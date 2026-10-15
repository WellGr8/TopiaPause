import type { Lang } from '@topiapause/shared';

// Voice output order (ARCHITECTURE §2 notes):
//   1. pre-generated ElevenLabs clip from demo/audio (served at /audio)
//   2. TODO: live TTS via POST /api/voice/tts (ElevenLabs proxy, stub in workers/api)
//   3. browser speechSynthesis
//   4. text only

interface ClipEntry {
  file: string;
  text?: string;
}
interface Manifest {
  clips: Record<string, ClipEntry>;
}

let manifestPromise: Promise<Manifest | null> | undefined;

function loadManifest(): Promise<Manifest | null> {
  manifestPromise ??= fetch('/audio/manifest.json')
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
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

let current: (() => void) | null = null;

export function stopVoice(): void {
  current?.();
  current = null;
}

export async function speak(input: { text: string; lang: Lang; clipId?: string }, ev: VoiceEvents): Promise<void> {
  stopVoice();
  const manifest = input.clipId ? await loadManifest() : null;
  const clip = input.clipId ? manifest?.clips[input.clipId.replace('-', `-${input.lang}-`)] : undefined;

  if (clip && (!clip.text || normalize(clip.text) === normalize(input.text))) {
    const audio = new Audio(`/audio/${clip.file}`);
    audio.onended = ev.onEnd;
    try {
      await audio.play();
      ev.onStart();
      current = () => {
        audio.pause();
        ev.onEnd();
      };
      return;
    } catch {
      // autoplay refused or file missing: fall through
    }
  }

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
