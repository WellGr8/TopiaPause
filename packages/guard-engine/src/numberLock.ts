import { isMoney, toMajor, type CounterOffer, type Explanation, type Finding, type GuardVerdict, type Money } from '@topiapause/shared';

// Number lock (§1 principle 2): an LLM explanation may only contain numbers the
// engine produced. Anything else -> fall back to the deterministic template.

const NUMBER_RE = /\d[\d,]*(?:\.\d+)?/g;

export function extractNumbers(text: string): number[] {
  return (text.match(NUMBER_RE) ?? []).map((s) => Number(s.replace(/,/g, ''))).filter(Number.isFinite);
}

export function allowedNumbers(v: {
  metrics: Record<string, number>;
  amounts?: Record<string, Money>;
  findings: Finding[];
  counterOffer?: CounterOffer;
}): number[] {
  const out: number[] = [];
  const push = (x: unknown) => {
    if (typeof x === 'number' && Number.isFinite(x)) out.push(Math.abs(x));
    else if (isMoney(x)) out.push(Math.abs(toMajor(x)));
  };
  Object.values(v.metrics).forEach(push);
  Object.values(v.amounts ?? {}).forEach(push);
  v.findings.forEach((f) => Object.values(f.evidence).forEach(push));
  if (v.counterOffer) {
    Object.values(v.counterOffer.diff).forEach((d) => {
      push(d.from);
      push(d.to);
    });
  }
  return out;
}

function variants(x: number): number[] {
  const r = (d: number) => Math.round(x * 10 ** d) / 10 ** d;
  const fl = (d: number) => Math.floor(x * 10 ** d + 1e-9) / 10 ** d;
  return [x, r(0), r(1), r(2), fl(0), fl(1), fl(2)];
}

export function passesNumberLock(text: string, allowed: number[]): boolean {
  const ok = new Set<number>();
  allowed.forEach((a) => variants(a).forEach((x) => ok.add(Number(x.toFixed(6)))));
  return extractNumbers(text).every((n) => ok.has(Number(n.toFixed(6))));
}

/** Accepts an LLM explanation only if every number in both languages is engine-derived. */
export function lockExplanation(candidate: { th: string; en: string } | undefined, verdict: GuardVerdict): Explanation {
  if (!candidate) return { ...verdict.explanation, source: 'template' };
  const allowed = allowedNumbers(verdict);
  if (passesNumberLock(candidate.th, allowed) && passesNumberLock(candidate.en, allowed)) {
    return { th: candidate.th, en: candidate.en, source: 'llm' };
  }
  return { ...verdict.explanation, source: 'template' };
}
