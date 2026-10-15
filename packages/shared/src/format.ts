import type { Currency, Lang, Money } from './types';

export const CURRENCY_DECIMALS: Record<Currency, number> = {
  THB: 2,
  USD: 2,
  USDT: 6,
};

/** en-US digit grouping for both languages (Thai uses Arabic numerals too). */
export function fmtNumber(n: number, maxDecimals = 2, minDecimals = 0): string {
  return n.toLocaleString('en-US', {
    minimumFractionDigits: minDecimals,
    maximumFractionDigits: maxDecimals,
  });
}

/** Floors to `decimals` so displayed amounts never overstate what is allowed. */
export function floorTo(n: number, decimals: number): number {
  const p = 10 ** decimals;
  return Math.floor(n * p + 1e-9) / p;
}

export function fmtMoney(m: Money, opts: { precise?: boolean } = {}): string {
  const { amount, currency } = m;
  if (currency === 'THB') {
    const isInt = Number.isInteger(amount);
    return `฿${fmtNumber(amount, 2, isInt ? 0 : 2)}`;
  }
  if (currency === 'USD') {
    return `$${fmtNumber(floorTo(amount, 2), 2, Number.isInteger(amount) ? 0 : 2)}`;
  }
  const shown = opts.precise ? amount : floorTo(amount, 2);
  return `${fmtNumber(shown, opts.precise ? 6 : 2)} ${currency}`;
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
