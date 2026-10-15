import type { UserPolicy } from '@topiapause/shared';

// Deterministic plain-language rule parser (TH + EN) for the three demo rules.
// Keyword + regex only: same input, same result, no model in the loop.

export type ParsedRule =
  | { kind: 'subscriptionCap'; amount: number; fromYearly?: boolean }
  | { kind: 'refundablePremium'; pct: number }
  | { kind: 'tokenCap'; asset: 'TOKEN-X'; pct: number };

export type ParseResult = { ok: true; rule: ParsedRule } | { ok: false; reason: 'empty' | 'noTopic' | 'noNumber' | 'outOfRange' };

const THAI_DIGITS = '๐๑๒๓๔๕๖๗๘๙';

/** Thai digits -> Arabic, full-width % -> %, thousands separators removed. */
export function normalizeRuleText(text: string): string {
  return text
    .replace(/[๐-๙]/g, (d) => String(THAI_DIGITS.indexOf(d)))
    .replace(/％/g, '%')
    .replace(/(\d),(?=\d{3}\b)/g, '$1')
    .toLowerCase()
    .trim();
}

const SUB_WORDS = ['subscri', 'membership', 'member', 'plan', 'app', 'สมาชิก', 'สมัคร', 'แอป', 'แพ็กเกจ', 'แพคเกจ', 'รายเดือน'];
const STAY_WORDS = ['hotel', 'room', 'stay', 'refund', 'booking', 'โรงแรม', 'ห้อง', 'ที่พัก', 'คืนเงิน', 'ยกเลิกได้', 'รีฟันด์'];
const TOKEN_WORDS = ['crypto', 'token', 'portfolio', 'coin', 'คริปโต', 'โทเคน', 'โทเค็น', 'เหรียญ', 'พอร์ต'];
const YEARLY_WORDS = ['per year', 'a year', '/year', '/yr', 'yearly', 'annual', 'ปีละ', 'ต่อปี', 'รายปี'];

const count = (t: string, words: string[]) => words.filter((w) => t.includes(w)).length;

function firstNumber(t: string): number | undefined {
  const m = t.match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : undefined;
}

/** A percentage: "30%", "30 percent", "30 เปอร์เซ็นต์", "ร้อยละ 30". */
function percent(t: string): number | undefined {
  const m =
    t.match(/(\d+(?:\.\d+)?)\s*(?:%|percent|per cent|pct|เปอร์เซ็นต์|เปอร์เซ็น|เปอร์)/) ?? t.match(/ร้อยละ\s*(\d+(?:\.\d+)?)/);
  return m ? Number(m[1]) : undefined;
}

/** A money amount, preferring one tagged with a currency marker. */
function money(t: string): number | undefined {
  const m = t.match(/(?:฿|thb|บาท)\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)\s*(?:฿|thb|บาท|baht)/);
  if (m) return Number(m[1] ?? m[2]);
  return percent(t) === undefined ? firstNumber(t) : undefined;
}

export function parseRule(input: string): ParseResult {
  const t = normalizeRuleText(input);
  if (!t) return { ok: false, reason: 'empty' };

  const scores = { token: count(t, TOKEN_WORDS), stay: count(t, STAY_WORDS), sub: count(t, SUB_WORDS) };
  if (t.includes('token-x')) scores.token += 2;
  const best = (Object.entries(scores) as Array<[keyof typeof scores, number]>).sort((a, b) => b[1] - a[1])[0]!;
  if (best[1] === 0) return { ok: false, reason: 'noTopic' };

  if (best[0] === 'token') {
    const pct = percent(t) ?? firstNumber(t);
    if (pct === undefined) return { ok: false, reason: 'noNumber' };
    if (pct <= 0 || pct > 100) return { ok: false, reason: 'outOfRange' };
    return { ok: true, rule: { kind: 'tokenCap', asset: 'TOKEN-X', pct } };
  }
  if (best[0] === 'stay') {
    const pct = percent(t) ?? firstNumber(t);
    if (pct === undefined) return { ok: false, reason: 'noNumber' };
    if (pct < 0 || pct > 100) return { ok: false, reason: 'outOfRange' };
    return { ok: true, rule: { kind: 'refundablePremium', pct } };
  }
  const amount = money(t);
  if (amount === undefined) return { ok: false, reason: 'noNumber' };
  if (amount <= 0 || amount > 1_000_000) return { ok: false, reason: 'outOfRange' };
  const yearly = count(t, YEARLY_WORDS) > 0;
  return {
    ok: true,
    rule: yearly ? { kind: 'subscriptionCap', amount: Math.round((amount / 12) * 100) / 100, fromYearly: true } : { kind: 'subscriptionCap', amount },
  };
}

export function applyRule(policy: UserPolicy, rule: ParsedRule): UserPolicy {
  switch (rule.kind) {
    case 'subscriptionCap':
      return { ...policy, monthlySubscriptionCap: { amount: rule.amount, currency: 'THB' } };
    case 'refundablePremium':
      return { ...policy, requireRefundableWhenFlexible: true, maxRefundablePremiumPct: rule.pct };
    case 'tokenCap':
      return { ...policy, tokenConcentrationCaps: { ...policy.tokenConcentrationCaps, [rule.asset]: rule.pct / 100 } };
  }
}
