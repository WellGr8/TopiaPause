import { fmtMoney, fmtNumber, fmtPct, fmtWeekday, pick } from './format';
import { isMoney } from './money';
import type {
  AgentProposal,
  Evidence,
  Finding,
  GuardVerdict,
  Lang,
  RuleId,
} from './types';

// Deterministic TH/EN templates. Every number interpolated here comes from
// engine evidence/metrics, so template output always passes the number lock.

const num = (e: Evidence, k: string): number => Number(e[k] ?? 0);
const str = (e: Evidence, k: string): string => String(e[k] ?? '');
const money = (e: Evidence, k: string): string => {
  const v = e[k];
  return isMoney(v) ? fmtMoney(v) : '';
};

export const RULE_TITLES: Record<RuleId, { th: string; en: string }> = {
  SUB_COMMITMENT: { th: 'ผูกมัดนานกว่าที่ตั้งใจ', en: 'Longer commitment than you meant' },
  SUB_OVER_CAP: { th: 'เกินงบรายเดือนที่ตั้งไว้', en: 'Over your monthly cap' },
  STAY_FLEXIBILITY: { th: 'คืนเงินไม่ได้ ทั้งที่แผนอาจเปลี่ยน', en: 'Non-refundable, but your plans may change' },
  STAY_HIDDEN_TOTAL: { th: 'ราคารวมค่าธรรมเนียมสูงกว่าที่แสดง', en: 'Total with fees is higher than shown' },
  APPROVAL_SCOPE: { th: 'ขอสิทธิ์ใช้เงินแบบไม่จำกัด', en: 'Unlimited spending approval' },
  APPROVAL_EXPIRY: { th: 'สิทธิ์ไม่มีวันหมดอายุ', en: 'Approval does not expire soon enough' },
  CONC_CAP: { th: 'พอร์ตเกินเพดานที่ตั้งไว้', en: 'Portfolio over your cap' },
  INSUFFICIENT_BALANCE: { th: 'ยอดเงินไม่พอ', en: 'Insufficient balance' },
  INVALID_INPUT: { th: 'ข้อมูลไม่ถูกต้อง', en: 'Invalid input' },
  LOW_CONFIDENCE: { th: 'ยังไม่แน่ใจว่าคุณหมายถึงอะไร', en: 'Not sure what you meant' },
  UNLOCK_SOON: { th: 'มีโทเคนปลดล็อกเร็วๆ นี้', en: 'Large token unlock soon' },
  AGENT_FOLLOWED_UNTRUSTED: { th: 'agent ทำตามคำสั่งจากเนื้อหาภายนอก', en: 'Agent followed instructions from content it read' },
  FX_UNAVAILABLE: { th: 'ไม่มีอัตราแลกเปลี่ยน', en: 'No exchange rate' },
};

// Fixed vocabulary only: evidence for AGENT_FOLLOWED_UNTRUSTED never carries source text.
const SOURCE_WORD = {
  web_page: { th: 'หน้าเว็บ', en: 'The web page' },
  email: { th: 'อีเมล', en: 'The email' },
  tool_output: { th: 'ผลลัพธ์จากเครื่องมือ', en: 'The tool output' },
} as const;
const PUSHED_WORD = {
  yearly: { th: 'เลือกรายปี', en: 'pick yearly' },
  unlimited: { th: 'อนุมัติแบบไม่จำกัด', en: 'approve unlimited spending' },
  non_refundable: { th: 'จองห้องคืนเงินไม่ได้', en: 'book a non-refundable room' },
  other: { th: 'เลือกแทนคุณ', en: 'choose for you' },
} as const;
const ASKED_WORD = {
  trial: { th: 'แต่คุณบอกแค่ลอง', en: 'but you only asked to try' },
  once: { th: 'แต่คุณบอกว่าครั้งเดียว', en: 'but you said just once' },
  flexible: { th: 'แต่คุณบอกว่าแผนอาจเปลี่ยน', en: 'but you said your plans may change' },
  other: { th: 'แต่ไม่ตรงกับที่คุณขอ', en: "but that isn't what you asked for" },
} as const;
const word = <T extends Record<string, { th: string; en: string }>>(table: T, key: unknown, fallback: keyof T, lang: Lang) =>
  (table[(typeof key === 'string' && key in table ? key : fallback) as keyof T] as { th: string; en: string })[lang];

