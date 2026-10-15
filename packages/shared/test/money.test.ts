import { describe, expect, it } from 'vitest';
import {
  DEMO_FX_USDT_THB,
  DEMO_FX_USD_THB,
  convert,
  divRound,
  estimateCostThb,
  fmtMoney,
  money,
  parseMoney,
  pctTenths,
  sum,
  toDecimal,
  type Rounding,
} from '../src';

// Seeded PRNG so property tests are reproducible.
function rng(seed: number) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
}
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

/** Reference rounding on exact rationals: compares 2·remainder with the divisor. */
function ref(n: bigint, d: bigint, mode: Rounding): bigint {
  const fl = n >= 0n ? n / d : -((-n + d - 1n) / d);
  const rem = n - fl * d;
  if (rem === 0n) return fl;
  if (mode === 'floor') return fl;
  if (mode === 'ceil') return fl + 1n;
  if (2n * rem > d) return fl + 1n;
  if (2n * rem < d) return fl;
  return mode === 'half_up' ? fl + 1n : fl % 2n === 0n ? fl : fl + 1n;
}

describe('money: exact minor units', () => {
  it('parses decimals exactly and refuses extra precision', () => {
    expect(parseMoney('3990', 'THB')).toEqual({ minor: 399000, currency: 'THB' });
    expect(parseMoney('332.50', 'THB').minor).toBe(33250);
    expect(parseMoney('200.420883', 'USDT').minor).toBe(200_420_883);
    expect(parseMoney(0.1, 'THB').minor).toBe(10);
    expect(() => parseMoney('1.005', 'THB')).toThrow(/2 decimals/);
    expect(() => parseMoney('1e3', 'THB')).toThrow();
  });

  it('formats without float drift', () => {
    expect(fmtMoney(money(399000, 'THB'))).toBe('฿3,990');
    expect(fmtMoney(money(33250, 'THB'))).toBe('฿332.50');
    expect(fmtMoney(money(999, 'USD'))).toBe('$9.99');
    expect(fmtMoney(money(500_000_000, 'USDT'))).toBe('500 USDT');
    expect(fmtMoney(money(200_420_883, 'USDT'))).toBe('200.42 USDT');
    expect(fmtMoney(money(200_420_883, 'USDT'), { precise: true })).toBe('200.420883 USDT');
    expect(toDecimal(money(-5, 'THB'))).toBe('-0.05');
  });

  it('property: divRound matches the rational reference for every mode', () => {
    const r = rng(42);
    for (let i = 0; i < 5000; i++) {
      const n = BigInt(int(r, -1e9, 1e9));
      const d = BigInt(int(r, 1, 1e5));
      for (const mode of ['floor', 'ceil', 'half_even', 'half_up'] as Rounding[]) expect(divRound(n, d, mode)).toBe(ref(n, d, mode));
    }
  });

  it("banker's rounding on exact halves", () => {
    expect(divRound(5n, 2n, 'half_even')).toBe(2n);
    expect(divRound(7n, 2n, 'half_even')).toBe(4n);
    expect(divRound(5n, 2n, 'half_up')).toBe(3n);
    expect(divRound(-5n, 2n, 'half_even')).toBe(-2n);
  });

  it('property: parse ∘ toDecimal is the identity', () => {
    const r = rng(7);
    for (let i = 0; i < 2000; i++) {
      const m = money(int(r, 0, 9e12), i % 2 ? 'THB' : 'USDT');
      expect(parseMoney(toDecimal(m), m.currency)).toEqual(m);
    }
  });

  it('property: sums of line items are exact (no float accumulation)', () => {
    const r = rng(9);
    for (let i = 0; i < 500; i++) {
      const items = Array.from({ length: int(r, 1, 30) }, () => money(int(r, 0, 1e9), 'THB'));
      const exact = items.reduce((s, m) => s + BigInt(m.minor), 0n);
      expect(BigInt(sum(items, 'THB').minor)).toBe(exact);
    }
  });
});

describe('FX: explicit rate, rounded once', () => {
  it('USDT -> THB at the stated demo rate', () => {
    expect(DEMO_FX_USDT_THB).toMatchObject({ rate: '32.50', asOf: '2026-10-15T00:00:00Z' });
    expect(convert(money(300_000_000, 'USDT'), DEMO_FX_USDT_THB)).toEqual({ minor: 975000, currency: 'THB' });
    // 9.99 × 32.50 = 324.675 -> half-even to the satang = 324.68
    expect(convert(money(999, 'USD'), DEMO_FX_USD_THB).minor).toBe(32468);
    expect(() => convert(money(1, 'THB'), DEMO_FX_USDT_THB)).toThrow();
  });

  it('property: conversion equals the exact rational rounded half-even', () => {
    const r = rng(11);
    for (let i = 0; i < 3000; i++) {
      const micro = BigInt(int(r, 0, 1e12));
      const rateMicro = BigInt(int(r, 1, 99_999_999)); // up to 99.999999
      const rate = `${rateMicro / 1_000_000n}.${(rateMicro % 1_000_000n).toString().padStart(6, '0')}`;
      const got = convert(money(Number(micro), 'USDT'), { ...DEMO_FX_USDT_THB, rate });
      expect(BigInt(got.minor)).toBe(ref(micro * rateMicro * 100n, 1_000_000n * 1_000_000n, 'half_even'));
    }
  });
});

describe('cost estimates', () => {
  it('a rules-only check rounds UP to one satang; a Tokenomist miss adds ~$0.005', () => {
    expect(estimateCostThb({ workerRequests: 1 }).minor).toBe(1);
    // $0.15 / million DO requests = 150 nano-USD → 0.0004875 satang, ceil 1.
    expect(estimateCostThb({ doRequests: 1 }).minor).toBe(1);
    // Worker request + the ticket issue still ceilings to one satang.
    expect(estimateCostThb({ workerRequests: 1, doRequests: 1 }).minor).toBe(1);
    // 0.0050003 USD × 32.50 = 0.16250975 THB -> ceil -> 17 satang
    expect(estimateCostThb({ workerRequests: 1, tokenomistCalls: 1 }).minor).toBe(17);
    // Worker + ticket issue + Tokenomist: 5,000,450 × 32.50 × 100 / 1e9 = 16.2514625 satang, ceil 17.
    expect(estimateCostThb({ workerRequests: 1, doRequests: 1, tokenomistCalls: 1 }).minor).toBe(17);
    // gpt-4o-mini 1k in + 200 out = 0.00015 + 0.00012 = 0.00027 USD -> 0.008775 THB -> 1 satang
    expect(estimateCostThb({ llmInputTokens: 1000, llmOutputTokens: 200 }).minor).toBe(1);
    expect(estimateCostThb({}).minor).toBe(0);
    // A guard check does not include speech-to-text.
    expect(estimateCostThb({ workerRequests: 1, sttCalls: 0 }).minor).toBe(1);
    // $0.22/hour × 6s × 32.50 × 100 satang = 4290/3600 = 1.1916… satang, ceil 2.
    expect(estimateCostThb({ sttCalls: 1 }).minor).toBe(2);
  });

  it('percentages round half-even to 0.1', () => {
    expect(pctTenths(161n, 1284n)).toBe(12.5);
    expect(pctTenths(9n, 20n)).toBe(45);
  });
});
