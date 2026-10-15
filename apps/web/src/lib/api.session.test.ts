import { SCENES } from '@topiapause/shared';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { apiChat, apiExecute, apiStt, resetApiCaches } from './api';

const health = { ok: true, engineVersion: 'test', llm: 'scripted', tts: 'unavailable' };
const later = () => new Date(Date.now() + 120_000).toISOString();

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function tokenOf(init?: RequestInit): string {
  return new Headers(init?.headers).get('X-TopiaPause-Session') ?? '';
}

afterEach(() => {
  resetApiCaches();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('app session', () => {
  it('reuses a fresh token and does not keep a failed mint', async () => {
    const calls: string[] = [];
    let sessionTries = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = String(url);
        calls.push(path);
        if (path.includes('/api/health')) return json(health);
        if (path.includes('/api/session')) {
          sessionTries += 1;
          if (sessionTries === 1) return new Response('no', { status: 500 });
          return json({ session: 'ok', expiresAt: later() });
        }
        return json({ reply: 'hi', source: 'scripted' });
      }),
    );

    expect(await apiChat({ message: 'a', lang: 'th' })).toBeNull();
    expect(await apiChat({ message: 'b', lang: 'th' })).toMatchObject({ reply: 'hi' });
    expect(await apiChat({ message: 'c', lang: 'th' })).toMatchObject({ reply: 'hi' });
    expect(calls.filter((path) => path.includes('/api/session'))).toHaveLength(2);
  });

  it('mints again when the token is inside the refresh window', async () => {
    let sessions = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = String(url);
        if (path.includes('/api/health')) return json(health);
        if (path.includes('/api/session')) {
          sessions += 1;
          return json({ session: `s${sessions}`, expiresAt: new Date(Date.now() + 5_000).toISOString() });
        }
        return json({ reply: 'hi', source: 'scripted' });
      }),
    );
    await apiChat({ message: 'a', lang: 'th' });
    await apiChat({ message: 'b', lang: 'th' });
    expect(sessions).toBe(2);
  });

  it('joins one mint when two calls start together', async () => {
    let sessions = 0;
    let release: (r: Response) => void = () => {};
    const gate = new Promise<Response>((resolve) => {
      release = resolve;
    });
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const path = String(url);
        if (path.includes('/api/health')) return json(health);
        if (path.includes('/api/session')) {
          sessions += 1;
          return gate;
        }
        return json({ reply: 'hi', source: 'scripted' });
      }),
    );
    const pending = Promise.all([apiChat({ message: 'a', lang: 'th' }), apiChat({ message: 'b', lang: 'th' })]);
    await vi.waitFor(() => expect(sessions).toBe(1));
    release(json({ session: 'shared', expiresAt: later() }));
    const [a, b] = await pending;
    expect(a).toMatchObject({ reply: 'hi' });
    expect(b).toMatchObject({ reply: 'hi' });
    expect(sessions).toBe(1);
  });

  it('retries a dead session once, and does not mint a third time when the retry is also dead', async () => {
    let sessions = 0;
    const chatTokens: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url);
        if (path.includes('/api/health')) return json(health);
        if (path.includes('/api/session')) {
          sessions += 1;
          return json({ session: sessions === 1 ? 'old' : 'new', expiresAt: later() });
        }
        chatTokens.push(tokenOf(init));
        return json({ error: { code: 'invalid_session', message: 'no' } }, 403);
      }),
    );
    expect(await apiChat({ message: 'a', lang: 'th' })).toBeNull();
    expect(sessions).toBe(2);
    expect(chatTokens).toEqual(['old', 'new']);
  });

  it('does not refresh on forbidden_origin, and a failed refresh drops the stale token', async () => {
    let sessions = 0;
    let chats = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url);
        if (path.includes('/api/health')) return json(health);
        if (path.includes('/api/session')) {
          sessions += 1;
          if (sessions === 2) return new Response('no', { status: 500 });
          return json({ session: sessions === 1 ? 'A' : 'B', expiresAt: later() });
        }
        chats += 1;
        const token = tokenOf(init);
        if (chats === 1) return json({ error: { code: 'forbidden_origin', message: 'no' } }, 403);
        if (chats === 2) {
          expect(token).toBe('A');
          return json({ error: { code: 'session_required', message: 'no' } }, 403);
        }
        expect(token).toBe('B');
        return json({ reply: 'back', source: 'scripted' });
      }),
    );

    expect(await apiChat({ message: 'a', lang: 'th' })).toBeNull();
    expect(sessions).toBe(1);
    expect(await apiChat({ message: 'b', lang: 'th' })).toBeNull();
    expect(sessions).toBe(2);
    expect(await apiChat({ message: 'c', lang: 'th' })).toMatchObject({ reply: 'back' });
    expect(sessions).toBe(3);
  });

  it('retries speech-to-text and confirm once after invalid_session', async () => {
    let sessions = 0;
    const seen: string[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const path = String(url);
        if (path.includes('/api/health')) return json(health);
        if (path.includes('/api/session')) {
          sessions += 1;
          return json({ session: sessions === 1 ? 'old' : 'new', expiresAt: later() });
        }
        seen.push(`${path}:${tokenOf(init)}`);
        if (tokenOf(init) === 'old') return json({ error: { code: 'invalid_session', message: 'no' } }, 403);
        if (path.includes('/api/voice/stt')) return json({ transcript: 'เอาอันที่แนะนำ', action: 'counter_offer' });
        if (path.includes('/api/confirm')) return json({ confirmation: 'c' });
        if (path.includes('/api/agent/execute')) return json({ execution: { mode: 'mock', status: 'done' } });
        return json({ error: { code: 'nope' } }, 500);
      }),
    );

    expect(await apiStt(new Blob(['x'], { type: 'audio/webm' }))).toEqual({ transcript: 'เอาอันที่แนะนำ', action: 'counter_offer' });
    expect(sessions).toBe(2);
    resetApiCaches();
    sessions = 0;
    const execution = await apiExecute(SCENES.subscription.buildProposal(), 'v1', 'counter_offer');
    expect(execution).toMatchObject({ status: 'done' });
    expect(sessions).toBe(2);
    expect(seen).toContain('/api/confirm:new');
  });
});
