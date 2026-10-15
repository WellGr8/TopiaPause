/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { speak } from '../lib/voice';
import { AppProvider } from '../state';
import { Onboarding } from './Onboarding';

vi.mock('../lib/voice', () => ({
  speak: vi.fn(async () => {}),
  stopVoice: vi.fn(),
}));

function matchMedia(reduce: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: reduce && query.includes('prefers-reduced-motion'),
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as typeof window.matchMedia;
}

function renderLanding() {
  return render(
    <AppProvider>
      <Onboarding />
    </AppProvider>,
  );
}

beforeEach(() => {
  localStorage.clear();
  vi.mocked(speak).mockClear();
  document.documentElement.classList.remove('dark');
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('first screen', () => {
  it('renders the hero chat from the subscription scene', () => {
    matchMedia(true);
    renderLanding();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ให้ AI จ่ายแทนได้ โดยไม่ต้องเข้าใจทุกเงื่อนไข');
    expect(screen.getByText('ลองแอปนี้ให้หน่อย')).toBeTruthy();
    expect(screen.getByText('U-Bot (จำลอง)')).toBeTruthy();
    expect(screen.getByText(/กำลังสมัครแพ็กเกจรายปี ฿3,990\.00/)).toBeTruthy();
    const plain = screen.getByTestId('pause-plain');
    expect(plain.textContent).toContain('เดี๋ยวครับ คุณแค่อยากลอง');
    expect(plain.textContent).toContain('฿299.00');
    expect(plain.textContent).toContain('฿3,691.00');
    expect(plain.textContent).toContain('งบสมาชิก ฿300 ของคุณทำงานแล้ว');
    expect(screen.getByRole('button', { name: 'ฟังเสียงเตือน' }).className).toContain('min-h-12');
    expect(speak).not.toHaveBeenCalled();
  });

  it('shows the finished chat immediately when motion is reduced', () => {
    matchMedia(true);
    renderLanding();
    expect(screen.getByRole('region', { name: 'TopiaPause' }).getAttribute('class')).toBeTruthy();
    expect(document.querySelector('[data-reduced="true"]')?.getAttribute('data-step')).toBe('3');
    expect(screen.getByText('เดี๋ยวครับ คุณแค่อยากลอง')).toBeTruthy();
    expect(speak).not.toHaveBeenCalled();
  });

  it('plays a scenario pause from its chip, and keeps jargon inside details', () => {
    matchMedia(true);
    renderLanding();
    fireEvent.click(screen.getByRole('button', { name: 'AI จองที่พักให้' }));
    const stay = screen.getByTestId('pause-plain');
    expect(stay.textContent).toContain('฿1,284.00');
    expect(stay.textContent).toContain('กฎที่พักต้องยกเลิกได้ของคุณทำงานแล้ว');

    fireEvent.click(screen.getByRole('button', { name: 'AI ลงทุนเหรียญให้' }));
    const coin = screen.getByTestId('pause-plain');
    expect(coin.textContent).toContain('ไปลงเหรียญเดียวมากเกินไป เสี่ยงเสียเงินก้อนใหญ่');
    expect(coin.textContent).toContain('AI กำลังจะให้สิทธิ์ดึงเงินได้ไม่จำกัด');
    expect(coin.textContent).toContain('USDT');
    expect(coin.textContent).not.toMatch(/฿|TOKEN-X|เพดาน/);
    expect(screen.getByTestId('pause-details').textContent).toContain('CONC_CAP');
    expect(screen.getByTestId('pause-details').textContent).toContain('APPROVAL_SCOPE');
  });

  it('plays the Thai warning only after the listen button', () => {
    matchMedia(true);
    renderLanding();
    expect(speak).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'ฟังเสียงเตือน' }));
    expect(speak).toHaveBeenCalledTimes(1);
    const input = vi.mocked(speak).mock.calls[0]?.[0] as { text: string; lang: string; clipId: string };
    expect(input.lang).toBe('th');
    expect(input.clipId).toBe('subscription-pause');
    expect(input.text).toContain('เดี๋ยวก่อนครับ');
  });
});
