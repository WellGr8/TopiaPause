import { evaluate } from '@topiapause/guard-engine';
import { DEFAULT_POLICY, SCENES, sceneIntent, type AgentProposal, type SceneId } from '@topiapause/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import worker from '../src/index';
import type { AppEnv } from '../src/http';

const assetFetch = vi.fn(async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }));

function makeEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    ASSETS: { fetch: assetFetch } as unknown as Fetcher,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    RATE_LIMITER_PAID: { limit: async () => ({ success: true }) },
    LLM_BASE_URL: 'https://llm.example/v1',
    LLM_MODEL: '',
    ELEVENLABS_VOICE_ID: '',
    ELEVENLABS_MODEL_ID: 'eleven_v3',
    ALLOWED_ORIGIN: '',
    ...overrides,
  } as AppEnv;
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

function call(path: string, init: RequestInit & { json?: unknown } = {}, env = makeEnv()): Promise<Response> {
  const { json, ...rest } = init;
  const req = new Request(`https://topiapause.test${path}`, {
    method: json !== undefined ? 'POST' : (rest.method ?? 'GET'),
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers as Record<string, string>) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  return worker.fetch(req as Request<unknown, IncomingRequestCfProperties>, env, ctx);
}

const scene = (id: SceneId) => ({ userText: SCENES[id].userText.th, proposal: SCENES[id].buildProposal({}) as AgentProposal });

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('GET /api/health', () => {
  it('reports fallback modes without keys', async () => {
    const res = await call('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, llm: 'scripted', tts: 'unavailable', agent: 'U-Bot (mock)' });
  });
  it('never leaks secrets', async () => {
    const res = await call('/api/health', {}, makeEnv({ LLM_API_KEY: 'sk-secret', LLM_MODEL: 'm', ELEVENLABS_API_KEY: 'xi-secret', ELEVENLABS_VOICE_ID: 'v' }));
    const text = await res.text();
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toMatchObject({ llm: 'llm', tts: 'elevenlabs' });
  });
});

describe('POST /api/guard/check', () => {
  it.each(['subscription', 'stay', 'crypto'] as const)('pauses the %s scene with a re-checked counter-offer', async (id) => {
    const res = await call('/api/guard/check', { json: { ...scene(id), lang: 'th' } });
    expect(res.status).toBe(200);
    const v = await res.json<Record<string, any>>();
    expect(v.decision).toBe('pause');
    expect(v.counterOffer.recheck).toBe('allow');
    expect(v.explanation.source).toBe('template');
  });

  it('returns exactly the engine numbers (crypto a_max = $200)', async () => {
    const s = scene('crypto');
    const res = await call('/api/guard/check', { json: { ...s, lang: 'en', intent: sceneIntent('crypto', s.userText, 'en') } });
    const v = await res.json<Record<string, any>>();
    const local = evaluate({ intent: sceneIntent('crypto', s.userText, 'en'), proposal: s.proposal, policy: DEFAULT_POLICY, lang: 'en' });
    expect(v.metrics).toEqual(local.metrics);
    expect(v.metrics.aMaxUsd).toBe(200);
    expect(v.counterOffer.proposal.amountIn.amount).toBe(200);
    expect(v.counterOffer.proposal.approval.type).toBe('exact');
  });

  it('allows a proposal that matches intent', async () => {
    const proposal = { ...SCENES.subscription.buildProposal({}), planId: 'pixelpro-monthly', planName: 'PixelPro Monthly', price: { amount: 299, currency: 'THB' }, interval: 'month', trialDays: 7 };
    const res = await call('/api/guard/check', { json: { userText: 'I want to try the PixelPro photo app', proposal, lang: 'en' } });
    expect((await res.json<Record<string, any>>()).decision).toBe('allow');
  });

  it('is CORS-enabled for any origin, including preflight', async () => {
    const pre = await call('/api/guard/check', { method: 'OPTIONS', headers: { Origin: 'https://agent.example' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const res = await call('/api/guard/check', { json: { ...scene('stay'), lang: 'th' }, headers: { Origin: 'https://agent.example' } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects invalid input with a zod message', async () => {
    const res = await call('/api/guard/check', { json: { userText: 'hi', proposal: { kind: 'yacht' } } });
    expect(res.status).toBe(400);
    const body = await res.json<Record<string, any>>();
    expect(body.error.code).toBe('invalid_input');
    expect(body.error.message).toContain('proposal');
  });

  it('rejects negative amounts', async () => {
    const s = scene('crypto');
    const res = await call('/api/guard/check', { json: { ...s, proposal: { ...s.proposal, amountIn: { amount: -5, currency: 'USDT' } } } });
    expect(res.status).toBe(400);
  });

  it('rejects bad JSON, wrong content type and oversized bodies', async () => {
    expect((await call('/api/guard/check', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } })).status).toBe(400);
    expect((await call('/api/guard/check', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } })).status).toBe(415);
    const big = { ...scene('stay'), userText: 'x', padding: 'y'.repeat(40_000) };
    expect((await call('/api/guard/check', { json: big })).status).toBe(413);
  });

  it('rate-limits per client', async () => {
    const env = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const res = await call('/api/guard/check', { json: scene('stay') }, env);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });
});

describe('POST /api/agent/chat', () => {
  it('falls back to the scripted mock without an LLM key', async () => {
    const res = await call('/api/agent/chat', { json: { message: SCENES.subscription.userText.th, scene: 'subscription', lang: 'th' } });
    const body = await res.json<Record<string, any>>();
    expect(body.source).toBe('scripted');
    expect(body.proposal.kind).toBe('subscription');
    expect(body.intent.commitment).toBe('trial');
  });

  it('uses an OpenAI-compatible LLM and restores catalog facts', async () => {
    const fake = SCENES.crypto.buildProposal({ amount: 300 }) as Extract<AgentProposal, { kind: 'token_swap' }>;
    const tampered = { ...fake, portfolio: { totalUsd: 1e9, holdingsUsd: {}, balances: { USDT: 1e9 } } };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'Swapping 300 USDT now.', scene: 'crypto', proposal: tampered }) } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' });
    const res = await call('/api/agent/chat', { json: { message: 'swap 300 USDT to TOKEN-X once', lang: 'en' } }, env);
    const body = await res.json<Record<string, any>>();
    expect(body.source).toBe('llm');
    expect(body.proposal.amountIn.amount).toBe(300);
    expect(body.proposal.portfolio).toEqual(fake.portfolio);
    expect(body.intent.goal).toBe('swap_token');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://llm.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    expect(JSON.parse(String(init.body))).toMatchObject({ model: 'test-model', response_format: { type: 'json_object' } });
    expect(JSON.stringify(body)).not.toContain('sk-test');
  });

  it('falls back when the LLM returns junk', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ message: { content: '{"reply": 5}' } }] })));
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' });
    const res = await call('/api/agent/chat', { json: { message: SCENES.stay.userText.en, lang: 'en' } }, env);
    const body = await res.json<Record<string, any>>();
    expect(body.source).toBe('scripted');
    expect(body.proposal.kind).toBe('stay');
  });

  it('uses the paid rate limit bucket', async () => {
    const env = makeEnv({ RATE_LIMITER_PAID: { limit: async () => ({ success: false }) } });
    expect((await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' } }, env)).status).toBe(429);
  });
});

