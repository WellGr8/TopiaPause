import { fmtExact as fmtExactMoney, money, type AgentProposal, type Currency, type Money } from '@topiapause/shared';
import type { ActivityEntry } from '../state';

/** Exact money, every minor unit shown: ฿3,691.00 / -฿161.00 / 300.00 USDT. `minor` is integer minor units. */
export function fmtExact(minor: number, currency: Currency): string {
  return fmtExactMoney(money(minor, currency));
}

/** What the user would actually pay for a proposal (stay = total incl. taxes). */
export function totalOf(p: AgentProposal): Money {
  return p.kind === 'subscription' ? p.price : p.kind === 'stay' ? p.totalPrice : p.amountIn;
}

export interface SavedLine {
  entry: ActivityEntry;
  currency: Currency;
  originalMinor: number;
  acceptedMinor: number;
  /** original - accepted; negative when the better fit costs more (e.g. a refundable room). */
  savedMinor: number;
}

/** Only accepted better fits count: saved = original proposal total - accepted alternative total. */
export function savedLine(a: ActivityEntry): SavedLine | undefined {
  const accepted = a.choice === 'counter_offer' ? a.receipt.verdict.counterOffer?.proposal : undefined;
  if (!accepted) return undefined;
  const original = totalOf(a.receipt.originalProposal);
  const alt = totalOf(accepted);
  if (original.currency !== alt.currency) return undefined;
  return { entry: a, currency: original.currency, originalMinor: original.minor, acceptedMinor: alt.minor, savedMinor: original.minor - alt.minor };
}

/** Net savings from accepted better fits in the current calendar month (Bangkok time). */
export function monthlySavings(activity: ActivityEntry[], now = new Date()) {
  const key = (d: Date) => new Date(d.getTime() + 7 * 3600_000).toISOString().slice(0, 7);
  const month = key(now);
  const lines = activity.filter((a) => key(new Date(a.at)) === month).flatMap((a) => savedLine(a) ?? []);
  const sum = (c: Currency) => lines.filter((l) => l.currency === c).reduce((s, l) => s + l.savedMinor, 0);
  return { lines, thb: sum('THB'), usd: sum('USD'), usdt: sum('USDT') };
}
