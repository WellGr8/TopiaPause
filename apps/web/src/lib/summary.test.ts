import { DEFAULT_POLICY, SCENES, sceneIntent, type SceneId } from '@topiapause/shared';
import { evaluate } from '@topiapause/guard-engine';
import { describe, expect, it } from 'vitest';
import { offerOf, reasonLine } from './summary';

function verdict(scene: SceneId) {
  const preset = SCENES[scene];
  const proposal = preset.buildProposal();
  return {
    proposal,
    verdict: evaluate({
      intent: sceneIntent(scene, preset.userText.th, 'th'),
      proposal,
      policy: DEFAULT_POLICY,
      lang: 'th',
    }),
  };
}

describe('pause card face', () => {
  it('shows the yearly price to the satang and a plain monthly offer', () => {
    const { proposal, verdict: v } = verdict('subscription');
    expect(reasonLine(v, proposal, 'th')).toBe('คุณบอกแค่ลอง แต่นี่คือรายปี ฿3,990.00');
    const offer = offerOf(v, 'th');
    expect(offer?.value).toBe('฿299.00');
    expect(offer?.detail).toContain('฿300.00');
    expect(offer?.detail).not.toMatch(/พอร์ต|เพดาน|TOKEN-X/);
  });

  it('describes a coin in USDT, without a portfolio cap on the face', () => {
    const { proposal, verdict: v } = verdict('crypto');
    const line = reasonLine(v, proposal, 'th');
    expect(line).toContain('500 USDT');
    expect(line).toContain('ไปลงเหรียญเดียวมากเกินไป');
    expect(line).toContain('ดึงเงินได้ไม่จำกัด');
    expect(line).not.toMatch(/฿|TOKEN-X|เพดาน|พอร์ต/);
    expect(offerOf(v, 'th')).toEqual({ value: '200 USDT', detail: 'ให้ดึงเงินได้แค่ครั้งนี้' });
  });
});
