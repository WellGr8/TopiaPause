import type { Lang } from '@topiapause/shared';
import { apiTts } from './api';

// Voice output order (ARCHITECTURE §2 notes):
//   1. pre-generated ElevenLabs clips from apps/web/public/audio (scripts/pregen-voice.ts)
//   2. live ElevenLabs TTS via POST /api/voice/tts (Worker proxy; skipped when health says unavailable)
//   3. browser speechSynthesis
//   4. text only

export type ClipLine = 'pause' | 'warning' | 'counter' | 'confirm' | 'why';

interface ClipEntry {
  file: string;
  /** Engine voiceText of the scene + language the clip was written for. */
  text: string;
}
interface Manifest {
  clips: Record<string, ClipEntry>;
}

let manifestPromise: Promise<Manifest | null> | undefined;

function loadManifest(): Promise<Manifest | null> {
  manifestPromise ??= fetch('/audio/manifest.json')
    .then((r) => (r.ok && (r.headers.get('Content-Type') ?? '').includes('json') ? (r.json() as Promise<Manifest>) : null))
    .catch(() => null);
  return manifestPromise;
}

export interface VoiceEvents {
  onStart: () => void;
  onEnd: () => void;
  /** Autoplay was refused or no voice is available; the UI shows a play affordance. */
  onBlocked: () => void;
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

/**
 * Clip URLs for `lines` of a guard verdict, or null unless every line exists and was
 * written for exactly this voiceText. `clipId` is the engine's `<scene>-<decision>`.
 */
export async function clipUrls(clipId: string, lang: Lang, voiceText: string, lines: ClipLine[]): Promise<string[] | null> {
  const clips = (await loadManifest())?.clips;
  if (!clips) return null;
  const scene = clipId.split('-')[0];
  const urls: string[] = [];
  for (const line of lines) {
    const c = clips[`${scene}-${lang}-${line}`];
    if (!c?.file || !c.text || normalize(c.text) !== normalize(voiceText)) return null;
    urls.push(`/audio/${c.file}`);
  }
  return urls;
}

let current: (() => void) | null = null;
let generation = 0;

const ttsCache = new Map<string, string>();

async function ttsUrl(text: string, lang: Lang, clipId?: string): Promise<string | null> {
  const key = `${lang}|${clipId ?? ''}|${text}`;
  const hit = ttsCache.get(key);
  if (hit) return hit;
  const blob = await apiTts(text, lang, clipId);
  if (!blob) return null;
  const url = URL.createObjectURL(blob);
  ttsCache.set(key, url);
  return url;
}

export function stopVoice(): void {
  generation++;
  current?.();
  current = null;
}

/** Plays `urls` back to back. Resolves false if the first one can't start (autoplay refused, 404). */
async function playSequence(urls: string[], ev: VoiceEvents, gen: number): Promise<boolean> {
  const audios = urls.map((u) => {
    const a = new Audio(u);
    a.preload = 'auto';
    return a;
  });
  let i = 0;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    if (current === stop) current = null;
    ev.onEnd();
  };
  const stop = () => {
    audios[i]?.pause();
    finish();
  };
  audios.forEach((a, n) => {
    a.onended = () => {
      if (ended || gen !== generation) return;
      i = n + 1;
      const next = audios[i];
      if (!next) return finish();
      next.play().catch(finish);
    };
  });
  try {
    await audios[0]!.play();
  } catch {
    return false;
  }
  if (gen !== generation) {
    audios[0]!.pause();
    return true;
  }
  current = stop;
  ev.onStart();
  return true;
}

/**
 * Speaks a guard verdict: the warning + counter clips when both were generated for this
 * exact voiceText, else the combined pause clip, else live TTS, else browser speech.
 */
export async function speak(input: { text: string; lang: Lang; clipId?: string }, ev: VoiceEvents): Promise<void> {
  stopVoice();
  const gen = generation;
  const clips = input.clipId
    ? ((await clipUrls(input.clipId, input.lang, input.text, ['warning', 'counter'])) ?? (await clipUrls(input.clipId, input.lang, input.text, ['pause'])))
    : null;
  if (gen !== generation) return;
  // A user-rule sentence does not match the scene clip. Ask TTS for this exact text;
  // if the worker rejects it, browser speech says the same line.
  const urls = clips ?? [await ttsUrl(input.text, input.lang)].filter((u): u is string => Boolean(u));
  if (gen !== generation) return;
  if (urls.length && (await playSequence(urls, ev, gen))) return;
  if (gen !== generation) return;

  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    ev.onBlocked();
    return;
  }
  const synth = window.speechSynthesis;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(input.text);
  u.lang = input.lang === 'th' ? 'th-TH' : 'en-US';
  const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(input.lang));
  if (voice) u.voice = voice;
  u.rate = input.lang === 'th' ? 0.95 : 1;
  let started = false;
  u.onstart = () => {
    started = true;
    ev.onStart();
  };
  u.onend = ev.onEnd;
  u.onerror = (e) => (started && e.error === 'interrupted' ? ev.onEnd() : ev.onBlocked());
  current = () => {
    synth.cancel();
    ev.onEnd();
  };
  synth.speak(u);
  // Some browsers silently drop speech without user activation and never fire onstart.
  window.setTimeout(() => {
    if (!started && !synth.speaking) ev.onBlocked();
  }, 1200);
}

/** Plays one pre-generated line (e.g. the confirmation) if it exists for this voiceText; otherwise stays silent. */
export async function speakClip(input: { clipId: string; lang: Lang; voiceText: string; line: ClipLine }, ev: VoiceEvents): Promise<boolean> {
  stopVoice();
  const gen = generation;
  const urls = await clipUrls(input.clipId, input.lang, input.voiceText, [input.line]);
  if (!urls || gen !== generation) return false;
  return playSequence(urls, ev, gen);
}
