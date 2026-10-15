import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLICY,
  sceneIntent,
  stayProposal,
  subscriptionProposal,
  swapProposal,
  type ActionIntent,
  type GuardVerdict,
  type StayProposal,
  type SubscriptionProposal,
  type TokenSwapProposal,
} from '@topiapause/shared';
import {
  aMax,
  aMaxMicro,
  allowedNumbers,
  evaluate,
  lockExplanation,
  passesNumberLock,
  recheck,
  type EvaluateInput,
} from '../src';

const base = { portfolioUsd: 2000, holdingUsd: 400, balance: 500, cap: 0.3, feeRate: 0, gasUsd: 0 };
const policy = DEFAULT_POLICY;

function swap(overrides: Partial<TokenSwapProposal> & { amount?: number; holding?: number } = {}): TokenSwapProposal {
  const p = swapProposal(overrides.amount ?? 500);
  if (overrides.holding !== undefined) p.portfolio.holdingsUsd['TOKEN-X'] = overrides.holding;
  const { amount: _a, holding: _h, ...rest } = overrides;
  return { ...p, ...rest };
}

const onceIntent = (amount = 500): ActionIntent => ({
  ...sceneIntent('crypto', 'Swap USDT into TOKEN-X, just once', 'en'),
  amount: { amount, currency: 'USDT' },
});
const ids = (v: GuardVerdict) => v.findings.map((f) => f.ruleId).sort();

describe('a_max concentration formula (§5.2)', () => {
  it('T1 base case: a_max = 200.000000 and swap 500 pauses at 45%', () => {
    expect(aMaxMicro(base)).toBe(200_000_000n);
    expect(aMax(base)).toBe(200);
    const v = evaluate({ intent: onceIntent(), proposal: swap(), policy });
    expect(v.decision).toBe('pause');
    const conc = v.findings.find((f) => f.ruleId === 'CONC_CAP')!;
    expect(conc.severity).toBe('pause');
    expect(conc.evidence.postTradeSharePct).toBe(45);
    expect(v.metrics.aMaxUsd).toBe(200);
  });

  it('T2 fee 0.3%: a_max ≈ 200.420884 (floored to 6 decimals = 200.420883)', () => {
    const a = aMax({ ...base, feeRate: 0.003 });
    // Spec quotes 200.420884 (rounded); the engine rounds DOWN per §5.2 so the cap is never exceeded.
    expect(a).toBe(200.420883);
    expect(Math.abs(a - 200.420884)).toBeLessThanOrEqual(0.000001);
    expect(a).toBeCloseTo(200.42, 2);
  });

  it('T3 gas $2: a_max = 199.40', () => {
    expect(aMax({ ...base, gasUsd: 2 })).toBe(199.4);
  });

  it('a_max is clamped to the source balance', () => {
    expect(aMax({ ...base, holdingUsd: 0, balance: 100 })).toBe(100);
  });
});

