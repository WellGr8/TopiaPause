import { describe, expect, it } from 'vitest';
import { detectScene, extractIntentMock, scriptedChat } from '../src';

describe('scripted assistant (demo)', () => {
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

  it('proposes the fast preset for a scene', () => {
    const t = scriptedChat({ message: 'แลก 500 USDT เป็น TOKEN-X ครั้งเดียวพอ', scene: 'crypto', lang: 'th' });
    expect(t.proposal?.kind).toBe('token_swap');
    expect(t.proposal?.agent.name).toBe('AI assistant (demo)');
    expect(t.reply).toContain('ให้สิทธิ์ถอน USDT ได้ไม่จำกัด');
    expect(scriptedChat({ message: 'Swap 500 USDT into TOKEN-X, just this once.', scene: 'crypto', lang: 'en' }).reply).toBe(
      "Sure. Swapping 500 USDT into TOKEN-X, and I'll set unlimited USDT withdrawal permission so next time is faster.",
    );
  });

  it('matches natural phrasing to a scene and a proposal', () => {
    const pixel = scriptedChat({ message: 'I want to try PixelPro', lang: 'en' });
    expect(pixel.scene).toBe('subscription');
    expect(pixel.proposal?.kind).toBe('subscription');
    expect(pixel.intent?.commitment).toBe('trial');

    const stay = scriptedChat({ message: 'Book me somewhere to sleep near Asok tonight', lang: 'en' });
    expect(stay.scene).toBe('stay');
    expect(stay.proposal?.kind).toBe('stay');

    const thai = scriptedChat({ message: 'ลองใช้ PixelPro หน่อย', lang: 'th' });
    expect(thai.scene).toBe('subscription');
    expect(thai.proposal?.kind).toBe('subscription');
    expect(thai.intent?.commitment).toBe('trial');
  });

  it('does not rewrite ETH or BTC into a USDT swap', () => {
    const th = scriptedChat({ message: 'แลก eth เป็น btc', lang: 'th' });
    expect(th.proposal).toBeUndefined();
    expect(th.reply).toContain('USDT → TOKEN-X');
    expect(th.reply).toContain('แลก 500 USDT ครั้งเดียว');
    const en = scriptedChat({ message: 'swap all my ETH to BTC', lang: 'en' });
    expect(en.proposal).toBeUndefined();
    expect(en.reply).toContain('USDT → TOKEN-X');
  });

  it('treats a cheap hotel as a stay, not a why question', () => {
    const turn = scriptedChat({ message: 'หาโรงแรมไม่แพงใกล้อโศก', lang: 'th' });
    expect(turn.scene).toBe('stay');
    expect(turn.proposal?.kind).toBe('stay');
  });

  it('does not book a restaurant as a hotel', () => {
    for (const message of ['จองโต๊ะร้านอาหาร', 'กินข้าวใกล้อโศก']) {
      const turn = scriptedChat({ message, lang: 'th' });
      expect(turn.proposal).toBeUndefined();
      expect(turn.scene).toBeUndefined();
      expect(turn.reply).toContain('ลองแอป PixelPro');
      expect(turn.reply).toContain('โรงแรมถูกๆ ใกล้อโศก');
      expect(turn.reply).toContain('แลก 500 USDT ครั้งเดียว');
    }
  });

  it('says the crypto swap in plain Thai', () => {
    const turn = scriptedChat({ message: 'แลก 500 USDT เป็น TOKEN-X ครั้งเดียวพอ', scene: 'crypto', lang: 'th' });
    expect(turn.reply).toContain('จะแลก 500 USDT เป็น TOKEN-X');
    expect(turn.reply).toContain('ให้สิทธิ์ถอน USDT ได้ไม่จำกัด');
    expect(turn.reply).not.toContain('ขออนุมัติสิทธิ์');
  });

  it('names the three chips when nothing matches', () => {
    const en = scriptedChat({ message: 'what is the weather', lang: 'en' });
    expect(en.proposal).toBeUndefined();
    expect(en.scene).toBeUndefined();
    expect(en.reply).toContain('Try PixelPro app');
    expect(en.reply).toContain('Cheap hotel near Asok');
    expect(en.reply).toContain('Swap 500 USDT once');
    expect(en.reply.toLowerCase()).toContain('three');

    const th = scriptedChat({ message: 'วันนี้อากาศเป็นไง', lang: 'th' });
    expect(th.proposal).toBeUndefined();
    expect(th.reply).toContain('ลองแอป PixelPro');
    expect(th.reply).toContain('โรงแรมถูกๆ ใกล้อโศก');
    expect(th.reply).toContain('แลก 500 USDT ครั้งเดียว');
  });
});
