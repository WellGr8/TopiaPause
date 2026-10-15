import type {
  AgentChatResponse,
  AgentProposal,
  Execution,
  GuardVerdict,
  Lang,
  SceneId,
  UntrustedSource,
  UserPolicy,
} from '@topiapause/shared';

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

async function post<T>(path: string, body: unknown, timeoutMs = 8000): Promise<T | null> {
  try {
    const r = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
  return post<ChatTurn>('/api/agent/chat', { sessionId: 'web', ...input }, 15_000);
}

// The user's rules travel as a token the Worker signed for this app, never as raw policy:
// the guard API ignores policies an agent might send.
const policyTokens = new Map<string, Promise<string | null>>();

function policyToken(policy: UserPolicy): Promise<string | null> {
  const key = JSON.stringify(policy);
  let t = policyTokens.get(key);
  if (!t) {
    t = post<{ policyToken: string }>('/api/policy', { policy }).then((r) => r?.policyToken ?? null);
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
  const { policy: _policy, ...rest } = input;
  return post<GuardVerdict>('/api/guard/check', { ...rest, policyToken: token });
}

export async function apiExecute(proposal: AgentProposal, verdictId: string): Promise<Execution | null> {
  if (!(await apiHealth())) return null;
  const r = await post<{ execution: Execution }>('/api/agent/execute', { proposal, verdictId, userConfirmed: true });
  return r?.execution ?? null;
}

/** ElevenLabs audio from the Worker, or null so the caller uses browser speech. */
export async function apiTts(text: string, lang: Lang): Promise<Blob | null> {
  const h = await apiHealth();
  if (!h || h.tts !== 'elevenlabs') return null;
  try {
    const r = await fetch('/api/voice/tts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, lang }),
      signal: AbortSignal.timeout(15_000),
    });
    return r.ok && (r.headers.get('Content-Type') ?? '').startsWith('audio/') ? await r.blob() : null;
  } catch {
    return null;
  }
}
