import { evaluate } from '@topiapause/guard-engine';
import { DEFAULT_POLICY, SCENES, sceneIntent, type AgentProposal, type SceneId, type UserPolicy } from '@topiapause/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import attackPolicy from '../../../scripts/demo/attack-policy.json';
import shopCrypto from '../../../scripts/demo/crypto.json';
import shopInjection from '../../../scripts/demo/injection.json';
import shopStay from '../../../scripts/demo/stay.json';
import shopSubscription from '../../../scripts/demo/subscription.json';
import worker from '../src/index';
import type { AppEnv } from '../src/http';
import { resetTokenomistCache } from '../src/tokenomist';

const assetFetch = vi.fn(async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }));
const ORIGIN = 'https://topiapause.test';

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
    POLICY_SIGNING_KEY: 'test-signing-key',
    ...overrides,
  } as AppEnv;
}

const ctx = { waitUntil: () => {}, passThroughOnException: () => {} } as unknown as ExecutionContext;

function call(path: string, init: RequestInit & { json?: unknown } = {}, env = makeEnv()): Promise<Response> {
  const { json, ...rest } = init;
  const req = new Request(`${ORIGIN}${path}`, {
    method: json !== undefined ? 'POST' : (rest.method ?? 'GET'),
    ...rest,
    headers: { ...(json !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(rest.headers as Record<string, string>) },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  return worker.fetch(req as Request<unknown, IncomingRequestCfProperties>, env, ctx);
}

type V = Record<string, any>;
const check = async (body: unknown, env?: AppEnv) => {
  const res = await call('/api/guard/check', { json: body }, env);
  return { res, v: (await res.json()) as V };
};
const scene = (id: SceneId, lang: 'th' | 'en' = 'th') => ({ userMessage: SCENES[id].userText[lang], proposal: SCENES[id].buildProposal({}) as AgentProposal, lang });

async function mint(policy: UserPolicy, env?: AppEnv): Promise<string> {
  const res = await call('/api/policy', { json: { policy }, headers: { Origin: ORIGIN } }, env);
  expect(res.status).toBe(200);
  return ((await res.json()) as V).policyToken;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  resetTokenomistCache();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('GET /api/health', () => {
  it('reports fallback modes without keys', async () => {
    const res = await call('/api/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, llm: 'scripted', tts: 'unavailable', agent: 'U-Bot (mock)', marketData: 'sample' });
  });
  it('never leaks secrets', async () => {
    const env = makeEnv({ LLM_API_KEY: 'sk-secret', LLM_MODEL: 'm', ELEVENLABS_API_KEY: 'xi-secret', ELEVENLABS_VOICE_ID: 'v', TOKENOMIST_API_KEY: 'tk-secret', POLICY_SIGNING_KEY: 'hmac-secret' });
    const text = await (await call('/api/health', {}, env)).text();
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toMatchObject({ llm: 'llm', tts: 'elevenlabs', marketData: 'tokenomist' });
  });
});

describe('POST /api/guard/check', () => {
  it.each(['subscription', 'stay', 'crypto'] as const)('pauses the %s scene with a re-checked counter-offer', async (id) => {
    const { res, v } = await check(scene(id));
    expect(res.status).toBe(200);
    expect(v.decision).toBe('pause');
    expect(v.counterOffer.recheck).toBe('allow');
    expect(v.explanation.source).toBe('template');
  });

  it('returns exactly the engine numbers, in minor units (crypto a_max = 200.000000 USDT)', async () => {
    const s = scene('crypto', 'en');
    const { v } = await check(s);
    const local = evaluate({ intent: sceneIntent('crypto', s.userMessage, 'en'), proposal: s.proposal, policy: DEFAULT_POLICY, lang: 'en' });
    expect(v.metrics).toEqual(local.metrics);
    expect(v.amounts).toEqual(local.amounts);
    expect(v.breakdown).toEqual(local.breakdown);
    expect(v.amounts.aMax).toEqual({ minor: 200_000_000, currency: 'USDT' });
    expect(v.counterOffer.proposal.amountIn).toEqual({ minor: 200_000_000, currency: 'USDT' });
    expect(v.counterOffer.proposal.approval.type).toBe('exact');
  });

  it('allows a proposal that matches intent', async () => {
    const proposal = { ...SCENES.subscription.buildProposal({}), planId: 'pixelpro-monthly', planName: 'PixelPro Monthly', price: { minor: 29900, currency: 'THB' }, interval: 'month', trialDays: 7 };
    const { v } = await check({ userMessage: 'I want to try the PixelPro photo app', proposal, lang: 'en' });
    expect(v.decision).toBe('allow');
  });

  it('attaches the cost meter (estimate, rule-only, no AI calls)', async () => {
    const { v } = await check(scene('stay'));
    expect(v.check).toMatchObject({ where: 'worker', engine: 'rules', llmCalls: 0, externalCalls: 0, cacheHit: false, dataAge: null, estCostTHB_satang: 1, estimate: true });
    expect(v.check.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('receipt sections in the response reconcile to the minor unit', async () => {
    for (const id of ['subscription', 'stay', 'crypto'] as const) {
      const { v } = await check(scene(id));
      for (const s of v.breakdown) {
        const sum = s.lines.reduce((acc: number, l: V) => acc + (l.op === 'add' ? l.amount.minor : -l.amount.minor), 0);
        expect(sum).toBe(s.total.amount.minor);
      }
    }
  });

  it('is CORS-enabled for any origin, including preflight', async () => {
    const pre = await call('/api/guard/check', { method: 'OPTIONS', headers: { Origin: 'https://agent.example' } });
    expect(pre.status).toBe(204);
    expect(pre.headers.get('Access-Control-Allow-Origin')).toBe('*');
    const res = await call('/api/guard/check', { json: scene('stay'), headers: { Origin: 'https://agent.example' } });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  it('rejects invalid input with a zod message', async () => {
    const { res, v } = await check({ userMessage: 'hi', proposal: { kind: 'yacht' } });
    expect(res.status).toBe(400);
    expect(v.error.code).toBe('invalid_input');
    expect(v.error.message).toContain('proposal');
  });

  it('rejects negative, fractional and float-style money', async () => {
    const s = scene('crypto');
    for (const amountIn of [{ minor: -5, currency: 'USDT' }, { minor: 1.5, currency: 'USDT' }, { amount: 500, currency: 'USDT' }]) {
      expect((await check({ ...s, proposal: { ...s.proposal, amountIn } })).res.status).toBe(400);
    }
  });

  it('rejects bad JSON, wrong content type and oversized bodies', async () => {
    expect((await call('/api/guard/check', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } })).status).toBe(400);
    expect((await call('/api/guard/check', { method: 'POST', body: '{}', headers: { 'Content-Type': 'text/plain' } })).status).toBe(415);
    const big = { ...scene('stay'), padding: 'y'.repeat(40_000) };
    expect((await call('/api/guard/check', { json: big })).status).toBe(413);
  });

  it('keeps the template when an LLM explanation invents a number', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify({ th: 'ราคา 99999 บาท', en: 'The price is 99999.' }) } }] })),
    );
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' });
    const res = await call('/api/guard/check', { json: { ...scene('crypto'), lang: 'en' } }, env);
    const v = await res.json<Record<string, any>>();
    expect(res.status).toBe(200);
    expect(v.decision).toBe('pause');
    expect(v.explanation.source).toBe('template');
    expect(v.explanation.en).not.toContain('99999');
    expect(JSON.stringify(v)).not.toContain('sk-test');
  });

  it('accepts an LLM explanation that only uses engine numbers', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify({ th: 'เกินเพดาน 30% ซื้อได้ 200', en: 'Over the 30% cap, max is 200.' }) } }] })),
    );
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' });
    const res = await call('/api/guard/check', { json: { ...scene('crypto'), lang: 'en' } }, env);
    const v = await res.json<Record<string, any>>();
    expect(v.explanation.source).toBe('llm');
    expect(v.explanation.en).toBe('Over the 30% cap, max is 200.');
    expect(v.amounts.aMax).toEqual({ minor: 200_000_000, currency: 'USDT' });
  });

  it('keeps the template when the explainer is down', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' });
    const res = await call('/api/guard/check', { json: { ...scene('stay'), lang: 'th' } }, env);
    const v = await res.json<Record<string, any>>();
    expect(res.status).toBe(200);
    expect(v.decision).toBe('pause');
    expect(v.explanation.source).toBe('template');
  });

  it('rate-limits per client', async () => {
    const env = makeEnv({ RATE_LIMITER: { limit: async () => ({ success: false }) } });
    const res = await call('/api/guard/check', { json: scene('stay') }, env);
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
  });
});

