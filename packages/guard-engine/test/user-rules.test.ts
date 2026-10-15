import { describe, expect, it } from 'vitest';
import {
  DEFAULT_POLICY,
  findingDetail,
  money,
  sceneIntent,
  stayProposal,
  subscriptionProposal,
  swapProposal,
  type ActionIntent,
  type StayProposal,
  type UserPolicy,
} from '@topiapause/shared';
import { allowedNumbers, evaluate, passesNumberLock } from '../src';

const limit = (minor: number): UserPolicy => ({ ...DEFAULT_POLICY, perPaymentLimit: { minor, currency: 'THB' } });

const quietIntent: ActionIntent = {
  goal: 'book_stay',
  commitment: 'once',
  priceSensitivity: 'normal',
  flexibilityNeeded: false,
  confidence: 0.95,
  language: 'th',
  rawText: 'จองห้องที่ยกเลิกได้',
};

function quietStay(minor: number): StayProposal {
  return {
    ...stayProposal(),
    refundable: true,
    quotedPrice: undefined,
    totalPrice: { minor, currency: 'THB' },
    nightlyPrice: { minor, currency: 'THB' },
    freeCancelUntil: '2026-10-22T18:00:00+07:00',
    catalogAlternatives: [],
  };
}

describe('user-set rules', () => {
  it('allows a charge exactly at the per-payment limit and pauses 1 satang over', () => {
    const cap = 50_000;
    const at = evaluate({ intent: quietIntent, proposal: quietStay(cap), policy: limit(cap) });
    expect(at.decision).toBe('allow');
    expect(at.findings.map((f) => f.ruleId)).not.toContain('USER_PAYMENT_LIMIT');

    const over = evaluate({ intent: quietIntent, proposal: quietStay(cap + 1), policy: limit(cap) });
    expect(over.decision).toBe('pause');
    const finding = over.findings.find((f) => f.ruleId === 'USER_PAYMENT_LIMIT')!;
    expect(finding.evidence.limit).toEqual({ minor: cap, currency: 'THB' });
    expect(over.voiceText.th).toBe(findingDetail(finding, 'th'));
    expect(over.voiceText.en).toBe('Paused by your rule: max ฿500.00 per payment');
    expect(over.explanation.th).toContain('ติดกฎที่คุณตั้งไว้: จ่ายได้ไม่เกิน ฿500.00 ต่อครั้ง');
    const allowed = allowedNumbers(over);
    expect(passesNumberLock(over.voiceText.th, allowed)).toBe(true);
    expect(passesNumberLock(over.voiceText.en, allowed)).toBe(true);
  });

  it('pauses the hotel scene at ฿500 and cites the rule, and follows the stay rule at ฿2,000', () => {
    const proposal = stayProposal();
    const intent = sceneIntent('stay', 'หาโรงแรมถูกๆ ใกล้อโศก', 'th');
    const tight = evaluate({ intent, proposal, policy: limit(50_000) });
    expect(tight.decision).toBe('pause');
    expect(tight.findings.map((f) => f.ruleId)).toContain('USER_PAYMENT_LIMIT');
    expect(tight.counterOffer).toBeUndefined();
    expect(tight.voiceText.th).toBe('ติดกฎที่คุณตั้งไว้: จ่ายได้ไม่เกิน ฿500.00 ต่อครั้ง');

    const loose = evaluate({ intent, proposal, policy: limit(200_000) });
    expect(loose.findings.map((f) => f.ruleId)).not.toContain('USER_PAYMENT_LIMIT');
    expect(loose.findings.map((f) => f.ruleId)).toContain('STAY_FLEXIBILITY');
    expect(loose.counterOffer?.proposal).toMatchObject({ hotel: 'Asok Inn' });
    expect(loose.voiceText.th).not.toContain('จ่ายได้ไม่เกิน');
  });

  it('pauses an annual plan or an auto-renew only when that rule is on', () => {
    const annual = subscriptionProposal();
    const trial = sceneIntent('subscription', 'อยากลอง', 'th');
    const off = evaluate({ intent: trial, proposal: annual, policy: DEFAULT_POLICY });
    expect(off.findings.map((f) => f.ruleId).sort()).toEqual(['SUB_COMMITMENT', 'SUB_OVER_CAP']);

    const on = evaluate({ intent: trial, proposal: annual, policy: { ...DEFAULT_POLICY, blockAnnualAutoRenew: true } });
    expect(on.findings.map((f) => f.ruleId)).toContain('USER_BLOCK_ANNUAL');
    expect(on.voiceText.en).toBe('Paused by your rule: no annual plan and no auto-renew');

    const monthly = {
      ...subscriptionProposal(),
      planId: 'pixelpro-monthly',
      price: money(29900, 'THB'),
      interval: 'month' as const,
      trialDays: 0,
      autoRenew: true,
    };
    const ongoing: ActionIntent = { ...trial, commitment: 'ongoing', confidence: 0.95 };
    const renew = evaluate({ intent: ongoing, proposal: monthly, policy: { ...DEFAULT_POLICY, blockAnnualAutoRenew: true } });
    expect(renew.decision).toBe('pause');
    expect(renew.findings.map((f) => f.ruleId)).toEqual(['USER_BLOCK_ANNUAL']);

    const once = evaluate({
      intent: ongoing,
      proposal: { ...monthly, autoRenew: false },
      policy: { ...DEFAULT_POLICY, blockAnnualAutoRenew: true },
    });
    expect(once.decision).toBe('allow');
    expect(once.findings).toHaveLength(0);
  });

  it('pauses an unlimited withdrawal when exact mode is on, and allows it when the user turns that off', () => {
    const proposal = swapProposal(100_000_000);
    const intent: ActionIntent = {
      ...sceneIntent('crypto', 'Swap 100 USDT into TOKEN-X on an ongoing basis', 'en'),
      commitment: 'ongoing',
      amount: money(100_000_000, 'USDT'),
    };
    const exact = evaluate({ intent, proposal, policy: DEFAULT_POLICY });
    expect(exact.findings.map((f) => f.ruleId)).toEqual(['APPROVAL_SCOPE']);

    const open = evaluate({ intent, proposal, policy: { ...DEFAULT_POLICY, approvalMode: 'allow_unlimited' } });
    expect(open.decision).toBe('allow');
    expect(open.findings.map((f) => f.ruleId)).not.toContain('APPROVAL_SCOPE');

    const demo = evaluate({
      intent: sceneIntent('crypto', 'Swap 500 USDT into TOKEN-X, just this once.', 'en'),
      proposal: swapProposal(),
      policy: DEFAULT_POLICY,
    });
    expect(demo.findings.map((f) => f.ruleId)).toEqual(expect.arrayContaining(['CONC_CAP', 'APPROVAL_SCOPE']));
    expect(demo.findings.map((f) => f.ruleId)).not.toContain('USER_PAYMENT_LIMIT');
  });
});