/** "หน้าเว็บสั่งให้เลือกรายปี แต่คุณบอกแค่ลอง" / "A web page told your AI to pick the yearly plan, but you only asked to try it" */
function untrustedLine(e: Evidence, lang: Lang): string {
  if (lang === 'en' && e.sourceKind === 'web_page' && e.pushed === 'yearly' && e.asked === 'trial') {
    return 'A web page told your AI to pick the yearly plan, but you only asked to try it';
  }
  const src = word(SOURCE_WORD, e.sourceKind, 'web_page', lang);
  const pushed = word(PUSHED_WORD, e.pushed, 'other', lang);
  const asked = word(ASKED_WORD, e.asked, 'other', lang);
  return lang === 'th' ? `${src}สั่งให้${pushed} ${asked}` : `${src} told it to ${pushed}, ${asked}`;
}

export function findingTitle(ruleId: RuleId, lang: Lang): string {
  return RULE_TITLES[ruleId][lang];
}

export function findingDetail(f: Finding, lang: Lang): string {
  const e = f.evidence;
  switch (f.ruleId) {
    case 'SUB_COMMITMENT':
      return pick(
        lang,
        `คุณบอกว่าอยากลอง แต่นี่คือแพ็กเกจรายปี ${money(e, 'price')} ที่ต่ออายุอัตโนมัติ`,
        `You said you want to try it, but this is a ${money(e, 'price')} annual plan that auto-renews.`,
      );
    case 'SUB_OVER_CAP':
      return pick(
        lang,
        `เฉลี่ย ${money(e, 'monthlyEquivalent')}/เดือน เกินงบ ${money(e, 'cap')}/เดือน${e.fxRate ? ` (คิดที่ ${str(e, 'fxRate')} บาท/${str(e, 'priceCurrency')})` : ''}`,
        `Works out to ${money(e, 'monthlyEquivalent')}/month, above your ${money(e, 'cap')}/month cap${e.fxRate ? ` (at ฿${str(e, 'fxRate')} per ${str(e, 'priceCurrency')})` : ''}.`,
      );
    case 'STAY_FLEXIBILITY':
      return e.hasCounter
        ? pick(
            lang,
            `ห้องนี้คืนเงินไม่ได้ จ่ายเพิ่ม ${money(e, 'premium')} (${fmtPct(num(e, 'premiumPct'))}) ได้ห้องที่ยกเลิกฟรี`,
            `This room is non-refundable. Pay ${money(e, 'premium')} more (${fmtPct(num(e, 'premiumPct'))}) for a free-cancellation room.`,
          )
        : e.hasRefundableOption
          ? pick(
              lang,
              `ห้องคืนเงินได้ที่ถูกที่สุดแพงกว่า ${fmtPct(num(e, 'premiumPct'))} เกินเพดาน ${fmtPct(num(e, 'maxPremiumPct'))} ที่ตั้งไว้ ตัดสินใจเองนะครับ`,
              `The cheapest refundable room costs ${fmtPct(num(e, 'premiumPct'))} more, above your ${fmtPct(num(e, 'maxPremiumPct'))} limit. Your call.`,
            )
          : pick(lang, 'ไม่มีห้องแบบคืนเงินได้ในตัวเลือก', 'No refundable room in the catalog.');
    case 'STAY_HIDDEN_TOTAL':
      return pick(
        lang,
        `ราคาที่แสดง ${money(e, 'quoted')} แต่ยอดจริงรวมค่าธรรมเนียมคือ ${money(e, 'total')}`,
        `Shown as ${money(e, 'quoted')}, but the real total with fees is ${money(e, 'total')}.`,
      );
    case 'APPROVAL_SCOPE':
      return pick(
        lang,
        `คุณบอกว่า "ครั้งเดียว" แต่ agent ขอสิทธิ์ใช้ ${str(e, 'asset')} แบบไม่จำกัด`,
        `You said "just once", but the agent asks for unlimited ${str(e, 'asset')} approval.`,
      );
    case 'APPROVAL_EXPIRY':
      return pick(
        lang,
        `สิทธิ์ครั้งเดียวควรหมดอายุภายใน ${fmtNumber(num(e, 'maxExpiryMin'))} นาที`,
        `A one-time approval should expire within ${fmtNumber(num(e, 'maxExpiryMin'))} minutes.`,
      );
    case 'CONC_CAP':
      return pick(
        lang,
        `${str(e, 'asset')} จะเป็น ${fmtPct(num(e, 'postTradeSharePct'))} ของพอร์ต เกินเพดาน ${fmtPct(num(e, 'capPct'))}`,
        `${str(e, 'asset')} would be ${fmtPct(num(e, 'postTradeSharePct'))} of your portfolio, above your ${fmtPct(num(e, 'capPct'))} cap.`,
      );
    case 'INSUFFICIENT_BALANCE':
      return pick(
        lang,
        `ต้องใช้ ${money(e, 'amountIn')} แต่มีแค่ ${money(e, 'balance')}`,
        `Needs ${money(e, 'amountIn')}, but you only have ${money(e, 'balance')}.`,
      );
    case 'INVALID_INPUT':
      return pick(lang, `ค่า ${str(e, 'field')} ไม่ถูกต้อง`, `The value of ${str(e, 'field')} is invalid.`);
    case 'LOW_CONFIDENCE':
      return pick(
        lang,
        `มั่นใจเพียง ${fmtPct(num(e, 'confidencePct'))} ช่วยยืนยันรายละเอียดอีกครั้ง`,
        `Only ${fmtPct(num(e, 'confidencePct'))} confident. Please confirm the details.`,
      );
    case 'AGENT_FOLLOWED_UNTRUSTED':
      return lang === 'th' ? untrustedLine(e, lang) : `${untrustedLine(e, lang)}.`;
    case 'UNLOCK_SOON':
      return pick(lang, 'มีการปลดล็อกโทเคนจำนวนมากภายใน 7 วัน', 'A large token unlock is due within 7 days.');
    case 'FX_UNAVAILABLE':
      return pick(
        lang,
        `ไม่มีอัตราแลกเปลี่ยน ${str(e, 'priceCurrency')} เป็น ${str(e, 'capCurrency')} จึงหยุดไว้ก่อน`,
        `No exchange rate from ${str(e, 'priceCurrency')} to ${str(e, 'capCurrency')}, so this is paused.`,
      );
  }
}

