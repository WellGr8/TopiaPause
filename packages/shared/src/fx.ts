import { MoneyError, ROUNDING, divRound, money, scaleOf, type Rounding } from './money';
import type { Currency, Money } from './types';

// Explicit FX: a decimal rate string, the time it applies to, and where it came from.
// Conversion is exact rational arithmetic, rounded once (half-even) into the target's minor units.

export interface FxRate {
  base: Currency;
  quote: Currency;
  /** Quote units per 1 base unit, as a decimal string with at most 6 decimals, e.g. "32.50". */
  rate: string;
  asOf: string;
  source: string;
}

const RATE_DECIMALS = 6;
const RATE_SCALE = 10n ** BigInt(RATE_DECIMALS);

/** Fixed sandbox rate so the demo is reproducible. Not a live quote. */
export const DEMO_FX_USDT_THB: FxRate = {
  base: 'USDT',
  quote: 'THB',
  rate: '32.50',
  asOf: '2026-10-15T00:00:00Z',
  source: 'TopiaPause fixed demo rate (not live)',
};

/** Cost constants are quoted in USD; the demo treats USD = USDT (same assumption as the swap scene). */
export const DEMO_FX_USD_THB: FxRate = { ...DEMO_FX_USDT_THB, base: 'USD' };

export function rateScaled(fx: FxRate): bigint {
  const m = /^(\d{1,9})(?:\.(\d{1,6}))?$/.exec(fx.rate);
  if (!m) throw new MoneyError(`Bad FX rate "${fx.rate}" (want a decimal with ≤ ${RATE_DECIMALS} places)`);
  return BigInt(m[1]!) * RATE_SCALE + BigInt((m[2] ?? '').padEnd(RATE_DECIMALS, '0'));
}

/** base -> quote. out = in × rate × 10^dq / (10^db × 10^6), rounded once. */
export function convert(m: Money, fx: FxRate, mode: Rounding = ROUNDING.conversion): Money {
  if (m.currency !== fx.base) throw new MoneyError(`FX ${fx.base}/${fx.quote} cannot convert ${m.currency}`);
  const num = BigInt(m.minor) * rateScaled(fx) * scaleOf(fx.quote);
  const den = scaleOf(fx.base) * RATE_SCALE;
  return money(divRound(num, den, mode), fx.quote);
}
