import {
  policyLoosens,
  type AgentChatResponse,
  type AgentProposal,
  type Execution,
  type GuardVerdict,
  type Lang,
  type SceneId,
  type UntrustedSource,
  type UserPolicy,
  type VoiceAction,
} from '@topiapause/shared';
import { GuardClientError } from '@topiapause/guard-client';
import { ubotGuard } from './ubot';

// Talks to the Worker API when it is reachable (feature-detected via /api/health).
// Under plain `vite dev` there is no API, so callers fall back to the in-browser
// engine and scripted U-Bot. Either way, every number comes from guard-engine.

export interface Health {
  ok: true;
  engineVersion: string;
  llm: 'llm' | 'scripted';
  tts: 'elevenlabs' | 'unavailable';
}

let healthPromise: Promise<Health | null> | undefined;

export function apiHealth(): Promise<Health | null> {
  healthPromise ??= fetch('/api/health', { signal: AbortSignal.timeout(1500) })
    .then(async (r) => {
      if (!r.ok || !(r.headers.get('Content-Type') ?? '').includes('application/json')) return null;
      const h = (await r.json()) as Partial<Health>;
      return h.ok === true ? (h as Health) : null;
    })
    .catch(() => null);
  return healthPromise;
}

const SESSION_SKEW_MS = 15_000;
const SESSION_FALLBACK_TTL_MS = 10 * 60 * 1000;
const REFRESH_CODES = new Set(['invalid_session', 'session_required']);

interface HeldSession {
  token: string;
  expiresAt: number;
}

let held: HeldSession | undefined;
let inflight: Promise<HeldSession | null> | undefined;
let mintGen = 0;

function sessionFresh(now = Date.now()): boolean {
  return held !== undefined && held.expiresAt - SESSION_SKEW_MS > now;
}

