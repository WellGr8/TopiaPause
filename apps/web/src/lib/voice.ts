import type { Lang } from '@topiapause/shared';

// Voice output order (ARCHITECTURE §2 notes):
//   1. pre-generated ElevenLabs clip from demo/audio (served at /audio)
//   2. TODO: live TTS via POST /api/voice/tts (ElevenLabs proxy, stub in workers/api)
//   3. browser speechSynthesis
//   4. text only

export type VoiceSource = 'clip' | 'speech' | 'none';

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

export interface Playback {
  source: VoiceSource;
  stop: () => void;
}

const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();

export async function speak(
  input: { text: string; lang: Lang; clipId?: string },
  onEnd: () => void,
): Promise<Playback> {
  const manifest = input.clipId ? await loadManifest() : null;
  const clip = input.clipId ? manifest?.clips[`${input.clipId.replace('-', `-${input.lang}-`)}`] : undefined;

  if (clip && (!clip.text || normalize(clip.text) === normalize(input.text))) {
    const audio = new Audio(`/audio/${clip.file}`);
    audio.onended = onEnd;
    audio.onerror = onEnd;
    try {
      await audio.play();
      return {
        source: 'clip',
        stop: () => {
          audio.pause();
          onEnd();
        },
      };
    } catch {
      // fall through to speech synthesis
    }
  }

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const synth = window.speechSynthesis;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(input.text);
    u.lang = input.lang === 'th' ? 'th-TH' : 'en-US';
    const voice = synth.getVoices().find((v) => v.lang.toLowerCase().startsWith(input.lang));
    if (voice) u.voice = voice;
    u.rate = input.lang === 'th' ? 0.95 : 1;
    u.onend = onEnd;
    u.onerror = onEnd;
    synth.speak(u);
    return {
      source: 'speech',
      stop: () => {
        synth.cancel();
        onEnd();
      },
    };
  }

  onEnd();
  return { source: 'none', stop: () => {} };
}