describe('policy and intent are user-owned (the agent cannot relax them)', () => {
  const permissive: UserPolicy = {
    requireRefundableWhenFlexible: false,
    maxRefundablePremiumPct: 1000,
    tokenConcentrationCaps: { 'TOKEN-X': 1 },
    approvalMode: 'allow_unlimited',
    oneTimeApprovalMaxExpirySec: 31_536_000,
  };

  it('ATTACK: agent-supplied permissive policy is rejected (400), unlimited swap is never approved', async () => {
    const { res, v } = await check(attackPolicy);
    expect(res.status).toBe(400);
    expect(v.error.code).toBe('agent_policy_rejected');
    expect(v.decision).toBeUndefined();
    // The same proposal without the smuggled policy pauses under the user's rules.
    const { policy: _p, ...clean } = attackPolicy;
    expect((await check(clean)).v.decision).toBe('pause');
  });

  it('ATTACK: agent-supplied intent is rejected (400)', async () => {
    const s = scene('crypto', 'en');
    const { res, v } = await check({ ...s, intent: { ...sceneIntent('crypto', 'x', 'en'), commitment: 'ongoing' } });
    expect(res.status).toBe(400);
    expect(v.error.code).toBe('agent_intent_rejected');
  });

  it('ATTACK: a tampered or foreign policy token is rejected (401)', async () => {
    const token = await mint(DEFAULT_POLICY);
    const [body, mac] = token.split('.');
    const forgedBody = btoa(JSON.stringify({ v: 1, policy: permissive, exp: 9_999_999_999 })).replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
    for (const bad of [`${forgedBody}.${mac}`, `${body}.AAAA${mac!.slice(4)}`, 'not-a-token']) {
      const { res, v } = await check({ ...scene('crypto'), policyToken: bad });
      expect(res.status).toBe(401);
      expect(v.error.code).toBe('invalid_policy_token');
    }
    const other = await mint(permissive, makeEnv({ POLICY_SIGNING_KEY: 'someone-elses-key' }));
    expect((await check({ ...scene('crypto'), policyToken: other })).res.status).toBe(401);
  });

  it('a token minted by the user app applies the user policy', async () => {
    const strict = await mint({ ...DEFAULT_POLICY, monthlySubscriptionCap: { minor: 20000, currency: 'THB' } });
    const proposal = { ...SCENES.subscription.buildProposal({}), planId: 'pixelpro-monthly', price: { minor: 29900, currency: 'THB' }, interval: 'month', trialDays: 7 };
    const { v } = await check({ userMessage: 'I want to try PixelPro', proposal, lang: 'en', policyToken: strict });
    expect(v.decision).toBe('pause');
    expect(v.findings.map((f: V) => f.ruleId)).toContain('SUB_OVER_CAP');
  });

  it('expired policy tokens are rejected', async () => {
    const token = await mint(DEFAULT_POLICY);
    vi.useFakeTimers({ now: Date.now() + 31 * 24 * 3600 * 1000 });
    const { res, v } = await check({ ...scene('stay'), policyToken: token });
    expect(res.status).toBe(401);
    expect(v.error.code).toBe('expired_policy_token');
  });

  it('only the user app (same origin) can mint policy tokens', async () => {
    expect((await call('/api/policy', { json: { policy: permissive }, headers: { Origin: 'https://agent.example' } })).status).toBe(403);
    expect((await call('/api/policy', { json: { policy: permissive } })).status).toBe(403);
  });

  it('intent comes from the user message: "just try" pauses an annual plan whatever the agent claims', async () => {
    const s = scene('subscription', 'en');
    const { v } = await check({ ...s, userMessage: 'Sign me up for PixelPro, just to try it.', proposal: { ...s.proposal, summary: 'User asked for the annual plan' } });
    expect(v.findings.map((f: V) => f.ruleId)).toContain('SUB_COMMITMENT');
  });
});

