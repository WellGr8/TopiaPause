import { stayProposal, subscriptionProposal, swapProposal, type AgentProposal } from '@topiapause/shared';
import { describe, expect, it } from 'vitest';
import type { ActivityEntry } from '../state';
import { fmtExact, monthlySavings, savedLine } from './savings';

function entry(original: AgentProposal, accepted: AgentProposal | undefined, over: Partial<ActivityEntry> = {}): ActivityEntry {
  return {
    id: 'a',
    at: '2026-10-15T08:00:00Z',
    scene: 'subscription',
    decision: 'pause',
    choice: 'counter_offer',
    protectedAmount: 99999,
    currency: original.kind === 'token_swap' ? 'USDT' : 'THB',
    receipt: { originalProposal: original, verdict: { counterOffer: accepted && { proposal: accepted } } } as unknown as ActivityEntry['receipt'],
    ...over,
  };
}

const sub = subscriptionProposal();
const monthly: AgentProposal = { ...sub, planId: 'pixelpro-monthly', planName: 'PixelPro Monthly', price: { minor: 29900, currency: 'THB' }, interval: 'month', trialDays: 7 };
const stay = stayProposal();
const asokInn: AgentProposal = { ...stay, hotel: 'Asok Inn', nightlyPrice: { minor: 135000, currency: 'THB' }, totalPrice: { minor: 144500, currency: 'THB' }, refundable: true };

describe('fmtExact', () => {
  it('always shows satang', () => {
    expect(fmtExact(369100, 'THB')).toBe('฿3,691.00');
    expect(fmtExact(5, 'THB')).toBe('฿0.05');
    expect(fmtExact(-16100, 'THB')).toBe('-฿161.00');
    expect(fmtExact(123456789, 'USD')).toBe('$1,234,567.89');
    expect(fmtExact(166_500_000, 'USDT')).toBe('166.50 USDT');
    expect(fmtExact(200_420_883, 'USDT')).toBe('200.420883 USDT');
  });
});

describe('savedLine', () => {
  it('is original total minus accepted total, ignoring the engine protectedAmount', () => {
    expect(savedLine(entry(sub, monthly))?.savedMinor).toBe(369100);
  });
  it('goes negative when the accepted fit costs more (refundable room)', () => {
    const l = savedLine(entry(stay, asokInn, { scene: 'stay' }))!;
    expect([l.originalMinor, l.acceptedMinor, l.savedMinor]).toEqual([128400, 144500, -16100]);
  });
  it('ignores anything the user did not accept', () => {
    expect(savedLine(entry(sub, monthly, { choice: 'cancel' }))).toBeUndefined();
    expect(savedLine(entry(sub, monthly, { choice: 'original' }))).toBeUndefined();
    expect(savedLine(entry(sub, undefined))).toBeUndefined();
  });
});

describe('monthlySavings', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  it('nets accepted lines this month so the total reconciles with the per-item list', () => {
    const s = monthlySavings(
      [
        entry(sub, monthly),
        entry(stay, asokInn, { scene: 'stay' }),
        entry(sub, monthly, { choice: 'cancel' }),
        entry(sub, monthly, { at: '2026-09-30T12:00:00Z' }),
        entry(swapProposal(500_000_000), swapProposal(333_500_000), { scene: 'crypto' }),
      ],
      now,
    );
    expect(s.lines).toHaveLength(3);
    expect(fmtExact(s.thb, 'THB')).toBe('฿3,530.00');
    expect(s.thb).toBe(s.lines.filter((l) => l.currency === 'THB').reduce((t, l) => t + l.savedMinor, 0));
    expect(fmtExact(s.usdt, 'USDT')).toBe('166.50 USDT');
  });
  it('uses Bangkok time for the month boundary', () => {
    expect(monthlySavings([entry(sub, monthly, { at: '2026-09-30T18:00:00Z' })], now).thb).toBe(369100);
  });
});
