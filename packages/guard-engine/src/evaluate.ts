import {
  buildExplanation,
  buildVoiceText,
  type ActionIntent,
  type AgentProposal,
  type CounterOffer,
  type Decision,
  type Finding,
  type GuardVerdict,
  type Lang,
  type UserPolicy,
} from '@topiapause/shared';
import { confidenceRule, stayRules, subscriptionRules, swapRules, type RuleResult } from './rules';

export const ENGINE_VERSION = '0.1.0';

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
}

function runRules({ intent, proposal, policy }: EvaluateInput): RuleResult {
  const r =
    proposal.kind === 'subscription'
      ? subscriptionRules(intent, proposal, policy)
      : proposal.kind === 'stay'
        ? stayRules(intent, proposal, policy)
        : swapRules(intent, proposal, policy);
  return { ...r, findings: [...r.findings, ...confidenceRule(intent)] };
}

/** Decision only, no counter-offer. Used for re-checks. */
export function recheck(input: EvaluateInput): Decision {
  return decide(runRules(input).findings);
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
  if (!counterOffer) {
    delete metrics.counterAmountIn;
    delete metrics.counterExpiryMin;
    delete metrics.counterSharePct;
    delete metrics.counterPrice;
    delete metrics.counterTrialDays;
    delete metrics.protectedAmount;
  }

  const tpl = { decision, findings: r.findings, counterOffer, metrics, proposal: input.proposal };
  return {
    verdictId: `v-${input.proposal.proposalId}`,
    decision,
    findings: r.findings,
    counterOffer,
    metrics,
    assumptions: r.assumptions.map((a) => a[lang]),
    explanation: { ...buildExplanation(tpl), source: 'template' },
    voiceText: buildVoiceText(tpl),
    engineVersion: ENGINE_VERSION,
  };
}
