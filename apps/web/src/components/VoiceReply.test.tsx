/** @vitest-environment happy-dom */
import { DEFAULT_POLICY, SCENES, sceneIntent } from '@topiapause/shared';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { GuardRun } from '../state';
import { resetApiCaches } from '../lib/api';
import { GuardianCard } from './GuardianCard';
import { VoiceReply } from './VoiceReply';

vi.mock('../lib/voice', () => ({
  speak: vi.fn(async () => {}),
  speakClip: vi.fn(async () => {}),
  stopVoice: vi.fn(),
}));

class FakeRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  ondataavailable: ((ev: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;
  start() {
    this.state = 'recording';
  }
  stop() {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob([Uint8Array.from([1, 2, 3])], { type: 'audio/webm' }) });
    this.onstop?.();
  }
  static isTypeSupported() {
    return true;
  }
}

function micOk(granted = true) {
  vi.stubGlobal('MediaRecorder', FakeRecorder);
  Object.defineProperty(navigator, 'mediaDevices', {
    configurable: true,
    value: {
      getUserMedia: granted ? vi.fn(async () => ({ getTracks: () => [{ stop() {} }] })) : vi.fn(async () => Promise.reject(new Error('denied'))),
    },
  });
}

function stubFetch(sttStatus: number, body: unknown) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      if (String(url).includes('/api/session')) {
        return new Response(JSON.stringify({ session: 's' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }
      return new Response(JSON.stringify(body), { status: sttStatus, headers: { 'Content-Type': 'application/json' } });
    }),
  );
}

beforeEach(() => {
  resetApiCaches();
  vi.stubGlobal('MediaRecorder', undefined);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('VoiceReply', () => {
  it('hides the mic when recording is unsupported', () => {
    render(<VoiceReply lang="th" canCounter onConfirm={vi.fn()} />);
    expect(screen.queryByTestId('voice-mic')).toBeNull();
    expect(screen.queryByText('ใช้ปุ่มด้านล่างได้เลย')).toBeNull();
  });

  it('hides the mic when permission is denied', async () => {
    micOk(false);
    render(<VoiceReply lang="th" canCounter onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByTestId('voice-mic'));
    expect(await screen.findByText('ใช้ปุ่มด้านล่างได้เลย')).toBeTruthy();
    expect(screen.queryByTestId('voice-mic')).toBeNull();
  });

  it('hides the mic when speech-to-text is rate-limited', async () => {
    micOk();
    stubFetch(429, { error: { code: 'rate_limited' } });
    render(<VoiceReply lang="th" canCounter onConfirm={vi.fn()} />);
    fireEvent.click(screen.getByTestId('voice-mic'));
    fireEvent.click(await screen.findByRole('button', { name: 'หยุดฟัง' }));
    expect(await screen.findByText('ใช้ปุ่มด้านล่างได้เลย')).toBeTruthy();
    expect(screen.queryByTestId('voice-mic')).toBeNull();
  });

  it('shows the transcript and waits for a tap before confirming the counter-offer', async () => {
    micOk();
    stubFetch(200, { transcript: 'เอาอันที่แนะนำ', action: 'counter_offer' });
    const onConfirm = vi.fn();
    render(<VoiceReply lang="th" canCounter onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('voice-mic'));
    const button = screen.getByTestId('voice-mic');
    expect(button.className).toContain('min-h-12');
    fireEvent.click(await screen.findByRole('button', { name: 'หยุดฟัง' }));
    expect(await screen.findByText(/เอาอันที่แนะนำ/)).toBeTruthy();
    expect(screen.getByText('จะใช้ทางเลือกที่แนะนำ')).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('voice-confirm'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith('counter_offer');
  });

  it('asks again when the reply is unclear and does not confirm', async () => {
    micOk();
    stubFetch(200, { transcript: 'ไม่ยืนยัน', action: 'unclear' });
    const onConfirm = vi.fn();
    render(<VoiceReply lang="th" canCounter onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('voice-mic'));
    fireEvent.click(await screen.findByRole('button', { name: 'หยุดฟัง' }));
    expect(await screen.findByText(/ลองพูดอีกครั้ง/)).toBeTruthy();
    expect(screen.queryByTestId('voice-confirm')).toBeNull();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it('stops a recording after 6 seconds', async () => {
    micOk();
    stubFetch(200, { transcript: 'ยกเลิก', action: 'cancel' });
    let armed: { fn: () => void; ms: number } | undefined;
    const real = window.setTimeout.bind(window);
    vi.spyOn(window, 'setTimeout').mockImplementation(((fn: TimerHandler, ms?: number) => {
      if (ms === 6000 && typeof fn === 'function') {
        armed = { fn: () => fn(), ms };
        return 1;
      }
      return real(fn, ms);
    }) as typeof window.setTimeout);
    const onConfirm = vi.fn();
    render(<VoiceReply lang="th" canCounter onConfirm={onConfirm} />);
    fireEvent.click(screen.getByTestId('voice-mic'));
    expect(await screen.findByRole('button', { name: 'หยุดฟัง' })).toBeTruthy();
    expect(armed?.ms).toBe(6000);
    await act(async () => {
      armed?.fn();
    });
    expect(await screen.findByText(/จะยกเลิก/)).toBeTruthy();
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('pause screen', () => {
  it('keeps the choice buttons when the mic is unavailable', () => {
    const scene = SCENES.subscription;
    const run: GuardRun = {
      runId: 'run-1',
      scene: 'subscription',
      userText: scene.userText.th,
      intent: sceneIntent('subscription', scene.userText.th, 'th'),
      proposal: scene.buildProposal({}),
      policy: DEFAULT_POLICY,
      stage: 'verdict',
    };
    render(<GuardianCard run={run} lang="th" onChoose={vi.fn()} onReceipt={vi.fn()} />);
    expect(screen.queryByTestId('voice-mic')).toBeNull();
    expect(screen.getByRole('button', { name: 'ใช้ทางเลือกนี้' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'ยกเลิก' })).toBeTruthy();
  });
});
