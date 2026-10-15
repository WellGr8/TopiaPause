import { Mic } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Lang, VoiceAction } from '@topiapause/shared';
import { t } from '../copy';
import { apiStt } from '../lib/api';
import { stopVoice } from '../lib/voice';

const MAX_RECORD_MS = 6000;
const SILENCE_MS = 1200;
const SILENCE_RMS = 0.02;

type Phase = 'ready' | 'recording' | 'sending' | 'review' | 'error' | 'unsupported';
type Failure = 'denied' | 'hear' | 'connect';

interface Heard {
  transcript: string;
  action: VoiceAction;
}

function recorderSupported(): boolean {
  return typeof MediaRecorder !== 'undefined' && typeof navigator.mediaDevices?.getUserMedia === 'function';
}

function mimeType(): string {
  const types = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4'];
  return types.find((type) => MediaRecorder.isTypeSupported?.(type)) ?? '';
}

/**
 * Tap to record a short reply. Speech never pays: the recognized line stays on
 * screen until the user taps once more. The choice buttons above this block stay put.
 */
export function VoiceReply({
  lang,
  canCounter,
  onConfirm,
}: {
  lang: Lang;
  canCounter: boolean;
  onConfirm: (choice: 'counter_offer' | 'cancel') => void;
}) {
  const [phase, setPhase] = useState<Phase>(recorderSupported() ? 'ready' : 'unsupported');
  const [heard, setHeard] = useState<Heard | null>(null);
  const [failure, setFailure] = useState<Failure | null>(null);
  const [level, setLevel] = useState(0);
  const root = useRef<HTMLDivElement>(null);
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef(0);
  const meter = useRef(0);

  useEffect(() => {
    root.current?.scrollIntoView({ block: 'nearest' });
  }, [phase]);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      window.clearTimeout(meter.current);
      if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
    },
    [],
  );

  const stop = () => {
    window.clearTimeout(timer.current);
    window.clearTimeout(meter.current);
    if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
  };

  const watchLevel = (stream: MediaStream, rec: MediaRecorder) => {
    const Ctx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    try {
      const audio = new Ctx();
      const source = audio.createMediaStreamSource(stream);
      const analyser = audio.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.fftSize);
      let spoke = false;
      let silentFor = 0;
      const tick = () => {
        if (rec.state !== 'recording') {
          void audio.close();
          return;
        }
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const sample of data) {
          const n = (sample - 128) / 128;
          sum += n * n;
        }
        const rms = Math.sqrt(sum / data.length);
        setLevel(rms);
        if (rms >= SILENCE_RMS) {
          spoke = true;
          silentFor = 0;
        } else if (spoke) {
          silentFor += 100;
        }
        if (spoke && silentFor >= SILENCE_MS) {
          rec.stop();
          void audio.close();
          return;
        }
        meter.current = window.setTimeout(tick, 100);
      };
      meter.current = window.setTimeout(tick, 100);
    } catch {
      // A browser without an analyser still records until the 6 second cap.
    }
  };

  const start = async () => {
    stopVoice();
    setHeard(null);
    setFailure(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
    } catch {
      setFailure('denied');
      setPhase('error');
      return;
    }
    const mime = mimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime, audioBitsPerSecond: 48_000 } : { audioBitsPerSecond: 48_000 });
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setFailure('hear');
      setPhase('error');
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    rec.onstop = () => {
      window.clearTimeout(meter.current);
      setLevel(0);
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      const blob = new Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] });
      if (blob.size === 0) {
        setHeard({ transcript: '', action: 'unclear' });
        setPhase('review');
        return;
      }
      setPhase('sending');
      void apiStt(blob, lang).then((result) => {
        if (!result || 'error' in result) {
          setFailure(!result || result.error === 'session' ? 'connect' : 'hear');
          setPhase('error');
          return;
        }
        const action = result.action === 'counter_offer' && !canCounter ? 'unclear' : result.action;
        setHeard({ transcript: result.transcript, action });
        setPhase('review');
      });
    };
    recorder.current = rec;
    rec.start();
    setPhase('recording');
    watchLevel(stream, rec);
    timer.current = window.setTimeout(() => {
      if (rec.state === 'recording') rec.stop();
    }, MAX_RECORD_MS);
  };

  const again = () => {
    setHeard(null);
    setFailure(null);
    setPhase('ready');
  };

  const action = heard && heard.action !== 'unclear' ? heard.action : null;
  const bars = [0.25, 0.5, 0.75, 1];

  return (
    <div ref={root} className="mt-4" data-testid="voice-reply">
      {(phase === 'ready' || phase === 'recording' || phase === 'sending') && (
        <button
          type="button"
          data-testid="voice-mic"
          onClick={() => (phase === 'recording' ? stop() : void start())}
          disabled={phase === 'sending'}
          aria-pressed={phase === 'recording'}
          className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-control border border-line bg-surface px-4 text-[17px] font-semibold text-ink disabled:opacity-40"
        >
          <Mic size={20} aria-hidden="true" />
          {phase === 'recording' ? t(lang, 'micStop') : phase === 'sending' ? t(lang, 'micHearing') : t(lang, 'mic')}
          {phase === 'recording' && (
            <span className="ml-1 flex h-4 items-end gap-0.5" aria-hidden="true" data-testid="voice-meter">
              {bars.map((mark) => (
                <span key={mark} className="w-1 rounded-full bg-ink" style={{ height: `${level >= mark * SILENCE_RMS * 4 ? 16 : 4}px` }} />
              ))}
            </span>
          )}
        </button>
      )}

      {phase === 'review' && heard && (
        <div data-testid="voice-review" className="space-y-3" aria-live="polite">
          <p className="text-[17px] leading-relaxed text-ink">
            {t(lang, 'voiceHeard')}: “{heard.transcript}”
          </p>
          {heard.action === 'unclear' ? (
            <p className="text-[17px] leading-relaxed text-ink">{t(lang, 'voiceUnclear')}</p>
          ) : (
            <>
              <p className="text-[17px] font-semibold leading-relaxed text-ink">
                {heard.action === 'counter_offer' ? t(lang, 'voiceWillCounter') : t(lang, 'voiceWillCancel')}
              </p>
              <p className="text-[17px] leading-relaxed text-ink">{t(lang, 'voiceTap')}</p>
            </>
          )}
          <div className="flex flex-wrap gap-2">
            {action && (
              <button
                type="button"
                data-testid="voice-confirm"
                onClick={() => onConfirm(action)}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-control border border-line bg-surface px-4 text-[17px] font-semibold text-ink"
              >
                {t(lang, 'voiceTap')}
              </button>
            )}
            {heard.action === 'unclear' && canCounter && (
              <button
                type="button"
                data-testid="voice-use-recommended"
                onClick={() => onConfirm('counter_offer')}
                className="inline-flex min-h-12 flex-1 items-center justify-center rounded-control border border-line bg-surface px-4 text-[17px] font-semibold text-ink"
              >
                {t(lang, 'voiceUseRecommended')}
              </button>
            )}
            <button
              type="button"
              data-testid="voice-again"
              onClick={again}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-control border border-line bg-surface px-4 text-[17px] font-semibold text-ink"
            >
              {t(lang, 'voiceRetry')}
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="space-y-3" data-testid="voice-error">
          <p className="text-[17px] leading-relaxed text-ink">
            {failure === 'denied' ? t(lang, 'voiceMicDenied') : failure === 'hear' ? t(lang, 'voiceHear') : t(lang, 'voiceConnect')}
          </p>
          <p className="text-[17px] leading-relaxed text-ink">{t(lang, 'voiceAbove')}</p>
          <button
            type="button"
            data-testid="voice-retry"
            onClick={() => void start()}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-control border border-line bg-surface px-4 text-[17px] font-semibold text-ink"
          >
            {t(lang, 'voiceTryAgain')}
          </button>
        </div>
      )}

      {phase === 'unsupported' && <p className="text-[17px] leading-relaxed text-ink">{t(lang, 'voiceInApp')}</p>}
    </div>
  );
}
