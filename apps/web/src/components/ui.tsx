import type { Decision, Lang } from '@topiapause/shared';
import { Minus, Plus } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { DECISION_LABEL } from '../copy';

export function cx(...c: Array<string | false | null | undefined>): string {
  return c.filter(Boolean).join(' ');
}

export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id="tp-logo" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#4FA8FF" />
          <stop offset="0.4" stopColor="#3B82F6" />
          <stop offset="0.75" stopColor="#8B9CFF" />
          <stop offset="1" stopColor="#5EE6E0" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="20" fill="url(#tp-logo)" />
      <rect x="22" y="18" width="7" height="28" rx="3.5" fill="#fff" />
      <rect x="35" y="18" width="7" height="28" rx="3.5" fill="#fff" />
    </svg>
  );
}

const PILL: Record<Decision, string> = {
  allow: 'bg-teal-100 text-teal-900 ring-teal-300/70 dark:bg-teal-400/15 dark:text-teal-200 dark:ring-teal-300/30',
  pause: 'bg-indigo-100 text-indigo-900 ring-indigo-300/70 dark:bg-indigo-400/20 dark:text-indigo-100 dark:ring-indigo-300/30',
  block: 'bg-amber-100 text-amber-950 ring-amber-300/80 dark:bg-amber-400/15 dark:text-amber-200 dark:ring-amber-300/30',
};
const DOT: Record<Decision, string> = { allow: 'bg-teal-500', pause: 'bg-indigo-500', block: 'bg-amber-500' };

export function StatusPill({ decision, lang, size = 'md' }: { decision: Decision; lang: Lang; size?: 'sm' | 'md' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 whitespace-nowrap',
        size === 'md' ? 'px-3 py-1 text-sm' : 'px-2 py-0.5 text-xs',
        PILL[decision],
      )}
    >
      <span className={cx('h-2 w-2 rounded-full', DOT[decision])} aria-hidden="true" />
      {DECISION_LABEL[decision][lang]}
    </span>
  );
}

export function Glass({ className, children, as: As = 'div' }: { className?: string; children: ReactNode; as?: 'div' | 'section' | 'article' }) {
  return <As className={cx('glass rounded-3xl', className)}>{children}</As>;
}

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'ghost' | 'soft'; full?: boolean };

export function Button({ variant = 'soft', full, className, children, ...rest }: BtnProps) {
  const base =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-2xl px-4 text-[15px] font-semibold transition duration-200 ease-out disabled:cursor-not-allowed';
  const v =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'ghost'
        ? 'text-ink hover:bg-white/60 dark:text-slate-100 dark:hover:bg-white/10'
        : 'bg-white/70 text-ink ring-1 ring-slate-900/10 hover:bg-white disabled:opacity-50 dark:bg-white/10 dark:text-slate-100 dark:ring-white/15 dark:hover:bg-white/15';
  return (
    <button type="button" className={cx(base, v, full && 'w-full', className)} {...rest}>
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
      className={cx(
        'inline-flex h-11 w-11 items-center justify-center rounded-2xl text-ink transition duration-200 hover:bg-white/70 disabled:opacity-40 dark:text-slate-100 dark:hover:bg-white/10',
        className,
      )}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="inline-flex h-11 min-w-11 items-center justify-center"
    >
      <span
        className={cx(
          'relative h-7 w-12 rounded-full transition-colors duration-200',
          checked ? 'bg-azure' : 'bg-slate-300 dark:bg-slate-600',
        )}
      >
        <span
          className={cx(
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ease-out',
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
    <div className="inline-flex items-center gap-1 rounded-2xl bg-white/70 p-0.5 ring-1 ring-slate-900/10 dark:bg-white/10 dark:ring-white/15" role="group" aria-label={label}>
      <IconButton label={`- ${label}`} onClick={() => onChange(Math.max(min, value - step))} disabled={value <= min}>
        <Minus size={18} strokeWidth={2.2} />
      </IconButton>
      <span className="min-w-16 text-center text-base font-semibold tabular-nums" aria-live="polite">
        {format(value)}
      </span>
      <IconButton label={`+ ${label}`} onClick={() => onChange(Math.min(max, value + step))} disabled={value >= max}>
        <Plus size={18} strokeWidth={2.2} />
      </IconButton>
    </div>
  );
}
