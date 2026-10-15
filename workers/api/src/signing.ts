import { DEFAULT_POLICY, type AgentProposal, type UserPolicy } from '@topiapause/shared';
import { HttpError, log, type AppEnv } from './http';
import { AgentProposal as AgentProposalSchema, UserPolicy as UserPolicySchema } from './schemas';

// HMAC-SHA256 tokens for two things an agent must not be able to forge:
//  - policy tokens: the user's rules, minted for the user's own app (POST /api/policy);
//  - verdict tickets: which proposals a guard check cleared for execution, short-lived, single use.
// Token = base64url(payload JSON) "." base64url(HMAC(purpose "|" payload)).

const enc = new TextEncoder();
const POLICY_TTL_SEC = 30 * 24 * 3600;
export const TICKET_TTL_SEC = 10 * 60;

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
    if (!ephemeral) {
      log({ message: 'POLICY_SIGNING_KEY not set: using a per-isolate key (tokens stop verifying after a restart)' });
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
  } catch {
    return undefined;
  }
}

const nowSec = () => Math.floor(Date.now() / 1000);

// ---------------- Policy tokens ----------------

export async function mintPolicyToken(env: AppEnv, policy: UserPolicy): Promise<{ policyToken: string; expiresAt: string }> {
  const exp = nowSec() + POLICY_TTL_SEC;
  return { policyToken: await sign(env, 'policy', { v: 1, policy, exp }), expiresAt: new Date(exp * 1000).toISOString() };
}

/** The user's policy from a signed token; no token means the default demo policy. */
export async function policyFrom(env: AppEnv, token: string | undefined): Promise<{ policy: UserPolicy; source: 'token' | 'default' }> {
  if (!token) return { policy: DEFAULT_POLICY, source: 'default' };
  const payload = (await verify(env, 'policy', token)) as { v?: number; policy?: unknown; exp?: number } | undefined;
  if (!payload || payload.v !== 1 || typeof payload.exp !== 'number') throw new HttpError(401, 'invalid_policy_token', 'Policy token is invalid or was not issued by TopiaPause');
  if (payload.exp < nowSec()) throw new HttpError(401, 'expired_policy_token', 'Policy token expired; ask the user app for a new one');
  const parsed = UserPolicySchema.safeParse(payload.policy);
  if (!parsed.success) throw new HttpError(401, 'invalid_policy_token', 'Policy token payload is invalid');
  return { policy: parsed.data as UserPolicy, source: 'token' };
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

export async function issueTicket(env: AppEnv, cleared: AgentProposal[]): Promise<string> {
  const hashes = await Promise.all(cleared.map(proposalHash));
  return sign(env, 'verdict', { v: 1, jti: crypto.randomUUID(), h: hashes, exp: nowSec() + TICKET_TTL_SEC });
}

// Single use per isolate. A multi-isolate deployment would move this to a Durable Object.
const used = new Map<string, number>();

export async function redeemTicket(env: AppEnv, ticket: string, proposal: AgentProposal): Promise<void> {
  const payload = (await verify(env, 'verdict', ticket)) as { v?: number; jti?: string; h?: string[]; exp?: number } | undefined;
  if (!payload || payload.v !== 1 || !payload.jti || !Array.isArray(payload.h) || typeof payload.exp !== 'number') {
    throw new HttpError(403, 'unknown_verdict', 'verdictId was not issued by TopiaPause');
  }
  const now = nowSec();
  if (payload.exp < now) throw new HttpError(403, 'expired_verdict', 'Verdict expired; run the guard check again');
  if (!payload.h.includes(await proposalHash(proposal))) throw new HttpError(403, 'proposal_not_cleared', 'This proposal is not the one the guard checked');
  for (const [k, exp] of used) if (exp < now) used.delete(k);
  if (used.has(payload.jti)) throw new HttpError(409, 'verdict_used', 'This verdict was already executed');
  used.set(payload.jti, payload.exp);
}
