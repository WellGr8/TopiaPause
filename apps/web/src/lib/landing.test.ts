import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fmtExact } from '@topiapause/shared';
import { describe, expect, it } from 'vitest';
import { landingPlainText, landingPreview } from './landing';

function lin(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function contrast(a: string, b: string): number {
  const lum = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

describe('landing preview uses the engine scenes', () => {
  it('subscription amounts are the scene fixtures, to the satang', () => {
    const p = landingPreview('subscription', 'th');
    expect(p.user).toBe('ลองแอปนี้ให้หน่อย');
    expect(p.agentLabel).toBe('U-Bot (จำลอง)');
    expect(p.lead).toBe('เดี๋ยวครับ คุณแค่อยากลอง');
    expect(p.agent).toContain('฿3,990.00');
    expect(p.better).toContain('฿299.00');
    expect(p.better).toContain('฿3,691.00');
    expect(p.ruleLine).toBe('งบสมาชิก ฿300 ของคุณทำงานแล้ว');
    expect(p.details.map((d) => d.ruleId)).toEqual(expect.arrayContaining(['SUB_COMMITMENT', 'SUB_OVER_CAP']));
    expect(fmtExact({ minor: 399000, currency: 'THB' })).toBe('฿3,990.00');
    expect(fmtExact({ minor: 369100, currency: 'THB' })).toBe('฿3,691.00');
  });

  it('crypto pause stays in plain words and USDT, with the rule ids behind details', () => {
    const plain = landingPlainText('crypto', 'th');
    expect(plain).toContain('ไปลงเหรียญเดียวมากเกินไป เสี่ยงเสียเงินก้อนใหญ่');
    expect(plain).toContain('AI กำลังจะให้สิทธิ์ดึงเงินได้ไม่จำกัด');
    expect(plain).toContain('USDT');
    expect(plain).not.toMatch(/฿|TOKEN-X|เพดาน|approval|concentration/i);
    const p = landingPreview('crypto', 'th');
    expect(p.details.map((d) => d.ruleId)).toEqual(expect.arrayContaining(['CONC_CAP', 'APPROVAL_SCOPE']));
    expect(p.details.map((d) => d.text).join('\n')).toContain('TOKEN-X');
  });

  it('stay pause uses the engine totals, not a baht sign on a coin', () => {
    const plain = landingPlainText('stay', 'th');
    expect(plain).toContain('฿1,200.00');
    expect(plain).toContain('฿1,284.00');
    expect(plain).toContain('฿1,445.00');
    expect(plain).toContain('฿161.00');
    expect(plain).toContain('กฎที่พักต้องยกเลิกได้ของคุณทำงานแล้ว');
  });
});

describe('light theme contrast', () => {
  it('ink on the canvas, and canvas on ink, are at least 7:1', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    const theme = css.slice(css.indexOf('@theme'), css.indexOf('.dark {'));
    const ink = theme.match(/--color-ink:\s*(#[0-9a-fA-F]{6})/)?.[1];
    const canvas = theme.match(/--color-canvas:\s*(#[0-9a-fA-F]{6})/)?.[1];
    expect(ink).toBeTruthy();
    expect(canvas).toBeTruthy();
    expect(contrast(ink!, canvas!)).toBeGreaterThanOrEqual(7);
    expect(contrast(canvas!, ink!)).toBeGreaterThanOrEqual(7);
  });
});
