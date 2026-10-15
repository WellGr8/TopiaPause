import { evaluate } from '@topiapause/guard-engine';
import type { CheckMeta, Currency, GuardVerdict, Lang } from '@topiapause/shared';
import type { GuardRun } from '../state';

// The browser runs the same pure guard-engine the Worker uses, so every number
// shown in the demo is engine output, with or without the API.

const cache = new Map<string, GuardVerdict>();

export function verdictFor(run: Pick<GuardRun, 'runId' | 'intent' | 'proposal' | 'policy' | 'verdict' | 'verdictLang' | 'sources'>, lang: Lang): GuardVerdict {
  // Server verdicts come from the same engine; other languages are re-derived locally (same numbers, localized assumptions).
  if (run.verdict && run.verdictLang === lang) return run.verdict;
  const key = `${run.runId}|${lang}`;
  let v = cache.get(key);
  if (!v) {
    const started = performance.now();
    v = evaluate({ intent: run.intent, proposal: run.proposal, policy: run.policy, lang, sources: run.sources });
    // Same engine on the device: no server, AI or data calls, so no marginal cost.
    const local: CheckMeta = { where: 'browser', engine: 'rules', llmCalls: 0, externalCalls: 0, cacheHit: false, dataAge: null, estCostTHB_satang: 0, latencyMs: Math.round(performance.now() - started), estimate: true };
    v = { ...v, check: run.verdict?.check ?? local };
    cache.set(key, v);
  }
  return v;
}

export function protectedCurrency(run: Pick<GuardRun, 'proposal'>): Currency {
  const p = run.proposal;
  return p.kind === 'subscription' ? p.price.currency : p.kind === 'stay' ? p.totalPrice.currency : p.amountIn.currency;
}