describe('POST /api/agent/execute (verdict tickets)', () => {
  const exec = (proposal: unknown, verdictId: string) => call('/api/agent/execute', { json: { proposal, verdictId, userConfirmed: true } });

  it('requires explicit confirmation', async () => {
    const res = await call('/api/agent/execute', { json: { proposal: scene('stay').proposal, verdictId: 'v1' } });
    expect(res.status).toBe(400);
  });

  it('rejects unknown / forged verdict ids (403)', async () => {
    for (const id of ['v1', 'v-prop-123', 'eyJ2IjoxfQ.AAAA']) {
      const res = await exec(scene('stay').proposal, id);
      expect(res.status).toBe(403);
      expect(((await res.json()) as V).error.code).toBe('unknown_verdict');
    }
  });

  it('executes the cleared counter-offer once; a reuse is 409', async () => {
    const { v } = await check(scene('crypto'));
    const res = await exec(v.counterOffer.proposal, v.verdictId);
    expect(res.status).toBe(200);
    expect(((await res.json()) as V).execution).toMatchObject({ mode: 'mock', status: 'success' });
    const again = await exec(v.counterOffer.proposal, v.verdictId);
    expect(again.status).toBe(409);
    expect(((await again.json()) as V).error.code).toBe('verdict_used');
  });

  it('rejects a proposal the verdict did not cover (agent swaps in a bigger amount)', async () => {
    const { v } = await check(scene('crypto'));
    const bigger = { ...v.counterOffer.proposal, amountIn: { minor: 500_000_000, currency: 'USDT' }, approval: { ...v.counterOffer.proposal.approval, type: 'unlimited' } };
    const res = await exec(bigger, v.verdictId);
    expect(res.status).toBe(403);
    expect(((await res.json()) as V).error.code).toBe('proposal_not_cleared');
  });

  it('a blocked verdict clears nothing', async () => {
    const s = scene('crypto');
    const p = { ...s.proposal, amountIn: { minor: 600_000_000, currency: 'USDT' } };
    const { v } = await check({ ...s, userMessage: 'swap 600 USDT to TOKEN-X once', proposal: p });
    expect(v.decision).toBe('block');
    expect((await exec(p, v.verdictId)).status).toBe(403);
  });

  it('expires after 10 minutes', async () => {
    const { v } = await check(scene('stay'));
    vi.useFakeTimers({ now: Date.now() + 11 * 60 * 1000 });
    const res = await exec(v.counterOffer.proposal, v.verdictId);
    expect(res.status).toBe(403);
    expect(((await res.json()) as V).error.code).toBe('expired_verdict');
  });
});