async function fetchMint(gen: number): Promise<HeldSession | null> {
  try {
    const r = await fetch('/api/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{}',
      signal: AbortSignal.timeout(8000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { session?: unknown; expiresAt?: unknown };
    if (typeof data.session !== 'string' || data.session.length === 0) return null;
    const parsed = typeof data.expiresAt === 'string' ? Date.parse(data.expiresAt) : Number.NaN;
    const next: HeldSession = {
      token: data.session,
      expiresAt: Number.isFinite(parsed) ? parsed : Date.now() + SESSION_FALLBACK_TTL_MS,
    };
    if (gen !== mintGen) return held ?? null;
    held = next;
    return next;
  } catch {
    return null;
  }
}

/**
 * One short-lived token for this tab. A failed mint is never cached.
 * Refresh shortly before expiresAt, and again when the server rejects the token.
 * A forced refresh that fails does not hand back the rejected token.
 */
function appSession(force = false): Promise<string | null> {
  if (!force && sessionFresh()) return Promise.resolve(held!.token);
  if (!force && inflight) return inflight.then((got) => got?.token ?? null);
  const gen = ++mintGen;
  const run = fetchMint(gen);
  inflight = run;
  return run
    .then((got) => {
      if (!got) {
        if (gen === mintGen) held = undefined;
        return null;
      }
      return got.token;
    })
    .finally(() => {
      if (inflight === run) inflight = undefined;
    });
}

async function errorCode(r: Response): Promise<string> {
  try {
    const data = (await r.clone().json()) as { error?: { code?: string } | string };
    if (typeof data.error === 'string') return data.error;
    return data.error?.code ?? '';
  } catch {
    return '';
  }
}

/** Sends with the current session. One 403 for a dead session mints a new token and retries once. */
async function withSession(run: (token: string) => Promise<Response>, retried = false): Promise<Response | null> {
  const token = await appSession(retried);
  if (!token) return null;
  const r = await run(token);
  if (!retried && r.status === 403 && REFRESH_CODES.has(await errorCode(r))) return withSession(run, true);
  return r;
}

/** Tests reset the cached health and session probes. */
export function resetApiCaches(): void {
  healthPromise = undefined;
  held = undefined;
  inflight = undefined;
  mintGen += 1;
}

async function post<T>(path: string, body: unknown, timeoutMs = 8000, session = false): Promise<T | null> {
  try {
    const send = (token?: string) =>
      fetch(path, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { 'X-TopiaPause-Session': token } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
    const r = session ? await withSession((token) => send(token)) : await send();
    return r?.ok ? ((await r.json()) as T) : null;
  } catch {
    return null;
  }
}

export type ChatTurn = AgentChatResponse & { scene?: SceneId };

export async function apiChat(input: { message: string; scene?: SceneId; lang: Lang }): Promise<ChatTurn | null> {
  if (!(await apiHealth())) return null;
  return post<ChatTurn>('/api/agent/chat', { sessionId: 'web', ...input }, 15_000, true);
}

// The user's rules travel as a token the Worker signed for this app, never as raw policy:
// the guard API ignores policies an agent might send.
const policyTokens = new Map<string, Promise<string | null>>();

function policyToken(policy: UserPolicy): Promise<string | null> {
  // Looser rules stay in this tab and run through the in-browser engine. The API is tighten-only.
  if (policyLoosens(policy)) return Promise.resolve(null);
  const key = JSON.stringify(policy);
  let t = policyTokens.get(key);
  if (!t) {
    t = post<{ policyToken: string }>('/api/policy', { policy }, 8000, true).then((r) => r?.policyToken ?? null);
    policyTokens.set(key, t);
  }
  return t;
}

export async function apiGuardCheck(input: {
  /** The user's message verbatim; the Worker derives intent from it. */
  userMessage: string;
  proposal: AgentProposal;
  policy: UserPolicy;
  lang: Lang;
  /** Untrusted context the agent read (e.g. a web page); the engine checks whether the proposal followed it. */
  sources?: UntrustedSource[];
}): Promise<GuardVerdict | null> {
  if (!(await apiHealth())) return null;
  const token = await policyToken(input.policy);
  if (!token) return null;
  try {
    return await ubotGuard({ policyToken: token }).check<GuardVerdict>({
      userMessage: input.userMessage,
      proposal: input.proposal,
      lang: input.lang,
      sources: input.sources,
    });
  } catch {
    return null;
  }
}

export async function apiExecute(proposal: AgentProposal, verdictId: string, choice: 'original' | 'counter_offer'): Promise<Execution | null> {
  if (!(await apiHealth())) return null;
  // The API confirms only a counter-offer. An allow executes on the verdict ticket alone.
  // Choosing the paused original returns null here, and the app finishes it as a local mock.
  let confirmation: string | undefined;
  if (choice === 'counter_offer') {
    const confirmOnce = async (retried: boolean): Promise<string | null> => {
      const sessionToken = await appSession(retried);
      if (!sessionToken) return null;
      try {
        return (await ubotGuard({ sessionToken }).confirm({ verdictId, choice: 'counter_offer' })).confirmation;
      } catch (err) {
        if (!retried && err instanceof GuardClientError && err.status === 403 && REFRESH_CODES.has(err.code)) return confirmOnce(true);
        return null;
      }
    };
    const got = await confirmOnce(false);
    if (!got) return null;
    confirmation = got;
  }
  const r = await post<{ execution: Execution }>('/api/agent/execute', {
    proposal,
    verdictId,
    userConfirmed: true,
    ...(confirmation ? { confirmation } : {}),
  });
  return r?.execution ?? null;
}

/** ElevenLabs audio from the Worker, or null so the caller uses browser speech. */
export async function apiTts(text: string, lang: Lang, clipId?: string): Promise<Blob | null> {
  const h = await apiHealth();
  if (!h || h.tts !== 'elevenlabs') return null;
  try {
    const r = await withSession((token) =>
      fetch('/api/voice/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-TopiaPause-Session': token },
        body: JSON.stringify(clipId ? { clipId, lang } : { text, lang }),
        signal: AbortSignal.timeout(15_000),
      }),
    );
    return r?.ok && (r.headers.get('Content-Type') ?? '').startsWith('audio/') ? await r.blob() : null;
  } catch {
    return null;
  }
}

export type SttResult = { transcript: string; action: VoiceAction } | { error: 'session' | 'stt' };

/** ElevenLabs transcript for a short reply. `error` tells the mic what to show. */
export async function apiStt(blob: Blob, lang: Lang = 'th'): Promise<SttResult | null> {
  try {
    const type = (blob.type || 'audio/webm').split(';')[0] || 'audio/webm';
    const r = await withSession((token) =>
      fetch(`/api/voice/stt?lang=${lang}`, {
        method: 'POST',
        headers: { 'Content-Type': type, 'X-TopiaPause-Session': token, 'X-TopiaPause-Lang': lang },
        body: blob,
        signal: AbortSignal.timeout(20_000),
      }),
    );
    if (!r) return { error: 'session' };
    if (!r.ok) {
      const code = await errorCode(r);
      if (r.status === 403 || code === 'session_required' || code === 'invalid_session') return { error: 'session' };
      return { error: 'stt' };
    }
    const data = (await r.json()) as { transcript?: unknown; action?: unknown };
    if (typeof data.transcript !== 'string') return { error: 'stt' };
    if (data.action !== 'counter_offer' && data.action !== 'cancel' && data.action !== 'unclear') return { error: 'stt' };
    return { transcript: data.transcript, action: data.action };
  } catch {
    return { error: 'stt' };
  }
}