describe('POST /api/voice/tts', () => {
  it('answers 503 with a clear message when ElevenLabs is not configured', async () => {
    const res = await call('/api/voice/tts', { json: { text: 'สวัสดี', lang: 'th' } });
    expect(res.status).toBe(503);
    const body = await res.json<Record<string, any>>();
    expect(body.error.code).toBe('tts_unavailable');
    expect(body.error.message).toContain('ELEVENLABS_API_KEY');
  });

  it('streams mp3 from ElevenLabs with the server-side key and eleven_v3', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { headers: { 'Content-Type': 'audio/mpeg' } }));
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ ELEVENLABS_API_KEY: 'xi-test', ELEVENLABS_VOICE_ID: 'voice123' });
    const res = await call('/api/voice/tts', { json: { text: 'หยุดก่อนครับ', lang: 'th' } }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90]));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/v1/text-to-speech/voice123');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('xi-test');
    expect(JSON.parse(String(init.body))).toEqual({ text: 'หยุดก่อนครับ', model_id: 'eleven_v3' });
  });

  it('returns 502 when ElevenLabs fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    const env = makeEnv({ ELEVENLABS_API_KEY: 'xi-test', ELEVENLABS_VOICE_ID: 'voice123' });
    expect((await call('/api/voice/tts', { json: { text: 'hi', lang: 'en' } }, env)).status).toBe(502);
  });
});

describe('POST /api/agent/execute', () => {
  it('requires explicit confirmation', async () => {
    const res = await call('/api/agent/execute', { json: { proposal: scene('stay').proposal, verdictId: 'v1' } });
    expect(res.status).toBe(400);
  });
  it('returns a mock execution', async () => {
    const res = await call('/api/agent/execute', { json: { proposal: scene('stay').proposal, verdictId: 'v1', userConfirmed: true } });
    const body = await res.json<Record<string, any>>();
    expect(body.execution).toMatchObject({ mode: 'mock', status: 'success' });
    expect(body.execution.ref).toMatch(/^mock-tx-/);
  });
});

describe('routing', () => {
  it('404s unknown API routes and 405s wrong methods', async () => {
    expect((await call('/api/nope')).status).toBe(404);
    expect((await call('/api/guard/check')).status).toBe(405);
  });
  it('keeps non-public routes same-origin', async () => {
    const res = await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers: { Origin: 'https://evil.example' } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });
  it('serves the web app for non-API paths', async () => {
    const res = await call('/activity');
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(assetFetch).toHaveBeenCalled();
  });
});