function weekday(iso: string | undefined, lang: Lang): string {
  return iso ? fmtWeekday(iso, lang) : '';
}

/** Human description of a proposal (display only — not number-locked). */
export function describeProposal(p: AgentProposal, lang: Lang): string {
  switch (p.kind) {
    case 'subscription': {
      const per = p.interval === 'year' ? pick(lang, '/ปี', '/year') : pick(lang, '/เดือน', '/month');
      const name = p.planName ?? p.planId;
      const trial = p.trialDays > 0 ? pick(lang, ` · ทดลองฟรี ${p.trialDays} วัน`, ` · ${p.trialDays}-day free trial`) : '';
      const renew = p.autoRenew ? pick(lang, ' · ต่ออายุอัตโนมัติ', ' · auto-renews') : '';
      return `${pick(lang, 'สมัคร', 'Subscribe to')} ${name} ${fmtMoney(p.price)}${per}${trial}${renew}`;
    }
    case 'stay': {
      const refund = p.refundable
        ? pick(lang, `ยกเลิกฟรีถึง${weekday(p.freeCancelUntil, lang)}`, `free cancellation until ${weekday(p.freeCancelUntil, lang)}`)
        : pick(lang, 'คืนเงินไม่ได้', 'non-refundable');
      return `${pick(lang, 'จอง', 'Book')} ${p.hotel} · ${pick(lang, 'รวม', 'total')} ${fmtMoney(p.totalPrice)} · ${refund}`;
    }
    case 'token_swap': {
      const approval =
        p.approval.type === 'unlimited'
          ? pick(lang, 'อนุมัติแบบไม่จำกัด', 'unlimited approval')
          : pick(
              lang,
              `อนุมัติแค่ ${fmtMoney(p.approval.amount ?? p.amountIn)}${p.approval.expirySec ? ` · ${Math.round(p.approval.expirySec / 60)} นาที` : ''}`,
              `exact approval ${fmtMoney(p.approval.amount ?? p.amountIn)}${p.approval.expirySec ? ` · ${Math.round(p.approval.expirySec / 60)} min` : ''}`,
            );
      return `Swap ${fmtMoney(p.amountIn)} → ${p.toAsset} · ${approval}`;
    }
  }
}

