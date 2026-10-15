import { DEFAULT_POLICY, policyLoosens, type AgentProposal, type GuardVerdict, type UserPolicy } from '@topiapause/shared';
import { HttpError, log, type AppEnv } from './http';
import { devLedgerNamespace, type LedgerResult, type LedgerStub } from './ledger';
import { AgentProposal as AgentProposalSchema, UserPolicy as UserPolicySchema } from './schemas';

// HMAC-SHA256 tokens for two things an agent must not be able to forge:
//  - policy tokens: the user's rules, minted for the user's own app (POST /api/policy);
//  - verdict tickets: which proposals a guard check cleared for execution, short-lived, single use.
// Token = base64url(payload JSON) "." base64url(HMAC(purpose "|" payload)).

const enc = new TextEncoder();
const POLICY_TTL_SEC = 30 * 24 * 3600;
export const TICKET_TTL_SEC = 10 * 60;
const SESSION_TTL_SEC = 10 * 60;
const SESSION_COOKIE = 'tp_session';

let ephemeral: CryptoKey | undefined;
const keys = new Map<string, Promise<CryptoKey>>();

function b64url(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function unb64url(s: string): Uint8Array {
  const bin = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function signingKey(env: AppEnv): Promise<CryptoKey> {
  const secret = env.POLICY_SIGNING_KEY;
  if (!secret) {
    if (env.DEV !== '1') {
      throw new HttpError(503, 'misconfigured', 'POLICY_SIGNING_KEY is not set');
    }
    if (!ephemeral) {
      log({ message: 'DEV=1 and POLICY_SIGNING_KEY not set: using a per-isolate key (tokens stop verifying after a restart)' });
      ephemeral = (await crypto.subtle.generateKey({ name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])) as CryptoKey;
    }
    return ephemeral!;
  }
  let k = keys.get(secret);
  if (!k) {
    k = crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
    keys.set(secret, k);
  }
  return k;
}

async function sign(env: AppEnv, purpose: string, payload: object): Promise<string> {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  const mac = await crypto.subtle.sign('HMAC', await signingKey(env), enc.encode(`${purpose}|${body}`));
  return `${body}.${b64url(new Uint8Array(mac))}`;
}

async function verify(env: AppEnv, purpose: string, token: string): Promise<unknown | undefined> {
  const [body, mac, extra] = token.split('.');
  if (!body || !mac || extra !== undefined) return undefined;
  try {
    const ok = await crypto.subtle.verify('HMAC', await signingKey(env), unb64url(mac), enc.encode(`${purpose}|${body}`));
    return ok ? JSON.parse(new TextDecoder().decode(unb64url(body))) : undefined;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    return undefined;
  }
}

const nowSec = () => Math.floor(Date.now() / 1000);

// ---------------- Policy tokens ----------------

export async function mintPolicyToken(env: AppEnv, policy: UserPolicy): Promise<{ policyToken: string; expiresAt: string }> {
  if (policyLoosens(policy)) {
    throw new HttpError(400, 'policy_loosening_rejected', 'The API only accepts a policy that is as strict as the default or stricter');
  }
  const exp = nowSec() + POLICY_TTL_SEC;
  return { policyToken: await sign(env, 'policy', { v: 1, policy, exp }), expiresAt: new Date(exp * 1000).toISOString() };
}

/** The user's policy from a signed token; no token means the default demo policy. A loosening policy is rejected even when the HMAC is valid. */
export async function policyFrom(env: AppEnv, token: string | undefined): Promise<{ policy: UserPolicy; source: 'token' | 'default' }> {
  if (!token) return { policy: DEFAULT_POLICY, source: 'default' };
  const payload = (await verify(env, 'policy', token)) as { v?: number; policy?: unknown; exp?: number } | undefined;
  if (!payload || payload.v !== 1 || typeof payload.exp !== 'number') throw new HttpError(401, 'invalid_policy_token', 'Policy token is invalid or was not issued by TopiaPause');
  if (payload.exp < nowSec()) throw new HttpError(401, 'expired_policy_token', 'Policy token expired; ask the user app for a new one');
  const parsed = UserPolicySchema.safeParse(payload.policy);
  if (!parsed.success) throw new HttpError(401, 'invalid_policy_token', 'Policy token payload is invalid');
  if (policyLoosens(parsed.data as UserPolicy)) {
    throw new HttpError(401, 'invalid_policy_token', 'This policy token loosens the default rules; the API only accepts a tighter policy');
  }
  return { policy: parsed.data as UserPolicy, source: 'token' };
}

// ---------------- Browser session ----------------

/** Binds a session to a hash of the User-Agent. The IP is not part of the binding: Private Relay, WARP, and mobile networks change it mid-session. Rate limits still key on IP. */
export async function clientBinding(req: Request): Promise<string> {
  const ua = req.headers.get('User-Agent') ?? '';
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(ua));
  return b64url(new Uint8Array(digest)).slice(0, 16);
}

export function sessionCookie(token: string): string {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=${SESSION_TTL_SEC}`;
}

function cookieValue(req: Request, name: string): string | undefined {
  const raw = req.headers.get('Cookie');
  if (!raw) return undefined;
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    const value = part.slice(eq + 1).trim();
    if (value) return value;
  }
  return undefined;
}

export async function mintSession(env: AppEnv, req: Request): Promise<{ session: string; expiresAt: string }> {
  const exp = nowSec() + SESSION_TTL_SEC;
  const session = await sign(env, 'session', { v: 2, bind: await clientBinding(req), exp });
  return { session, expiresAt: new Date(exp * 1000).toISOString() };
}

export async function verifySession(env: AppEnv, req: Request): Promise<void> {
  const token = cookieValue(req, SESSION_COOKIE) ?? req.headers.get('X-TopiaPause-Session');
  if (!token) throw new HttpError(403, 'session_required', 'This route needs a TopiaPause session');
  const payload = (await verify(env, 'session', token)) as { v?: number; bind?: string; exp?: number } | undefined;
  if (!payload || payload.v !== 2 || typeof payload.bind !== 'string' || typeof payload.exp !== 'number') {
    throw new HttpError(403, 'invalid_session', 'Session token is invalid');
  }
  if (payload.exp < nowSec()) throw new HttpError(403, 'invalid_session', 'Session token expired');
  if (payload.bind !== (await clientBinding(req))) throw new HttpError(403, 'invalid_session', 'Session token does not match this client');
}

// ---------------- Verdict tickets ----------------

/** Canonical JSON (sorted keys) so the same proposal always hashes the same. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v)
      .sort()
      .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`)
      .join(',')}}`;
  }
  return JSON.stringify(v);
}

/** Hashes the schema-normalised proposal, the same shape /api/agent/execute receives. */
export async function proposalHash(p: AgentProposal): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', enc.encode(canonical(AgentProposalSchema.parse(p))));
  return b64url(new Uint8Array(digest)).slice(0, 32);
}

type Ticket = {
  v?: number;
  jti?: string;
  exp?: number;
  needsUser?: boolean;
  choices?: { original?: string; counter_offer?: string };
};

async function readTicket(env: AppEnv, ticket: string): Promise<Ticket & { jti: string; exp: number; choices: NonNullable<Ticket['choices']> }> {
  const payload = (await verify(env, 'verdict', ticket)) as Ticket | undefined;
  if (!payload || payload.v !== 2 || !payload.jti || typeof payload.exp !== 'number' || !payload.choices) {
    throw new HttpError(403, 'unknown_verdict', 'verdictId was not issued by TopiaPause');
  }
  return payload as Ticket & { jti: string; exp: number; choices: NonNullable<Ticket['choices']> };
}

/** An allow clears the original. A pause clears only the counter-offer, and that still needs a confirmation. */
export async function issueTicket(env: AppEnv, verdict: GuardVerdict, original: AgentProposal): Promise<string> {
  const choices: { original?: string; counter_offer?: string } = {};
  if (verdict.decision === 'allow') {
    choices.original = await proposalHash(original);
  } else if (verdict.decision === 'pause' && verdict.counterOffer) {
    choices.counter_offer = await proposalHash(verdict.counterOffer.proposal);
  }
  const exp = nowSec() + TICKET_TTL_SEC;
  const jti = crypto.randomUUID();
  const token = await sign(env, 'verdict', {
    v: 2,
    jti,
    exp,
    needsUser: verdict.decision === 'pause',
    choices,
  });
  const recorded = await ledger(env, jti, (stub) => stub.issue(jti, exp));
  expectLedger(recorded, ['issued']);
  return token;
}

export async function issueConfirmation(env: AppEnv, ticket: string, choice: 'original' | 'counter_offer'): Promise<string> {
  if (choice !== 'counter_offer') {
    throw new HttpError(400, 'original_not_confirmable', 'The API confirms only the counter-offer. The paused original is not an agent action.');
  }
  const payload = await readTicket(env, ticket);
  const now = nowSec();
  if (payload.exp < now) throw new HttpError(403, 'expired_verdict', 'Verdict expired; run the guard check again');
  const hash = payload.choices.counter_offer;
  if (!hash) throw new HttpError(400, 'invalid_input', 'This verdict has no counter-offer to confirm');
  const recorded = await ledger(env, payload.jti, (stub) => stub.confirm(payload.jti, payload.exp));
  expectLedger(recorded, ['confirmed']);
  return sign(env, 'confirm', { v: 1, jti: payload.jti, choice, h: hash, exp: payload.exp });
}

export async function redeemTicket(env: AppEnv, ticket: string, proposal: AgentProposal, confirmation?: string): Promise<void> {
  const payload = await readTicket(env, ticket);
  const now = nowSec();
  if (payload.exp < now) throw new HttpError(403, 'expired_verdict', 'Verdict expired; run the guard check again');
  const hash = await proposalHash(proposal);
  if (payload.needsUser && hash !== payload.choices.counter_offer) {
    throw new HttpError(403, 'proposal_not_cleared', 'A paused verdict only clears the counter-offer');
  }
  if (!Object.values(payload.choices).includes(hash)) throw new HttpError(403, 'proposal_not_cleared', 'This proposal is not the one the guard checked');
  if (payload.needsUser) {
    const conf = confirmation ? ((await verify(env, 'confirm', confirmation)) as { v?: number; jti?: string; h?: string; exp?: number } | undefined) : undefined;
    if (!conf || conf.v !== 1 || conf.jti !== payload.jti || conf.h !== hash || typeof conf.exp !== 'number' || conf.exp < now) {
      throw new HttpError(403, 'confirmation_required', 'A paused counter-offer needs a confirmation token from the user');
    }
  }
  const recorded = await ledger(env, payload.jti, (stub) => stub.consume(payload.jti, payload.exp, Boolean(payload.needsUser)));
  if (recorded.state === 'used' && recorded.firstUse) return;
  expectLedger(recorded, []);
}

async function ledger(env: AppEnv, jti: string, run: (stub: LedgerStub) => Promise<LedgerResult>): Promise<LedgerResult> {
  try {
    if (env.VERDICT_LEDGER) {
      const stub = env.VERDICT_LEDGER.get(env.VERDICT_LEDGER.idFromName(jti));
      return await run(stub);
    }
    if (env.DEV === '1') return await run(devLedgerNamespace().get(jti));
    throw new HttpError(503, 'ledger_unavailable', 'Verdict ledger is not configured');
  } catch (e) {
    if (e instanceof HttpError) throw e;
    log({ message: 'verdict ledger failed', error: e instanceof Error ? e.message : String(e) });
    throw new HttpError(503, 'ledger_unavailable', 'Verdict ledger is unavailable');
  }
}

function expectLedger(result: LedgerResult, ok: LedgerResult['state'][]): void {
  if (ok.includes(result.state)) return;
  if (result.state === 'expired') throw new HttpError(403, 'expired_verdict', 'Verdict expired; run the guard check again');
  if (result.state === 'used') throw new HttpError(409, 'verdict_used', 'This verdict was already executed');
  if (result.state === 'unconfirmed') throw new HttpError(403, 'confirmation_required', 'A paused counter-offer needs a confirmation token from the user');
  throw new HttpError(403, 'unknown_verdict', 'verdictId was not issued by TopiaPause');
}
