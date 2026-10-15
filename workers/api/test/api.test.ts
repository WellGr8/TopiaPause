import { evaluate } from '@topiapause/guard-engine';
import { DEFAULT_POLICY, SCENES, sceneIntent, type AgentProposal, type SceneId, type UserPolicy } from '@topiapause/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import attackPolicy from '../../../scripts/demo/attack-policy.json';
import shopCrypto from '../../../scripts/demo/crypto.json';
import shopInjection from '../../../scripts/demo/injection.json';
import shopStay from '../../../scripts/demo/stay.json';
import shopSubscription from '../../../scripts/demo/subscription.json';
import worker from '../src/index';
import { resetIsolateRateLimit, type AppEnv } from '../src/http';
import { resetLedgerForTests, sharedLedgerNamespace } from '../src/ledger';
import { llmExplain } from '../src/llm';
import { resetTokenomistCache } from '../src/tokenomist';
import { voiceLine } from '../src/voiceAllow';

const assetFetch = vi.fn(async () => new Response('<!doctype html>', { headers: { 'Content-Type': 'text/html' } }));
const ORIGIN = 'https://topiapause.test';

function makeEnv(overrides: Partial<AppEnv> = {}): AppEnv {
  return {
    ASSETS: { fetch: assetFetch } as unknown as Fetcher,
    RATE_LIMITER: { limit: async () => ({ success: true }) },
    RATE_LIMITER_PAID: { limit: async () => ({ success: true }) },
    VERDICT_LEDGER: sharedLedgerNamespace(),
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

async function session(env: AppEnv = makeEnv(), headers: Record<string, string> = {}): Promise<string> {
  const res = await call('/api/session', { json: {}, headers: { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', ...headers } }, env);
  expect(res.status).toBe(200);
  return ((await res.json()) as V).session as string;
}

async function appHeaders(env: AppEnv = makeEnv(), extra: Record<string, string> = {}): Promise<Record<string, string>> {
  const token = await session(env, extra);
  return { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'X-TopiaPause-Session': token, ...extra };
}

async function mint(policy: UserPolicy, env?: AppEnv): Promise<string> {
  const headers = await appHeaders(env ?? makeEnv());
  const res = await call('/api/policy', { json: { policy }, headers }, env);
  expect(res.status).toBe(200);
  return ((await res.json()) as V).policyToken;
}

/** A cryptographically valid policy token whose rules are looser than the default. The API must still reject it. */
async function signedLooseningToken(policy: UserPolicy, secret = 'test-signing-key'): Promise<string> {
  const enc = new TextEncoder();
  const b64url = (bytes: Uint8Array) => {
    let s = '';
    for (const b of bytes) s += String.fromCharCode(b);
    return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  };
  const body = b64url(enc.encode(JSON.stringify({ v: 1, policy, exp: Math.floor(Date.now() / 1000) + 3600, loosening: true })));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(`policy|${body}`)));
  return `${body}.${b64url(mac)}`;
}

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  resetTokenomistCache();
  resetIsolateRateLimit();
  resetLedgerForTests();
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
    expect(await res.json()).toMatchObject({ ok: true, llm: 'scripted', tts: 'unavailable', stt: 'unavailable', agent: 'U-Bot (mock)', marketData: 'sample' });
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('Referrer-Policy')).toBe('no-referrer');
  });
  it('never leaks secrets', async () => {
    const env = makeEnv({ LLM_API_KEY: 'sk-secret', LLM_MODEL: 'm', ELEVENLABS_API_KEY: 'xi-secret', ELEVENLABS_VOICE_ID: 'v', TOKENOMIST_API_KEY: 'tk-secret', POLICY_SIGNING_KEY: 'hmac-secret' });
    const text = await (await call('/api/health', {}, env)).text();
    expect(text).not.toContain('secret');
    expect(JSON.parse(text)).toMatchObject({ llm: 'llm', tts: 'elevenlabs', stt: 'elevenlabs', marketData: 'tokenomist' });
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

  it('never calls the LLM, even when a key is set, and llmCalls stays 0', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: '{"th":"ราคา 99999","en":"The price is 99999."}' } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' });
    const { res, v } = await check({ ...scene('crypto'), lang: 'en' }, env);
    expect(res.status).toBe(200);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(v.check.llmCalls).toBe(0);
    expect(v.explanation.source).toBe('template');
    expect(v.explanation.en).not.toContain('99999');
    expect(JSON.stringify(v)).not.toContain('sk-test');
  });

  it('fails closed when POLICY_SIGNING_KEY is unset, unless DEV=1', async () => {
    const missing = makeEnv({ POLICY_SIGNING_KEY: undefined });
    const res = await call('/api/guard/check', { json: scene('stay') }, missing);
    expect(res.status).toBe(503);
    expect(((await res.json()) as V).error.code).toBe('misconfigured');
    const dev = makeEnv({ POLICY_SIGNING_KEY: undefined, DEV: '1' });
    expect((await call('/api/guard/check', { json: scene('stay') }, dev)).status).toBe(200);
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
    const tighter = { ...DEFAULT_POLICY, monthlySubscriptionCap: { minor: 10000, currency: 'THB' as const } };
    const other = await mint(tighter, makeEnv({ POLICY_SIGNING_KEY: 'someone-elses-key' }));
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

  it('only the user app (same origin, with a session) can mint policy tokens', async () => {
    expect((await call('/api/policy', { json: { policy: permissive }, headers: { Origin: 'https://agent.example' } })).status).toBe(403);
    expect((await call('/api/policy', { json: { policy: permissive } })).status).toBe(403);
    const spoofed = await call('/api/policy', { json: { policy: DEFAULT_POLICY }, headers: { Origin: ORIGIN } });
    expect(spoofed.status).toBe(403);
    expect(((await spoofed.json()) as V).error.code).toBe('session_required');
  });

  it('ATTACK: a scripted session cannot mint a looser policy, even with userConfirmedLoosening', async () => {
    const headers = await appHeaders();
    const rejected = await call('/api/policy', { json: { policy: permissive, userConfirmedLoosening: true }, headers });
    expect(rejected.status).toBe(400);
    expect(((await rejected.json()) as V).error.code).toBe('policy_loosening_rejected');
    const token = await signedLooseningToken(permissive);
    const loosened = await check({ ...scene('crypto'), policyToken: token });
    expect(loosened.res.status).toBe(401);
    expect(loosened.v.error.code).toBe('invalid_policy_token');
    expect(loosened.v.decision).toBeUndefined();
    const { v } = await check(scene('crypto'));
    expect(v.findings.map((f: V) => f.ruleId)).toEqual(expect.arrayContaining(['CONC_CAP', 'APPROVAL_SCOPE', 'APPROVAL_EXPIRY']));
  });

  it('intent comes from the user message: "just try" pauses an annual plan whatever the agent claims', async () => {
    const s = scene('subscription', 'en');
    const { v } = await check({ ...s, userMessage: 'Sign me up for PixelPro, just to try it.', proposal: { ...s.proposal, summary: 'User asked for the annual plan' } });
    expect(v.findings.map((f: V) => f.ruleId)).toContain('SUB_COMMITMENT');
  });
});

