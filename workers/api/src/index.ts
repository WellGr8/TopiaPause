import { evaluate, lockExplanation } from '@topiapause/guard-engine';
import {
  MockUBotAdapter,
  extractIntentMock,
  detectScene,
  type AgentChatRequest,
  type AgentChatResponse,
  type ApiError,
  type ExecuteRequest,
  type ExecuteResponse,
  type GuardCheckRequest,
  type GuardVerdict,
  type Lang,
  type SceneId,
} from '@topiapause/shared';

// Thin API stubs (ARCHITECTURE §6). The guard check is real (same pure engine as the
// web app). LLM, ElevenLabs and Tokenomist calls are TODO; without keys every route
// answers with deterministic scripted responses so the demo never depends on them.

/** Optional secrets: set via `.dev.vars` locally or `wrangler secret put`. Absent = mock mode. */
interface Secrets {
  LLM_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  TOKENOMIST_API_KEY?: string;
}
type AppEnv = Env & Secrets;

const MAX_BODY = 32 * 1024;
const ubot = new MockUBotAdapter();

function json(data: unknown, status: number, env: AppEnv, req: Request): Response {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...cors(env, req) } });
}

function fail(code: string, message: string, status: number, env: AppEnv, req: Request): Response {
  const body: ApiError = { error: { code, message } };
  return json(body, status, env, req);
}

function cors(env: AppEnv, req: Request): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (!origin || !env.ALLOWED_ORIGIN || origin !== env.ALLOWED_ORIGIN) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    Vary: 'Origin',
  };
}

async function readJson<T>(req: Request): Promise<T | null> {
  const len = Number(req.headers.get('Content-Length') ?? 0);
  if (len > MAX_BODY) return null;
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return null;
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

const isLang = (v: unknown): v is Lang => v === 'th' || v === 'en';
const isScene = (v: unknown): v is SceneId => v === 'subscription' || v === 'stay' || v === 'crypto';
const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

async function chat(req: Request, env: AppEnv): Promise<Response> {
  const body = await readJson<AgentChatRequest>(req);
  if (!body || typeof body.message !== 'string' || !body.message.trim() || !isLang(body.lang)) {
    return fail('invalid_input', 'Expected { sessionId, message, lang, scene?, policy }', 400, env, req);
  }
  if (body.scene !== undefined && !isScene(body.scene)) return fail('invalid_input', 'Unknown scene', 400, env, req);
  // TODO(LLM): when env.LLM_API_KEY is set, plan with the hosted LLM (JSON schema) and validate against the scene catalog.
  const turn = await ubot.chat({ sessionId: String(body.sessionId ?? ''), message: body.message, scene: body.scene, lang: body.lang });
  const res: AgentChatResponse = { ...turn, source: 'scripted' };
  return json(res, 200, env, req);
}

async function guardCheck(req: Request, env: AppEnv): Promise<Response> {
  const body = await readJson<GuardCheckRequest>(req);
  if (!body || typeof body.userText !== 'string' || !isObj(body.proposal) || !isObj(body.policy) || !isLang(body.lang)) {
    return fail('invalid_input', 'Expected { userText, proposal, policy, lang, intent? }', 400, env, req);
  }
  const kind = (body.proposal as { kind?: unknown }).kind;
  if (kind !== 'subscription' && kind !== 'stay' && kind !== 'token_swap') {
    return fail('invalid_input', 'Unknown proposal kind', 400, env, req);
  }
  const scene: SceneId = kind === 'token_swap' ? 'crypto' : kind;
  // TODO(LLM): extract ActionIntent with the LLM (schema-validated) when env.LLM_API_KEY is set.
  const intent = body.intent ?? extractIntentMock(body.userText, detectScene(body.userText) ?? scene, body.lang);
  let verdict: GuardVerdict;
  try {
    verdict = evaluate({ intent, proposal: body.proposal, policy: body.policy, lang: body.lang });
  } catch (e) {
    console.error(JSON.stringify({ message: 'guard evaluate failed', error: e instanceof Error ? e.message : String(e) }));
    return fail('invalid_input', 'Proposal or policy could not be evaluated', 400, env, req);
  }
  // TODO(LLM): ask the LLM to explain `verdict`; lockExplanation() rejects any number not produced by the engine.
  verdict = { ...verdict, explanation: lockExplanation(undefined, verdict) };
  return json(verdict, 200, env, req);
}

async function execute(req: Request, env: AppEnv): Promise<Response> {
  const body = await readJson<ExecuteRequest>(req);
  if (!body || !isObj(body.proposal) || typeof body.verdictId !== 'string' || body.userConfirmed !== true) {
    return fail('confirmation_required', 'Execution needs { proposal, verdictId, userConfirmed: true }', 400, env, req);
  }
  const res: ExecuteResponse = { execution: await ubot.execute(body) };
  return json(res, 200, env, req);
}

function notImplemented(feature: string, env: AppEnv, req: Request): Response {
  return fail('not_implemented', `${feature} is a TODO stub. The web app falls back to pre-generated clips / browser speech.`, 501, env, req);
}

export default {
  async fetch(req: Request, env: AppEnv): Promise<Response> {
    const url = new URL(req.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(req);
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(env, req) });

    const route = `${req.method} ${url.pathname}`;
    console.log(JSON.stringify({ message: 'api request', route }));
    switch (route) {
      case 'GET /api/health':
        return json(
          {
            ok: true,
            adapter: ubot.label,
            mode: { llm: env.LLM_API_KEY ? 'configured (TODO)' : 'scripted', tts: env.ELEVENLABS_API_KEY ? 'configured (TODO)' : 'browser-fallback' },
          },
          200,
          env,
          req,
        );
      case 'POST /api/agent/chat':
        return chat(req, env);
      case 'POST /api/guard/check':
        return guardCheck(req, env);
      case 'POST /api/agent/execute':
        return execute(req, env);
      case 'POST /api/voice/tts':
        // TODO(ElevenLabs): POST https://api.elevenlabs.io/v1/text-to-speech/{voice_id} with xi-api-key = env.ELEVENLABS_API_KEY,
        // model_id = TH: env.ELEVENLABS_MODEL_TH (Eleven v3, id to verify) / EN: env.ELEVENLABS_MODEL_EN; max 400 chars, cache by hash.
        return notImplemented('ElevenLabs TTS', env, req);
      case 'POST /api/voice/stt':
        return notImplemented('ElevenLabs Scribe STT', env, req);
      case 'GET /api/market/unlocks':
        return notImplemented('Tokenomist unlocks', env, req);
      default:
        return fail('not_found', 'Unknown API route', 404, env, req);
    }
  },
} satisfies ExportedHandler<AppEnv>;
