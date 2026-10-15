import { describe, expect, it, vi } from 'vitest';
import { GuardClientError, createGuard, type CreateGuardOptions } from '../src/index';

type FetchMock = NonNullable<CreateGuardOptions['fetch']>;

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe('createGuard', () => {
  it('POSTs the public check contract and attaches the policy token', async () => {
    const fetchMock = vi.fn<FetchMock>(async () => jsonResponse(200, { decision: 'pause', verdictId: 'v1', check: { llmCalls: 0, estCostTHB_satang: 1 } }));
    const guard = createGuard({ baseUrl: 'https://topiapause.example/', policyToken: 'tok', fetch: fetchMock });
    const verdict = await guard.check({
      userMessage: 'Sign me up for PixelPro, just to try it.',
      lang: 'en',
      proposal: { kind: 'subscription', price: { minor: 399000, currency: 'THB' } },
    });
    expect(verdict).toMatchObject({ decision: 'pause', verdictId: 'v1', check: { llmCalls: 0 } });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://topiapause.example/api/guard/check');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');
    expect(JSON.parse(init.body)).toEqual({
      userMessage: 'Sign me up for PixelPro, just to try it.',
      lang: 'en',
      proposal: { kind: 'subscription', price: { minor: 399000, currency: 'THB' } },
      policyToken: 'tok',
    });
  });

  it('refuses to send policy or intent', async () => {
    const fetchMock = vi.fn();
    const guard = createGuard({ baseUrl: 'https://topiapause.example', fetch: fetchMock });
    await expect(guard.check({ userMessage: 'hi', policy: { approvalMode: 'allow_unlimited' } } as never)).rejects.toMatchObject({
      code: 'agent_field_rejected',
    });
    await expect(guard.check({ userMessage: 'hi', intent: { goal: 'try_app' } } as never)).rejects.toBeInstanceOf(GuardClientError);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('confirms only the counter-offer and sends the session', async () => {
    const fetchMock = vi.fn<FetchMock>(async () => jsonResponse(200, { confirmation: 'c1' }));
    const guard = createGuard({ baseUrl: 'https://topiapause.example', sessionToken: 'sess', fetch: fetchMock });
    await expect(guard.confirm({ verdictId: 'v1', choice: 'original' as 'counter_offer' })).rejects.toMatchObject({
      status: 400,
      code: 'original_not_confirmable',
    });
    expect(fetchMock).not.toHaveBeenCalled();
    const conf = await guard.confirm({ verdictId: 'v1', choice: 'counter_offer' });
    expect(conf).toEqual({ confirmation: 'c1' });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://topiapause.example/api/confirm');
    expect(init.headers['X-TopiaPause-Session']).toBe('sess');
    expect(JSON.parse(init.body)).toEqual({ verdictId: 'v1', choice: 'counter_offer' });
  });

  it('surfaces the API error code', async () => {
    const fetchMock = vi.fn<FetchMock>(async () => jsonResponse(400, { error: { code: 'original_not_confirmable', message: 'no' } }));
    const guard = createGuard({ baseUrl: 'https://topiapause.example', fetch: fetchMock });
    await expect(guard.confirm({ verdictId: 'v1', choice: 'counter_offer' })).rejects.toMatchObject({ status: 400, code: 'original_not_confirmable' });
  });
});
