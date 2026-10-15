// Typed client for the TopiaPause guard API. No runtime dependencies.
// A real agent calls check() before it pays, then confirm() only for the counter-offer.

export class GuardClientError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface GuardCheckInput {
  /** The user's own words, verbatim. TopiaPause derives intent from this. */
  userMessage: string;
  lang?: 'th' | 'en';
  /** Full proposal (what U-Bot sends). */
  proposal?: object;
  /** Generic action (what any other agent sends). */
  agent?: { name: string; version?: string };
  action?: object;
  amount?: object;
  alternatives?: object[];
  sources?: object[];
}

export interface GuardConfirmation {
  confirmation: string;
}

interface HttpResponse {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}

type HttpFetch = (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<HttpResponse>;

export interface CreateGuardOptions {
  /** Origin of the Worker, with no path. Use "" in the TopiaPause app itself. */
  baseUrl: string;
  /** Signed by the user's app via POST /api/policy. Omit for the default demo policy. */
  policyToken?: string;
  /** Browser session for confirm(). The cookie is sent automatically on the same origin. */
  sessionToken?: string;
  fetch?: HttpFetch;
}

function rootOf(baseUrl: string): string {
  return baseUrl.replace(/\/$/, '');
}

async function request<T>(doFetch: HttpFetch, url: string, body: unknown, headers: Record<string, string>): Promise<T> {
  const res = await doFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  if (!res.ok) {
    throw new GuardClientError(res.status, data?.error?.code ?? 'request_failed', data?.error?.message ?? `Guard request failed (${res.status})`);
  }
  return data as T;
}

export function createGuard(options: CreateGuardOptions) {
  const root = rootOf(options.baseUrl);
  const doFetch: HttpFetch = options.fetch ?? ((url, init) => (globalThis as unknown as { fetch: HttpFetch }).fetch(url, init));

  return {
    /** POST /api/guard/check. Policy and intent are never sent by the agent. */
    async check<T = unknown>(input: GuardCheckInput): Promise<T> {
      const raw = input as GuardCheckInput & { policy?: unknown; intent?: unknown };
      if ('policy' in raw || 'intent' in raw) {
        throw new GuardClientError(400, 'agent_field_rejected', 'Send userMessage and a policyToken. Agents cannot send policy or intent.');
      }
      const body: Record<string, unknown> = { ...input };
      if (options.policyToken) body.policyToken = options.policyToken;
      return request<T>(doFetch, `${root}/api/guard/check`, body, {});
    },

    /**
     * POST /api/confirm. Only the counter-offer. The paused original is not confirmable.
     */
    async confirm(input: { verdictId: string; choice: 'counter_offer' }): Promise<GuardConfirmation> {
      if ((input as { choice: string }).choice !== 'counter_offer') {
        throw new GuardClientError(400, 'original_not_confirmable', 'Only the counter-offer can be confirmed');
      }
      const headers: Record<string, string> = {};
      if (options.sessionToken) headers['X-TopiaPause-Session'] = options.sessionToken;
      return request<GuardConfirmation>(doFetch, `${root}/api/confirm`, { verdictId: input.verdictId, choice: 'counter_offer' }, headers);
    },
  };
}

export type GuardClient = ReturnType<typeof createGuard>;
