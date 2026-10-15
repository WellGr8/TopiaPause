import type { Lang } from '@topiapause/shared';
import { Square, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { t } from '../copy';
import { speak, type Playback, type VoiceSource } from '../lib/voice';
import { cx } from './ui';

export function Waveform({ active }: { active: boolean }) {
  return (
    <span className="flex h-5 items-center gap-[3px]" aria-hidden="true">
      {[0.55, 0.9, 0.7, 1, 0.6].map((h, i) => (
        <span
          key={i}
          className={cx('w-[3px] rounded-full bg-current', active && 'wave-bar')}
          style={{ height: `${h * 100}%`, animationDelay: `${i * 0.11}s`, transform: active ? undefined : 'scaleY(0.35)' }}
        />
      ))}
    </span>
  );
}

export function VoiceButton({ text, lang, clipId }: { text: string; lang: Lang; clipId?: string }) {
  const [speaking, setSpeaking] = useState(false);
  const [source, setSource] = useState<VoiceSource | null>(null);
  const pb = useRef<Playback | null>(null);

  useEffect(() => () => pb.current?.stop(), []);

  const toggle = async () => {
    if (speaking) {
      pb.current?.stop();
      return;
    }
    setSpeaking(true);
    pb.current = await speak({ text, lang, clipId }, () => setSpeaking(false));
    setSource(pb.current.source);
  };

  const sourceLabel = source === 'clip' ? t(lang, 'voiceClip') : source === 'speech' ? t(lang, 'voiceSpeech') : source === 'none' ? t(lang, 'voiceNone') : null;

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        type="button"
        onClick={toggle}
        aria-pressed={speaking}
        aria-label={speaking ? t(lang, 'stop') : t(lang, 'listen')}
        className={cx(
          'inline-flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-semibold ring-1 transition duration-200',
          speaking
            ? 'bg-indigo-600 text-white ring-indigo-600'
            : 'bg-white/80 text-indigo-800 ring-indigo-200 hover:bg-white dark:bg-white/10 dark:text-indigo-100 dark:ring-white/15',
        )}
      >
        {speaking ? <Square size={14} fill="currentColor" /> : <Volume2 size={18} strokeWidth={2.2} />}
        <Waveform active={speaking} />
        <span>{speaking ? t(lang, 'stop') : t(lang, 'listen')}</span>
      </button>
      {sourceLabel && <span className="text-[11px] text-muted dark:text-slate-400">{sourceLabel}</span>}
    </div>
  );
}
