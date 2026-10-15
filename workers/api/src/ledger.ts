import { DurableObject } from 'cloudflare:workers';

// One object per verdict id (idFromName(ticketId)). Input gates serialize the
// methods, and the read-then-write below does not await, so two executes of the
// same ticket cannot both observe "not used".

export type TicketState = 'issued' | 'confirmed' | 'used';
export type LedgerOp = 'issue' | 'confirm' | 'consume';

export interface TicketRow {
  state: TicketState;
  /** Unix seconds. */
  expiresAt: number;
}

export interface LedgerResult {
  state: TicketState | 'expired' | 'missing' | 'unconfirmed';
  /** True only for the transition that first marks the ticket used. */
  firstUse: boolean;
}

export interface LedgerStub {
  issue(ticketId: string, expiresAt: number): Promise<LedgerResult>;
  confirm(ticketId: string, expiresAt: number): Promise<LedgerResult>;
  consume(ticketId: string, expiresAt: number, needsConfirm: boolean): Promise<LedgerResult>;
}

const STATES = new Set<TicketState>(['issued', 'confirmed', 'used']);

function isState(value: string): value is TicketState {
  return STATES.has(value as TicketState);
}

/**
 * One transition. `expiresAt` and `now` are unix seconds.
 * An expired row is dropped. Nothing here awaits.
 */
export function step(row: TicketRow | undefined, op: LedgerOp, expiresAt: number, now: number, needsConfirm: boolean): { row: TicketRow | undefined; result: LedgerResult } {
  if (expiresAt < now || (row !== undefined && row.expiresAt < now)) {
    return { row: undefined, result: { state: 'expired', firstUse: false } };
  }
  if (op === 'issue') {
    if (!row) return { row: { state: 'issued', expiresAt }, result: { state: 'issued', firstUse: true } };
    return { row, result: { state: row.state, firstUse: false } };
  }
  if (!row) return { row: undefined, result: { state: 'missing', firstUse: false } };
  if (op === 'confirm') {
    if (row.state === 'used') return { row, result: { state: 'used', firstUse: false } };
    return { row: { state: 'confirmed', expiresAt: row.expiresAt }, result: { state: 'confirmed', firstUse: row.state !== 'confirmed' } };
  }
  if (row.state === 'used') return { row, result: { state: 'used', firstUse: false } };
  if (needsConfirm && row.state !== 'confirmed') return { row, result: { state: 'unconfirmed', firstUse: false } };
  return { row: { state: 'used', expiresAt: row.expiresAt }, result: { state: 'used', firstUse: true } };
}

interface Slot {
  row?: TicketRow;
  tail: Promise<void>;
}

/** In-process ledger with the same transitions, serialized per ticket. DEV=1 only. */
export function createMemoryNamespace(store = new Map<string, Slot>()) {
  return {
    idFromName(name: string) {
      return name;
    },
    get(id: string): LedgerStub {
      let slot = store.get(id);
      if (!slot) {
        slot = { tail: Promise.resolve() };
        store.set(id, slot);
      }
      const current = slot;
      const run = <T>(fn: () => T): Promise<T> => {
        const done = current.tail.then(fn, fn);
        current.tail = done.then(
          () => undefined,
          () => undefined,
        );
        return done;
      };
      const apply = (op: LedgerOp, expiresAt: number, needsConfirm: boolean) => {
        const now = Math.floor(Date.now() / 1000);
        const next = step(current.row, op, expiresAt, now, needsConfirm);
        current.row = next.row;
        return next.result;
      };
      return {
        issue: (_ticketId, expiresAt) => run(() => apply('issue', expiresAt, false)),
        confirm: (_ticketId, expiresAt) => run(() => apply('confirm', expiresAt, false)),
        consume: (_ticketId, expiresAt, needsConfirm) => run(() => apply('consume', expiresAt, needsConfirm)),
      };
    },
  };
}

let devStore = new Map<string, Slot>();
let devNamespace = createMemoryNamespace(devStore);
let sharedStore = new Map<string, Slot>();
let sharedNamespace = createMemoryNamespace(sharedStore);

/** Local fallback when DEV=1 and the binding was not injected. Not shared across isolates. */
export function devLedgerNamespace() {
  return devNamespace;
}

/** One namespace for the whole test, so a check and a later execute see the same ticket. */
export function sharedLedgerNamespace() {
  return sharedNamespace;
}

export function resetLedgerForTests(): void {
  devStore = new Map();
  devNamespace = createMemoryNamespace(devStore);
  sharedStore = new Map();
  sharedNamespace = createMemoryNamespace(sharedStore);
}

export class VerdictLedger extends DurableObject<Env> {
  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.sql().exec(
        `CREATE TABLE IF NOT EXISTS ticket (
          id TEXT PRIMARY KEY,
          state TEXT NOT NULL,
          expires_at INTEGER NOT NULL
        )`,
      );
    });
  }

  async issue(ticketId: string, expiresAt: number): Promise<LedgerResult> {
    const result = this.mutate(ticketId, 'issue', expiresAt, false);
    await this.arm(result);
    return result;
  }

  async confirm(ticketId: string, expiresAt: number): Promise<LedgerResult> {
    const result = this.mutate(ticketId, 'confirm', expiresAt, false);
    await this.arm(result);
    return result;
  }

  async consume(ticketId: string, expiresAt: number, needsConfirm: boolean): Promise<LedgerResult> {
    const result = this.mutate(ticketId, 'consume', expiresAt, needsConfirm);
    await this.arm(result);
    return result;
  }

  async alarm(): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    this.sql().exec('DELETE FROM ticket WHERE expires_at <= ?', now);
    const next = this.sql().exec<{ expires_at: number }>('SELECT expires_at FROM ticket ORDER BY expires_at ASC LIMIT 1').toArray()[0];
    if (next) await this.ctx.storage.setAlarm(next.expires_at * 1000);
  }

  private sql() {
    return this.ctx.storage.sql;
  }

  /** Sync read and write. The input gate holds other calls until this method finishes. */
  private mutate(ticketId: string, op: LedgerOp, expiresAt: number, needsConfirm: boolean): LedgerResult {
    const now = Math.floor(Date.now() / 1000);
    const existing = this.read(ticketId);
    const next = step(existing, op, expiresAt, now, needsConfirm);
    if (next.row) this.write(ticketId, next.row);
    else if (existing) this.sql().exec('DELETE FROM ticket WHERE id = ?', ticketId);
    return next.result;
  }

  private read(id: string): TicketRow | undefined {
    const row = this.sql().exec<{ state: string; expires_at: number }>('SELECT state, expires_at FROM ticket WHERE id = ?', id).toArray()[0];
    if (!row || !isState(row.state)) return undefined;
    return { state: row.state, expiresAt: row.expires_at };
  }

  private write(id: string, row: TicketRow): void {
    if (this.read(id)) this.sql().exec('UPDATE ticket SET state = ?, expires_at = ? WHERE id = ?', row.state, row.expiresAt, id);
    else this.sql().exec('INSERT INTO ticket (id, state, expires_at) VALUES (?, ?, ?)', id, row.state, row.expiresAt);
  }

  private async arm(result: LedgerResult): Promise<void> {
    if (result.state === 'expired' || result.state === 'missing' || result.state === 'used') return;
    const row = this.sql().exec<{ expires_at: number }>('SELECT expires_at FROM ticket ORDER BY expires_at ASC LIMIT 1').toArray()[0];
    if (row) await this.ctx.storage.setAlarm(row.expires_at * 1000);
  }
}
