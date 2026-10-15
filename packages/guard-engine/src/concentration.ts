// Concentration-cap math (docs/ARCHITECTURE.md §5.2), exact integer arithmetic.
//
//   a_max = min( B , max(0, (c·(V − g) − H) / (c + (1 − c)·(1 − f))) )
//
// Amounts are micro-USDT (bigint); c and f are parts-per-million. USD = USDT 1:1 is an
// assumption, and zero slippage (k = 1 − f) is the worst case for the cap.
// Rounding rule: a_max is FLOORED to the micro-unit (ROUNDING.limit), so it never exceeds the cap.

export const PPM = 1_000_000n;

export interface ConcentrationInput {
  /** V: total portfolio value */
  portfolio: bigint;
  /** H: current holding of the target asset */
  holding: bigint;
  /** B: source asset balance */
  balance: bigint;
  /** c: cap, ppm (300000 = 30 %) */
  capPpm: bigint;
  /** f: fee, ppm (3000 = 0.3 %) */
  feePpm: bigint;
  /** g: gas, paid from a non-target asset */
  gas: bigint;
}

/** Uncapped-by-balance maximum, floored. Exposed so the receipt can show the balance clamp separately. */
export function aMaxUnclamped(i: Omit<ConcentrationInput, 'balance'>): bigint {
  const num = i.capPpm * (i.portfolio - i.gas) - i.holding * PPM; // micro · ppm
  const den = i.capPpm * PPM + (PPM - i.capPpm) * (PPM - i.feePpm); // ppm²
  if (num <= 0n || den <= 0n) return 0n;
  return (num * PPM) / den; // positive operands: BigInt division floors
}

/** Largest swap that keeps the target at or below the cap, floored to the micro-unit. */
export function aMaxMicro(i: ConcentrationInput): bigint {
  const a = aMaxUnclamped(i);
  return a > i.balance ? i.balance : a;
}

/** Post-trade share as exact numerator/denominator (both micro · ppm). */
export function postTradeParts(i: Omit<ConcentrationInput, 'balance' | 'capPpm'>, amountIn: bigint) {
  const numer = i.holding * PPM + amountIn * (PPM - i.feePpm);
  const denom = i.portfolio * PPM - amountIn * i.feePpm - i.gas * PPM;
  return { numer, denom };
}

/** Inclusive: exactly at the cap is allowed. */
export function withinCap(i: Omit<ConcentrationInput, 'balance'>, amountIn: bigint): boolean {
  const { numer, denom } = postTradeParts(i, amountIn);
  if (denom <= 0n) return false;
  return numer * PPM <= i.capPpm * denom;
}