/** Short counter-offer headline. */
export function describeCounter(p: AgentProposal, lang: Lang): string {
  switch (p.kind) {
    case 'subscription':
      return p.trialDays > 0
        ? pick(
            lang,
            `ทดลองฟรี ${p.trialDays} วัน แล้วรายเดือน ${fmtMoney(p.price)}`,
            `${p.trialDays}-day free trial, then ${fmtMoney(p.price)}/month`,
          )
        : pick(lang, `รายเดือน ${fmtMoney(p.price)}`, `Monthly ${fmtMoney(p.price)}`);
    case 'stay':
      return pick(
        lang,
        `${p.hotel} ${fmtMoney(p.totalPrice)} ยกเลิกฟรีถึง${weekday(p.freeCancelUntil, lang)}`,
        `${p.hotel} ${fmtMoney(p.totalPrice)}, free cancellation until ${weekday(p.freeCancelUntil, lang)}`,
      );
    case 'token_swap':
      return pick(
        lang,
        `Swap ${fmtMoney(p.amountIn)} · อนุมัติแค่ครั้งเดียว`,
        `Swap ${fmtMoney(p.amountIn)} · one-time exact approval`,
      );
  }
}

interface TemplateInput {
  decision: GuardVerdict['decision'];
  findings: Finding[];
  counterOffer?: GuardVerdict['counterOffer'];
  metrics: GuardVerdict['metrics'];
  amounts: GuardVerdict['amounts'];
  proposal: AgentProposal;
}

function counterSentence(input: TemplateInput, lang: Lang): string {
  const co = input.counterOffer;
  if (!co) return '';
  const p = co.proposal;
  const m = input.metrics;
  switch (p.kind) {
    case 'subscription':
      return pick(
        lang,
        `ทางที่ตรงกว่าคือ${describeCounter(p, lang)} ซึ่งผมจะเตือนก่อนตัดเงิน`,
        `A better fit: ${describeCounter(p, lang)}, with a reminder before the first charge.`,
      );
    case 'stay':
      return pick(lang, `ทางเลือกที่ตรงกว่าคือ ${describeCounter(p, lang)}`, `A better fit: ${describeCounter(p, lang)}.`);
    case 'token_swap': {
      const amt = fmtMoney(input.amounts.counterAmountIn ?? p.amountIn);
      return pick(
        lang,
        `ทางเลือกที่ผ่านกฎคือ ${amt} โดยอนุมัติแค่ ${amt} ครั้งเดียว ใช้ได้ ${fmtNumber(m.counterExpiryMin ?? 0)} นาที`,
        `The option that passes your rules is ${amt}, with a one-time exact approval of ${amt} for ${fmtNumber(m.counterExpiryMin ?? 0)} minutes.`,
      );
    }
  }
}

export function buildExplanation(input: TemplateInput): { th: string; en: string } {
  const make = (lang: Lang) => {
    if (input.decision === 'allow') {
      return pick(lang, 'ตรงกับที่คุณตั้งใจและกฎที่ตั้งไว้ ไปต่อได้เลย', 'Matches what you meant and your rules. Good to go.');
    }
    const head =
      input.decision === 'block'
        ? pick(lang, 'หยุดรายการนี้ไว้ก่อน', 'This action is blocked.')
        : pick(lang, 'เดี๋ยวก่อนครับ', 'Hold on.');
    const body = input.findings.map((f) => findingDetail(f, lang)).join(' ');
    const tail = counterSentence(input, lang);
    return [head, body, tail].filter(Boolean).join(' ');
  };
  return { th: make('th'), en: make('en') };
}

const SCENE_BY_KIND = { subscription: 'subscription', stay: 'stay', token_swap: 'crypto' } as const;

