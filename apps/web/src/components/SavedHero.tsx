import { t } from '../copy';
import { fmtExact, monthlySavings } from '../lib/savings';
import { useApp } from '../state';
import { cx } from './ui';

export function useSavings() {
  const { state } = useApp();
  return monthlySavings(state.activity);
}

/** "TopiaPause saved you ฿3,691.00 this month": net of accepted better fits, reconciles with Activity. */
export function SavedHero({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const { state } = useApp();
  const { lang } = state;
  const { lines, thb, usd, usdt } = useSavings();
  const other = ([['USDT', usdt], ['USD', usd]] as const).filter(([, v]) => v !== 0);
  const [currency, value] = thb === 0 && other.length > 0 ? other[0] : (['THB', thb] as const);
  const amount = fmtExact(value, currency);
  const extra = other.filter(([c]) => c !== currency);
  const n = lines.length;

  return (
    <section className={className} aria-label={`${t(lang, 'savedLead')} ${amount} ${t(lang, 'savedTail')}`}>
      <p className={cx('text-on-glow', size === 'lg' ? 'text-[15px]' : 'text-sm')}>{t(lang, 'savedLead')}</p>
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
      {extra.map(([c, v]) => (
        <p key={c} className="mt-1 text-sm text-muted">
          + <span className="font-medium text-ink tabular-nums">{fmtExact(v, c)}</span>
          {c === 'USDT' && <> {t(lang, 'inCrypto')}</>}
        </p>
      ))}
      <p className="mt-1.5 text-xs text-muted">{n === 0 ? t(lang, 'savedEmpty') : n === 1 ? t(lang, 'savedFromOne') : t(lang, 'savedFromMany', { n })}</p>
    </section>
  );
}
