import type { ApiError } from '@topiapause/shared';
import type { z } from 'zod';
import { issues } from './schemas';

/** Optional secrets: `.dev.vars` locally, `wrangler secret put` in production. Absent = fallback mode. */
export interface Secrets {
  LLM_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  /** HMAC key for policy tokens, sessions, and verdict tickets. Required unless DEV=1. */
  POLICY_SIGNING_KEY?: string;
  TOKENOMIST_API_KEY?: string;
  /** Set to "1" only in local `.dev.vars`. Production must leave this unset. */
  DEV?: string;
  /** Max LLM + TTS + STT upstream calls per isolate per UTC day. Default 300. */
  PAID_DAILY_MAX?: string;
  /** Scribe model id. Default scribe_v2. */
  ELEVENLABS_STT_MODEL_ID?: string;
}
export type AppEnv = Env & Secrets;

export const MAX_BODY_BYTES = 32 * 1024;

/** Routes any origin may call (the public guard API). Everything else is same-origin only. */
export const PUBLIC_ROUTES = new Set(['/api/guard/check', '/api/health']);

/**
 * App routes reject a cross-site browser call and a missing Origin.
 * CORS headers alone do not stop a POST that ignores them.
 * `DEV=1` (local `.dev.vars` only) still allows a missing Origin.
 */
export function assertSameOrigin(req: Request, env: AppEnv): void {
  const site = req.headers.get('Sec-Fetch-Site');
  if (site === 'cross-site') {
    throw new HttpError(403, 'forbidden_origin', 'This route only accepts same-origin requests');
  }
  const origin = req.headers.get('Origin');
  if (!origin) {
    if (env.DEV === '1') return;
    throw new HttpError(403, 'forbidden_origin', 'This route only accepts same-origin requests');
  }
  const self = new URL(req.url).origin;
  const allowed = origin === self || (Boolean(env.ALLOWED_ORIGIN) && origin === env.ALLOWED_ORIGIN);
  if (!allowed) throw new HttpError(403, 'forbidden_origin', 'This route only accepts same-origin requests');
}

export function corsHeaders(req: Request, env: AppEnv, path: string): Record<string, string> {
  const origin = req.headers.get('Origin');
  if (PUBLIC_ROUTES.has(path)) {
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    };
  }
  if (origin && env.ALLOWED_ORIGIN && origin === env.ALLOWED_ORIGIN) {
    return {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-TopiaPause-Session',
      Vary: 'Origin',
    };
  }
  return {};
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'no-referrer',
      ...headers,
    },
  });
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly headers: Record<string, string> = {},
  ) {
    super(message);
  }
  toResponse(): Response {
    const body: ApiError = { error: { code: this.code, message: this.message } };
    return json(body, this.status, this.headers);
  }
}

/** Size-checked JSON body, unvalidated. */
export async function readJson(req: Request): Promise<unknown> {
  if (!(req.headers.get('Content-Type') ?? '').includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send Content-Type: application/json');
  }
  const declared = Number(req.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', `Body must be at most ${MAX_BODY_BYTES} bytes`);
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large', `Body must be at most ${MAX_BODY_BYTES} bytes`);
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'Body is not valid JSON');
  }
}

export function parseJson<S extends z.ZodType>(raw: unknown, schema: S): z.output<S> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, 'invalid_input', issues(parsed.error));
  return parsed.data;
}

export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  return parseJson(await readJson(req), schema);
}

const isolateHits = new Map<string, number[]>();
const ISOLATE_WINDOW_MS = 60_000;
const ISOLATE_LIMIT = 20;

const paidSpend = new Map<string, { day: string; n: number }>();

/** Drops in-memory buckets. Tests call this so one suite does not trip the next. */
export function resetIsolateRateLimit(): void {
  isolateHits.clear();
  paidSpend.clear();
}

/**
 * Counts LLM, TTS, and speech-to-text upstream calls for this isolate. Over the daily
 * cap the caller skips the paid provider. The counter is not shared across isolates.
 */
export function chargePaid(env: AppEnv): boolean {
  const raw = env.PAID_DAILY_MAX;
  const parsed = raw === undefined || raw === '' ? 300 : Number(raw);
  const max = Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 300;
  const day = new Date().toISOString().slice(0, 10);
  const cur = paidSpend.get('paid');
  const n = cur && cur.day === day ? cur.n : 0;
  if (n >= max) return false;
  paidSpend.set('paid', { day, n: n + 1 });
  return true;
}

/**
 * Per-IP limit that lives in this isolate. Paid routes use it even when the Workers
 * Rate Limiting binding is absent (local dev, tests). Returns 429 once the window is full.
 */
export function isolateRateLimit(req: Request, bucket: string, limit = ISOLATE_LIMIT): void {
  const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
  const key = `${bucket}:${ip}`;
  const now = Date.now();
  const hits = (isolateHits.get(key) ?? []).filter((t) => now - t < ISOLATE_WINDOW_MS);
  if (hits.length >= limit) {
    throw new HttpError(429, 'rate_limited', 'Too many requests, slow down', { 'Retry-After': '60' });
  }
  hits.push(now);
  isolateHits.set(key, hits);
}

/** Per-client limit via the Workers Rate Limiting binding. A missing binding means no limit (tests). */
export async function rateLimit(limiter: RateLimit | undefined, req: Request, bucket: string): Promise<void> {
  if (!limiter) return;
  const ip = req.headers.get('CF-Connecting-IP') ?? 'local';
  const { success } = await limiter.limit({ key: `${bucket}:${ip}` });
  if (!success) throw new HttpError(429, 'rate_limited', 'Too many requests, slow down', { 'Retry-After': '60' });
}

export function log(fields: Record<string, unknown>): void {
  console.log(JSON.stringify(fields));
}