describe('any-agent generic schema (ShopBot fixtures in scripts/demo/)', () => {
  it.each([
    ['subscription', shopSubscription, ['SUB_COMMITMENT', 'SUB_OVER_CAP'], 369100],
    ['stay', shopStay, ['STAY_FLEXIBILITY', 'STAY_HIDDEN_TOTAL'], -16100],
    ['crypto', shopCrypto, ['APPROVAL_EXPIRY', 'APPROVAL_SCOPE', 'CONC_CAP'], 300_000_000],
  ] as const)('%s: pauses with a counter-offer from the alternatives the agent saw', async (_n, body, rules, difference) => {
    const { res, v } = await check(body);
    expect(res.status).toBe(200);
    expect(v.decision).toBe('pause');
    expect(v.findings.map((f: V) => f.ruleId).sort()).toEqual(rules);
    expect(v.counterOffer.recheck).toBe('allow');
    expect(v.counterOffer.proposal.agent).toEqual({ name: 'ShopBot', adapter: 'external' });
    expect(v.amounts.difference.minor).toBe(difference);
  });

  it('injection: page text in `sources` triggers AGENT_FOLLOWED_UNTRUSTED with its own reason, no echo', async () => {
    const { v } = await check(shopInjection);
    expect(v.decision).toBe('pause');
    expect(v.findings[0]).toMatchObject({ ruleId: 'AGENT_FOLLOWED_UNTRUSTED', evidence: { sourceKind: 'web_page', pushed: 'yearly', asked: 'trial' } });
    expect(v.explanation.en).toContain('The web page told it to pick yearly, but you only asked to try.');
    expect(v.voiceText.clipId).toBe('injection-pause');
    expect(JSON.stringify([v.findings, v.explanation, v.voiceText, v.notes])).not.toContain('AI assistants');
    const { sources: _s, ...without } = shopInjection;
    expect((await check(without)).v.findings.map((f: V) => f.ruleId)).not.toContain('AGENT_FOLLOWED_UNTRUSTED');
  });

  it('sources are validated', async () => {
    expect((await check({ ...shopInjection, sources: [{ kind: 'sms', text: 'x' }] })).res.status).toBe(400);
  });

  it('accepts exact decimal strings and rejects extra precision', async () => {
    const usd = { ...shopSubscription, amount: { value: '9.99', currency: 'USD' }, action: { ...shopSubscription.action, interval: 'month' }, alternatives: [{ name: 'Lite', amount: { value: '8.99', currency: 'USD' }, interval: 'month', trialDays: 7 }] };
    const { v } = await check({ ...usd, userMessage: 'I want PixelPro long term' });
    expect(v.amounts.monthlyEquivalent).toEqual({ minor: 32468, currency: 'THB' });
    expect(v.findings.map((f: V) => f.ruleId)).toEqual(['SUB_OVER_CAP']);
    const bad = await check({ ...shopSubscription, amount: { value: '3990.001', currency: 'THB' } });
    expect(bad.res.status).toBe(400);
    expect(bad.v.error.message).toContain('2 decimals');
  });
});