export function buildVoiceText(input: TemplateInput): { th: string; en: string; clipId: string } {
  const ev = (id: RuleId) => input.findings.find((f) => f.ruleId === id)?.evidence;
  const untrusted = ev('AGENT_FOLLOWED_UNTRUSTED');
  const clipId = untrusted ? `injection-${input.decision}` : `${SCENE_BY_KIND[input.proposal.kind]}-${input.decision}`;
  const make = (lang: Lang): string => {
    if (input.decision === 'allow') return pick(lang, 'ตรงกับที่คุณตั้งใจครับ', 'This matches what you meant.');
    const p = input.proposal;
    const tail = counterSentence(input, lang);
    if (untrusted) {
      return `${pick(lang, 'เดี๋ยวก่อนครับ', 'Hold on.')} ${lang === 'th' ? untrustedLine(untrusted, lang) : `${untrustedLine(untrusted, lang)}.`} ${tail}`.trim();
    }
    if (p.kind === 'subscription' && ev('SUB_COMMITMENT')) {
      return `${pick(lang, 'เดี๋ยวก่อนครับ', 'Hold on.')} ${findingDetail(input.findings.find((f) => f.ruleId === 'SUB_COMMITMENT')!, lang)} ${tail}`.trim();
    }
    if (p.kind === 'stay' && ev('STAY_FLEXIBILITY')?.hasCounter) {
      const e = ev('STAY_FLEXIBILITY')!;
      return pick(
        lang,
        `คุณบอกว่าแผนอาจเปลี่ยน แต่ห้องนี้คืนเงินไม่ได้ ถ้าจ่ายเพิ่ม ${money(e, 'premium')} จะได้ห้องที่ยกเลิกฟรีได้ถึง${weekday(str(e, 'freeCancelUntil'), lang)}`,
        `You said your plans may change, but this room is non-refundable. For ${money(e, 'premium')} more, you get free cancellation until ${weekday(str(e, 'freeCancelUntil'), lang)}.`,
      );
    }
    if (p.kind === 'token_swap' && ev('CONC_CAP') && ev('APPROVAL_SCOPE')) {
      const e = ev('CONC_CAP')!;
      return pick(
        lang,
        `พอร์ตคุณจะมี ${str(e, 'asset')} ถึง ${fmtPct(num(e, 'postTradeSharePct'))} เกินเพดาน ${fmtPct(num(e, 'capPct'))} ที่ตั้งไว้ และ agent ขอสิทธิ์ใช้เงินแบบไม่จำกัด ${tail}`,
        `Your ${str(e, 'asset')} share would hit ${fmtPct(num(e, 'postTradeSharePct'))}, above your ${fmtPct(num(e, 'capPct'))} cap, and the agent wants unlimited approval. ${tail}`,
      );
    }
    return buildExplanation(input)[lang];
  };
  return { th: make('th'), en: make('en'), clipId };
}

/** Deterministic answer to "why?" follow-ups, built only from verdict numbers. */
export function buildWhyAnswer(verdict: GuardVerdict, lang: Lang): string {
  const conc = verdict.findings.find((f) => f.ruleId === 'CONC_CAP');
  if (conc) {
    const e = conc.evidence;
    const capPct = num(e, 'capPct');
    return pick(
      lang,
      `เพดาน ${fmtPct(capPct)} ของพอร์ต ${money(e, 'portfolio')} คือ ${money(e, 'capValue')} ตอนนี้คุณถือ ${str(e, 'asset')} อยู่ ${money(e, 'holding')} จึงซื้อเพิ่มได้สูงสุด ${money(e, 'aMax')} (คำนวณรวมค่าธรรมเนียม ${fmtPct(num(e, 'feePct'))} และค่า gas ${money(e, 'gas')} แล้ว)`,
      `Your ${fmtPct(capPct)} cap on a ${money(e, 'portfolio')} portfolio is ${money(e, 'capValue')}. You already hold ${money(e, 'holding')} of ${str(e, 'asset')}, so the most you can add is ${money(e, 'aMax')} (after a ${fmtPct(num(e, 'feePct'))} fee and ${money(e, 'gas')} gas).`,
    );
  }
  const sub = verdict.findings.find((f) => f.ruleId === 'SUB_OVER_CAP');
  if (sub) {
    const e = sub.evidence;
    return pick(
      lang,
      `แพ็กเกจรายปี ${money(e, 'price')} หาร 12 เดือน = ${money(e, 'monthlyEquivalent')}/เดือน ซึ่งเกินงบ ${money(e, 'cap')} และต้องจ่ายล่วงหน้าทั้งก้อน`,
      `${money(e, 'price')} a year divided by 12 is ${money(e, 'monthlyEquivalent')}/month, which is over your ${money(e, 'cap')} cap, and it is paid upfront.`,
    );
  }
  const stay = verdict.findings.find((f) => f.ruleId === 'STAY_FLEXIBILITY');
  if (stay) {
    const e = stay.evidence;
    return pick(
      lang,
      `ห้องคืนเงินได้แพงกว่า ${money(e, 'premium')} (${fmtPct(num(e, 'premiumPct'))}) ซึ่งไม่เกินเพดาน ${fmtPct(num(e, 'maxPremiumPct'))} ที่คุณตั้งไว้ ถ้าแผนเปลี่ยน คุณจะไม่เสีย ${money(e, 'total')}`,
      `The refundable room costs ${money(e, 'premium')} more (${fmtPct(num(e, 'premiumPct'))}), within your ${fmtPct(num(e, 'maxPremiumPct'))} limit. If plans change, you don't lose ${money(e, 'total')}.`,
    );
  }
  return verdict.explanation[lang];
}
