import { DEFAULT_POLICY } from '@topiapause/shared';
import { describe, expect, it } from 'vitest';
import { applyRule, normalizeRuleText, parseRule } from './rules';

const rule = (text: string) => {
  const r = parseRule(text);
  if (!r.ok) throw new Error(`expected a rule for "${text}", got ${r.reason}`);
  return r.rule;
};

describe('parseRule: subscription budget', () => {
  it.each([
    ['ค่าสมาชิกห้ามเกินเดือนละ 300', 300],
    ['ค่าสมัครสมาชิกแอปไม่เกิน 1,200 บาทต่อเดือน', 1200],
    ['งบแอปรายเดือน ๕๐๐ บาท', 500],
    ['Subscriptions max ฿300 a month', 300],
    ['subscription budget 450 THB/mo', 450],
    ['app plans: no more than 1,500.50 baht monthly', 1500.5],
  ])('%s -> ฿%d/mo', (text, amount) => {
    expect(rule(text)).toEqual({ kind: 'subscriptionCap', amount });
  });

  it('converts a yearly budget to monthly', () => {
    expect(rule('ค่าสมาชิกปีละ 3,600 บาท')).toEqual({ kind: 'subscriptionCap', amount: 300, fromYearly: true });
    expect(rule('subscriptions up to 1000 baht per year')).toEqual({ kind: 'subscriptionCap', amount: 83.33, fromYearly: true });
  });
});

describe('parseRule: refundable hotels', () => {
  it.each([
    ['hotels must be refundable if ≤15% more', 15],
    ['Refundable rooms only when they cost at most 20 percent extra', 20],
    ['โรงแรมต้องคืนเงินได้ ถ้าแพงกว่าไม่เกิน 15%', 15],
    ['ห้องพักต้องยกเลิกได้ ถ้าแพงขึ้นไม่เกินร้อยละ ๑๐', 10],
  ])('%s -> +%d%%', (text, pct) => {
    expect(rule(text)).toEqual({ kind: 'refundablePremium', pct });
  });
});

describe('parseRule: token cap', () => {
  it.each([
    ['crypto cap 30% of portfolio', 30],
    ['TOKEN-X no more than 25 percent of my portfolio', 25],
    ['คริปโตห้ามเกิน 30% ของพอร์ต', 30],
    ['โทเคนไม่เกิน ๔๐ เปอร์เซ็นต์ของพอร์ต', 40],
  ])('%s -> %d%%', (text, pct) => {
    expect(rule(text)).toEqual({ kind: 'tokenCap', asset: 'TOKEN-X', pct });
  });
});

describe('parseRule: polite failures', () => {
  it('rejects empty input', () => expect(parseRule('   ')).toEqual({ ok: false, reason: 'empty' }));
  it('rejects text with no known topic', () => {
    expect(parseRule('be nice to me')).toEqual({ ok: false, reason: 'noTopic' });
    expect(parseRule('ห้ามเกิน 300')).toEqual({ ok: false, reason: 'noTopic' });
  });
  it('rejects a topic with no number', () => {
    expect(parseRule('ค่าสมาชิกอย่าแพงนะ')).toEqual({ ok: false, reason: 'noNumber' });
    expect(parseRule('crypto should be small')).toEqual({ ok: false, reason: 'noNumber' });
  });
  it('rejects impossible percentages', () => {
    expect(parseRule('crypto cap 150% of portfolio')).toEqual({ ok: false, reason: 'outOfRange' });
  });
});

describe('normalizeRuleText', () => {
  it('maps Thai digits and strips thousands separators', () => {
    expect(normalizeRuleText('๑,๒๐๐ บาท')).toBe('1200 บาท');
    expect(normalizeRuleText('1,234,567.50')).toBe('1234567.50');
  });
});

describe('applyRule', () => {
  it('writes into the existing policy fields only', () => {
    const p = applyRule(DEFAULT_POLICY, { kind: 'tokenCap', asset: 'TOKEN-X', pct: 25 });
    expect(p.tokenConcentrationCaps['TOKEN-X']).toBe(0.25);
    expect(p.monthlySubscriptionCap).toEqual(DEFAULT_POLICY.monthlySubscriptionCap);
    expect(applyRule(DEFAULT_POLICY, { kind: 'subscriptionCap', amount: 450 }).monthlySubscriptionCap).toEqual({ minor: 45000, currency: 'THB' });
    expect(applyRule(DEFAULT_POLICY, { kind: 'refundablePremium', pct: 20 }).maxRefundablePremiumPct).toBe(20);
  });
});