describe('Tokenomist unlock data (crypto risk note)', () => {
  const v5 = {
    metadata: { queryDate: '2026-10-15T00:00:00Z' },
    status: true,
    data: [{ tokenSymbol: 'ARB', upcomingEvent: { unlockDate: new Date(Date.now() + 2 * 86_400_000).toISOString(), cliffUnlocks: { cliffValue: 3.9e7, valueToMarketCap: 2.5 } } }],
  };

  it('without a key: bundled sample, clearly labelled, no external call', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { v } = await check(scene('crypto', 'en'));
    expect(fetchMock).not.toHaveBeenCalled();
    const note = v.notes.find((n: V) => n.kind === 'unlock');
    expect(note).toMatchObject({ source: 'sample', severity: 'warn' });
    expect(note.text.en).toContain('sample data, not live');
    expect(v.check).toMatchObject({ externalCalls: 0, dataAge: null });
  });

  it('with a key: one live call (x-api-key), then shared cache for an hour', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => Response.json(v5));
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ TOKENOMIST_API_KEY: 'tk-test' });
    const first = (await check(scene('crypto', 'en'), env)).v;
    const second = (await check(scene('crypto', 'en'), env)).v;
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.tokenomist.ai/v5/unlock/events/upcoming');
    expect((init.headers as Record<string, string>)['x-api-key']).toBe('tk-test');
    expect(first.notes[0]).toMatchObject({ source: 'live', severity: 'warn' });
    expect(first.check).toMatchObject({ externalCalls: 1, cacheHit: false, dataAge: 0, estCostTHB_satang: 17 });
    expect(second.notes[0]).toMatchObject({ source: 'cache' });
    expect(second.check).toMatchObject({ externalCalls: 0, cacheHit: true, estCostTHB_satang: 1 });
    expect(JSON.stringify(first)).not.toContain('tk-test');
  });

  it('falls back to the sample on errors or an empty answer; the decision never depends on it', async () => {
    const env = makeEnv({ TOKENOMIST_API_KEY: 'tk-test' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 500 })));
    const failed = (await check(scene('crypto', 'en'), env)).v;
    expect(failed.notes[0].source).toBe('sample');
    resetTokenomistCache();
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...v5, data: [] })));
    const empty = (await check(scene('crypto', 'en'), env)).v;
    expect(empty.notes[0].source).toBe('sample');
    expect(failed.decision).toBe('pause');
    expect(empty.counterOffer.proposal.amountIn.minor).toBe(200_000_000);
  });

  it('is not fetched for non-crypto checks', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await check(scene('stay'), makeEnv({ TOKENOMIST_API_KEY: 'tk-test' }));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/agent/chat', () => {
  it('falls back to the scripted mock without an LLM key', async () => {
    const res = await call('/api/agent/chat', { json: { message: SCENES.subscription.userText.th, scene: 'subscription', lang: 'th' } });
    const body = (await res.json()) as V;
    expect(body.source).toBe('scripted');
    expect(body.proposal.kind).toBe('subscription');
    expect(body.intent.commitment).toBe('trial');
  });

  it('uses an OpenAI-compatible LLM and restores catalog facts', async () => {
    const fake = SCENES.crypto.buildProposal({ amountMinor: 300_000_000 }) as Extract<AgentProposal, { kind: 'token_swap' }>;
    const big = { minor: 1e12, currency: 'USDT' };
    const tampered = { ...fake, feePpm: 0, portfolio: { total: big, holdings: {}, balances: { USDT: big } } };
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) =>
      Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'Swapping 300 USDT now.', scene: 'crypto', proposal: tampered }) } }] }),
    );
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' });
    const res = await call('/api/agent/chat', { json: { message: 'swap 300 USDT to TOKEN-X once', lang: 'en' } }, env);
    const body = (await res.json()) as V;
    expect(body.source).toBe('llm');
    expect(body.proposal.amountIn).toEqual({ minor: 300_000_000, currency: 'USDT' });
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
    const body = (await res.json()) as V;
    expect(body.source).toBe('scripted');
    expect(body.proposal.kind).toBe('stay');
  });

  it('uses the paid rate limit bucket', async () => {
    const env = makeEnv({ RATE_LIMITER_PAID: { limit: async () => ({ success: false }) } });
    expect((await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' } }, env)).status).toBe(429);
  });

  it('matches natural phrasing without an LLM key', async () => {
    const cases = [
      ['I want to try PixelPro', 'en', 'subscription'],
      ['Book me somewhere to sleep near Asok tonight', 'en', 'stay'],
      ['ลองใช้ PixelPro หน่อย', 'th', 'subscription'],
    ] as const;
    for (const [message, lang, scene] of cases) {
      const res = await call('/api/agent/chat', { json: { message, lang } });
      expect(res.status).toBe(200);
      const body = await res.json<Record<string, any>>();
      expect(body.source).toBe('scripted');
      expect(body.scene).toBe(scene);
      expect(body.proposal).toBeTruthy();
    }
  });

  it('names the three chips when free text matches nothing', async () => {
    const res = await call('/api/agent/chat', { json: { message: 'what is the weather', lang: 'en' } });
    const body = await res.json<Record<string, any>>();
    expect(body.proposal).toBeUndefined();
    expect(body.reply).toContain('Try PixelPro app');
    expect(body.reply).toContain('Cheap hotel near Asok');
    expect(body.reply).toContain('Swap 500 USDT once');
  });
});

