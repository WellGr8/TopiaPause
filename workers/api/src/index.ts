import { ENGINE_VERSION, evaluate, lockExplanation } from '@topiapause/guard-engine';
import {
  DEFAULT_POLICY,
  MockUBotAdapter,
  detectScene,
  extractIntentMock,
  scriptedChat,
  type AgentChatResponse,
  type ExecuteResponse,
  type GuardVerdict,
  type SceneId,
  type UserPolicy,
} from '@topiapause/shared';
import { HttpError, corsHeaders, json, log, rateLimit, readBody, type AppEnv } from './http';
import { llmChat, llmConfigured } from './llm';
import { AgentChatRequest, ExecuteRequest, GuardCheckRequest, TtsRequest } from './schemas';
import { tts, ttsConfigured } from './tts';

// One Worker serves the built web app (static assets) and /api/*.
// Guard check is the public API any agent can call; numbers only come from guard-engine.

const ubot = new MockUBotAdapter();
const SCENE_OF = { subscription: 'subscription', stay: 'stay', token_swap: 'crypto' } as const;

function health(env: AppEnv): Response {
  return json({
    ok: true,
    engineVersion: ENGINE_VERSION,
    agent: ubot.label,
    llm: llmConfigured(env) ? 'llm' : 'scripted',
    tts: ttsConfigured(env) ? 'elevenlabs' : 'unavailable',
  });
}

async function guardCheck(req: Request): Promise<Response> {
  const body = await readBody(req, GuardCheckRequest);
  const scene: SceneId = SCENE_OF[body.proposal.kind];
  const intent = body.intent ?? extractIntentMock(body.userText, detectScene(body.userText) ?? scene, body.lang);
  const policy = (body.policy ?? DEFAULT_POLICY) as UserPolicy;
  let verdict: GuardVerdict;
  try {
    verdict = evaluate({ intent, proposal: body.proposal, policy, lang: body.lang });
  } catch (e) {
    log({ message: 'guard evaluate failed', error: e instanceof Error ? e.message : String(e) });
    throw new HttpError(422, 'unprocessable', 'Proposal or policy could not be evaluated');
  }
  // TODO(LLM explanation): pass an LLM draft here; lockExplanation rejects numbers the engine didn't produce.
  verdict = { ...verdict, explanation: lockExplanation(undefined, verdict) };
  log({ message: 'guard check', kind: body.proposal.kind, decision: verdict.decision, findings: verdict.findings.map((f) => f.ruleId) });
  return json(verdict);
}

async function agentChat(req: Request, env: AppEnv): Promise<Response> {
  const body = await readBody(req, AgentChatRequest);
  const llm = await llmChat(env, body);
  if (llm) {
    const scene = llm.scene;
    const scripted = scene ? scriptedChat({ message: body.message, scene: body.scene ?? scene, lang: body.lang }) : undefined;
    const intent = scene ? (scripted?.intent ?? extractIntentMock(body.message, scene, body.lang)) : undefined;
    const res: AgentChatResponse & { scene?: SceneId } = { reply: llm.reply, proposal: llm.proposal, intent, scene, source: 'llm' };
    return json(res);
  }
  const turn = scriptedChat(body);
  const res: AgentChatResponse & { scene?: SceneId } = { reply: turn.reply, proposal: turn.proposal, intent: turn.intent, scene: turn.scene, source: 'scripted' };
  return json(res);
}

async function execute(req: Request): Promise<Response> {
  const body = await readBody(req, ExecuteRequest);
  const res: ExecuteResponse = { execution: await ubot.execute(body) };
  return json(res);
}

async function voiceTts(req: Request, env: AppEnv, ctx?: ExecutionContext): Promise<Response> {
  const body = await readBody(req, TtsRequest);
  return tts(env, body.text, ctx);
}

type Handler = (req: Request, env: AppEnv, ctx?: ExecutionContext) => Promise<Response> | Response;

const ROUTES: Record<string, { handler: Handler; bucket?: 'api' | 'paid' }> = {
  'GET /api/health': { handler: (_r, env) => health(env) },
  'POST /api/guard/check': { handler: guardCheck, bucket: 'api' },
  'POST /api/agent/chat': { handler: agentChat, bucket: 'paid' },
  'POST /api/agent/execute': { handler: execute, bucket: 'api' },
  'POST /api/voice/tts': { handler: voiceTts, bucket: 'paid' },
};

export async function handleApi(req: Request, env: AppEnv, ctx?: ExecutionContext): Promise<Response> {
  const url = new URL(req.url);
  const cors = corsHeaders(req, env, url.pathname);
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const started = Date.now();
  let res: Response;
  try {
    const route = ROUTES[`${req.method} ${url.pathname}`];
    if (!route) {
      const known = Object.keys(ROUTES).some((k) => k.endsWith(` ${url.pathname}`));
      throw known ? new HttpError(405, 'method_not_allowed', 'Method not allowed') : new HttpError(404, 'not_found', 'Unknown API route');
    }
    if (route.bucket) await rateLimit(route.bucket === 'paid' ? env.RATE_LIMITER_PAID : env.RATE_LIMITER, req, route.bucket);
    res = await route.handler(req, env, ctx);
  } catch (e) {
    if (e instanceof HttpError) res = e.toResponse();
    else {
      log({ message: 'unhandled error', path: url.pathname, error: e instanceof Error ? e.message : String(e) });
      res = new HttpError(500, 'internal', 'Internal error').toResponse();
    }
  }
  log({ message: 'api request', method: req.method, path: url.pathname, status: res.status, ms: Date.now() - started });
  const out = new Response(res.body, res);
  for (const [k, v] of Object.entries(cors)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(req, env, ctx): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    return handleApi(req, env, ctx);
  },
} satisfies ExportedHandler<AppEnv>;
