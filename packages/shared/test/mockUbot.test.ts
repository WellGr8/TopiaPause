import { describe, expect, it } from 'vitest';
import { detectScene, extractIntentMock, scriptedChat } from '../src';

describe('scripted U-Bot (mock)', () => {
  it('detects scenes from Thai and English text', () => {
    expect(detectScene('แลก 500 USDT เป็น TOKEN-X')).toBe('crypto');
    expect(detectScene('Find me a cheap hotel')).toBe('stay');
    expect(detectScene('สมัครแอปแต่งรูป')).toBe('subscription');
    expect(detectScene('hello')).toBeUndefined();
  });

  it('extracts amount and "once" from free text', () => {
    const i = extractIntentMock('swap 300 usdt just once', 'crypto', 'en');
    expect(i.amount).toEqual({ minor: 300_000_000, currency: 'USDT' });
    expect(i.commitment).toBe('once');
    expect(i.confidence).toBeGreaterThanOrEqual(0.7);
  });

  it('lowers confidence when no intent cue is found', () => {
    expect(extractIntentMock('book a hotel', 'stay', 'en').confidence).toBeLessThan(0.7);
  });

  it('proposes the scene trap for presets', () => {
    const t = scriptedChat({ message: 'แลก 500 USDT เป็น TOKEN-X ครั้งเดียวพอ', scene: 'crypto', lang: 'th' });
    expect(t.proposal?.kind).toBe('token_swap');
    expect(t.proposal?.agent.name).toBe('U-Bot (mock)');
  });
});