describe('POST /api/voice/tts', () => {
  it('answers 503 with a clear message when ElevenLabs is not configured', async () => {
    const res = await call('/api/voice/tts', { json: { text: 'สวัสดี', lang: 'th' } });
    expect(res.status).toBe(503);
    const body = (await res.json()) as V;
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

describe('routing', () => {
  it('404s unknown API routes and 405s wrong methods', async () => {
    expect((await call('/api/nope')).status).toBe(404);
    expect((await call('/api/guard/check')).status).toBe(405);
  });
  it('rejects a cross-origin paid request instead of only hiding CORS', async () => {
    const res = await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers: { Origin: 'https://evil.example' } });
    expect(res.status).toBe(403);
    expect((await res.json<Record<string, any>>()).error.code).toBe('forbidden_origin');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBeNull();
  });

  it('rejects Sec-Fetch-Site cross-site on paid routes', async () => {
    const res = await call('/api/voice/tts', {
      json: { text: 'สวัสดี', lang: 'th' },
      headers: { Origin: 'https://topiapause.test', 'Sec-Fetch-Site': 'cross-site' },
    });
    expect(res.status).toBe(403);
    expect((await res.json<Record<string, any>>()).error.code).toBe('forbidden_origin');
  });

  it('allows a paid route from the worker origin and from ALLOWED_ORIGIN', async () => {
    const same = await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers: { Origin: 'https://topiapause.test' } });
    expect(same.status).toBe(200);
    const env = makeEnv({ ALLOWED_ORIGIN: 'https://app.example' });
    const extra = await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers: { Origin: 'https://app.example' } }, env);
    expect(extra.status).toBe(200);
  });

  it('leaves the public guard API open to any origin', async () => {
    const res = await call('/api/guard/check', { json: { ...scene('stay'), lang: 'th' }, headers: { Origin: 'https://evil.example' } });
    expect(res.status).toBe(200);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });
  it('serves the web app for non-API paths', async () => {
    const res = await call('/activity');
    expect(res.headers.get('Content-Type')).toContain('text/html');
    expect(assetFetch).toHaveBeenCalled();
  });
});
