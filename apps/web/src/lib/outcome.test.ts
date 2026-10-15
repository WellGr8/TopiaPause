import { evaluate } from '@topiapause/guard-engine';
import { DEFAULT_POLICY, SCENE_ORDER, SCENES, sceneIntent, type GuardVerdict } from '@topiapause/shared';
import { describe, expect, it } from 'vitest';
import { outcomeLine } from '../components/GuardReceipt';
import type { ActivityEntry } from '../state';
import { fmtExact, savedLine } from './savings';

const verdictOf = (id: (typeof SCENE_ORDER)[number]): { v: GuardVerdict; entry: ActivityEntry } => {
  const proposal = SCENES[id].buildProposal();
  const v = evaluate({ intent: sceneIntent(id, SCENES[id].userText.en, 'en'), proposal, policy: DEFAULT_POLICY });
  const entry = { id: 'a', at: new Date().toISOString(), scene: id, decision: v.decision, choice: 'counter_offer', protectedAmount: 0, currency: 'THB', receipt: { originalProposal: proposal, verdict: v } } as unknown as ActivityEntry;
  return { v, entry };
};

describe('finished GuardCard line agrees with the saved-this-month hero', () => {
  it.each(SCENE_ORDER)('%s: engine difference === hero savedLine, to the minor unit', (id) => {
    const { v, entry } = verdictOf(id);
    expect(v.amounts.difference?.minor).toBe(savedLine(entry)!.savedMinor);
  });

  it('subscription: "You save ฿3,691.00"', () => {
    expect(outcomeLine(verdictOf('subscription').v, 'en')).toEqual({ lead: 'You save', amount: '฿3,691.00' });
  });

  it('stay: the refundable room costs more, so it reads as the price of protection, not savings', () => {
    const { v, entry } = verdictOf('stay');
    expect(fmtExact(savedLine(entry)!.savedMinor, 'THB')).toBe('-฿161.00');
    expect(outcomeLine(v, 'en')).toEqual({ lead: '', amount: '+฿161.00', tail: 'for a refundable room, protects ฿1,284.00' });
    expect(outcomeLine(v, 'th')).toEqual({ lead: '', amount: '+฿161.00', tail: 'เพื่อห้องยกเลิกฟรี คุ้มครอง ฿1,284.00' });
  });

  it('crypto: 300.00 USDT stays in USDT', () => {
    expect(outcomeLine(verdictOf('crypto').v, 'en')).toEqual({ lead: 'Stays in USDT', amount: '300.00 USDT' });
  });
});
