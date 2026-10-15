import { stayProposal, subscriptionProposal, swapProposal, type AgentProposal } from '@topiapause/shared';
import { describe, expect, it } from 'vitest';
import type { ActivityEntry } from '../state';
import { fmtExact, moneyLine, monthlySavings } from './savings';

let n = 0;
function entry(
  original: AgentProposal,
  accepted: AgentProposal | undefined,
  over: Partial<ActivityEntry> = {},
  metrics: Record<string, number> = {},
): ActivityEntry {
  return {
    id: `a${n++}`,
    at: '2026-10-15T08:00:00Z',
    scene: 'subscription',
    decision: 'pause',
    choice: 'counter_offer',
    protectedAmount: 99999,
    currency: original.kind === 'token_swap' ? 'USD' : 'THB',
    receipt: { originalProposal: original, verdict: { metrics, counterOffer: accepted && { proposal: accepted } } } as unknown as ActivityEntry['receipt'],
    ...over,
  };
}

const sub = subscriptionProposal();
const monthly: AgentProposal = { ...sub, planId: 'pixelpro-monthly', planName: 'PixelPro Monthly', price: { amount: 299, currency: 'THB' }, interval: 'month', trialDays: 7 };
const stay = stayProposal();
const asokInn: AgentProposal = { ...stay, ...stay.catalogAlternatives[0]!, nightlyPrice: { amount: 1350, currency: 'THB' } };
const swap = swapProposal(500);
const swapCounter: AgentProposal = { ...swap, amountIn: { amount: 200, currency: 'USDT' }, approval: { ...swap.approval, type: 'exact' } };

describe('fmtExact', () => {
  it('always shows satang for THB', () => {
    expect(fmtExact(369100, 'THB')).toBe('฿3,691.00');
    expect(fmtExact(5, 'THB')).toBe('฿0.05');
  });
  it('formats USDT at 6 decimals, trimmed, never as $', () => {
    expect(fmtExact(300_000_000, 'USDT')).toBe('300 USDT');
    expect(fmtExact(12_500_000, 'USDT')).toBe('12.5 USDT');
    expect(fmtExact(1, 'USDT')).toBe('0.000001 USDT');
  });
});

describe('moneyLine', () => {
  it('saved = original price - accepted price for a cheaper plan, ignoring the engine protectedAmount', () => {
    const l = moneyLine(entry(sub, monthly))!;
    expect(l.kind).toBe('saved');
    expect(l.kind === 'saved' && l.savedMinor).toBe(369100);
  });
  it('a refundable room is protection with a cost, never a negative saving', () => {
    const l = moneyLine(entry(stay, asokInn, { scene: 'stay' }))!;
    expect(l).toMatchObject({ kind: 'protected', scene: 'stay', costMinor: 16100, coveredMinor: 128400 });
  });
  it('a smaller swap is reduced exposure in USDT, not savings', () => {
    const l = moneyLine(entry(swap, swapCounter, { scene: 'crypto' }, { postTradeSharePct: 45, counterSharePct: 30 }))!;
    expect(l).toMatchObject({ kind: 'protected', scene: 'crypto', asset: 'TOKEN-X', reducedMinor: 300_000_000, fromPct: 45, toPct: 30 });
    expect(l.kind === 'protected' && l.scene === 'crypto' && fmtExact(l.reducedMinor, 'USDT')).toBe('300 USDT');
  });
  it('falls back to portfolio maths for the exposure %', () => {
    const l = moneyLine(entry(swap, swapCounter, { scene: 'crypto' }))!;
    expect(l).toMatchObject({ fromPct: 45, toPct: 30 });
  });
  it('ignores anything the user did not accept', () => {
    expect(moneyLine(entry(sub, monthly, { choice: 'cancel' }))).toBeUndefined();
    expect(moneyLine(entry(sub, monthly, { choice: 'original' }))).toBeUndefined();
    expect(moneyLine(entry(sub, undefined))).toBeUndefined();
  });
});

describe('monthlySavings', () => {
  const now = new Date('2026-10-20T00:00:00Z');
  it('full demo: PixelPro + injection count ฿3,691.00 once; hotel and crypto stay out of saved', () => {
    const scene1 = entry(sub, monthly, { at: '2026-10-15T08:00:00Z' });
    const injection = entry(subscriptionProposal(), monthly, { at: '2026-10-15T08:05:00Z' });
    const s = monthlySavings(
      [
        injection,
        entry(stay, asokInn, { scene: 'stay' }),
        entry(swap, swapCounter, { scene: 'crypto' }, { postTradeSharePct: 45, counterSharePct: 30 }),
        scene1,
        entry(sub, monthly, { choice: 'cancel' }),
        entry(sub, monthly, { at: '2026-09-30T12:00:00Z' }),
      ],
      now,
    );
    expect(fmtExact(s.thb, 'THB')).toBe('฿3,691.00');
    expect(s.saved.map((l) => l.entry.id)).toEqual([scene1.id]);
    expect(s.counted.has(injection.id)).toBe(false);
    expect(s.stays.map((l) => [l.costMinor, l.coveredMinor])).toEqual([[16100, 128400]]);
    expect(s.cryptos.map((l) => fmtExact(l.reducedMinor, 'USDT'))).toEqual(['300 USDT']);
  });
  it('uses Bangkok time for the month boundary', () => {
    expect(monthlySavings([entry(sub, monthly, { at: '2026-09-30T18:00:00Z' })], now).thb).toBe(369100);
  });
});
