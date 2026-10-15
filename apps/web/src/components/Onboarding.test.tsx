/** @vitest-environment happy-dom */
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../App';
import { speak } from '../lib/voice';
import { AppProvider } from '../state';
import { Onboarding } from './Onboarding';

vi.mock('../lib/voice', () => ({
  speak: vi.fn(async () => {}),
  speakClip: vi.fn(async () => {}),
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

function rect(left: number): () => DOMRect {
  return () =>
    ({
      left,
      top: 0,
      right: left + 280,
      bottom: 96,
      width: 280,
      height: 96,
      x: left,
      y: 0,
      toJSON() {
        return {};
      },
    }) as DOMRect;
}

beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, '', '/');
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
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('ก่อน AI จ่าย\nเราถามคุณก่อน');
    expect(screen.getByText('ลองแอปนี้ให้หน่อย')).toBeTruthy();
    expect(screen.getByText('ผู้ช่วย AI (จำลอง)')).toBeTruthy();
    expect(screen.getByText('ใช้ได้กับ u.bot และผู้ช่วย AI อื่นผ่าน SDK')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'กลับหน้าแรก' })).toBeTruthy();
    expect(screen.getByText('สมัครรายปี ฿3,990.00 ให้นะครับ')).toBeTruthy();
    const plain = screen.getByTestId('pause-plain');
    expect(plain.textContent).toContain('เดี๋ยวครับ คุณแค่อยากลอง');
    expect(plain.textContent).toContain('฿299.00');
    expect(plain.textContent).toContain('฿3,990.00');
    expect(plain.textContent).toContain('ประหยัด ฿3,691.00');
    expect(plain.textContent).not.toContain('งบสมาชิก');
    expect(screen.getByTestId('pause-details').textContent).toContain('งบสมาชิก ฿300.00 ของคุณทำงานแล้ว');
    const listen = screen.getByRole('button', { name: 'ฟังเสียงเตือน' });
    expect(listen.className).toContain('min-h-12');
    expect(listen.textContent).toContain('ฟัง');
    expect(speak).not.toHaveBeenCalled();
    const cta = screen.getByRole('link', { name: 'ลองให้ AI จ่ายดู' });
    expect(cta.className).toContain('btn-gradient');
    expect(cta.className).not.toContain('bg-ink');
  });

  it('shows the finished chat immediately when motion is reduced, and never auto-advances', () => {
    matchMedia(true);
    const intervals = vi.spyOn(window, 'setInterval');
    renderLanding();
    expect(screen.getByRole('region', { name: 'TopiaPause' })).toBeTruthy();
    expect(document.querySelector('[data-reduced="true"]')?.getAttribute('data-step')).toBe('3');
    expect(screen.getByText('เดี๋ยวครับ คุณแค่อยากลอง')).toBeTruthy();
    expect(intervals).not.toHaveBeenCalled();
    expect(speak).not.toHaveBeenCalled();
    intervals.mockRestore();
  });

  it('selects a scenario card and replays that pause', () => {
    matchMedia(true);
    renderLanding();
    const app = screen.getByRole('tab', { name: /สมัครแอป/ });
    const stay = screen.getByRole('tab', { name: /จองที่พัก/ });
    const coin = screen.getByRole('tab', { name: /ลงทุนเหรียญ/ });
    expect(app.getAttribute('href')).toBe('/app?scene=subscription');
    expect(stay.getAttribute('href')).toBe('/app?scene=stay');
    expect(coin.getAttribute('href')).toBe('/app?scene=crypto');
    expect(app.getAttribute('aria-selected')).toBe('true');
    expect(app.className).toContain('border-ink');
    expect(app.className).toContain('rounded-full');
    expect(stay.getAttribute('aria-selected')).toBe('false');
    expect(stay.getAttribute('tabindex')).toBe('-1');
    expect(screen.getByRole('tablist').className).toContain('flex');
    expect(screen.getByRole('tablist').className).not.toContain('grid-cols-3');

    fireEvent.click(stay);
    const hero = screen.getByRole('tabpanel');
    const stayPlain = screen.getByTestId('pause-plain');
    expect(stay.getAttribute('aria-selected')).toBe('true');
    expect(hero.textContent).toContain('฿1,200.00');
    expect(hero.textContent).toContain('฿1,284.00');
    expect(stayPlain.textContent).toContain('฿1,445.00');
    expect(stayPlain.textContent).toContain('฿161.00');
    expect(stayPlain.textContent).not.toContain('กฎที่พักต้องยกเลิกได้');
    expect(screen.getByTestId('pause-details').textContent).toContain('กฎที่พักต้องยกเลิกได้ของคุณทำงานแล้ว');

    fireEvent.click(coin);
    const coinPlain = screen.getByTestId('pause-plain');
    expect(coinPlain.textContent).toContain('500 USDT');
    expect(coinPlain.textContent).toContain('200 USDT');
    expect(coinPlain.textContent).not.toMatch(/฿|TOKEN-X|เพดาน/);
    expect(screen.getByTestId('pause-details').textContent).toContain('CONC_CAP');
    expect(screen.getByTestId('pause-details').textContent).toContain('APPROVAL_SCOPE');
  });

  it('moves selection with the arrow keys, Home, and End', () => {
    matchMedia(true);
    renderLanding();
    const app = screen.getByRole('tab', { name: /สมัครแอป/ });
    const stay = screen.getByRole('tab', { name: /จองที่พัก/ });
    const coin = screen.getByRole('tab', { name: /ลงทุนเหรียญ/ });
    app.focus();
    fireEvent.keyDown(app, { key: 'ArrowRight' });
    expect(stay.getAttribute('aria-selected')).toBe('true');
    expect(stay.getAttribute('tabindex')).toBe('0');
    expect(app.getAttribute('tabindex')).toBe('-1');
    expect(document.activeElement).toBe(stay);
    expect(screen.getByTestId('pause-plain').textContent).toContain('฿1,445.00');

    fireEvent.keyDown(stay, { key: 'ArrowRight' });
    expect(coin.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(coin);

    fireEvent.keyDown(coin, { key: 'ArrowRight' });
    expect(app.getAttribute('aria-selected')).toBe('true');

    fireEvent.keyDown(app, { key: 'End' });
    expect(coin.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(coin);

    fireEvent.keyDown(coin, { key: 'Home' });
    expect(app.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(app);

    fireEvent.keyDown(app, { key: 'ArrowLeft' });
    expect(coin.getAttribute('aria-selected')).toBe('true');
  });

  it('selects the card nearest the left edge when the row scrolls', () => {
    matchMedia(true);
    renderLanding();
    const list = screen.getByRole('tablist');
    Object.defineProperty(list, 'scrollWidth', { configurable: true, value: 900 });
    Object.defineProperty(list, 'clientWidth', { configurable: true, value: 390 });
    list.getBoundingClientRect = rect(0);
    const [app, stay, coin] = screen.getAllByRole('tab');
    app!.getBoundingClientRect = rect(-300);
    stay!.getBoundingClientRect = rect(8);
    coin!.getBoundingClientRect = rect(320);
    fireEvent.scroll(list);
    expect(stay!.getAttribute('aria-selected')).toBe('true');
    expect(screen.getByTestId('pause-plain').textContent).toContain('฿1,445.00');
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

  it('stays light when the system is dark and an old theme value is stored', () => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-color-scheme') && query.includes('dark'),
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false,
    })) as typeof window.matchMedia;
    localStorage.setItem('topiapause:theme', 'dark');
    localStorage.setItem('topiapause:v3', JSON.stringify({ onboarded: false, lang: 'th', theme: 'dark' }));
    render(
      <AppProvider>
        <App />
      </AppProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem('topiapause:theme-choice')).toBe('light');
  });

  it('turns dark only when the explicit choice key says dark', () => {
    matchMedia(true);
    localStorage.setItem('topiapause:theme-choice', 'dark');
    render(
      <AppProvider>
        <App />
      </AppProvider>,
    );
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('deep-links /app/rules without using the saved screen', () => {
    matchMedia(true);
    window.history.replaceState(null, '', '/app/rules');
    localStorage.setItem('topiapause:v3', JSON.stringify({ onboarded: false, lang: 'th', theme: 'dark', screen: 'chat' }));
    render(
      <AppProvider>
        <App />
      </AppProvider>,
    );
    expect(screen.getByRole('heading', { name: 'กฎของคุณ' })).toBeTruthy();
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('opens the selected scenario from the primary button', async () => {
    matchMedia(true);
    render(
      <AppProvider>
        <App />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /จองที่พัก/ }));
    fireEvent.click(screen.getByRole('link', { name: 'ลองให้ AI จ่ายดู' }));
    expect(await screen.findByText('หาโรงแรมถูกๆ ใกล้อโศก คืนวันศุกร์ แต่แผนอาจเปลี่ยนนะ')).toBeTruthy();
    expect(window.location.pathname).toBe('/app');
  });

  it('opens the selected scenario card, and Back returns without dropping the chat', async () => {
    matchMedia(true);
    render(
      <AppProvider>
        <App />
      </AppProvider>,
    );
    fireEvent.click(screen.getByRole('tab', { name: /สมัครแอป/ }));
    expect(await screen.findByText('ช่วยสมัครแอปแต่งรูป PixelPro ให้หน่อย อยากลองดู')).toBeTruthy();
    expect(window.location.pathname).toBe('/app');
    fireEvent.click(screen.getAllByRole('link', { name: 'กลับหน้าแรก' })[0]!);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toContain('ก่อน AI จ่าย');
    expect(window.location.pathname).toBe('/');
    window.history.back();
    expect(await screen.findByText('ช่วยสมัครแอปแต่งรูป PixelPro ให้หน่อย อยากลองดู')).toBeTruthy();
    expect(window.location.pathname).toBe('/app');
  });
});
