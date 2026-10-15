import { evaluate } from '@topiapause/guard-engine';
import type { GuardVerdict, Lang } from '@topiapause/shared';
import type { GuardRun } from '../state';

// The browser runs the same pure guard-engine the Worker uses, so every number
// shown in the demo is engine output, with or without the API.

const cache = new Map<string, GuardVerdict>();

export function verdictFor(run: Pick<GuardRun, 'runId' | 'intent' | 'proposal' | 'policy' | 'verdict' | 'verdictLang'>, lang: Lang): GuardVerdict {
  // Server verdicts come from the same engine; other languages are re-derived locally (same numbers, localized assumptions).
  if (run.verdict && run.verdictLang === lang) return run.verdict;
  const key = `${run.runId}|${lang}`;
  let v = cache.get(key);
  if (!v) {
    v = evaluate({ intent: run.intent, proposal: run.proposal, policy: run.policy, lang });
    cache.set(key, v);
  }
  return v;
}

export function protectedCurrency(run: Pick<GuardRun, 'proposal'>): 'THB' | 'USD' {
  return run.proposal.kind === 'token_swap' ? 'USD' : 'THB';
}
