// "Any agent" demo: ShopBot, an external shopping agent, asks TopiaPause before it spends.
//
//   pnpm agent:demo                                # local `pnpm dev:worker` (http://127.0.0.1:8787)
//   pnpm agent:demo https://topiapause.<you>.workers.dev
//
// ShopBot sends the user's message verbatim plus what it is about to do (scripts/demo/*.json,
// generic schema in docs/API.md). It never sends a policy or an intent: TopiaPause derives intent
// from the user's words and uses the user's own rules. Prints verdict, receipt and cost meter for
// the 3 scenes and the prompt-injection scene, then shows the guard refusing a smuggled policy
// and a replayed verdict.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = (process.argv[2] ?? process.env.BASE_URL ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');
const DIR = join(dirname(fileURLToPath(import.meta.url)), 'demo');
const load = (name: string): Record<string, unknown> => JSON.parse(readFileSync(join(DIR, `${name}.json`), 'utf8'));

type Money = { minor: number; currency: 'THB' | 'USD' | 'USDT' };
interface Verdict {
  verdictId: string;
  decision: 'allow' | 'pause' | 'block';
  findings: { ruleId: string }[];
  counterOffer?: { proposal: Record<string, unknown> & { summary: string }; recheck: string };
  breakdown: { key: string; title: { en: string }; lines: { label: { en: string }; amount: Money; op: string }[]; total: { label: { en: string }; amount: Money }; fx?: { amount: Money; rate: string } }[];
  notes: { kind: string; severity: string; text: { en: string } }[];
  explanation: { en: string };
  check?: { llmCalls: number; externalCalls: number; cacheHit: boolean; estCostTHB_satang: number; latencyMs: number };
}

const DEC = { THB: 2, USD: 2, USDT: 6 } as const;
function fmt(m: Money): string {
  const d = DEC[m.currency];
  const abs = BigInt(Math.abs(m.minor)).toString().padStart(d + 1, '0');
  const int = abs.slice(0, -d).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  let frac = abs.slice(-d);
  if (m.currency === 'USDT') frac = frac.replace(/0+$/, '').padEnd(2, '0');
  const sign = m.minor < 0 ? '-' : '';
  return m.currency === 'THB' ? `${sign}฿${int}.${frac}` : m.currency === 'USD' ? `${sign}$${int}.${frac}` : `${sign}${int}.${frac} USDT`;
}

const bold = (s: string) => `\x1b[1m${s}\x1b[0m`;
const dim = (s: string) => `\x1b[2m${s}\x1b[0m`;
const COLOR = { allow: '\x1b[32m', pause: '\x1b[34m', block: '\x1b[33m' } as const;

async function post(path: string, body: unknown): Promise<{ status: number; json: any }> {
  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { status: res.status, json: await res.json() };
}

function printVerdict(v: Verdict): void {
  console.log(`  ${COLOR[v.decision]}${bold(v.decision.toUpperCase())}\x1b[0m  ${v.findings.map((f) => f.ruleId).join(', ')}`);
  console.log(`  ${v.explanation.en}`);
  if (v.counterOffer) console.log(`  better fit: ${bold(v.counterOffer.proposal.summary)}  (re-check: ${v.counterOffer.recheck})`);
  for (const s of v.breakdown) {
    console.log(dim(`  ┌ ${s.title.en}`));
    for (const l of s.lines) console.log(`  │ ${l.label.en.padEnd(52)} ${(l.op === 'sub' ? '−' : ' ') + fmt(l.amount).padStart(18)}`);
    console.log(`  └ ${bold(s.total.label.en.padEnd(52))} ${bold(fmt(s.total.amount).padStart(19))}`);
    if (s.fx) console.log(dim(`    ≈ ${fmt(s.fx.amount)} at ${s.fx.rate} (fixed demo rate)`));
  }
  for (const n of v.notes) console.log(`  ${n.severity === 'warn' ? '!' : 'i'} ${n.text.en}`);
  const c = v.check;
  if (c) console.log(dim(`  Rule check · ${c.llmCalls} AI calls · ${c.externalCalls} data calls${c.cacheHit ? ' (cache)' : ''} · ≈${fmt({ minor: c.estCostTHB_satang, currency: 'THB' })} est. · ${c.latencyMs < 1 ? '<1' : c.latencyMs} ms`));
}

async function main(): Promise<void> {
  const health = await fetch(`${BASE}/api/health`).then((r) => r.json()).catch(() => null);
  if (!health?.ok) {
    console.error(`API not reachable at ${BASE} (start it with: pnpm build && pnpm dev:worker)`);
    process.exit(1);
  }
  console.log(dim(`TopiaPause ${BASE} · engine ${health.engineVersion} · market data: ${health.marketData}`));

  let crypto: Verdict | undefined;
  for (const scene of ['subscription', 'stay', 'crypto', 'injection']) {
    const body = load(scene);
    console.log(`\n${bold(`▶ ShopBot · ${scene}`)}  user: “${body.userMessage}”`);
    if (scene === 'injection') console.log(dim(`  page ShopBot read: ${JSON.stringify((body.sources as { text: string }[])[0]!.text)}`));
    const { status, json } = await post('/api/guard/check', body);
    if (status !== 200) {
      console.log(`  HTTP ${status}: ${json.error?.code} ${json.error?.message}`);
      continue;
    }
    printVerdict(json as Verdict);
    if (scene === 'crypto') crypto = json as Verdict;
  }

  console.log(`\n${bold('▶ ShopBot tries to bring its own permissive policy')}`);
  const attack = await post('/api/guard/check', load('attack-policy'));
  console.log(`  HTTP ${attack.status}: ${attack.json.error?.code}`);

  if (crypto?.counterOffer) {
    console.log(`\n${bold('▶ User picks the better fit; ShopBot executes with the verdict ticket')}`);
    const ok = await post('/api/agent/execute', { proposal: crypto.counterOffer.proposal, verdictId: crypto.verdictId, userConfirmed: true });
    console.log(`  HTTP ${ok.status}: ${ok.json.execution ? `${ok.json.execution.status} ${ok.json.execution.ref}` : ok.json.error?.code}`);
    const replay = await post('/api/agent/execute', { proposal: crypto.counterOffer.proposal, verdictId: crypto.verdictId, userConfirmed: true });
    console.log(`  replay → HTTP ${replay.status}: ${replay.json.error?.code}`);
    const forged = await post('/api/agent/execute', { proposal: crypto.counterOffer.proposal, verdictId: 'v-forged', userConfirmed: true });
    console.log(`  forged id → HTTP ${forged.status}: ${forged.json.error?.code}`);
  }
}

await main();
