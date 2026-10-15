import { afterEach, describe, expect, it, vi } from 'vitest';
import { ubotGuard } from './ubot';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('in-app U-Bot mock', () => {
  it('uses the guard client for check and confirm', async () => {
    const seen: { url: string; body: unknown; session?: string }[] = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
        seen.push({ url: String(url), body: JSON.parse(init.body), session: init.headers['X-TopiaPause-Session'] });
        const path = String(url);
        const body = path.endsWith('/api/confirm') ? { confirmation: 'c1' } : { decision: 'pause', verdictId: 'v1', check: { llmCalls: 0 } };
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }),
    );
    const guard = ubotGuard({ policyToken: 'tok', sessionToken: 'sess' });
    const verdict = await guard.check<{ decision: string; check: { llmCalls: number } }>({
      userMessage: 'ลองแอปนี้ให้หน่อย',
      lang: 'th',
      proposal: { kind: 'subscription' },
    });
    expect(verdict).toMatchObject({ decision: 'pause', check: { llmCalls: 0 } });
    await expect(guard.confirm({ verdictId: 'v1', choice: 'original' as 'counter_offer' })).rejects.toMatchObject({ code: 'original_not_confirmable' });
    await guard.confirm({ verdictId: 'v1', choice: 'counter_offer' });
    expect(seen[0]?.url).toBe('/api/guard/check');
    expect(seen[0]?.body).toMatchObject({ userMessage: 'ลองแอปนี้ให้หน่อย', policyToken: 'tok' });
    expect(seen[1]?.url).toBe('/api/confirm');
    expect(seen[1]?.body).toEqual({ verdictId: 'v1', choice: 'counter_offer' });
    expect(seen[1]?.session).toBe('sess');
  });
});
