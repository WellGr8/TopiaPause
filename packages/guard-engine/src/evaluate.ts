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
  type UserPolicy,
} from '@topiapause/shared';
import { DEFAULT_FX, confidenceRule, stayRules, subscriptionRules, swapRules, type RuleResult } from './rules';

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
  /** Text the agent read (web page, email). Scanned for injected instructions, never used for decisions. */
  agentContext?: string;
  /** Reference time for date windows; keeps the engine pure. */
  now?: string;
}

function runRules({ intent, proposal, policy, fx = DEFAULT_FX }: EvaluateInput): RuleResult {
  const r =
    proposal.kind === 'subscription'
      ? subscriptionRules(intent, proposal, policy, fx)
      : proposal.kind === 'stay'
        ? stayRules(intent, proposal, policy, fx)
        : swapRules(intent, proposal, policy, fx);
  return { ...r, findings: [...r.findings, ...confidenceRule(intent)] };
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

// Instruction-like text inside content the agent read. Heuristic on purpose: the guard never
// obeys it anyway (decisions come from the user's words), the note just makes the attempt visible.
const INJECTION = [
  /ignore (all |any |the )?(previous|prior|user|above)/i,
  /\b(system|assistant)\s*:/i,
  /\b(you must|always|agent(s)? should)\s+(choose|select|pick|buy|approve)/i,
  /\b(choose|select|pick)\s+(the\s+)?(annual|yearly|premium|unlimited)/i,
  /ไม่ต้องสนใจ|เลือกแพ็กเกจรายปี|เลือกรายปี/,
];

function injectionNote(text: string | undefined): RiskNote | undefined {
  if (!text) return undefined;
  const hit = INJECTION.map((re) => re.exec(text)).find(Boolean);
  if (!hit) return undefined;
  const start = Math.max(0, hit.index - 20);
  const excerpt = text.slice(start, start + 90).replace(/\s+/g, ' ').trim();
  return {
    kind: 'injection',
    severity: 'warn',
    text: {
      th: `เนื้อหาที่ agent อ่านพยายามสั่งให้เลือกแทนคุณ: “${excerpt}” TopiaPause ตัดสินจากสิ่งที่คุณพูดเท่านั้น`,
      en: `Content the agent read tried to steer the choice: “${excerpt}”. TopiaPause only decides from what you said.`,
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

  let counterOffer: CounterOffer | undefined;
  if (decision === 'pause' && r.counter) {
    const re = recheck({ ...input, proposal: r.counter.proposal });
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

  const notes = [unlockNote(input), injectionNote(input.agentContext)].filter((n): n is RiskNote => !!n);
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
