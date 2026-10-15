import {
  findingTitle,
  fmtExact,
  fmtMoney,
  fmtWeekday,
  findingDetail,
  isMoney,
  pick,
  type AgentProposal,
  type Finding,
  type GuardVerdict,
  type Lang,
  type Money,
  type RuleId,
} from '@topiapause/shared';

const RULE_ORDER: RuleId[] = [
  'AGENT_FOLLOWED_UNTRUSTED',
  'INVALID_INPUT',
  'INSUFFICIENT_BALANCE',
  'CONC_CAP',
  'SUB_COMMITMENT',
  'STAY_FLEXIBILITY',
  'APPROVAL_SCOPE',
  'SUB_OVER_CAP',
  'STAY_HIDDEN_TOTAL',
  'APPROVAL_EXPIRY',
  'LOW_CONFIDENCE',
  'UNLOCK_SOON',
];

export function sortedFindings(v: GuardVerdict): Finding[] {
  return [...v.findings].sort((a, b) => RULE_ORDER.indexOf(a.ruleId) - RULE_ORDER.indexOf(b.ruleId));
}

/** Baht shows every satang. A coin stays in its own unit, never a baht sign. */
const face = (m: Money | undefined): string => (m ? (m.currency === 'USDT' ? fmtMoney(m) : fmtExact(m)) : '');
const cash = (f: Finding | undefined, k: string): string => {
  const v = f?.evidence[k];
  return isMoney(v) ? face(v) : '';
};

/** One sentence: why the guard stopped. Every number is engine evidence. */
export function reasonLine(v: GuardVerdict, proposal: AgentProposal, lang: Lang): string {
  if (v.decision === 'allow') return pick(lang, 'ตรงกับที่คุณตั้งใจ', 'This matches what you meant.');
  const by = (id: RuleId) => v.findings.find((f) => f.ruleId === id);
  const untrusted = by('AGENT_FOLLOWED_UNTRUSTED');
  if (untrusted) return findingDetail(untrusted, lang).replace(/\.$/, '');

  if (proposal.kind === 'subscription') {
    const c = by('SUB_COMMITMENT');
    if (c) {
      const per = c.evidence.interval === 'year' ? pick(lang, 'รายปี', 'a yearly plan') : pick(lang, 'แพ็กเกจผูกมัด', 'a commitment');
      const price = cash(c, 'price');
      return pick(lang, `คุณบอกแค่ลอง แต่นี่คือ${per} ${price}`, `You said just trying, but this is ${per} at ${price}`);
    }
    const cap = by('SUB_OVER_CAP');
    if (cap) {
      const m = cash(cap, 'monthlyEquivalent');
      const b = cash(cap, 'cap');
      return pick(lang, `เดือนละ ${m} เกินงบ ${b}`, `${m}/month is over your ${b} budget`);
    }
  }

  if (proposal.kind === 'stay') {
    if (by('STAY_FLEXIBILITY')) return pick(lang, 'แผนอาจเปลี่ยน แต่ห้องนี้คืนเงินไม่ได้', 'Plans may change, but this room is non-refundable');
    const h = by('STAY_HIDDEN_TOTAL');
    if (h) {
      const q = cash(h, 'quoted');
      const tot = cash(h, 'total');
      return pick(lang, `โชว์ ${q} แต่จ่ายจริง ${tot}`, `Shows ${q}, but you’d pay ${tot}`);
    }
  }

  if (proposal.kind === 'token_swap') {
    const parts: string[] = [];
    const spending = face(proposal.amountIn);
    if (by('CONC_CAP')) {
      parts.push(
        pick(
          lang,
          `AI กำลังจะเอา ${spending} ไปลงเหรียญเดียวมากเกินไป เสี่ยงเสียเงินก้อนใหญ่`,
          `The AI is about to put ${spending} into one coin. You could lose a large sum.`,
        ),
      );
    }
    if (by('APPROVAL_SCOPE')) {
      parts.push(pick(lang, 'AI กำลังจะให้สิทธิ์ดึงเงินได้ไม่จำกัด', 'The AI is about to let itself take money with no limit.'));
    }
    if (parts.length > 0) return parts.join(' ');
  }

  const top = sortedFindings(v)[0];
  return top ? findingTitle(top.ruleId, lang) : '';
}

export interface Offer {
  value: string;
  unit?: string;
  detail: string;
}

/** The counter-offer as one big number plus one short line. */
export function offerOf(v: GuardVerdict, lang: Lang): Offer | undefined {
  const p = v.counterOffer?.proposal;
  if (!p) return undefined;
  const a = v.amounts;

  if (p.kind === 'subscription') {
    const parts: string[] = [];
    if (p.trialDays > 0) parts.push(pick(lang, `ทดลองฟรี ${p.trialDays} วัน`, `${p.trialDays}-day free trial`));
    if (a.cap) parts.push(pick(lang, `อยู่ในงบ ${face(a.cap)}`, `within ${face(a.cap)}`));
    return {
      value: face(p.price),
      unit: p.interval === 'year' ? pick(lang, '/ปี', '/yr') : pick(lang, '/เดือน', '/mo'),
      detail: parts.join(' · '),
    };
  }

  if (p.kind === 'stay') {
    const parts = [p.hotel];
    if (p.freeCancelUntil) parts.push(pick(lang, `ยกเลิกฟรีถึง${fmtWeekday(p.freeCancelUntil, lang)}`, `free cancel until ${fmtWeekday(p.freeCancelUntil, lang)}`));
    if (a.premium) parts.push(`+${face(a.premium)}`);
    return { value: face(p.totalPrice), unit: pick(lang, 'รวม', 'total'), detail: parts.join(' · ') };
  }

  return { value: face(p.amountIn), detail: pick(lang, 'ให้ดึงเงินได้แค่ครั้งนี้', 'Only this one payment') };
}

/** Short label for what was approved, used on the result line and receipt. */
export function approvedLine(p: AgentProposal, lang: Lang): string {
  if (p.kind === 'subscription') {
    const per = p.interval === 'year' ? pick(lang, '/ปี', '/yr') : pick(lang, '/เดือน', '/mo');
    const trial = p.trialDays > 0 ? pick(lang, ` · ทดลองฟรี ${p.trialDays} วัน`, ` · ${p.trialDays}-day trial`) : '';
    return `${p.planName ?? p.planId} ${face(p.price)}${per}${trial}`;
  }
  if (p.kind === 'stay') return `${p.hotel} ${face(p.totalPrice)}${p.refundable ? pick(lang, ' · คืนเงินได้', ' · refundable') : ''}`;
  return `Swap ${face(p.amountIn)} → ${p.toAsset}`;
}
