import type { Currency, Money } from './types';

// Exact money. Every amount is an integer count of minor units:
//   THB  -> satang      (2 decimals)
//   USD  -> cents       (2 decimals)
//   USDT -> micro-USDT  (6 decimals, the token's on-chain precision)
// Arithmetic happens in BigInt; `number` is only used to carry a safe integer in JSON.
//
// Rounding policy (docs/API.md#money, ARCHITECTURE §5.2). There is exactly one rule per purpose:
//   limit      floor      anything the user may spend up to (a_max / maxAlternative): never exceeds the cap
//   conversion half_even  FX and per-period splits (banker's rounding: unbiased across many conversions)
//   cost       ceil       cost estimates: never understate what a check costs
//   percent    half_even  display percentages, to 0.1 %

export const CURRENCY_DECIMALS: Record<Currency, number> = { THB: 2, USD: 2, USDT: 6 };

export type Rounding = 'floor' | 'ceil' | 'half_even' | 'half_up';
export const ROUNDING = { limit: 'floor', conversion: 'half_even', cost: 'ceil', percent: 'half_even' } as const satisfies Record<
  string,
  Rounding
>;

export const scaleOf = (c: Currency): bigint => 10n ** BigInt(CURRENCY_DECIMALS[c]);

export class MoneyError extends Error {}

export function money(minor: number | bigint, currency: Currency): Money {
  const n = typeof minor === 'bigint' ? Number(minor) : minor;
  if (!Number.isSafeInteger(n)) throw new MoneyError(`Money must be a safe integer of minor units, got ${String(minor)} ${currency}`);
  return { minor: n, currency };
}

export const big = (m: Money): bigint => BigInt(m.minor);
export const isMoney = (x: unknown): x is Money =>
  typeof x === 'object' && x !== null && Number.isSafeInteger((x as Money).minor) && typeof (x as Money).currency === 'string';

/** n / d rounded with `mode`. d must be positive. */
export function divRound(n: bigint, d: bigint, mode: Rounding): bigint {
  if (d <= 0n) throw new MoneyError('divisor must be positive');
  const q = n / d; // truncates toward zero
  const r = n % d;
  if (r === 0n) return q;
  const neg = n < 0n;
  const floor = neg ? q - 1n : q;
  if (mode === 'floor') return floor;
  if (mode === 'ceil') return floor + 1n;
  const twice = 2n * (neg ? r + d : r); // remainder relative to floor, doubled
  if (twice > d) return floor + 1n;
  if (twice < d) return floor;
  return mode === 'half_up' ? floor + 1n : floor % 2n === 0n ? floor : floor + 1n;
}

function same(a: Money, b: Money): void {
  if (a.currency !== b.currency) throw new MoneyError(`Currency mismatch: ${a.currency} vs ${b.currency}`);
}
export function add(a: Money, b: Money): Money {
  same(a, b);
  return money(big(a) + big(b), a.currency);
}
export function sub(a: Money, b: Money): Money {
  same(a, b);
  return money(big(a) - big(b), a.currency);
}
export function sum(items: Money[], currency: Currency): Money {
  return money(items.reduce((s, m) => (same(m, { minor: 0, currency }), s + big(m)), 0n), currency);
}
export const min = (a: Money, b: Money): Money => (same(a, b), a.minor <= b.minor ? a : b);
export const max = (a: Money, b: Money): Money => (same(a, b), a.minor >= b.minor ? a : b);
export const isZero = (m: Money) => m.minor === 0;

/** m × num / den, rounded with `mode`. */
export function mulRatio(m: Money, num: bigint, den: bigint, mode: Rounding): Money {
  return money(divRound(big(m) * num, den, mode), m.currency);
}

const DECIMAL_RE = /^(-)?(\d{1,15})(?:\.(\d+))?$/;

/**
 * Parses a decimal string ("3990", "3990.00", "200.420883") into exact minor units.
 * Rejects more fraction digits than the currency has instead of rounding silently.
 */
export function parseMoney(value: string | number, currency: Currency): Money {
  const s = typeof value === 'number' ? numberToDecimal(value) : value.trim();
  const m = DECIMAL_RE.exec(s);
  if (!m) throw new MoneyError(`Not a decimal amount: "${s}"`);
  const decimals = CURRENCY_DECIMALS[currency];
  const frac = (m[3] ?? '').replace(/0+$/, '');
  if (frac.length > decimals) throw new MoneyError(`${currency} has ${decimals} decimals; "${s}" has more`);
  const minor = BigInt(m[2]!) * scaleOf(currency) + BigInt((frac || '0').padEnd(decimals, '0'));
  return money(m[1] ? -minor : minor, currency);
}

/** JSON numbers are accepted for convenience; their shortest round-trip form is parsed, never the binary value. */
function numberToDecimal(n: number): string {
  if (!Number.isFinite(n)) throw new MoneyError(`Not a finite amount: ${n}`);
  const s = String(n);
  if (!/e/i.test(s)) return s;
  return n.toFixed(20).replace(/\.?0+$/, '');
}

/** Exact decimal string, all currency decimals: 399000 THB -> "3990.00". */
export function toDecimal(m: Money): string {
  const neg = m.minor < 0;
  const abs = neg ? -big(m) : big(m);
  const scale = scaleOf(m.currency);
  const d = CURRENCY_DECIMALS[m.currency];
  const int = (abs / scale).toString();
  const frac = d ? `.${(abs % scale).toString().padStart(d, '0')}` : '';
  return `${neg ? '-' : ''}${int}${frac}`;
}

/** Major units as a JS number. Display and number-lock only; never feed this back into math. */
export function toMajor(m: Money): number {
  return Number(toDecimal(m));
}

/** Re-expresses m with fewer decimals (e.g. USDT micro -> cents), rounded with `mode`. */
export function rescale(m: Money, currency: Currency, mode: Rounding): Money {
  const from = scaleOf(m.currency);
  const to = scaleOf(currency);
  return money(divRound(big(m) * to, from, mode), currency);
}

/** Percentage with one decimal: 100·num/den rounded half-even to 0.1. */
export function pctTenths(num: bigint, den: bigint): number {
  if (den <= 0n) return Number.POSITIVE_INFINITY;
  return Number(divRound(num * 1000n, den, ROUNDING.percent)) / 10;
}

/** Fractions such as 0.3 or 0.003 -> parts-per-million, half-even. Rates are not money but need a fixed scale. */
export function toPpm(rate: number): bigint {
  return divRound(BigInt(Math.round(rate * 1e9)), 1000n, 'half_even');
}
