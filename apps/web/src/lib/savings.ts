import {
  fmtExact as fmtExactMoney,
  money,
  pick,
  type AgentProposal,
  type Currency,
  type GuardVerdict,
  type Lang,
  type Money,
  type StayProposal,
  type SubscriptionProposal,
  type TokenSwapProposal,
} from '@topiapause/shared';
import type { ActivityEntry } from '../state';

/**
 * Exact money. THB always shows satang (฿3,691.00, -฿161.00).
 * USDT trims trailing zeros (300 USDT, 12.5 USDT) and is never written as $.
 */
export function fmtExact(minor: number, currency: Currency): string {
  if (currency === 'USDT') {
    const d = 6;
    const sign = minor < 0 ? '-' : '';
    const abs = Math.abs(Math.round(minor));
    const base = 10 ** d;
    const whole = Math.floor(abs / base).toLocaleString('en-US');
    const frac = String(abs % base).padStart(d, '0');
    const trimmed = frac.replace(/0+$/, '');
    return `${sign}${whole}${trimmed ? `.${trimmed}` : ''} USDT`;
  }
  return fmtExactMoney(money(minor, currency));
}

/** What the user would actually pay for a proposal (stay = total incl. taxes). */
export function totalOf(p: AgentProposal): Money {
  return p.kind === 'subscription' ? p.price : p.kind === 'stay' ? p.totalPrice : p.amountIn;
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

function acceptedOf(a: ActivityEntry): AgentProposal | undefined {
  return a.choice === 'counter_offer' ? a.receipt.verdict.counterOffer?.proposal : undefined;
}

/** Post-trade share of `toAsset`, in percent to 0.1. Fee is ppm. */
function sharePct(p: TokenSwapProposal, amountInMinor: number): number {
  const v = p.portfolio.total.minor;
  if (!v) return 0;
  const h = p.portfolio.holdings[p.toAsset]?.minor ?? 0;
  const net = Math.round((amountInMinor * (1_000_000 - p.feePpm)) / 1_000_000);
  return Math.round(((h + net) / v) * 1000) / 10;
}

/** One accepted better fit, classified. Saved = a cheaper THB plan; everything else is protection. */
export function moneyLine(a: ActivityEntry): MoneyLine | undefined {
  const acc = acceptedOf(a);
  const orig = a.receipt.originalProposal;
  if (!acc || acc.kind !== orig.kind) return undefined;

  if (orig.kind === 'subscription' && acc.kind === 'subscription') {
    if (orig.price.currency !== 'THB' || acc.price.currency !== 'THB') return undefined;
    const originalMinor = orig.price.minor;
    const acceptedMinor = acc.price.minor;
    if (acceptedMinor >= originalMinor) return undefined;
    return { kind: 'saved', entry: a, original: orig, accepted: acc, originalMinor, acceptedMinor, savedMinor: originalMinor - acceptedMinor };
  }

  if (orig.kind === 'stay' && acc.kind === 'stay') {
    const s = acc as StayProposal;
    if (!s.refundable || orig.refundable) return undefined;
    const coveredMinor = orig.totalPrice.minor;
    const costMinor = Math.max(0, s.totalPrice.minor - coveredMinor);
    return { kind: 'protected', scene: 'stay', entry: a, costMinor, coveredMinor, freeCancelUntil: s.freeCancelUntil };
  }

  if (orig.kind === 'token_swap' && acc.kind === 'token_swap') {
    if (orig.amountIn.currency !== 'USDT') return undefined;
    const reducedMinor = orig.amountIn.minor - acc.amountIn.minor;
    if (reducedMinor <= 0) return undefined;
    const m = a.receipt.verdict.metrics ?? {};
    return {
      kind: 'protected',
      scene: 'crypto',
      entry: a,
      asset: orig.toAsset,
      reducedMinor,
      fromPct: m.postTradeSharePct ?? sharePct(orig, orig.amountIn.minor),
      toPct: m.counterSharePct ?? sharePct(orig, acc.amountIn.minor),
    };
  }
  return undefined;
}

/** Same purchase twice in a month (the PixelPro scene and the injection scene) counts once. */
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

function asEntry(original: AgentProposal, verdict: GuardVerdict): ActivityEntry {
  const scene = original.kind === 'subscription' ? 'subscription' : original.kind === 'stay' ? 'stay' : 'crypto';
  return {
    id: 'card',
    at: new Date().toISOString(),
    scene,
    decision: verdict.decision,
    choice: 'counter_offer',
    protectedAmount: 0,
    currency: original.kind === 'token_swap' ? 'USDT' : 'THB',
    receipt: { originalProposal: original, verdict } as ActivityEntry['receipt'],
  };
}

/**
 * Finished guard-card line. Same classification and numbers as the saved-this-month hero:
 * a cheaper THB plan is "saved"; a refundable room is a protection cost; a smaller swap is USDT exposure cut.
 */
export function cardLine(original: AgentProposal, verdict: GuardVerdict, lang: Lang): { lead: string; amount: string; tail?: string } | undefined {
  const line = moneyLine(asEntry(original, verdict));
  if (!line) return undefined;
  if (line.kind === 'saved') {
    return { lead: pick(lang, 'ประหยัด', 'Saved'), amount: fmtExact(line.savedMinor, 'THB') };
  }
  if (line.scene === 'stay') {
    return {
      lead: pick(lang, 'ค่าความคุ้มครอง', 'Protection cost'),
      amount: fmtExact(line.costMinor, 'THB'),
      tail: pick(
        lang,
        `จ่ายเพิ่มเพื่อให้ ${fmtExact(line.coveredMinor, 'THB')} ยกเลิกฟรีได้`,
        `paid to make ${fmtExact(line.coveredMinor, 'THB')} cancel-free`,
      ),
    };
  }
  return {
    lead: pick(lang, `ลดความเสี่ยง ${line.asset}`, `Cut ${line.asset} exposure by`),
    amount: fmtExact(line.reducedMinor, 'USDT'),
    tail: `(${line.fromPct}% → ${line.toPct}%)`,
  };
}
