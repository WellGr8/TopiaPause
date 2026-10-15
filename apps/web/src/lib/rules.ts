import type { UserPolicy } from '@topiapause/shared';

// Deterministic plain-language rule parser (TH + EN) for the three demo rules.
// Keyword + regex only: same input, same result, no model in the loop.

export type ParsedRule =
  | { kind: 'subscriptionCap'; amount: number; fromYearly?: boolean }
  | { kind: 'refundablePremium'; pct: number }
  | { kind: 'tokenCap'; asset: 'TOKEN-X'; pct: number };

export type ParseResult = { ok: true; rule: ParsedRule } | { ok: false; reason: 'empty' | 'noTopic' | 'multiple' | 'noNumber' | 'outOfRange' };

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

type Word = string | RegExp;

// Short EN words need word boundaries ("app" must not match "happen" or "apply").
const SUB_WORDS: Word[] = ['subscri', /\bsubs\b/, 'membership', 'member', /\bplans?\b/, /\bapps?\b/, 'สมาชิก', 'สมัคร', 'แอป', 'แพ็กเกจ', 'แพคเกจ', 'รายเดือน'];
const STAY_WORDS: Word[] = ['hotel', 'room', /\bstays?\b/, 'refund', 'booking', 'โรงแรม', 'ห้อง', 'ที่พัก', 'คืนเงิน', 'ยกเลิกได้', 'รีฟันด์'];
const TOKEN_WORDS: Word[] = ['crypto', 'token', 'portfolio', /\bcoins?\b/, 'คริปโต', 'โทเคน', 'โทเค็น', 'เหรียญ', 'พอร์ต'];
const YEARLY = /per year|a year|\/year|\/yr|yearly|annual|ปีละ|ต่อปี|รายปี/g;

/** Limits read as "at most", not as negation: "ไม่เกิน 300", "no more than 300". */
const LIMIT = /ไม่ให้เกิน|ไม่เกิน|ห้ามเกิน|อย่าเกิน|\b(?:no|not|never) more than\b|\b(?:not|don'?t|never) (?:exceed|go over)\b|\bnot over\b/g;
const NEGATION_TH = ['ห้าม', 'ไม่เอา', 'ไม่', 'อย่า'];
const NEGATION_EN = /\b(?:no|never|not|don'?t|dont)\b/;

const has = (t: string, w: Word) => (typeof w === 'string' ? t.includes(w) : w.test(t));
const count = (t: string, words: Word[]) => words.filter((w) => has(t, w)).length;

/** A yearly word counts unless one of the ~4 tokens before it negates it ("ห้ามสมัครรายปี", "no yearly plans"). */
function mentionsYearly(t: string): boolean {
  const plain = t.replace(LIMIT, ' max ');
  for (const m of plain.matchAll(YEARLY)) {
    const before = plain.slice(0, m.index).split(/\s+/).filter(Boolean).slice(-4).join(' ').slice(-24);
    if (!NEGATION_TH.some((w) => before.includes(w)) && !NEGATION_EN.test(before)) return true;
  }
  return false;
}

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
  const ranked = (Object.entries(scores) as Array<[keyof typeof scores, number]>).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  if (ranked.length === 0) return { ok: false, reason: 'noTopic' };
  if (ranked.length > 1) return { ok: false, reason: 'multiple' };
  const best = ranked[0]!;

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
  const yearly = mentionsYearly(t);
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

export interface RuleDelta {
  before?: number;
  after: number;
  /** True when the new rule lets more through than the current one. */
  loosens: boolean;
}

/** Current value -> new value, in the rule's own unit (THB/month or %). */
export function ruleDelta(policy: UserPolicy, rule: ParsedRule): RuleDelta {
  switch (rule.kind) {
    case 'subscriptionCap': {
      const before = policy.monthlySubscriptionCap?.amount;
      return { before, after: rule.amount, loosens: before !== undefined && rule.amount > before };
    }
    case 'refundablePremium': {
      // A lower premium tolerance means fewer refundable upgrades get offered.
      const before = policy.requireRefundableWhenFlexible ? policy.maxRefundablePremiumPct : undefined;
      return { before, after: rule.pct, loosens: before !== undefined && rule.pct < before };
    }
    case 'tokenCap': {
      const cap = policy.tokenConcentrationCaps[rule.asset];
      const before = cap === undefined ? undefined : Math.round(cap * 1000) / 10;
      return { before, after: rule.pct, loosens: before !== undefined && rule.pct > before };
    }
  }
}
