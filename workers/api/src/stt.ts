import { mapVoiceIntent, type VoiceAction } from '@topiapause/shared';
import { chargePaid, HttpError, log, type AppEnv } from './http';

// ElevenLabs Scribe proxy. The key stays on the Worker. Audio and the transcript
// are not stored, cached, or written to logs.

const STT_URL = 'https://api.elevenlabs.io/v1/speech-to-text';
const DEFAULT_MODEL = 'scribe_v2';
export const MAX_STT_BYTES = 300 * 1024;
const MAX_TRANSCRIPT = 400;

const AUDIO_TYPES = new Set([
  'audio/webm',
  'audio/mp4',
  'audio/mpeg',
  'audio/mp3',
  'audio/wav',
  'audio/wave',
  'audio/x-wav',
  'audio/ogg',
  'audio/aac',
  'audio/x-m4a',
  'audio/m4a',
]);

export function sttConfigured(env: AppEnv): boolean {
  return Boolean(env.ELEVENLABS_API_KEY);
}

export function audioMime(header: string | null): string | null {
  if (!header) return null;
  const base = header.split(';')[0]?.trim().toLowerCase() ?? '';
  return AUDIO_TYPES.has(base) ? base : null;
}

export async function readAudio(req: Request): Promise<{ bytes: Uint8Array; mime: string }> {
  const mime = audioMime(req.headers.get('Content-Type'));
  if (!mime) throw new HttpError(415, 'unsupported_media_type', 'Send an audio clip: webm, mp4, mpeg, wav, or ogg');
  const declared = Number(req.headers.get('Content-Length') ?? 0);
  if (Number.isFinite(declared) && declared > MAX_STT_BYTES) {
    throw new HttpError(413, 'payload_too_large', `Audio must be at most ${MAX_STT_BYTES} bytes`);
  }
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) throw new HttpError(400, 'invalid_input', 'Audio clip is empty');
  if (bytes.byteLength > MAX_STT_BYTES) throw new HttpError(413, 'payload_too_large', `Audio must be at most ${MAX_STT_BYTES} bytes`);
  return { bytes, mime };
}

function extOf(mime: string): string {
  if (mime === 'audio/mp4' || mime === 'audio/m4a' || mime === 'audio/x-m4a') return 'mp4';
  if (mime === 'audio/mpeg' || mime === 'audio/mp3') return 'mp3';
  if (mime === 'audio/wav' || mime === 'audio/wave' || mime === 'audio/x-wav') return 'wav';
  if (mime === 'audio/ogg') return 'ogg';
  if (mime === 'audio/aac') return 'aac';
  return 'webm';
}

export async function transcribe(
  env: AppEnv,
  audio: { bytes: Uint8Array; mime: string },
  lang: 'th' | 'en' = 'th',
): Promise<{ transcript: string; action: VoiceAction }> {
  if (!sttConfigured(env)) {
    throw new HttpError(503, 'stt_unavailable', 'Speech-to-text is not configured (missing ELEVENLABS_API_KEY). Use the buttons.');
  }
  if (!chargePaid(env)) throw new HttpError(503, 'spend_cap', 'Daily voice and chat limit reached. Use the buttons.');

  const model = env.ELEVENLABS_STT_MODEL_ID || DEFAULT_MODEL;
  const form = new FormData();
  form.append('file', new Blob([audio.bytes], { type: audio.mime }), `reply.${extOf(audio.mime)}`);
  form.append('model_id', model);
  form.append('tag_audio_events', 'false');
  form.append('language_code', lang === 'en' ? 'eng' : 'tha');

  const started = Date.now();
  const upstream = await fetch(STT_URL, {
    method: 'POST',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY! },
    body: form,
    signal: AbortSignal.timeout(20_000),
  }).catch((e: unknown) => {
    log({ message: 'stt fetch failed', error: e instanceof Error ? e.name : 'error' });
    return null;
  });

  if (!upstream?.ok) {
    log({ message: 'stt upstream error', status: upstream?.status ?? 0, ms: Date.now() - started });
    throw new HttpError(502, 'stt_failed', 'Speech-to-text failed. Use the buttons.');
  }

  let text = '';
  let languageCode: string | undefined;
  let languageProbability: number | undefined;
  try {
    const data = (await upstream.json()) as { text?: unknown; language_code?: unknown; language_probability?: unknown };
    text = typeof data.text === 'string' ? data.text : '';
    if (typeof data.language_code === 'string') languageCode = data.language_code;
    if (typeof data.language_probability === 'number') languageProbability = data.language_probability;
  } catch {
    log({ message: 'stt bad response', ms: Date.now() - started });
    throw new HttpError(502, 'stt_failed', 'Speech-to-text failed. Use the buttons.');
  }

  const transcript = text.trim().slice(0, MAX_TRANSCRIPT);
  log({
    message: 'stt ok',
    model,
    ms: Date.now() - started,
    bytes: audio.bytes.byteLength,
    language_code: languageCode,
    language_probability: languageProbability,
  });
  return { transcript, action: mapVoiceIntent(transcript) };
}
