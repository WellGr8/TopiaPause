import {
  buildExplanation,
  buildVoiceText,
  type ActionIntent,
  type AgentProposal,
  type CounterOffer,
  type DataSource,
  type Decision,
  type Finding,
  type FxRate,
  type GuardVerdict,
  type Lang,
  type MarketData,
  type RiskNote,
  type UntrustedSource,
  type UserPolicy,
} from '@topiapause/shared';
import { DEFAULT_FX, confidenceRule, stayRules, subscriptionRules, swapRules, userRuleFindings, type RuleResult } from './rules';
import { findInstruction, untrustedRule } from './untrusted';

export const ENGINE_VERSION = '0.2.0';

const RANK: Record<Decision, number> = { allow: 0, pause: 1, block: 2 };

export function decide(findings: Finding[]): Decision {
  return findings.reduce<Decision>((d, f) => (RANK[f.severity] > RANK[d] ? f.severity : d), 'allow');
}

export interface EvaluateInput {
  intent: ActionIntent;
  proposal: AgentProposal;
  policy: UserPolicy;
  /** Language of the `assumptions` list. Explanation and voice are always TH + EN. */
  lang?: Lang;
  /** Explicit FX rates; defaults to the fixed demo rates. */
  fx?: FxRate[];
  /** Token unlock data for the crypto risk note (informational only). */
  market?: MarketData;
  /** What the agent read. Untrusted: can only add AGENT_FOLLOWED_UNTRUSTED, never loosen anything. */
  sources?: UntrustedSource[];
  /** Reference time for date windows; keeps the engine pure. */
  now?: string;
}

function runRules({ intent, proposal, policy, fx = DEFAULT_FX, sources }: EvaluateInput): RuleResult {
  const r =
    proposal.kind === 'subscription'
      ? subscriptionRules(intent, proposal, policy, fx)
      : proposal.kind === 'stay'
        ? stayRules(intent, proposal, policy, fx)
        : swapRules(intent, proposal, policy, fx);
  const findings = [...userRuleFindings(proposal, policy, fx), ...r.findings, ...confidenceRule(intent)];
  return { ...r, findings: [...untrustedRule(intent, proposal, findings, sources), ...findings] };
}

/** Decision only, no counter-offer. Used for re-checks. */
export function recheck(input: EvaluateInput): Decision {
  return decide(runRules(input).findings);
}

const SOURCE_LABEL: Record<DataSource, { th: string; en: string }> = {
  live: { th: 'ข้อมูลสด', en: 'live data' },
  cache: { th: 'ข้อมูลแคช', en: 'cached data' },
  recorded: { th: 'ข้อมูลที่บันทึกไว้', en: 'recorded data' },
  sample: { th: 'ข้อมูลตัวอย่าง ไม่ใช่ข้อมูลจริง', en: 'sample data, not live' },
};
const UNLOCK_WINDOW_DAYS = 14;

function shortDate(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
}

function unlockNote(input: EvaluateInput): RiskNote | undefined {
  const { market, proposal } = input;
  if (!market || proposal.kind !== 'token_swap') return undefined;
  const now = Date.parse(input.now ?? market.asOf);
  const horizon = now + UNLOCK_WINDOW_DAYS * 86_400_000;
  const src = SOURCE_LABEL[market.source];
  const ev = market.unlocks
    .filter((u) => u.asset === proposal.toAsset && Date.parse(u.unlockDate) >= now && Date.parse(u.unlockDate) <= horizon)
    .sort((a, b) => b.valueToMarketCapPct - a.valueToMarketCapPct)[0];
  const base = { kind: 'unlock' as const, source: market.source, asOf: market.asOf };
  if (!ev) {
    return {
      ...base,
      severity: 'info',
      text: {
        th: `ไม่พบการปลดล็อก ${proposal.toAsset} ก้อนใหญ่ใน ${UNLOCK_WINDOW_DAYS} วัน (${src.th})`,
        en: `No large ${proposal.toAsset} unlock in the next ${UNLOCK_WINDOW_DAYS} days (${src.en}).`,
      },
    };
  }
  const warnAt = input.policy.unlockWarnPctOfCirculating ?? 1;
  const pct = Math.round(ev.valueToMarketCapPct * 100) / 100;
  const mapped = ev.symbol !== ev.asset;
  return {
    ...base,
    severity: ev.valueToMarketCapPct >= warnAt ? 'warn' : 'info',
    text: {
      th: `${ev.asset}${mapped ? ` (ใช้ข้อมูล ${ev.symbol})` : ''} จะปลดล็อก ${pct}% ของมูลค่าตลาด ${shortDate(ev.unlockDate, 'th')} ราคาอาจผันผวน (${src.th})`,
      en: `${ev.asset}${mapped ? ` (using ${ev.symbol} data)` : ''} unlocks ${pct}% of market cap on ${shortDate(ev.unlockDate, 'en')}; price may swing (${src.en}).`,
    },
  };
}

