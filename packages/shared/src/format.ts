import { CURRENCY_DECIMALS, MoneyError, divRound, toDecimal } from './money';
import type { Currency, Lang, Money } from './types';

/** en-US digit grouping for both languages (Thai uses Arabic numerals too). */
export function fmtNumber(n: number, maxDecimals = 2, minDecimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

const group = (int: string) => int.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Exact decimal text: whole amounts drop the fraction, otherwise `decimals` digits (trailing zeros trimmed if `trim`). */
function decimalText(m: Money, decimals: number, trim: boolean): string {
  const [int = '0', frac = ''] = toDecimal(m).replace('-', '').split('.');
  let f = frac.slice(0, decimals);
  if (/^0*$/.test(f)) f = '';
  else if (trim) f = f.replace(/0+$/, '');
  return `${m.minor < 0 ? '-' : ''}${group(int)}${f ? `.${f}` : ''}`;
}

/** Floors USDT to `decimals` places for display, so shown amounts never overstate what is allowed. */
function floorDecimals(m: Money, decimals: number): Money {
  const drop = 10n ** BigInt(CURRENCY_DECIMALS[m.currency] - decimals);
  return { minor: Number(divRound(BigInt(m.minor), drop, 'floor') * drop), currency: m.currency };
}

const SYMBOL: Partial<Record<Currency, string>> = { THB: '฿', USD: '$' };

/** ฿3,990 · ฿332.50 · $9.99 · 500 USDT · 200.42 USDT (precise: 200.420883 USDT; USDT is floored, never overstated). */
export function fmtMoney(m: Money, opts: { precise?: boolean } = {}): string {
  if (!Number.isSafeInteger(m.minor)) throw new MoneyError(`fmtMoney: bad minor ${String(m.minor)}`);
  const sym = SYMBOL[m.currency];
  if (sym) return `${sym}${decimalText(m, 2, false)}`;
  const shown = opts.precise ? m : floorDecimals(m, 2);
  return `${decimalText(shown, opts.precise ? 6 : 2, true)} ${m.currency}`;
}

export function fmtPct(pct: number): string {
  return `${fmtNumber(pct, 1)}%`;
}

export function pick<T>(lang: Lang, th: T, en: T): T {
  return lang === 'th' ? th : en;
}

const TH_WEEKDAYS = ['วันอาทิตย์', 'วันจันทร์', 'วันอังคาร', 'วันพุธ', 'วันพฤหัสบดี', 'วันศุกร์', 'วันเสาร์'];
const EN_WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Weekday only (no digits), so it is safe inside number-locked text. Uses Bangkok time. */
export function fmtWeekday(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const bkk = new Date(d.getTime() + 7 * 3600 * 1000);
  const idx = bkk.getUTCDay();
  return lang === 'th' ? TH_WEEKDAYS[idx]! : EN_WEEKDAYS[idx]!;
}
