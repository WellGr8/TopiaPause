import { DEMO_FX_USD_THB, rateScaled, type FxRate } from './fx';
import { ROUNDING, divRound, money } from './money';
import type { Money } from './types';

// Cost ESTIMATES for one guard check (docs/COSTS.md has the sources and the arithmetic).
// Unit prices are integers of nano-USD (1e-9 USD) so sub-cent prices stay exact.

export const NANO_PER_USD = 1_000_000_000n;

export const COSTS = {
  /** gpt-4o-mini: $0.00015 per 1k input tokens, $0.0006 per 1k output tokens. */
  llmInputPerToken: 150n,
  llmOutputPerToken: 600n,
  /** Tokenomist Standard API: $249.95/month for 50,000 calls ≈ $0.005 per call. Cached 1 h and shared by all checks. */
  tokenomistPerCall: 5_000_000n,
  /** Cloudflare Workers Paid: $0.30 per million requests beyond the included 10M. */
  workerPerRequest: 300n,
  /** ElevenLabs voice is pre-generated once (scripts/pregen-voice.ts), so a check spends nothing on TTS. */
  ttsPerCheck: 0n,
  /**
   * Scribe v2 speech-to-text is $0.22 per audio hour.
   * One reply is capped at 6 seconds: ceil(0.22e9 × 6 / 3600) = 366667 nano-USD.
   * https://elevenlabs.io/pricing/api?price.section=speech_to_text
   */
  sttPerSixSec: 366_667n,
} as const;

export interface CostInput {
  llmInputTokens?: number;
  llmOutputTokens?: number;
  tokenomistCalls?: number;
  workerRequests?: number;
  /** Speech-to-text replies. Not part of a guard check. */
  sttCalls?: number;
}

export function estimateNanoUsd(i: CostInput): bigint {
  return (
    BigInt(i.llmInputTokens ?? 0) * COSTS.llmInputPerToken +
    BigInt(i.llmOutputTokens ?? 0) * COSTS.llmOutputPerToken +
    BigInt(i.tokenomistCalls ?? 0) * COSTS.tokenomistPerCall +
    BigInt(i.workerRequests ?? 0) * COSTS.workerPerRequest +
    BigInt(i.sttCalls ?? 0) * COSTS.sttPerSixSec +
    COSTS.ttsPerCheck
  );
}

/** Estimated cost in satang, rounded UP (ROUNDING.cost) so it never understates. */
export function estimateCostThb(i: CostInput, fx: FxRate = DEMO_FX_USD_THB): Money {
  if (fx.base !== 'USD' || fx.quote !== 'THB') throw new Error('cost FX must be USD/THB');
  // satang = nano-USD × rate × 100 / (1e9 × 1e6), one rational step, rounded up.
  return money(divRound(estimateNanoUsd(i) * rateScaled(fx) * 100n, NANO_PER_USD * 1_000_000n, ROUNDING.cost), 'THB');
}
