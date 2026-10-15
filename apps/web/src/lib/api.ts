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

let sessionPromise: Promise<string | null> | undefined;

/** Tests reset the cached health and session probes. */
export function resetApiCaches(): void {
  healthPromise = undefined;
  sessionPromise = undefined;
}

/** One short-lived token for this tab. Chat, TTS, policy, confirm, and speech-to-text send it back. */
function appSession(): Promise<string | null> {
  sessionPromise ??= post<{ session: string }>('/api/session', {}, 8000, false)
    .then((r) => r?.session ?? null)
    .catch(() => null);
  return sessionPromise;
}

async function post<T>(path: string, body: unknown, timeoutMs = 8000, session = false): Promise<T | null> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session) {
      const token = await appSession();
      if (!token) return null;
      headers['X-TopiaPause-Session'] = token;
    }
    const r = await fetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return r.ok ? ((await r.json()) as T) : null;
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
    const sessionToken = await appSession();
    if (!sessionToken) return null;
    try {
      confirmation = (await ubotGuard({ sessionToken }).confirm({ verdictId, choice: 'counter_offer' })).confirmation;
    } catch {
      return null;
    }
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
  const token = await appSession();
  if (!token) return null;
  try {
    const r = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TopiaPause-Session': token },
      body: JSON.stringify(clipId ? { clipId, lang } : { text, lang }),
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok && (r.headers.get('Content-Type') ?? '').startsWith('audio/') ? await r.blob() : null;
  } catch {
    return null;
  }
}

/** ElevenLabs transcript for a short reply, or null when the mic should step aside. */
export async function apiStt(blob: Blob): Promise<{ transcript: string; action: VoiceAction } | null> {
  const token = await appSession();
  if (!token) return null;
  try {
    const type = (blob.type || 'audio/webm').split(';')[0] || 'audio/webm';
    const r = await fetch('/api/voice/stt', {
      method: 'POST',
      headers: { 'Content-Type': type, 'X-TopiaPause-Session': token },
      body: blob,
      signal: AbortSignal.timeout(20_000),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { transcript?: unknown; action?: unknown };
    if (typeof data.transcript !== 'string') return null;
    if (data.action !== 'counter_offer' && data.action !== 'cancel' && data.action !== 'unclear') return null;
    return { transcript: data.transcript, action: data.action };
  } catch {
    return null;
  }
}
