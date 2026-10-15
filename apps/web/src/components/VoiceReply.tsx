import { Mic } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { Lang, VoiceAction } from '@topiapause/shared';
import { t } from '../copy';
import { apiStt } from '../lib/api';
import { stopVoice } from '../lib/voice';

const MAX_RECORD_MS = 6000;

type Phase = 'ready' | 'recording' | 'sending' | 'review' | 'hidden';

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
 * Tap to record a short reply. Speech never pays: the recognized line and the
 * action it maps to stay on screen until the user taps once more.
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
  const [phase, setPhase] = useState<Phase>(recorderSupported() ? 'ready' : 'hidden');
  const [heard, setHeard] = useState<Heard | null>(null);
  const [unsupported] = useState(() => !recorderSupported());
  const recorder = useRef<MediaRecorder | null>(null);
  const timer = useRef(0);

  useEffect(
    () => () => {
      window.clearTimeout(timer.current);
      if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
    },
    [],
  );

  if (unsupported) return null;

  const stop = () => {
    window.clearTimeout(timer.current);
    if (recorder.current && recorder.current.state === 'recording') recorder.current.stop();
  };

  const start = async () => {
    stopVoice();
    setHeard(null);
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setPhase('hidden');
      return;
    }
    const mime = mimeType();
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    } catch {
      stream.getTracks().forEach((track) => track.stop());
      setPhase('hidden');
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    rec.onstop = () => {
      stream.getTracks().forEach((track) => track.stop());
      recorder.current = null;
      const blob = new Blob(chunks, { type: (mime || 'audio/webm').split(';')[0] });
      if (blob.size === 0) {
        setHeard({ transcript: '', action: 'unclear' });
        setPhase('review');
        return;
      }
      setPhase('sending');
      void apiStt(blob).then((result) => {
        if (!result) {
          setPhase('hidden');
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
    timer.current = window.setTimeout(() => {
      if (rec.state === 'recording') rec.stop();
    }, MAX_RECORD_MS);
  };

  const action = heard && heard.action !== 'unclear' ? heard.action : null;

  return (
    <div className="mt-4">
      {phase !== 'hidden' && phase !== 'review' && (
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
            <p className="text-[17px] font-semibold leading-relaxed text-ink">
              {heard.action === 'counter_offer' ? t(lang, 'voiceWillCounter') : t(lang, 'voiceWillCancel')}
            </p>
          )}
          <div className="flex gap-2">
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
            <button
              type="button"
              onClick={() => {
                setHeard(null);
                setPhase('ready');
              }}
              className="inline-flex min-h-12 flex-1 items-center justify-center rounded-control border border-line bg-surface px-4 text-[17px] font-semibold text-ink"
            >
              {t(lang, 'mic')}
            </button>
          </div>
        </div>
      )}

      {phase === 'hidden' && <p className="text-[17px] leading-relaxed text-ink">{t(lang, 'voiceFallback')}</p>}
    </div>
  );
}
