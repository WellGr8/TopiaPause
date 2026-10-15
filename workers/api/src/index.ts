import { ENGINE_VERSION, evaluate, lockExplanation } from '@topiapause/guard-engine';
import {
  MockUBotAdapter,
  deriveIntent,
  estimateCostThb,
  extractIntentMock,
  policyLoosens,
  isWhyQuestion,
  scriptedChat,
  type AgentChatResponse,
  type AgentProposal,
  type CheckMeta,
  type ExecuteResponse,
  type GuardVerdict,
  type MarketData,
  type SceneId,
} from '@topiapause/shared';
import { genericToProposal } from './generic';
import { HttpError, assertSameOrigin, corsHeaders, isolateRateLimit, json, log, parseJson, rateLimit, readBody, readJson, type AppEnv } from './http';
import { llmChat, llmConfigured } from './llm';
import { AgentChatRequest, ConfirmRequest, ExecuteRequest, GenericCheck, PolicyRequest, ProposalCheck, TtsRequest } from './schemas';
import { issueConfirmation, issueTicket, mintPolicyToken, mintSession, policyFrom, redeemTicket, sessionCookie, verifySession, whyFromTicket } from './signing';
import { upcomingUnlocks, type MarketFetch } from './tokenomist';
import { readAudio, sttConfigured, transcribe } from './stt';
import { tts, ttsConfigured } from './tts';
import { resolveTts } from './voiceAllow';

// One Worker serves the built web app (static assets) and /api/*.
// Guard check is the public API any agent can call; numbers only come from guard-engine.
// Trust boundary: the agent supplies a proposal and the user's message verbatim. The policy comes
// from a token the user's app minted, and intent is derived here, so an agent can't relax either.

const ubot = new MockUBotAdapter();
const SCENE_OF = { subscription: 'subscription', stay: 'stay', token_swap: 'crypto' } as const;

function health(env: AppEnv): Response {
  return json({
    ok: true,
    engineVersion: ENGINE_VERSION,
    agent: ubot.label,
    llm: llmConfigured(env) ? 'llm' : 'scripted',
    tts: ttsConfigured(env) ? 'elevenlabs' : 'unavailable',
    stt: sttConfigured(env) ? 'elevenlabs' : 'unavailable',
    marketData: env.TOKENOMIST_API_KEY ? 'tokenomist' : 'sample',
  });
}

async function guardCheck(req: Request, env: AppEnv, ctx?: ExecutionContext): Promise<Response> {
  const started = Date.now();
  const raw = await readJson(req);
  if (raw && typeof raw === 'object') {
    if ('policy' in raw) throw new HttpError(400, 'agent_policy_rejected', 'Agents cannot send a policy. Pass the policyToken issued to the user app, or omit it for the default policy.');
    if ('intent' in raw) throw new HttpError(400, 'agent_intent_rejected', 'Agents cannot send intent. Pass the user message verbatim as userMessage; TopiaPause derives intent from it.');
  }
  const generic = raw && typeof raw === 'object' && 'action' in raw;
  const body = generic ? parseJson(raw, GenericCheck) : parseJson(raw, ProposalCheck);
  const proposal = 'action' in body ? genericToProposal(body) : (body.proposal as AgentProposal);
  const scene: SceneId = SCENE_OF[proposal.kind];
  const { policy, source: policySource } = await policyFrom(env, body.policyToken);
  const intent = deriveIntent(body.userMessage, scene, body.lang);

  let market: MarketFetch | undefined;
  if (proposal.kind === 'token_swap') market = await upcomingUnlocks(env, ctx);
  const marketData: MarketData | undefined = market?.market;

  let verdict: GuardVerdict;
  try {
    verdict = evaluate({
      intent,
      proposal,
      policy,
      lang: body.lang,
      market: marketData,
      sources: body.sources,
      now: marketData?.source === 'sample' ? marketData.asOf : new Date().toISOString(),
    });
  } catch (e) {
    log({ message: 'guard evaluate failed', error: e instanceof Error ? e.message : String(e) });
    throw new HttpError(422, 'unprocessable', 'Proposal could not be evaluated');
  }
  // The public check never calls an LLM. The template is the explanation, so the meter stays at 0.
  verdict = { ...verdict, explanation: lockExplanation(undefined, verdict) };
  verdict.verdictId = await issueTicket(env, verdict, proposal);

  const externalCalls = market?.externalCalls ?? 0;
  const llmCalls = 0;
  const check: CheckMeta = {
    where: 'worker',
    engine: 'rules',
    llmCalls,
    externalCalls,
    cacheHit: market?.cacheHit ?? false,
    dataAge: market?.dataAge ?? null,
    estCostTHB_satang: estimateCostThb({ workerRequests: 1, doRequests: 1, tokenomistCalls: externalCalls }).minor,
    latencyMs: Date.now() - started,
    estimate: true,
  };
  verdict.check = check;
  log({
    message: 'guard check',
    agent: 'agent' in body ? body.agent.name : proposal.agent.name,
    kind: proposal.kind,
    decision: verdict.decision,
    findings: verdict.findings.map((f) => f.ruleId),
    policy: policySource,
    sources: body.sources?.length ?? 0,
    notes: verdict.notes.map((n) => `${n.kind}:${n.severity}`),
  });
  return json(verdict);
}

