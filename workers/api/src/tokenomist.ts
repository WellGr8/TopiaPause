import type { DataSource, MarketData, UnlockEvent } from '@topiapause/shared';
import sample from './data/tokenomist-sample.json';
import { log, type AppEnv } from './http';

// Upcoming token unlocks from Tokenomist (v5), for the crypto risk note only: the note never
// changes the decision. One call per hour is shared by every check (in-memory per isolate, plus
// the Cache API across isolates in a colo), so the per-check cost is ~0.
// No key, an error or an empty answer: the bundled sample, labelled "sample data, not live".

export const TOKENOMIST_URL = 'https://api.tokenomist.ai/v5/unlock/events/upcoming';
const TTL_MS = 60 * 60 * 1000;
const CACHE_KEY = 'https://tokenomist-cache.topiapause.internal/v5/unlock/events/upcoming';

/** TOKEN-X is a sandbox asset; its risk note uses a real token's schedule. */
export const SYMBOL_FOR: Record<string, string> = { 'TOKEN-X': 'ARB' };

interface V5Event {
  tokenSymbol?: string;
  upcomingEvent?: { unlockDate?: string; cliffUnlocks?: { cliffValue?: number; valueToMarketCap?: number } };
}
interface V5Response {
  metadata?: { queryDate?: string };
  data?: V5Event[];
}

export interface MarketFetch {
  market: MarketData;
  externalCalls: number;
  cacheHit: boolean;
  /** Seconds since the data was fetched (null for the bundled sample). */
  dataAge: number | null;
}

export function toUnlocks(res: V5Response): UnlockEvent[] {
  const assets = Object.entries(SYMBOL_FOR);
  return (res.data ?? []).flatMap((e) => {
    const ev = e.upcomingEvent;
    const pct = ev?.cliffUnlocks?.valueToMarketCap;
    if (!e.tokenSymbol || !ev?.unlockDate || typeof pct !== 'number') return [];
    return assets
      .filter(([, sym]) => sym === e.tokenSymbol)
      .map(([asset, symbol]) => ({ symbol, asset, unlockDate: ev.unlockDate!, valueToMarketCapPct: pct, cliffValueUsd: ev.cliffUnlocks?.cliffValue }));
  });
}

let memory: { unlocks: UnlockEvent[]; fetchedAt: number } | undefined;

/** Test hook. */
export function resetTokenomistCache(): void {
  memory = undefined;
}

function sampleData(): MarketFetch {
  return { market: { unlocks: toUnlocks(sample as V5Response), source: 'sample', asOf: sample.metadata.queryDate }, externalCalls: 0, cacheHit: false, dataAge: null };
}

function fromCache(entry: { unlocks: UnlockEvent[]; fetchedAt: number }, source: DataSource, now: number): MarketFetch {
  return {
    market: { unlocks: entry.unlocks, source, asOf: new Date(entry.fetchedAt).toISOString() },
    externalCalls: 0,
    cacheHit: true,
    dataAge: Math.round((now - entry.fetchedAt) / 1000),
  };
}

export async function upcomingUnlocks(env: AppEnv, ctx?: ExecutionContext, now = Date.now()): Promise<MarketFetch> {
  if (!env.TOKENOMIST_API_KEY) return sampleData();
  if (memory && now - memory.fetchedAt < TTL_MS) return fromCache(memory, 'cache', now);

  const cache = typeof caches !== 'undefined' ? caches.default : undefined;
  const hit = await cache?.match(CACHE_KEY);
  if (hit) {
    const entry = (await hit.json()) as { unlocks: UnlockEvent[]; fetchedAt: number };
    if (now - entry.fetchedAt < TTL_MS) {
      memory = entry;
      return fromCache(entry, 'cache', now);
    }
  }

  const started = Date.now();
  try {
    const res = await fetch(TOKENOMIST_URL, { headers: { 'x-api-key': env.TOKENOMIST_API_KEY, Accept: 'application/json' }, signal: AbortSignal.timeout(4000) });
    if (!res.ok) {
      log({ message: 'tokenomist http error', status: res.status, ms: Date.now() - started });
      return { ...sampleData(), externalCalls: 1 };
    }
    const unlocks = toUnlocks((await res.json()) as V5Response);
    log({ message: 'tokenomist ok', unlocks: unlocks.length, ms: Date.now() - started });
    if (unlocks.length === 0) return { ...sampleData(), externalCalls: 1 };
    memory = { unlocks, fetchedAt: now };
    const put = cache?.put(CACHE_KEY, new Response(JSON.stringify(memory), { headers: { 'Content-Type': 'application/json', 'Cache-Control': `public, max-age=${TTL_MS / 1000}` } }));
    if (put) ctx ? ctx.waitUntil(put) : void put;
    return { market: { unlocks, source: 'live', asOf: new Date(now).toISOString() }, externalCalls: 1, cacheHit: false, dataAge: 0 };
  } catch (e) {
    log({ message: 'tokenomist failed', error: e instanceof Error ? e.name : String(e), ms: Date.now() - started });
    return { ...sampleData(), externalCalls: 1 };
  }
}
