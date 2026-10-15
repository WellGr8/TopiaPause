import { afterEach, describe, expect, it, vi } from 'vitest';
import { VerdictLedger, step, type TicketRow } from '../src/ledger';

interface Stored {
  id: string;
  state: string;
  expires_at: number;
}

/** The SQL statements VerdictLedger actually sends, with synchronous exec(). */
function fakeStorage() {
  const rows = new Map<string, Stored>();
  let alarmAt: number | undefined;
  let ready: Promise<unknown> = Promise.resolve();
  const sql = {
    exec(query: string, ...bindings: unknown[]) {
      const q = query.replace(/\s+/g, ' ').trim();
      let out: Record<string, string | number>[] = [];
      if (q.startsWith('CREATE TABLE')) {
        // schema init
      } else if (q.startsWith('SELECT state, expires_at')) {
        const row = rows.get(String(bindings[0]));
        if (row) out = [{ state: row.state, expires_at: row.expires_at }];
      } else if (q.startsWith('SELECT expires_at')) {
        const next = [...rows.values()].sort((a, b) => a.expires_at - b.expires_at)[0];
        if (next) out = [{ expires_at: next.expires_at }];
      } else if (q.startsWith('INSERT')) {
        const [id, state, expiresAt] = bindings;
        rows.set(String(id), { id: String(id), state: String(state), expires_at: Number(expiresAt) });
      } else if (q.startsWith('UPDATE')) {
        const [state, expiresAt, id] = bindings;
        const row = rows.get(String(id));
        if (row) rows.set(row.id, { id: row.id, state: String(state), expires_at: Number(expiresAt) });
      } else if (q.startsWith('DELETE FROM ticket WHERE id')) {
        rows.delete(String(bindings[0]));
      } else if (q.startsWith('DELETE FROM ticket WHERE expires_at')) {
        const now = Number(bindings[0]);
        for (const [id, row] of rows) if (row.expires_at <= now) rows.delete(id);
      } else {
        throw new Error(`unhandled SQL: ${q}`);
      }
      return {
        toArray: () => out,
        one: () => out[0],
      };
    },
  };
  const ctx = {
    blockConcurrencyWhile(fn: () => Promise<unknown>) {
      ready = fn();
      return ready;
    },
    storage: {
      sql,
      setAlarm: async (when: number) => {
        alarmAt = when;
      },
    },
  };
  return { ctx, rows, alarm: () => alarmAt, ready: () => ready };
}

async function open() {
  const storage = fakeStorage();
  const obj = new VerdictLedger(storage.ctx as unknown as DurableObjectState, {} as Env);
  await storage.ready();
  return { obj, rows: storage.rows, alarm: storage.alarm };
}

const future = () => Math.floor(Date.now() / 1000) + 600;

describe('step', () => {
  const row = (state: TicketRow['state'], expiresAt = 100): TicketRow => ({ state, expiresAt });

  it('issues once, confirms a pause, and spends on the first consume only', () => {
    const issued = step(undefined, 'issue', 100, 1, false);
    expect(issued.result).toEqual({ state: 'issued', firstUse: true });
    const again = step(issued.row, 'issue', 100, 1, false);
    expect(again.result).toEqual({ state: 'issued', firstUse: false });
    const confirmed = step(issued.row, 'confirm', 100, 1, false);
    expect(confirmed.result).toEqual({ state: 'confirmed', firstUse: true });
    const spent = step(confirmed.row, 'consume', 100, 1, true);
    expect(spent.result).toEqual({ state: 'used', firstUse: true });
    expect(step(spent.row, 'consume', 100, 1, true).result).toEqual({ state: 'used', firstUse: false });
  });

  it('refuses to spend a pause that is still issued, and drops an expired row', () => {
    const issued = step(undefined, 'issue', 100, 1, false).row;
    expect(step(issued, 'consume', 100, 1, true).result).toEqual({ state: 'unconfirmed', firstUse: false });
    expect(step(issued, 'consume', 100, 1, true).row).toEqual(row('issued'));
    expect(step(issued, 'consume', 50, 60, false)).toEqual({ row: undefined, result: { state: 'expired', firstUse: false } });
    expect(step(row('used', 40), 'consume', 100, 50, false).result.state).toBe('expired');
  });
});

describe('VerdictLedger', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('spends one ticket on the first consume when two consumes run together', async () => {
    const { obj, rows } = await open();
    const exp = future();
    await obj.issue('ticket-a', exp);
    const [a, b] = await Promise.all([obj.consume('ticket-a', exp, false), obj.consume('ticket-a', exp, false)]);
    expect([a, b].map((r) => r.firstUse).sort()).toEqual([false, true]);
    expect(a.state).toBe('used');
    expect(b.state).toBe('used');
    expect(rows.get('ticket-a')?.state).toBe('used');
    const replay = await obj.consume('ticket-a', exp, false);
    expect(replay).toEqual({ state: 'used', firstUse: false });
  });

  it('requires confirm before a pause can be spent, and a second issue does not clear used', async () => {
    const { obj } = await open();
    const exp = future();
    await obj.issue('pause', exp);
    expect(await obj.consume('pause', exp, true)).toEqual({ state: 'unconfirmed', firstUse: false });
    expect(await obj.confirm('pause', exp)).toEqual({ state: 'confirmed', firstUse: true });
    expect(await obj.consume('pause', exp, true)).toEqual({ state: 'used', firstUse: true });
    expect(await obj.issue('pause', exp)).toEqual({ state: 'used', firstUse: false });
    expect(await obj.consume('missing', exp, false)).toEqual({ state: 'missing', firstUse: false });
  });

  it('rejects an expired ticket and deletes the row', async () => {
    vi.useFakeTimers();
    const start = Date.now();
    const { obj, rows } = await open();
    const exp = Math.floor(start / 1000) + 30;
    await obj.issue('old', exp);
    vi.setSystemTime(start + 31_000);
    expect(await obj.consume('old', exp, false)).toEqual({ state: 'expired', firstUse: false });
    expect(rows.has('old')).toBe(false);
  });

  it('alarm deletes expired rows and reschedules the earliest one left', async () => {
    vi.useFakeTimers();
    const now = Math.floor(Date.now() / 1000);
    const { obj, rows, alarm } = await open();
    await obj.issue('early', now + 10);
    await obj.issue('late', now + 100);
    expect(alarm()).toBe((now + 10) * 1000);
    vi.setSystemTime((now + 11) * 1000);
    await obj.alarm();
    expect(rows.has('early')).toBe(false);
    expect(rows.get('late')?.state).toBe('issued');
    expect(alarm()).toBe((now + 100) * 1000);
  });

  it('keeps two objects apart', async () => {
    const a = await open();
    const b = await open();
    const exp = future();
    await a.obj.issue('same-name', exp);
    await b.obj.consume('same-name', exp, false);
    expect(b.rows.has('same-name')).toBe(false);
    expect(a.rows.get('same-name')?.state).toBe('issued');
  });
});