describe('POST /api/agent/execute (verdict tickets)', () => {
  const exec = (proposal: unknown, verdictId: string, confirmation?: string) =>
    call('/api/agent/execute', { json: { proposal, verdictId, userConfirmed: true, ...(confirmation ? { confirmation } : {}) } });

  async function confirmed(verdictId: string, choice: 'original' | 'counter_offer' = 'counter_offer') {
    const headers = await appHeaders();
    const res = await call('/api/confirm', { json: { verdictId, choice }, headers });
    expect(res.status).toBe(200);
    return ((await res.json()) as V).confirmation as string;
  }

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

  it('rejects a paused execute that only asserts userConfirmed', async () => {
    const { v } = await check(scene('crypto'));
    const res = await exec(v.counterOffer.proposal, v.verdictId);
    expect(res.status).toBe(403);
    expect(((await res.json()) as V).error.code).toBe('confirmation_required');
  });

  it('ATTACK: a scripted session cannot confirm or execute the paused original', async () => {
    const s = scene('crypto');
    const { v } = await check(s);
    expect(v.decision).toBe('pause');
    const headers = await appHeaders();
    const confirm = await call('/api/confirm', { json: { verdictId: v.verdictId, choice: 'original' }, headers });
    expect(confirm.status).toBe(400);
    expect(((await confirm.json()) as V).error.code).toBe('original_not_confirmable');
    const executed = await exec(s.proposal, v.verdictId);
    expect(executed.status).toBe(403);
    expect(((await executed.json()) as V).error.code).toBe('proposal_not_cleared');
    const confirmation = await confirmed(v.verdictId);
    const swapped = await exec(s.proposal, v.verdictId, confirmation);
    expect(swapped.status).toBe(403);
    expect(((await swapped.json()) as V).error.code).toBe('proposal_not_cleared');
    const still = await exec(v.counterOffer.proposal, v.verdictId, confirmation);
    expect(still.status).toBe(200);
  });

  it('executes the cleared counter-offer once after the user confirms; a reuse is 409', async () => {
    const { v } = await check(scene('crypto'));
    const confirmation = await confirmed(v.verdictId);
    const res = await exec(v.counterOffer.proposal, v.verdictId, confirmation);
    expect(res.status).toBe(200);
    expect(((await res.json()) as V).execution).toMatchObject({ mode: 'mock', status: 'success' });
    const again = await exec(v.counterOffer.proposal, v.verdictId, confirmation);
    expect(again.status).toBe(409);
    expect(((await again.json()) as V).error.code).toBe('verdict_used');
  });

  it('an allow verdict executes without a confirmation token', async () => {
    const proposal = { ...SCENES.subscription.buildProposal({}), planId: 'pixelpro-monthly', planName: 'PixelPro Monthly', price: { minor: 29900, currency: 'THB' }, interval: 'month', trialDays: 7 };
    const { v } = await check({ userMessage: 'I want to try the PixelPro photo app', proposal, lang: 'en' });
    expect(v.decision).toBe('allow');
    const res = await exec(proposal, v.verdictId);
    expect(res.status).toBe(200);
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

  it('spends one ticket exactly once when two executes race', async () => {
    const { v } = await check(scene('crypto'));
    const confirmation = await confirmed(v.verdictId);
    const [a, b] = await Promise.all([exec(v.counterOffer.proposal, v.verdictId, confirmation), exec(v.counterOffer.proposal, v.verdictId, confirmation)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const bodies = (await Promise.all([a.json(), b.json()])) as V[];
    expect(bodies.find((body) => body.error)?.error.code).toBe('verdict_used');
    const replay = await exec(v.counterOffer.proposal, v.verdictId, confirmation);
    expect(replay.status).toBe(409);
    expect(((await replay.json()) as V).error.code).toBe('verdict_used');
  });

  it('fails closed with 503 when the ledger binding is missing', async () => {
    const env = makeEnv({ VERDICT_LEDGER: undefined });
    const { res, v } = await check(scene('stay'), env);
    expect(res.status).toBe(503);
    expect(v.error.code).toBe('ledger_unavailable');
  });

  it('uses the in-process ledger when DEV=1 and the binding is missing', async () => {
    const env = makeEnv({ VERDICT_LEDGER: undefined, DEV: '1' });
    const { res, v } = await check(scene('stay'), env);
    expect(res.status).toBe(200);
    expect(v.verdictId).toEqual(expect.any(String));
  });

  it('fails closed with 503 when the ledger throws', async () => {
    const broken = {
      idFromName: () => 'id',
      get: () => ({
        issue: async () => {
          throw new Error('storage down');
        },
        confirm: async () => {
          throw new Error('storage down');
        },
        consume: async () => {
          throw new Error('storage down');
        },
      }),
    };
    const env = makeEnv({ VERDICT_LEDGER: broken as unknown as AppEnv['VERDICT_LEDGER'] });
    const { res, v } = await check(scene('stay'), env);
    expect(res.status).toBe(503);
    expect(v.error.code).toBe('ledger_unavailable');
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
    expect(v.explanation.en).toContain('A web page told your AI to pick the yearly plan, but you only asked to try it.');
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
    const headers = await appHeaders();
    const res = await call('/api/agent/chat', { json: { message: SCENES.subscription.userText.th, scene: 'subscription', lang: 'th' }, headers });
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
    const headers = await appHeaders(env);
    const res = await call('/api/agent/chat', { json: { message: 'swap 300 USDT to TOKEN-X once', lang: 'en' }, headers }, env);
    const body = (await res.json()) as V;
    expect(body.source).toBe('llm');
    expect(body.proposal.amountIn).toEqual({ minor: 300_000_000, currency: 'USDT' });
    expect(body.proposal.portfolio).toEqual(fake.portfolio);
    expect(body.intent.goal).toBe('swap_token');
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://llm.example/v1/chat/completions');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer sk-test');
    const sent = JSON.parse(String(init.body));
    expect(sent).toMatchObject({ model: 'test-model', response_format: { type: 'json_object' } });
    const system = sent.messages[0].content as string;
    expect(system).toContain('use ผม');
    expect(system).toContain('ครับ');
    expect(system).toContain('Never use ฉัน, ค่ะ or คะ');
    expect(JSON.stringify(body)).not.toContain('sk-test');
  });

  it('falls back when the LLM returns junk', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ choices: [{ message: { content: '{"reply": 5}' } }] })));
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' });
    const headers = await appHeaders(env);
    const res = await call('/api/agent/chat', { json: { message: SCENES.stay.userText.en, lang: 'en' }, headers }, env);
    const body = (await res.json()) as V;
    expect(body.source).toBe('scripted');
    expect(body.proposal.kind).toBe('stay');
  });

  it('uses a separate paid rate limit key for chat and for tts', async () => {
    const seen: string[] = [];
    const env = makeEnv({
      RATE_LIMITER_PAID: {
        limit: async ({ key }: { key: string }) => {
          seen.push(key);
          return { success: false };
        },
      },
    });
    const headers = await appHeaders(env);
    expect((await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers }, env)).status).toBe(429);
    expect((await call('/api/voice/tts', { json: { clipId: 'subscription-pause', lang: 'th' }, headers }, env)).status).toBe(429);
    expect(seen).toEqual(['chat:local', 'tts:local']);
  });

  it('gives chat and tts separate in-isolate budgets per IP', async () => {
    const ip = { 'CF-Connecting-IP': '203.0.113.9' };
    const headers = await appHeaders(makeEnv(), ip);
    for (let i = 0; i < 20; i++) {
      expect((await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers })).status).toBe(200);
    }
    const blocked = await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers });
    expect(blocked.status).toBe(429);
    expect((await blocked.json<Record<string, any>>()).error.code).toBe('rate_limited');
    expect(blocked.headers.get('Retry-After')).toBe('60');
    const tts = await call('/api/voice/tts', { json: { text: 'not a guard line', lang: 'en' }, headers });
    expect(tts.status).toBe(400);
    expect(((await tts.json()) as V).error.code).toBe('tts_text_rejected');
  });

  it('stops upstream LLM calls after PAID_DAILY_MAX and keeps the scripted reply', async () => {
    const fetchMock = vi.fn(async () => Response.json({ choices: [{ message: { content: JSON.stringify({ reply: 'Swapping now.', scene: null }) } }] }));
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model', PAID_DAILY_MAX: '1' });
    const headers = await appHeaders(env);
    const first = await call('/api/agent/chat', { json: { message: 'swap 300 USDT to TOKEN-X once', lang: 'en' }, headers }, env);
    expect(((await first.json()) as V).source).toBe('llm');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const second = await call('/api/agent/chat', { json: { message: 'what is the weather', lang: 'en' }, headers }, env);
    expect(((await second.json()) as V).source).toBe('scripted');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('matches natural phrasing without an LLM key', async () => {
    const cases = [
      ['I want to try PixelPro', 'en', 'subscription'],
      ['Book me somewhere to sleep near Asok tonight', 'en', 'stay'],
      ['ลองใช้ PixelPro หน่อย', 'th', 'subscription'],
    ] as const;
    const headers = await appHeaders();
    for (const [message, lang, scene] of cases) {
      const res = await call('/api/agent/chat', { json: { message, lang }, headers });
      expect(res.status).toBe(200);
      const body = await res.json<Record<string, any>>();
      expect(body.source).toBe('scripted');
      expect(body.scene).toBe(scene);
      expect(body.proposal).toBeTruthy();
    }
  });

  it('names the three chips when free text matches nothing', async () => {
    const headers = await appHeaders();
    const res = await call('/api/agent/chat', { json: { message: 'what is the weather', lang: 'en' }, headers });
    const body = await res.json<Record<string, any>>();
    expect(body.proposal).toBeUndefined();
    expect(body.reply).toContain('Try PixelPro app');
    expect(body.reply).toContain('Cheap hotel near Asok');
    expect(body.reply).toContain('Swap 500 USDT once');
  });
});

