import type { Decision, Lang } from '@topiapause/shared';
import { Minus, Plus } from 'lucide-react';
import type { ButtonHTMLAttributes, HTMLAttributes } from 'react';
import { DECISION_LABEL } from '../copy';

export function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(' ');
}

export function Logo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0 text-ink">
      <rect width="64" height="64" rx="18" fill="currentColor" />
      <rect x="22" y="18" width="7" height="28" rx="3.5" className="fill-canvas" />
      <rect x="35" y="18" width="7" height="28" rx="3.5" className="fill-canvas" />
    </svg>
  );
}

export function Card({ className, children, as: As = 'div', ...rest }: HTMLAttributes<HTMLElement> & { as?: 'div' | 'section' | 'article' }) {
  return (
    <As className={cx('rounded-card border border-line bg-surface shadow-card', className)} {...rest}>
      {children}
    </As>
  );
}

export const STATUS_TEXT: Record<Decision, string> = { allow: 'text-allow', pause: 'text-pause', block: 'text-block' };
export const STATUS_BG: Record<Decision, string> = { allow: 'bg-allow', pause: 'bg-pause', block: 'bg-block' };

export function Status({ decision, lang, className }: { decision: Decision; lang: Lang; className?: string }) {
  return <span className={cx('font-semibold', STATUS_TEXT[decision], className)}>{DECISION_LABEL[decision][lang]}</span>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary'; full?: boolean };

export function Button({ variant = 'secondary', full, className, children, ...rest }: BtnProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex min-h-12 items-center justify-center gap-2 rounded-control px-4 text-[15px] font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-40',
        variant === 'primary' ? 'bg-brand text-on-brand hover:bg-brand/90' : 'border border-line bg-surface text-ink hover:bg-canvas',
        full && 'w-full',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function TextButton({ className, children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={cx('inline-flex min-h-11 items-center gap-1 px-1 text-sm font-medium text-muted transition-colors hover:text-ink', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function IconButton({ label, children, className, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cx('inline-flex h-11 w-11 items-center justify-center rounded-control text-muted transition-colors hover:text-ink disabled:opacity-40', className)}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} className="inline-flex h-11 min-w-11 items-center justify-end">
      <span className={cx('relative h-7 w-12 rounded-full transition-colors duration-150', checked ? 'bg-brand' : 'bg-line')}>
        <span
          className={cx(
            'absolute left-0 top-0.5 h-6 w-6 rounded-full bg-white shadow-card transition-transform duration-150',
            checked ? 'translate-x-5.5' : 'translate-x-0.5',
          )}
        />
      </span>
    </button>
  );
}

export function Stepper({
  value,
  onChange,
  step,
  min,
  max,
  format,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  min: number;
  max: number;
  format: (v: number) => string;
  label: string;
}) {
  return (
    <div className="inline-flex items-center" role="group" aria-label={label}>
      <IconButton label={`- ${label}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
        <Minus size={16} />
      </IconButton>
      <span className="min-w-16 text-center text-[17px] font-semibold tabular-nums" aria-live="polite">
        {format(value)}
      </span>
      <IconButton label={`+ ${label}`} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>
        <Plus size={16} />
      </IconButton>
    </div>
  );
}

/** The signature: a thin flowing wave, shown only while TopiaPause is thinking. */
export function WaveStrip({ className }: { className?: string }) {
  return <div className={cx('bg-wave animate-wave-flow h-0.5 rounded-full', className)} aria-hidden="true" />;
}

/** Small voice waveform; gradient + moving while speaking, muted bars otherwise. */
export function Waveform({ active }: { active: boolean }) {
  return (
    <span className="flex h-4 items-center gap-[3px]" aria-hidden="true">
      {[0.5, 0.9, 0.65, 1, 0.55].map((h, i) => (
        <span
          key={i}
          className={cx('w-[3px] rounded-full', active ? 'bg-wave animate-wave-bar' : 'bg-muted/50')}
          style={{ height: `${h * 100}%`, animationDelay: `${i * 0.11}s`, transform: active ? undefined : 'scaleY(0.5)' }}
        />
      ))}
    </span>
  );
}
