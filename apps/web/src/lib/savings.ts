import type { AgentProposal, StayProposal, SubscriptionProposal, TokenSwapProposal } from '@topiapause/shared';
import type { ActivityEntry } from '../state';

export type Unit = 'THB' | 'USDT';

/** Minor units per unit so sums are exact: satang for THB, micro-USDT (6 decimals, as on-chain). */
const DECIMALS: Record<Unit, number> = { THB: 2, USDT: 6 };

export const toMinor = (amount: number, unit: Unit = 'THB') => Math.round(amount * 10 ** DECIMALS[unit]);

/** ฿3,691.00 (always satang) / 300 USDT / 12.5 USDT (trailing zeros trimmed). */
export function fmtExact(minor: number, unit: Unit): string {
  const d = DECIMALS[unit];
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  const base = 10 ** d;
  const whole = Math.floor(abs / base).toLocaleString('en-US');
  const frac = String(abs % base).padStart(d, '0');
  if (unit === 'THB') return `${sign}฿${whole}.${frac}`;
  const trimmed = frac.replace(/0+$/, '');
  return `${sign}${whole}${trimmed ? `.${trimmed}` : ''} USDT`;
}

export interface SavedLine {
  kind: 'saved';
  entry: ActivityEntry;
  original: SubscriptionProposal;
  accepted: SubscriptionProposal;
  originalMinor: number;
  acceptedMinor: number;
  /** original - accepted, always > 0 (only cheaper accepted fits count). */
  savedMinor: number;
}

export interface StayProtection {
  kind: 'protected';
  scene: 'stay';
  entry: ActivityEntry;
  /** What the refundable room cost on top of the original. Never a saving. */
  costMinor: number;
  /** The amount that is now cancel-free. */
  coveredMinor: number;
  freeCancelUntil?: string;
}

export interface CryptoProtection {
  kind: 'protected';
  scene: 'crypto';
  entry: ActivityEntry;
  asset: string;
  /** Micro-USDT not swapped into the capped token. */
  reducedMinor: number;
  fromPct: number;
  toPct: number;
}

export type ProtectedLine = StayProtection | CryptoProtection;
export type MoneyLine = SavedLine | ProtectedLine;

function accepted(a: ActivityEntry): AgentProposal | undefined {
  return a.choice === 'counter_offer' ? a.receipt.verdict.counterOffer?.proposal : undefined;
}

function sharePct(p: TokenSwapProposal, amountIn: number): number {
  const v = p.portfolio.totalUsd;
  const h = p.portfolio.holdingsUsd[p.toAsset] ?? 0;
  return Math.round(((h + amountIn * (1 - p.feeRate)) / v) * 1000) / 10;
}

/** One accepted better fit, classified. Saved = a cheaper THB plan; everything else is protection. */
export function moneyLine(a: ActivityEntry): MoneyLine | undefined {
  const acc = accepted(a);
  const orig = a.receipt.originalProposal;
  if (!acc || acc.kind !== orig.kind) return undefined;

  if (orig.kind === 'subscription' && acc.kind === 'subscription') {
    if (orig.price.currency !== 'THB' || acc.price.currency !== 'THB') return undefined;
    const originalMinor = toMinor(orig.price.amount);
    const acceptedMinor = toMinor(acc.price.amount);
    if (acceptedMinor >= originalMinor) return undefined;
    return { kind: 'saved', entry: a, original: orig, accepted: acc, originalMinor, acceptedMinor, savedMinor: originalMinor - acceptedMinor };
  }

  if (orig.kind === 'stay' && acc.kind === 'stay') {
    const s = acc as StayProposal;
    if (!s.refundable || orig.refundable) return undefined;
    const coveredMinor = toMinor(orig.totalPrice.amount);
    const costMinor = Math.max(0, toMinor(s.totalPrice.amount) - coveredMinor);
    return { kind: 'protected', scene: 'stay', entry: a, costMinor, coveredMinor, freeCancelUntil: s.freeCancelUntil };
  }

  if (orig.kind === 'token_swap' && acc.kind === 'token_swap') {
    if (orig.amountIn.currency !== 'USDT') return undefined;
    const reducedMinor = toMinor(orig.amountIn.amount, 'USDT') - toMinor(acc.amountIn.amount, 'USDT');
    if (reducedMinor <= 0) return undefined;
    const m = a.receipt.verdict.metrics ?? {};
    return {
      kind: 'protected',
      scene: 'crypto',
      entry: a,
      asset: orig.toAsset,
      reducedMinor,
      fromPct: m.postTradeSharePct ?? sharePct(orig, orig.amountIn.amount),
      toPct: m.counterSharePct ?? sharePct(orig, acc.amountIn.amount),
    };
  }
  return undefined;
}

/** Same purchase twice in a month (e.g. the PixelPro scene and the injection scene) counts once. */
function dedupeKey(l: MoneyLine): string {
  if (l.kind === 'saved') return `sub:${l.original.merchant}:${l.original.planId}:${l.accepted.planId}`;
  const o = l.entry.receipt.originalProposal;
  if (l.scene === 'stay') return `stay:${o.kind === 'stay' ? o.hotel : ''}`;
  return `swap:${l.asset}:${l.reducedMinor}`;
}

const bangkokMonth = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);

/** This Bangkok month: saved (cheaper fits, THB) kept apart from protected (refundable stays, crypto exposure cuts). */
export function monthlySavings(activity: ActivityEntry[], now = new Date()) {
  const month = bangkokMonth(now);
  const seen = new Set<string>();
  const saved: SavedLine[] = [];
  const protectedLines: ProtectedLine[] = [];
  const inMonth = activity.filter((a) => bangkokMonth(new Date(a.at)) === month).sort((a, b) => a.at.localeCompare(b.at));
  for (const a of inMonth) {
    const l = moneyLine(a);
    if (!l) continue;
    const k = dedupeKey(l);
    if (seen.has(k)) continue;
    seen.add(k);
    if (l.kind === 'saved') saved.push(l);
    else protectedLines.push(l);
  }
  const stays = protectedLines.filter((l): l is StayProtection => l.scene === 'stay');
  const cryptos = protectedLines.filter((l): l is CryptoProtection => l.scene === 'crypto');
  return {
    saved,
    protected: protectedLines,
    thb: saved.reduce((s, l) => s + l.savedMinor, 0),
    stays,
    cryptos,
    /** Entry ids whose line made it into the month's numbers (duplicates excluded). */
    counted: new Set([...saved, ...protectedLines].map((l) => l.entry.id)),
  };
}
