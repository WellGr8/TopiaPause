import { chargePaid, HttpError, log, type AppEnv } from './http';

// ElevenLabs text-to-speech proxy. The key stays on the Worker; the browser only sees
// audio/mpeg. Responses are cached by (voice, model, text) so stage rehearsals don't burn credits.

const DEFAULT_MODEL = 'eleven_v4';
const OUTPUT = 'mp3_44100_128';

export function ttsConfigured(env: AppEnv): boolean {
  return Boolean(env.ELEVENLABS_API_KEY && env.ELEVENLABS_VOICE_ID);
}

async function cacheKey(voice: string, model: string, text: string): Promise<Request> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${voice}|${model}|${text}`));
  const hex = [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
  return new Request(`https://tts-cache.topiapause.internal/${hex}.mp3`);
}

export async function tts(env: AppEnv, text: string, ctx?: ExecutionContext): Promise<Response> {
  if (!ttsConfigured(env)) {
    const missing = [!env.ELEVENLABS_API_KEY && 'ELEVENLABS_API_KEY', !env.ELEVENLABS_VOICE_ID && 'ELEVENLABS_VOICE_ID'].filter(Boolean).join(', ');
    throw new HttpError(503, 'tts_unavailable', `ElevenLabs is not configured (missing ${missing}). Use browser speech instead.`);
  }
  if (!chargePaid(env)) throw new HttpError(503, 'spend_cap', 'Daily voice and chat limit reached. Use browser speech.');
  const voice = env.ELEVENLABS_VOICE_ID;
  const model = env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL;
  const cache = typeof caches !== 'undefined' ? caches.default : undefined;
  const key = await cacheKey(voice, model, text);
  const hit = await cache?.match(key);
  if (hit) return new Response(hit.body, { headers: { 'Content-Type': 'audio/mpeg', 'X-TTS-Cache': 'hit' } });

  const started = Date.now();
  const upstream = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voice)}?output_format=${OUTPUT}`, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY!, 'Content-Type': 'application/json', Accept: 'audio/mpeg' },
    body: JSON.stringify({ text, model_id: model }),
    signal: AbortSignal.timeout(20_000),
  }).catch((e: unknown) => {
    log({ message: 'tts fetch failed', error: e instanceof Error ? e.name : String(e) });
    return null;
  });

  if (!upstream || !upstream.ok || !upstream.body) {
    log({ message: 'tts upstream error', status: upstream?.status, ms: Date.now() - started });
    throw new HttpError(502, 'tts_failed', 'ElevenLabs request failed. Use browser speech instead.');
  }
  log({ message: 'tts ok', model, ms: Date.now() - started });

  const headers = { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, max-age=86400', 'X-TTS-Cache': 'miss' };
  if (!cache) return new Response(upstream.body, { headers });
  const [toClient, toCache] = upstream.body.tee();
  const put = cache.put(key, new Response(toCache, { headers: { ...headers, 'Cache-Control': 'public, max-age=604800' } }));
  if (ctx) ctx.waitUntil(put);
  else void put;
  return new Response(toClient, { headers });
}
