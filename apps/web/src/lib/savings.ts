import type { AgentProposal } from '@topiapause/shared';
import type { ActivityEntry } from '../state';

/** Minor units (satang / cents) so sums are exact. */
export const toMinor = (amount: number) => Math.round(amount * 100);

/** Exact two-decimal money: ฿3,691.00 / -฿161.00 / $12.50. */
export function fmtExact(minor: number, currency: 'THB' | 'USD'): string {
  const sign = minor < 0 ? '-' : '';
  const abs = Math.abs(Math.round(minor));
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = String(abs % 100).padStart(2, '0');
  return `${sign}${currency === 'THB' ? '฿' : '$'}${whole}.${frac}`;
}

/** What the user would actually pay for a proposal (stay = total incl. taxes). */
function totalOf(p: AgentProposal): number {
  return p.kind === 'subscription' ? p.price.amount : p.kind === 'stay' ? p.totalPrice.amount : p.amountIn.amount;
}

export interface SavedLine {
  entry: ActivityEntry;
  currency: 'THB' | 'USD';
  originalMinor: number;
  acceptedMinor: number;
  /** original - accepted; negative when the better fit costs more (e.g. a refundable room). */
  savedMinor: number;
}

/** Only accepted better fits count: saved = original proposal total - accepted alternative total. */
export function savedLine(a: ActivityEntry): SavedLine | undefined {
  const accepted = a.choice === 'counter_offer' ? a.receipt.verdict.counterOffer?.proposal : undefined;
  if (!accepted) return undefined;
  const originalMinor = toMinor(totalOf(a.receipt.originalProposal));
  const acceptedMinor = toMinor(totalOf(accepted));
  return { entry: a, currency: a.currency, originalMinor, acceptedMinor, savedMinor: originalMinor - acceptedMinor };
}

/** Net savings from accepted better fits in the current calendar month (Bangkok time). */
export function monthlySavings(activity: ActivityEntry[], now = new Date()) {
  const key = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);
  const month = key(now);
  const lines = activity.filter((a) => key(new Date(a.at)) === month).flatMap((a) => savedLine(a) ?? []);
  const sum = (c: 'THB' | 'USD') => lines.filter((l) => l.currency === c).reduce((s, l) => s + l.savedMinor, 0);
  return { lines, thb: sum('THB'), usd: sum('USD') };
}
