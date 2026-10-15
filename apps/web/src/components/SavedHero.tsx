import { Info } from 'lucide-react';
import { Fragment, useId, type ReactNode } from 'react';
import { t, type CopyKey } from '../copy';
import { fmtExact, monthlySavings } from '../lib/savings';
import type { Lang } from '@topiapause/shared';
import { useApp } from '../state';
import { cx } from './ui';

/** Copy template with selected vars rendered bold. */
export function rich(lang: Lang, key: CopyKey, vars: Record<string, string | number>, bold: string[]): ReactNode {
  return t(lang, key)
    .split(/\{(\w+)\}/)
    .map((part, i) =>
      i % 2 === 0 ? part : bold.includes(part) ? <strong key={i} className="font-semibold text-ink">{vars[part]}</strong> : <Fragment key={i}>{vars[part]}</Fragment>,
    );
}

export function useSavings() {
  const { state } = useApp();
  return monthlySavings(state.activity);
}

/** Saved (cheaper accepted fits, THB) on top; protection (refundable stays, crypto exposure) below and never added in. */
export function SavedHero({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { state } = useApp();
  const { lang } = state;
  const { saved, thb, stays, cryptos } = useSavings();
  const tipId = useId();
  const amount = fmtExact(thb, 'THB');
  const covered = stays.reduce((s, l) => s + l.coveredMinor, 0);
  const cost = stays.reduce((s, l) => s + l.costMinor, 0);
  const empty = saved.length === 0 && stays.length === 0 && cryptos.length === 0;

  return (
    <section className={className} aria-label={`${t(lang, 'savedLead')} ${amount} ${t(lang, 'savedTail')}`}>
      <p className={cx('flex items-center gap-1 text-on-glow', size === 'lg' ? 'text-[15px]' : 'text-sm')}>
        {t(lang, 'savedLead')}
        <span className="group relative inline-flex">
          <button
            type="button"
            aria-label={t(lang, 'savedTipLabel')}
            aria-describedby={tipId}
            className="-m-1.5 inline-flex rounded-full p-1.5 text-on-glow focus-visible:outline-2 focus-visible:outline-brand"
          >
            <Info size={14} aria-hidden="true" />
          </button>
          <span
            id={tipId}
            role="tooltip"
            className="pointer-events-none absolute left-1/2 top-full z-20 mt-1.5 w-60 -translate-x-1/2 rounded-lg bg-ink px-3 py-2 text-xs leading-snug text-canvas opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100"
          >
            {t(lang, 'savedTip')}
          </span>
        </span>
      </p>
      <p aria-hidden="true" className="mt-1 flex flex-wrap items-baseline gap-x-2">
        <span
          className={cx(
            'font-semibold tracking-tight tabular-nums',
            size === 'lg' ? 'text-[48px] leading-none' : size === 'md' ? 'text-[32px] leading-tight' : 'text-[26px] leading-tight',
          )}
        >
          {amount}
        </span>
        <span className="text-sm text-muted">{t(lang, 'savedTail')}</span>
      </p>
      {stays.length > 0 && (
        <p className="mt-1 text-sm text-muted">
          {rich(lang, 'heroStay', { covered: fmtExact(covered, 'THB'), cost: fmtExact(cost, 'THB') }, ['covered'])}
        </p>
      )}
      {cryptos.map((c) => (
        <p key={c.entry.id} className="mt-1 text-sm text-muted">
          {rich(lang, 'heroCrypto', { asset: c.asset, amount: fmtExact(c.reducedMinor, 'USDT'), from: c.fromPct, to: c.toPct }, ['amount'])}
        </p>
      ))}
      {empty && <p className="mt-1.5 text-xs text-muted">{t(lang, 'savedEmpty')}</p>}
    </section>
  );
}