describe('token swap rules', () => {
  it('T4 swap 200 with exact one-time approval -> allow at exactly 30.0% (inclusive)', () => {
    const p = swap({
      amount: 200,
      approval: { spender: 'MockSwap Router (sandbox)', type: 'exact', amount: { amount: 200, currency: 'USDT' }, expirySec: 900 },
    });
    const v = evaluate({ intent: onceIntent(200), proposal: p, policy });
    expect(v.decision).toBe('allow');
    expect(v.findings).toHaveLength(0);
    expect(v.metrics.postTradeSharePct).toBe(30);
  });

  it('T5 once + unlimited approval, amount 100 -> pause APPROVAL_SCOPE, counter exact 100 -> allow', () => {
    const v = evaluate({ intent: onceIntent(100), proposal: swap({ amount: 100 }), policy });
    expect(v.decision).toBe('pause');
    expect(ids(v)).toContain('APPROVAL_SCOPE');
    expect(ids(v)).not.toContain('CONC_CAP');
    const co = v.counterOffer!;
    expect(co.recheck).toBe('allow');
    const cp = co.proposal as TokenSwapProposal;
    expect(cp.approval.type).toBe('exact');
    expect(cp.approval.amount?.amount).toBe(100);
    expect(cp.approval.expirySec).toBe(900);
  });

  it('T6 already at 30% (H=600), swap 50 -> block (a_max = 0), no counter-offer', () => {
    const v = evaluate({ intent: onceIntent(50), proposal: swap({ amount: 50, holding: 600 }), policy });
    expect(v.decision).toBe('block');
    const conc = v.findings.find((f) => f.ruleId === 'CONC_CAP')!;
    expect(conc.severity).toBe('block');
    expect(conc.evidence.aMax).toBe(0);
    expect(v.counterOffer).toBeUndefined();
  });

  it('T7 amount 600 > balance 500 -> block INSUFFICIENT_BALANCE', () => {
    const v = evaluate({ intent: onceIntent(600), proposal: swap({ amount: 600 }), policy });
    expect(v.decision).toBe('block');
    expect(ids(v)).toContain('INSUFFICIENT_BALANCE');
    expect(v.counterOffer).toBeUndefined();
  });

  it('Scene 3: counter-offer is swap 200, exact approval 200, 15 min, re-check allow at 30%', () => {
    const v = evaluate({ intent: onceIntent(), proposal: swap(), policy });
    expect(ids(v)).toEqual(['APPROVAL_EXPIRY', 'APPROVAL_SCOPE', 'CONC_CAP']);
    const cp = v.counterOffer!.proposal as TokenSwapProposal;
    expect(cp.amountIn.amount).toBe(200);
    expect(cp.approval).toMatchObject({ type: 'exact', amount: { amount: 200 }, expirySec: 900 });
    expect(v.counterOffer!.recheck).toBe('allow');
    expect(v.metrics.counterSharePct).toBe(30);
    expect(v.metrics.protectedAmount).toBe(300);
  });

  it('counter-offer with 0.3% fee stays within the cap', () => {
    const v = evaluate({ intent: onceIntent(), proposal: swap({ feeRate: 0.003 }), policy });
    const cp = v.counterOffer!.proposal as TokenSwapProposal;
    expect(cp.amountIn.amount).toBe(200.420883);
    expect(v.metrics.counterSharePct).toBeLessThanOrEqual(30);
  });

  it('INVALID_INPUT blocks NaN / non-positive amounts', () => {
    for (const amount of [Number.NaN, 0, -5]) {
      const v = evaluate({ intent: onceIntent(), proposal: swap({ amount }), policy });
      expect(v.decision).toBe('block');
      expect(ids(v)).toEqual(['INVALID_INPUT']);
    }
  });
});

describe('subscription rules', () => {
  const trial = sceneIntent('subscription', 'I just want to try PixelPro', 'en');

  it('T8 trial intent + annual ฿3,990, cap ฿300/mo -> pause, counter = 7-day trial + monthly ฿299 -> allow', () => {
    const v = evaluate({ intent: trial, proposal: subscriptionProposal(), policy });
    expect(v.decision).toBe('pause');
    expect(ids(v)).toEqual(['SUB_COMMITMENT', 'SUB_OVER_CAP']);
    expect(v.metrics.monthlyEquivalent).toBe(332.5);
    const cp = v.counterOffer!.proposal as SubscriptionProposal;
    expect(cp).toMatchObject({ interval: 'month', trialDays: 7, price: { amount: 299, currency: 'THB' } });
    expect(v.counterOffer!.recheck).toBe('allow');
  });

  it('T9 ongoing intent + monthly ฿299 -> allow', () => {
    const p: SubscriptionProposal = {
      ...subscriptionProposal(),
      planId: 'pixelpro-monthly',
      price: { amount: 299, currency: 'THB' },
      interval: 'month',
      trialDays: 0,
    };
    const v = evaluate({ intent: { ...trial, commitment: 'ongoing' }, proposal: p, policy });
    expect(v.decision).toBe('allow');
    expect(v.findings).toHaveLength(0);
  });
});

