import { evaluate } from '@topiapause/guard-engine';
import { DEFAULT_POLICY, SCENES, sceneIntent, type GuardVerdict } from '@topiapause/shared';
import { describe, expect, it } from 'vitest';
import type { ActivityEntry } from '../state';
import { cardLine, moneyLine, monthlySavings } from './savings';

const verdictOf = (id: 'subscription' | 'stay' | 'crypto'): { v: GuardVerdict; entry: ActivityEntry } => {
  const proposal = SCENES[id].buildProposal();
  const v = evaluate({ intent: sceneIntent(id, SCENES[id].userText.en, 'en'), proposal, policy: DEFAULT_POLICY });
  const entry = {
    id: 'a',
    at: new Date().toISOString(),
    scene: id,
    decision: v.decision,
    choice: 'counter_offer',
    protectedAmount: 0,
    currency: id === 'crypto' ? 'USDT' : 'THB',
    receipt: { originalProposal: proposal, verdict: v },
  } as unknown as ActivityEntry;
  return { v, entry };
};

describe('finished GuardCard line agrees with the saved-this-month hero', () => {
  it('subscription is the only saving: ฿3,691.00', () => {
    const { v, entry } = verdictOf('subscription');
    const line = moneyLine(entry)!;
    expect(line.kind).toBe('saved');
    expect(line.kind === 'saved' && line.savedMinor).toBe(369100);
    expect(v.amounts.difference?.minor).toBe(369100);
    expect(cardLine(entry.receipt.originalProposal, v, 'en')).toEqual({ lead: 'Saved', amount: '฿3,691.00' });
    expect(cardLine(entry.receipt.originalProposal, v, 'th')).toEqual({ lead: 'ประหยัด', amount: '฿3,691.00' });
  });

  it('stay is a protection cost of ฿161.00 covering ฿1,284.00, not a negative saving', () => {
    const { v, entry } = verdictOf('stay');
    expect(moneyLine(entry)).toMatchObject({ kind: 'protected', scene: 'stay', costMinor: 16100, coveredMinor: 128400 });
    expect(cardLine(entry.receipt.originalProposal, v, 'en')).toEqual({
      lead: 'Protection cost',
      amount: '฿161.00',
      tail: 'paid to make ฿1,284.00 cancel-free',
    });
    expect(cardLine(entry.receipt.originalProposal, v, 'th')).toEqual({
      lead: 'ค่าความคุ้มครอง',
      amount: '฿161.00',
      tail: 'จ่ายเพิ่มเพื่อให้ ฿1,284.00 ยกเลิกฟรีได้',
    });
    expect(monthlySavings([entry]).thb).toBe(0);
  });

  it('crypto is a 300 USDT exposure cut, never dollars', () => {
    const { v, entry } = verdictOf('crypto');
    const line = moneyLine(entry)!;
    expect(line).toMatchObject({ kind: 'protected', scene: 'crypto', asset: 'TOKEN-X', reducedMinor: 300_000_000, fromPct: 45, toPct: 30 });
    const card = cardLine(entry.receipt.originalProposal, v, 'en')!;
    expect(card).toEqual({ lead: 'Cut TOKEN-X exposure by', amount: '300 USDT', tail: '(45% → 30%)' });
    expect(card.amount).not.toContain('$');
    expect(cardLine(entry.receipt.originalProposal, v, 'th')?.amount).toBe('300 USDT');
    expect(monthlySavings([entry]).thb).toBe(0);
  });
});