describe('POST /api/voice/tts', () => {
  it('rejects arbitrary text', async () => {
    const headers = await appHeaders();
    const res = await call('/api/voice/tts', { json: { text: 'สวัสดี', lang: 'th' }, headers });
    expect(res.status).toBe(400);
    expect(((await res.json()) as V).error.code).toBe('tts_text_rejected');
  });

  it('answers 503 with a clear message when ElevenLabs is not configured', async () => {
    const headers = await appHeaders();
    const res = await call('/api/voice/tts', { json: { clipId: 'subscription-pause', lang: 'th' }, headers });
    expect(res.status).toBe(503);
    const body = (await res.json()) as V;
    expect(body.error.code).toBe('tts_unavailable');
    expect(body.error.message).toContain('ELEVENLABS_API_KEY');
  });

  it('streams mp3 from ElevenLabs for an engine voice line', async () => {
    const fetchMock = vi.fn(async (_url: string, _init: RequestInit) => new Response(new Uint8Array([0xff, 0xfb, 0x90]), { headers: { 'Content-Type': 'audio/mpeg' } }));
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ ELEVENLABS_API_KEY: 'xi-test', ELEVENLABS_VOICE_ID: 'voice123' });
    const headers = await appHeaders(env);
    const line = voiceLine('subscription-pause', 'th');
    expect(line).toBeTruthy();
    const res = await call('/api/voice/tts', { json: { clipId: 'subscription-pause', lang: 'th' }, headers }, env);
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');
    expect(new Uint8Array(await res.arrayBuffer())).toEqual(new Uint8Array([0xff, 0xfb, 0x90]));
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toContain('/v1/text-to-speech/voice123');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('xi-test');
    expect(JSON.parse(String(init.body))).toEqual({ text: line, model_id: 'eleven_v3' });
  });

  it('returns 502 when ElevenLabs fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('nope', { status: 401 })));
    const env = makeEnv({ ELEVENLABS_API_KEY: 'xi-test', ELEVENLABS_VOICE_ID: 'voice123' });
    const headers = await appHeaders(env);
    expect((await call('/api/voice/tts', { json: { clipId: 'stay-pause', lang: 'en' }, headers }, env)).status).toBe(502);
  });

  it('returns 503 spend_cap before calling ElevenLabs once the daily cap is spent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ ELEVENLABS_API_KEY: 'xi-test', ELEVENLABS_VOICE_ID: 'voice123', PAID_DAILY_MAX: '0' });
    const headers = await appHeaders(env);
    const res = await call('/api/voice/tts', { json: { clipId: 'crypto-pause', lang: 'en' }, headers }, env);
    expect(res.status).toBe(503);
    expect(((await res.json()) as V).error.code).toBe('spend_cap');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/voice/stt', () => {
  const clip = new Uint8Array([1, 2, 3, 4]);

  function stt(headers: Record<string, string>, env?: AppEnv, body: BodyInit = clip) {
    return call('/api/voice/stt', { method: 'POST', body, headers: { 'Content-Type': 'audio/webm', ...headers } }, env);
  }

  it('rejects a missing origin', async () => {
    const res = await stt({});
    expect(res.status).toBe(403);
    expect(((await res.json()) as V).error.code).toBe('forbidden_origin');
  });

  it('rejects a missing session', async () => {
    const res = await stt({ Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin' });
    expect(res.status).toBe(403);
    expect(((await res.json()) as V).error.code).toBe('session_required');
  });

  it('rejects a body over 300 KB', async () => {
    const headers = await appHeaders();
    const res = await stt(headers, undefined, new Uint8Array(300 * 1024 + 1));
    expect(res.status).toBe(413);
    expect(((await res.json()) as V).error.code).toBe('payload_too_large');
  });

  it('rejects a non-audio content type', async () => {
    const headers = await appHeaders();
    const res = await call('/api/voice/stt', { method: 'POST', body: clip, headers: { ...headers, 'Content-Type': 'text/plain' } });
    expect(res.status).toBe(415);
    expect(((await res.json()) as V).error.code).toBe('unsupported_media_type');
  });

  it('uses its own 10/minute rate limit', async () => {
    const env = makeEnv({
      RATE_LIMITER_STT: { limit: async () => ({ success: false }) },
    });
    const headers = await appHeaders(env);
    const res = await stt(headers, env);
    expect(res.status).toBe(429);
    expect(((await res.json()) as V).error.code).toBe('rate_limited');
    expect(res.headers.get('Retry-After')).toBe('60');
  });

  it('keeps a separate in-isolate budget from chat', async () => {
    const headers = await appHeaders(makeEnv(), { 'CF-Connecting-IP': '203.0.113.40' });
    for (let i = 0; i < 10; i++) expect((await stt(headers)).status).toBe(503);
    const blocked = await stt(headers);
    expect(blocked.status).toBe(429);
    expect((await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers })).status).toBe(200);
  });

  it('forwards audio to Scribe and returns the mapped action without logging the transcript', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      const form = await new Request('https://stt.test', { method: 'POST', body: init.body }).formData();
      expect(form.get('model_id')).toBe('scribe_v2');
      expect(form.get('tag_audio_events')).toBe('false');
      expect(form.get('file')).toBeInstanceOf(Blob);
      return Response.json({ text: 'เอาอันที่แนะนำ', words: [{ text: 'secret-word' }] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ ELEVENLABS_API_KEY: 'xi-test' });
    const headers = await appHeaders(env);
    const res = await stt(headers, env);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ transcript: 'เอาอันที่แนะนำ', action: 'counter_offer' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.elevenlabs.io/v1/speech-to-text');
    expect((init.headers as Record<string, string>)['xi-api-key']).toBe('xi-test');
    const logged = vi.mocked(console.log).mock.calls.map((c) => String(c[0])).join('\n');
    expect(logged).not.toContain('เอาอันที่แนะนำ');
    expect(logged).not.toContain('secret-word');
    expect(logged).not.toContain('xi-test');
  });

  it('counts a successful call in the shared daily cap', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({ text: 'ยกเลิก' })));
    const env = makeEnv({ ELEVENLABS_API_KEY: 'xi-test', ELEVENLABS_VOICE_ID: 'voice123', PAID_DAILY_MAX: '1' });
    const headers = await appHeaders(env);
    const sttRes = await stt(headers, env);
    expect(await sttRes.json()).toEqual({ transcript: 'ยกเลิก', action: 'cancel' });
    const tts = await call('/api/voice/tts', { json: { clipId: 'subscription-pause', lang: 'th' }, headers }, env);
    expect(tts.status).toBe(503);
    expect(((await tts.json()) as V).error.code).toBe('spend_cap');
  });

  it('does not call ElevenLabs once the daily cap is spent', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const env = makeEnv({ ELEVENLABS_API_KEY: 'xi-test', PAID_DAILY_MAX: '0' });
    const headers = await appHeaders(env);
    const res = await stt(headers, env);
    expect(res.status).toBe(503);
    expect(((await res.json()) as V).error.code).toBe('spend_cap');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('session binding (User-Agent, not IP)', () => {
  const ua = 'Mozilla/5.0 (TopiaPause test)';

  it('a session minted on IP A verifies on IP B, by header and by cookie', async () => {
    const minted = await call('/api/session', {
      json: {},
      headers: { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'User-Agent': ua, 'CF-Connecting-IP': '203.0.113.1' },
    });
    expect(minted.status).toBe(200);
    const body = (await minted.json()) as V;
    const setCookie = minted.headers.get('Set-Cookie') ?? '';
    expect(setCookie).toBe(`tp_session=${body.session}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=600`);

    const headerRes = await call('/api/policy', {
      json: { policy: DEFAULT_POLICY },
      headers: {
        Origin: ORIGIN,
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': ua,
        'CF-Connecting-IP': '198.51.100.8',
        'X-TopiaPause-Session': body.session,
      },
    });
    expect(headerRes.status).toBe(200);

    const cookieRes = await call('/api/policy', {
      json: { policy: DEFAULT_POLICY },
      headers: {
        Origin: ORIGIN,
        'Sec-Fetch-Site': 'same-origin',
        'User-Agent': ua,
        'CF-Connecting-IP': '198.51.100.9',
        Cookie: `tp_session=${body.session}`,
      },
    });
    expect(cookieRes.status).toBe(200);
  });

  it('a different User-Agent is 403 invalid_session', async () => {
    const token = await session(makeEnv(), { 'User-Agent': 'BrowserA/1.0' });
    const res = await call('/api/confirm', {
      json: { verdictId: 'v1', choice: 'counter_offer' },
      headers: { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'User-Agent': 'BrowserB/2.0', 'X-TopiaPause-Session': token },
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as V).error.code).toBe('invalid_session');
  });

  it('a missing session is 403 session_required', async () => {
    const res = await call('/api/policy', {
      json: { policy: DEFAULT_POLICY },
      headers: { Origin: ORIGIN, 'Sec-Fetch-Site': 'same-origin', 'User-Agent': ua },
    });
    expect(res.status).toBe(403);
    expect(((await res.json()) as V).error.code).toBe('session_required');
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

  it('rejects chat, tts, and policy with no Origin', async () => {
    expect((await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' } })).status).toBe(403);
    expect((await call('/api/voice/tts', { json: { text: 'hi', lang: 'en' } })).status).toBe(403);
    expect((await call('/api/policy', { json: { policy: DEFAULT_POLICY } })).status).toBe(403);
  });

  it('rejects Sec-Fetch-Site cross-site on paid routes', async () => {
    const res = await call('/api/voice/tts', {
      json: { clipId: 'subscription-pause', lang: 'th' },
      headers: { Origin: 'https://topiapause.test', 'Sec-Fetch-Site': 'cross-site' },
    });
    expect(res.status).toBe(403);
    expect((await res.json<Record<string, any>>()).error.code).toBe('forbidden_origin');
  });

  it('allows a paid route from the worker origin and from ALLOWED_ORIGIN when the session matches', async () => {
    const headers = await appHeaders();
    const same = await call('/api/agent/chat', { json: { message: 'hi', lang: 'en' }, headers });
    expect(same.status).toBe(200);
    const env = makeEnv({ ALLOWED_ORIGIN: 'https://app.example' });
    const token = await session(env, { Origin: 'https://app.example' });
    const extra = await call(
      '/api/agent/chat',
      { json: { message: 'hi', lang: 'en' }, headers: { Origin: 'https://app.example', 'X-TopiaPause-Session': token } },
      env,
    );
    expect(extra.status).toBe(200);
  });

  it('llmExplain does not put agent-supplied names in the prompt', async () => {
    const fetchMock = vi.fn(async (_url: string, init: RequestInit) => {
      void init;
      return Response.json({ choices: [{ message: { content: '{"th":"เดี๋ยวก่อนครับ","en":"Hold on."}' } }] });
    });
    vi.stubGlobal('fetch', fetchMock);
    const s = scene('stay', 'en');
    const verdict = evaluate({ intent: sceneIntent('stay', s.userMessage, 'en'), proposal: s.proposal, policy: DEFAULT_POLICY, lang: 'en' });
    expect(verdict.explanation.en).toContain('Asok Inn');
    await llmExplain(makeEnv({ LLM_API_KEY: 'sk-test', LLM_MODEL: 'test-model' }), { ...verdict, verdictId: 'v' });
    const sent = JSON.stringify(JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)).messages);
    expect(sent).not.toContain('Asok Inn');
    expect(sent).not.toContain('City Nest');
    expect(sent).toContain('STAY_FLEXIBILITY');
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