describe('stay rules', () => {
  const flexible = sceneIntent('stay', 'cheap hotel, plans may change', 'en');

  it('T10 flexible + non-refundable ฿1,284 vs refundable ฿1,445 (+12.5%) -> pause, counter refundable -> allow', () => {
    const v = evaluate({ intent: flexible, proposal: stayProposal(), policy });
    expect(v.decision).toBe('pause');
    expect(ids(v)).toEqual(['STAY_FLEXIBILITY', 'STAY_HIDDEN_TOTAL']);
    const flex = v.findings.find((f) => f.ruleId === 'STAY_FLEXIBILITY')!;
    expect(flex.evidence).toMatchObject({ premium: 161, premiumPct: 12.5, hasCounter: true });
    const cp = v.counterOffer!.proposal as StayProposal;
    expect(cp).toMatchObject({ hotel: 'Asok Inn', refundable: true, totalPrice: { amount: 1445 } });
    expect(v.counterOffer!.recheck).toBe('allow');
  });

  it('T11 refundable premium 30% (> 15%) -> pause with no counter-offer, trade-off explained', () => {
    const p = stayProposal();
    p.catalogAlternatives = [
      { hotel: 'Pricey Refundable', totalPrice: { amount: 1669.2, currency: 'THB' }, refundable: true },
    ];
    const v = evaluate({ intent: flexible, proposal: p, policy });
    expect(v.decision).toBe('pause');
    expect(v.counterOffer).toBeUndefined();
    const flex = v.findings.find((f) => f.ruleId === 'STAY_FLEXIBILITY')!;
    expect(flex.evidence).toMatchObject({ premiumPct: 30, hasCounter: false });
    expect(v.explanation.en).toContain('30%');
  });

  it('fixed plans (flexibilityNeeded=false) do not trigger STAY_FLEXIBILITY', () => {
    const p = { ...stayProposal(), quotedPrice: undefined };
    const v = evaluate({ intent: { ...flexible, flexibilityNeeded: false }, proposal: p, policy });
    expect(v.decision).toBe('allow');
  });
});

describe('cross-cutting', () => {
  const cases: Array<[string, EvaluateInput]> = [
    ['T1', { intent: onceIntent(), proposal: swap(), policy }],
    ['T2', { intent: onceIntent(), proposal: swap({ feeRate: 0.003 }), policy }],
    ['T3', { intent: onceIntent(), proposal: swap({ gasUsd: 2 }), policy }],
    ['T5', { intent: onceIntent(100), proposal: swap({ amount: 100 }), policy }],
    ['T8', { intent: sceneIntent('subscription', 'try', 'th'), proposal: subscriptionProposal(), policy }],
    ['T10', { intent: sceneIntent('stay', 'flexible', 'th'), proposal: stayProposal(), policy }],
  ];

  it.each(cases)('T12 %s: every offered counter-offer re-checks to allow', (_name, input) => {
    const v = evaluate(input);
    expect(v.counterOffer).toBeDefined();
    expect(v.counterOffer!.recheck).toBe('allow');
    expect(recheck({ ...input, proposal: v.counterOffer!.proposal })).toBe('allow');
  });

  it.each(cases)('%s: template explanation and voice text pass the number lock', (_name, input) => {
    const v = evaluate(input);
    const allowed = allowedNumbers(v);
    expect(passesNumberLock(v.explanation.th, allowed)).toBe(true);
    expect(passesNumberLock(v.explanation.en, allowed)).toBe(true);
    expect(passesNumberLock(v.voiceText.th, allowed)).toBe(true);
    expect(passesNumberLock(v.voiceText.en, allowed)).toBe(true);
  });

  it('T13 number lock: explanation with a number not in metrics falls back to template', () => {
    const v = evaluate({ intent: onceIntent(), proposal: swap(), policy });
    const bad = lockExplanation({ th: 'ซื้อได้ 250 ดอลลาร์', en: 'You can buy $250.' }, v);
    expect(bad.source).toBe('template');
    expect(bad.en).toBe(v.explanation.en);
    const good = lockExplanation({ th: 'เกินเพดาน 30% ซื้อได้ 200', en: 'Over 30%, max is $200.' }, v);
    expect(good.source).toBe('llm');
  });

  it('LOW_CONFIDENCE pauses and suppresses the counter-offer', () => {
    const v = evaluate({ intent: { ...onceIntent(), confidence: 0.5 }, proposal: swap(), policy });
    expect(ids(v)).toContain('LOW_CONFIDENCE');
    expect(v.decision).toBe('pause');
    expect(v.counterOffer).toBeUndefined();
  });

  it('is deterministic', () => {
    const p = swap();
    const a = evaluate({ intent: onceIntent(), proposal: p, policy });
    const b = evaluate({ intent: onceIntent(), proposal: p, policy });
    expect(a).toEqual(b);
  });
});