async function issueSession(req: Request, env: AppEnv): Promise<Response> {
  const site = req.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'none') {
    throw new HttpError(403, 'forbidden_origin', 'Sessions are issued to the TopiaPause app only');
  }
  assertSameOrigin(req, env);
  const minted = await mintSession(env, req);
  return json(minted, 200, { 'Set-Cookie': sessionCookie(minted.session) });
}

async function policyToken(req: Request, env: AppEnv): Promise<Response> {
  const body = await readBody(req, PolicyRequest);
  // A body flag is not a user. Looser rules stay in the browser; this API only tightens.
  if (policyLoosens(body.policy)) {
    throw new HttpError(400, 'policy_loosening_rejected', 'The API only accepts a policy that is as strict as the default or stricter');
  }
  return json(await mintPolicyToken(env, body.policy));
}

async function confirmChoice(req: Request, env: AppEnv): Promise<Response> {
  const body = await readBody(req, ConfirmRequest);
  return json({ confirmation: await issueConfirmation(env, body.verdictId, body.choice) });
}

async function agentChat(req: Request, env: AppEnv): Promise<Response> {
  const body = await readBody(req, AgentChatRequest);
  if (isWhyQuestion(body.message)) {
    return json({ reply: await whyFromTicket(env, body.verdictId, body.lang), source: 'scripted' });
  }
  const history = (body.history ?? []).slice(-4);
  const llm = await llmChat(env, { ...body, history });
  if (llm) {
    const scene = llm.scene;
    const scripted = scene ? scriptedChat({ message: body.message, scene: body.scene ?? scene, lang: body.lang }) : undefined;
    const intent = scene ? (scripted?.intent ?? extractIntentMock(body.message, scene, body.lang)) : undefined;
    const res: AgentChatResponse & { scene?: SceneId; chip?: SceneId } = {
      reply: llm.reply,
      proposal: llm.proposal,
      intent,
      scene,
      chip: llm.chip,
      source: 'llm',
    };
    return json(res);
  }
  const turn = scriptedChat(body);
  const res: AgentChatResponse & { scene?: SceneId } = { reply: turn.reply, proposal: turn.proposal, intent: turn.intent, scene: turn.scene, source: 'scripted' };
  return json(res);
}

async function execute(req: Request, env: AppEnv): Promise<Response> {
  const body = await readBody(req, ExecuteRequest);
  const proposal = body.proposal as AgentProposal;
  await redeemTicket(env, body.verdictId, proposal, body.confirmation);
  const res: ExecuteResponse = { execution: await ubot.execute({ ...body, proposal }) };
  return json(res);
}

async function voiceTts(req: Request, env: AppEnv, ctx?: ExecutionContext): Promise<Response> {
  const body = await readBody(req, TtsRequest);
  return tts(env, resolveTts(body), ctx);
}

function sttLang(req: Request): 'th' | 'en' {
  const query = new URL(req.url).searchParams.get('lang');
  const header = req.headers.get('X-TopiaPause-Lang');
  return (query || header || 'th').toLowerCase() === 'en' ? 'en' : 'th';
}

async function voiceStt(req: Request, env: AppEnv): Promise<Response> {
  const audio = await readAudio(req);
  return json(await transcribe(env, audio, sttLang(req)));
}

type Handler = (req: Request, env: AppEnv, ctx?: ExecutionContext) => Promise<Response> | Response;

const ROUTES: Record<string, { handler: Handler; bucket?: 'api' | 'paid'; app?: boolean; session?: boolean; paidKey?: 'chat' | 'tts' | 'stt'; isolateLimit?: number }> = {
  'GET /api/health': { handler: (_r, env) => health(env) },
  'POST /api/guard/check': { handler: guardCheck, bucket: 'api' },
  'POST /api/session': { handler: issueSession, bucket: 'api', app: true },
  'POST /api/policy': { handler: policyToken, bucket: 'api', session: true },
  'POST /api/confirm': { handler: confirmChoice, bucket: 'api', session: true },
  'POST /api/agent/chat': { handler: agentChat, bucket: 'paid', session: true, paidKey: 'chat' },
  'POST /api/agent/execute': { handler: execute, bucket: 'api' },
  'POST /api/voice/tts': { handler: voiceTts, bucket: 'paid', session: true, paidKey: 'tts' },
  'POST /api/voice/stt': { handler: voiceStt, bucket: 'paid', session: true, paidKey: 'stt', isolateLimit: 10 },
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
    if (route.session || route.app) assertSameOrigin(req, env);
    if (route.session) await verifySession(env, req);
    if (route.bucket === 'paid') isolateRateLimit(req, url.pathname, route.isolateLimit);
    if (route.paidKey === 'stt') await rateLimit(env.RATE_LIMITER_STT, req, 'stt');
    else if (route.paidKey) await rateLimit(env.RATE_LIMITER_PAID, req, route.paidKey);
    else if (route.bucket) await rateLimit(env.RATE_LIMITER, req, route.bucket);
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

export { VerdictLedger } from './ledger';

export default {
  async fetch(req, env, ctx): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    return handleApi(req, env, ctx);
  },
} satisfies ExportedHandler<AppEnv>;
