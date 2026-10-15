import type { ApiError } from '@topiapause/shared';
import type { z } from 'zod';
import { issues } from './schemas';

/** Optional secrets: `.dev.vars` locally, `wrangler secret put` in production. Absent = fallback mode. */
export interface Secrets {
  LLM_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
}
export type AppEnv = Env & Secrets;

export const MAX_BODY_BYTES = 32 * 1024;

/** Routes any origin may call (the public guard API). Everything else is same-origin only. */
export const PUBLIC_ROUTES = new Set(['/api/guard/check', '/api/health']);

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
      'Access-Control-Allow-Headers': 'Content-Type',
      Vary: 'Origin',
    };
  }
  return {};
}

export function json(data: unknown, status = 200, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers },
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

export async function readBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.output<S>> {
  if (!(req.headers.get('Content-Type') ?? '').includes('application/json')) {
    throw new HttpError(415, 'unsupported_media_type', 'Send Content-Type: application/json');
  }
  const declared = Number(req.headers.get('Content-Length') ?? 0);
  if (declared > MAX_BODY_BYTES) throw new HttpError(413, 'payload_too_large', `Body must be at most ${MAX_BODY_BYTES} bytes`);
  const text = await req.text();
  if (new TextEncoder().encode(text).byteLength > MAX_BODY_BYTES) {
    throw new HttpError(413, 'payload_too_large', `Body must be at most ${MAX_BODY_BYTES} bytes`);
  }
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new HttpError(400, 'invalid_json', 'Body is not valid JSON');
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new HttpError(400, 'invalid_input', issues(parsed.error));
  return parsed.data;
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
