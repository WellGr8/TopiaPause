import type { ActionIntent, AgentProposal, Finding, RuleId, UntrustedSource } from '@topiapause/shared';

// AGENT_FOLLOWED_UNTRUSTED: content the agent read (page, email, tool output) contains an
// instruction aimed at AI agents, and the proposal deviates from what the user asked for.
// Deterministic pattern matching, no LLM. Sources can only ADD a pause: they never feed intent,
// policy or numbers, and no source text is ever copied into evidence (fixed vocabulary only).

/** Findings that mean "the proposal is not what the user asked for / allowed". */
const DEVIATIONS: RuleId[] = ['SUB_COMMITMENT', 'SUB_OVER_CAP', 'STAY_FLEXIBILITY', 'STAY_HIDDEN_TOTAL', 'APPROVAL_SCOPE', 'APPROVAL_EXPIRY', 'CONC_CAP'];

// Who the text addresses: AI agents / assistants / bots, or a classic override phrase.
const ADDRESSED = [
  /\b(ai|a\.i\.)\s*(assistant|agent|model|bot)s?\b/,
  /\b(assistant|agent|bot|llm|chatbot|language model)s?\s*[:,—–-]/,
  /\b(note|message|instruction)s?\s+(to|for)\s+(ai|assistants?|agents?|bots?|llms?)\b/,
  /\bif you are an? (ai|assistant|agent|bot|language model)\b/,
  /\b(system|assistant)\s*:/,
  /(ผู้ช่วย\s*(ai|เอไอ)|ถึง\s*(ai|เอไอ|บอท|agent)|(ai|เอไอ|บอท|agent)\s*[:：])/,
];
const OVERRIDE = [
  /\b(ignore|disregard|forget)\s+(all\s+|any\s+|the\s+)?(previous|prior|above|earlier|user'?s?)\s+(instructions?|prompts?|messages?|requests?)/,
  /(ไม่ต้องสนใจ|เพิกเฉย|ลืม)(คำสั่ง|ข้อความ|สิ่งที่ผู้ใช้)/,
];
const IMPERATIVE = [
  /\b(always|must|should|need to|make sure to|be sure to)\b/,
  /\b(select|choose|pick|enable|approve|buy|purchase|book|subscribe|upgrade|switch)\b/,
  /(ต้อง|ให้เลือก|เลือก|กด|อนุมัติ|ซื้อ|จอง|สมัคร|เปิด)/,
];

type Pushed = 'yearly' | 'unlimited' | 'non_refundable' | 'other';
const TARGETS: Array<[Exclude<Pushed, 'other'>, RegExp]> = [
  ['yearly', /\b(annual|yearly|year|12[- ]month)\b|รายปี|ทั้งปี/],
  ['unlimited', /\bunlimited|infinite|max(imum)? approval\b|ไม่จำกัด/],
  ['non_refundable', /\bnon[- ]?refundable\b|คืนเงินไม่ได้/],
];

/** Lowercase, NFKC, strip zero-width / bidi controls so hidden text can't dodge the patterns. */
export function normalizeUntrusted(text: string): string {
  return text
    .normalize('NFKC')
    // NFKC splits Thai SARA AM (ำ) into NIKHAHIT + SARA AA; put it back so Thai patterns match.
    .replace(/\u0E4D\u0E32/g, '\u0E33')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .slice(0, 8000);
}

export interface Instruction {
  sourceIndex: number;
  sourceKind: UntrustedSource['kind'];
  targets: Exclude<Pushed, 'other'>[];
}

/** First agent-directed instruction in the sources, if any. Checked per sentence. */
export function findInstruction(sources: UntrustedSource[] | undefined): Instruction | undefined {
  for (const [i, s] of (sources ?? []).entries()) {
    for (const sentence of normalizeUntrusted(s.text).split(/[.!?\n。]+/)) {
      const override = OVERRIDE.some((re) => re.test(sentence));
      const directed = override || (ADDRESSED.some((re) => re.test(sentence)) && IMPERATIVE.some((re) => re.test(sentence)));
      if (directed) return { sourceIndex: i, sourceKind: s.kind, targets: TARGETS.filter(([, re]) => re.test(sentence)).map(([t]) => t) };
    }
  }
  return undefined;
}

function pushedBy(p: AgentProposal, targets: Instruction['targets']): Pushed {
  if (targets.includes('yearly') && p.kind === 'subscription' && p.interval === 'year') return 'yearly';
  if (targets.includes('unlimited') && p.kind === 'token_swap' && p.approval.type === 'unlimited') return 'unlimited';
  if (targets.includes('non_refundable') && p.kind === 'stay' && !p.refundable) return 'non_refundable';
  return 'other';
}

function asked(intent: ActionIntent): 'trial' | 'once' | 'flexible' | 'other' {
  if (intent.commitment === 'trial') return 'trial';
  if (intent.commitment === 'once') return 'once';
  if (intent.flexibilityNeeded === true) return 'flexible';
  return 'other';
}

export function untrustedRule(intent: ActionIntent, proposal: AgentProposal, findings: Finding[], sources: UntrustedSource[] | undefined): Finding[] {
  const deviation = findings.some((f) => DEVIATIONS.includes(f.ruleId));
  if (!deviation) return [];
  const ins = findInstruction(sources);
  if (!ins) return [];
  return [
    {
      ruleId: 'AGENT_FOLLOWED_UNTRUSTED',
      severity: 'pause',
      evidence: { sourceKind: ins.sourceKind, sourceIndex: ins.sourceIndex, pushed: pushedBy(proposal, ins.targets), asked: asked(intent) },
      messageKey: 'agent_followed_untrusted',
    },
  ];
}
