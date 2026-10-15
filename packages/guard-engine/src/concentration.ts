// Concentration-cap math (docs/ARCHITECTURE.md §5.2), in exact integer arithmetic.
//
//   a_max = min( B , max(0, (c·(V − g) − H) / (c + (1 − c)·(1 − f))) )
//
// Amounts are micro-units (6 decimals, USDT precision); c and f are parts-per-million.
// USD and USDT are treated 1:1. Worst case for the cap is zero slippage (k = 1 − f).

export const MICRO = 1_000_000n;
export const PPM = 1_000_000n;

export function toMicro(x: number): bigint {
  return BigInt(Math.round(x * 1e6));
}

export function fromMicro(x: bigint): number {
  return Number(x) / 1e6;
}

export function toPpm(rate: number): bigint {
  return BigInt(Math.round(rate * 1e6));
}

export interface ConcentrationInput {
  /** V: total portfolio value, USD */
  portfolioUsd: number;
  /** H: current holding of the target asset, USD */
  holdingUsd: number;
  /** B: source asset balance */
  balance: number;
  /** c: cap as a fraction, e.g. 0.30 */
  cap: number;
  /** f: fee rate, e.g. 0.003 */
  feeRate: number;
  /** g: gas in USD, paid from a non-target asset */
  gasUsd: number;
}

/** Largest swap that keeps the target at or below the cap, rounded DOWN to 6 decimals. */
export function aMaxMicro(i: ConcentrationInput): bigint {
  const V = toMicro(i.portfolioUsd);
  const H = toMicro(i.holdingUsd);
  const B = toMicro(i.balance);
  const g = toMicro(i.gasUsd);
  const c = toPpm(i.cap);
  const f = toPpm(i.feeRate);

  const num = c * (V - g) - H * PPM; // micro · ppm
  const den = c * PPM + (PPM - c) * (PPM - f); // ppm²
  if (num <= 0n || den <= 0n) return 0n;
  const a = (num * PPM) / den; // BigInt division floors for positives
  return a > B ? B : a;
}

export function aMax(i: ConcentrationInput): number {
  return fromMicro(aMaxMicro(i));
}

/** Post-trade share as exact numerator/denominator (both micro · ppm). */
function postTradeParts(i: Omit<ConcentrationInput, 'balance' | 'cap'>, amountIn: number) {
  const V = toMicro(i.portfolioUsd);
  const H = toMicro(i.holdingUsd);
  const g = toMicro(i.gasUsd);
  const a = toMicro(amountIn);
  const f = toPpm(i.feeRate);
  const numer = H * PPM + a * (PPM - f);
  const denom = V * PPM - a * f - g * PPM;
  return { numer, denom };
}

export function postTradeShare(i: Omit<ConcentrationInput, 'balance' | 'cap'>, amountIn: number): number {
  const { numer, denom } = postTradeParts(i, amountIn);
  if (denom <= 0n) return Number.POSITIVE_INFINITY;
  return Number(numer) / Number(denom);
}

/** Inclusive: exactly at the cap is allowed. */
export function withinCap(i: Omit<ConcentrationInput, 'balance'>, amountIn: number): boolean {
  const { numer, denom } = postTradeParts(i, amountIn);
  if (denom <= 0n) return false;
  return numer * PPM <= toPpm(i.cap) * denom;
}