/** Instruction found but the proposal still matches the user: say it was ignored. No source text is echoed. */
function ignoredInstructionNote(input: EvaluateInput, findings: Finding[]): RiskNote | undefined {
  if (findings.some((f) => f.ruleId === 'AGENT_FOLLOWED_UNTRUSTED')) return undefined;
  const ins = findInstruction(input.sources);
  if (!ins) return undefined;
  const where = { web_page: ['หน้าเว็บ', 'A web page'], email: ['อีเมล', 'An email'], tool_output: ['ผลลัพธ์จากเครื่องมือ', 'A tool output'] }[ins.sourceKind];
  return {
    kind: 'injection',
    severity: 'info',
    text: {
      th: `${where[0]}ที่ agent อ่านมีคำสั่งถึง AI แต่ข้อเสนอยังตรงกับที่คุณขอ จึงไม่มีผล`,
      en: `${where[1]} the agent read contains instructions for AI agents; the proposal still matches what you asked, so they had no effect.`,
    },
  };
}

/**
 * Authoritative evaluation: rules -> precedence (block > pause > allow) ->
 * counter-offer -> re-check. A counter-offer is attached only if its re-check is `allow`.
 */
export function evaluate(input: EvaluateInput): GuardVerdict {
  const lang = input.lang ?? input.intent.language;
  const r = runRules(input);
  const decision = decide(r.findings);

  // The counter is an engine option the user taps, so a low-confidence reading of the
  // original words must not hide it. The pause itself still records LOW_CONFIDENCE.
  const counterIntent = { ...input.intent, confidence: Math.max(input.intent.confidence, 0.95) };
  let counterOffer: CounterOffer | undefined;
  if (decision === 'pause' && r.counter) {
    const re = recheck({ ...input, intent: counterIntent, proposal: r.counter.proposal });
    if (re === 'allow') counterOffer = { proposal: r.counter.proposal, recheck: re, diff: r.counter.diff };
  }

  const metrics = { ...r.metrics };
  const amounts = { ...r.amounts };
  let breakdown = r.breakdown;
  if (!counterOffer) {
    for (const k of ['counterExpiryMin', 'counterSharePct', 'counterTrialDays']) delete metrics[k];
    for (const k of ['counterAmountIn', 'counterPrice', 'protected', 'difference']) delete amounts[k];
    breakdown = [];
  }

  const notes = [unlockNote(input), ignoredInstructionNote(input, r.findings)].filter((n): n is RiskNote => !!n);
  const tpl = { decision, findings: r.findings, counterOffer, metrics, amounts, proposal: input.proposal };
  return {
    verdictId: `v-${input.proposal.proposalId}`,
    decision,
    findings: r.findings,
    counterOffer,
    metrics,
    amounts,
    breakdown,
    notes,
    assumptions: r.assumptions.map((a) => a[lang]),
    explanation: { ...buildExplanation(tpl), source: 'template' },
    voiceText: buildVoiceText(tpl),
    engineVersion: ENGINE_VERSION,
  };
}
