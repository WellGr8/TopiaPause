import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLICY,
  convert,
  money,
  sceneIntent,
  stayProposal,
  subscriptionProposal,
  swapProposal,
  type BreakdownSection,
  type GuardVerdict,
  type StayProposal,
  type SubscriptionProposal,
} from '@topiapause/shared';
import { DEFAULT_FX, evaluate, withinCap } from '../src';

// Property tests: for randomised inputs, every receipt section reconciles exactly to the
// minor unit, and the receipt totals equal the amounts the card shows. Seeded so failures repeat.
function rng(seed: number) {
  let s = seed >>> 0;
  return (lo: number, hi: number) => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return lo + (s % (hi - lo + 1));
  };
}

function reconciles(s: BreakdownSection): void {
  const cur = s.total.amount.currency;
  let acc = 0n;
  for (const l of s.lines) {
    expect(l.amount.currency).toBe(cur);
    expect(Number.isSafeInteger(l.amount.minor) && l.amount.minor >= 0).toBe(true);
    acc += l.op === 'add' ? BigInt(l.amount.minor) : -BigInt(l.amount.minor);
  }
  expect(acc).toBe(BigInt(s.total.amount.minor));
  if (s.fx) {
    const rate = DEFAULT_FX.find((r) => r.base === cur && r.quote === 'THB')!;
    expect(s.fx.amount).toEqual(convert(s.total.amount, rate));
  }
}

function checkVerdict(v: GuardVerdict): void {
  v.breakdown.forEach(reconciles);
  const saved = v.breakdown.find((s) => s.key === 'savings');
  if (saved) expect(saved.total.amount).toEqual(v.amounts.protected);
  if (!v.counterOffer) expect(v.breakdown).toEqual([]);
}

const N = 400;

describe('receipts reconcile to the minor unit', () => {
  it('token swap: random portfolio, holding, fee, gas, amount', () => {
    const r = rng(42);
    let withCounter = 0;
    for (let i = 0; i < N; i++) {
      const V = r(100, 50_000) * 1_000_000 + r(0, 999_999);
      const H = r(0, Math.floor(V * 0.35));
      const B = r(1, V - H);
      const a = r(1, B);
      const p = swapProposal(a);
      p.feePpm = r(0, 10_000);
      p.gas = money(r(0, 5_000_000), 'USDT');
      p.portfolio = { total: money(V, 'USDT'), holdings: { 'TOKEN-X': money(H, 'USDT') }, balances: { USDT: money(B, 'USDT') } };
      const intent = { ...sceneIntent('crypto', 'once', 'en'), amount: money(a, 'USDT') };
      const v = evaluate({ intent, proposal: p, policy: DEFAULT_POLICY });
      checkVerdict(v);

      const base = { portfolio: BigInt(V), holding: BigInt(H), gas: BigInt(p.gas.minor), feePpm: BigInt(p.feePpm), capPpm: 300_000n };
      const aMax = v.amounts.aMax;
      if (aMax && aMax.minor > 0) {
        expect(withinCap(base, BigInt(aMax.minor))).toBe(true);
        if (aMax.minor < B) expect(withinCap(base, BigInt(aMax.minor) + 1n)).toBe(false);
      }
      const alt = v.breakdown.find((s) => s.key === 'alternative');
      if (alt) expect(alt.total.amount).toEqual(aMax);
      if (v.counterOffer) {
        withCounter++;
        expect(v.counterOffer.recheck).toBe('allow');
        const saved = v.breakdown.find((s) => s.key === 'savings');
        if (saved) expect(BigInt(saved.total.amount.minor) + BigInt(v.amounts.counterAmountIn!.minor)).toBe(BigInt(a));
      }
    }
    expect(withCounter).toBeGreaterThan(N / 10);
  });

  it('stay: random shown price, hidden fees, refundable alternatives', () => {
    const r = rng(7);
    for (let i = 0; i < N; i++) {
      const p: StayProposal = stayProposal();
      const quoted = r(50_000, 500_000);
      const fees = r(0, 1) ? r(1, 60_000) : 0;
      p.quotedPrice = money(quoted, 'THB');
      p.totalPrice = money(quoted + fees, 'THB');
      p.catalogAlternatives = [{ hotel: 'Alt', totalPrice: money(quoted + fees + r(-20_000, 120_000), 'THB'), refundable: true }];
      const intent = { ...sceneIntent('stay', 'flexible', 'en'), flexibilityNeeded: r(0, 3) > 0 };
      checkVerdict(evaluate({ intent, proposal: p, policy: DEFAULT_POLICY }));
    }
  });

  it('subscription: random THB / USD prices, intervals, trials', () => {
    const r = rng(99);
    for (let i = 0; i < N; i++) {
      const cur = r(0, 1) ? 'THB' : 'USD';
      const price = (lo: number, hi: number) => money(cur === 'THB' ? r(lo, hi) : r(Math.ceil(lo / 32), Math.ceil(hi / 32)), cur);
      const p: SubscriptionProposal = {
        ...subscriptionProposal(),
        price: price(10_000, 900_000),
        interval: r(0, 1) ? 'year' : 'month',
        catalogAlternatives: Array.from({ length: 3 }, (_, k) => ({
          planId: `alt-${k}`,
          price: price(5_000, 60_000),
          interval: 'month' as const,
          trialDays: r(0, 1) ? 7 : 0,
        })),
      };
      const v = evaluate({ intent: sceneIntent('subscription', 'try', 'en'), proposal: p, policy: DEFAULT_POLICY });
      checkVerdict(v);
      const cp = v.counterOffer?.proposal as SubscriptionProposal | undefined;
      if (cp) {
        const rate = DEFAULT_FX.find((x) => x.base === cp.price.currency && x.quote === 'THB');
        const thb = rate ? convert(cp.price, rate) : cp.price;
        expect(thb.minor).toBeLessThanOrEqual(DEFAULT_POLICY.monthlySubscriptionCap!.minor);
      }
    }
  });
});
