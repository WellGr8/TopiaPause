import { fmtExact, pick, type BreakdownSection, type CheckMeta, type GuardVerdict, type Lang, type RiskNote } from '@topiapause/shared';
import { cx } from './ui';

// GuardCard internals: the line-item receipt behind "See why", context notes, the cost meter and
// the finished-card outcome line. Every amount is engine output in minor units, shown to the satang.

const OP_SIGN = { add: '', sub: '−', total: '' } as const;

function fxLine(s: BreakdownSection, lang: Lang): string | undefined {
  if (!s.fx) return undefined;
  const date = new Date(s.fx.asOf).toLocaleDateString(lang === 'th' ? 'th-TH' : 'en-GB', { day: 'numeric', month: 'short', timeZone: 'Asia/Bangkok' });
  const pair = `${s.total.amount.currency}/THB`;
  return pick(lang, `≈ ${fmtExact(s.fx.amount)} ที่ ${s.fx.rate} ${pair} (อัตราเดโมคงที่ ณ ${date})`, `≈ ${fmtExact(s.fx.amount)} at ${s.fx.rate} ${pair} (fixed demo rate, ${date})`);
}

function Section({ s, lang }: { s: BreakdownSection; lang: Lang }) {
  const fx = fxLine(s, lang);
  return (
    <div data-receipt={s.key}>
      <p className="text-xs text-muted">{s.title[lang]}</p>
      <dl className="mt-1 font-[tabular-nums]">
        {s.lines.map((l) => (
          <div key={l.key} className="flex items-baseline justify-between gap-3 py-0.5">
            <dt className="min-w-0 text-muted">{l.label[lang]}</dt>
            <dd className="shrink-0 tabular-nums">
              {OP_SIGN[l.op]}
              {fmtExact(l.amount)}
            </dd>
          </div>
        ))}
        <div className="mt-1 flex items-baseline justify-between gap-3 border-t border-line pt-1 font-semibold">
          <dt>{s.total.label[lang]}</dt>
          <dd className="shrink-0 tabular-nums">{fmtExact(s.total.amount)}</dd>
        </div>
      </dl>
      {fx && <p className="mt-0.5 text-right text-xs text-muted tabular-nums">{fx}</p>}
    </div>
  );
}

export function ReceiptSections({ verdict, lang }: { verdict: GuardVerdict; lang: Lang }) {
  if (verdict.breakdown.length === 0) return null;
  return (
    <div className="space-y-3">
      {verdict.breakdown.map((s) => (
        <Section key={s.key} s={s} lang={lang} />
      ))}
    </div>
  );
}

export function RiskNotes({ notes, lang }: { notes: RiskNote[]; lang: Lang }) {
  if (notes.length === 0) return null;
  return (
    <ul className="space-y-1">
      {notes.map((n, i) => (
        <li key={`${n.kind}-${i}`} className={cx('text-sm', n.severity === 'warn' ? 'text-pause' : 'text-muted')}>
          {n.text[lang]}
        </li>
      ))}
    </ul>
  );
}

const ms = (n: number) => (n < 1 ? '<1 ms' : `${n} ms`);
const age = (sec: number, lang: Lang) => {
  const min = Math.round(sec / 60);
  return min < 1 ? pick(lang, 'ข้อมูลเพิ่งดึง', 'fresh data') : pick(lang, `ข้อมูลแคช ${min} นาที`, `cached data, ${min} min old`);
};

/** "Rule check · 0 AI calls · ≈฿0.01 · 4 ms". Costs are estimates (docs/COSTS.md). */
export function CostMeter({ check, lang }: { check?: CheckMeta; lang: Lang }) {
  if (!check) return null;
  const parts = [
    check.where === 'browser' ? pick(lang, 'ตรวจด้วยกฎในเครื่อง', 'Rule check on device') : pick(lang, 'ตรวจด้วยกฎ', 'Rule check'),
    pick(lang, `AI ${check.llmCalls} ครั้ง`, `${check.llmCalls} AI calls`),
  ];
  if (check.externalCalls > 0) parts.push(pick(lang, `เรียกข้อมูล ${check.externalCalls} ครั้ง`, `${check.externalCalls} data call${check.externalCalls > 1 ? 's' : ''}`));
  else if (check.cacheHit && check.dataAge !== null) parts.push(age(check.dataAge, lang));
  parts.push(`≈${fmtExact({ minor: check.estCostTHB_satang, currency: 'THB' })}`, ms(check.latencyMs));
  const label = pick(lang, 'ค่าใช้จ่ายโดยประมาณของการตรวจครั้งนี้', 'Estimated cost of this check');
  return (
    <p className="text-[11px] leading-tight text-muted tabular-nums" title={label} aria-label={`${label}: ${parts.join(', ')}`} data-cost-meter>
      {parts.join(' · ')}
    </p>
  );
}

const EXTRA_FOR = {
  stay: { th: 'เพื่อห้องยกเลิกฟรี', en: 'for a refundable room' },
  subscription: { th: 'ต่อรอบ เพื่อแผนที่ตรงกว่า', en: 'for the better-fitting plan' },
  token_swap: { th: 'เพื่อทางที่ผ่านกฎ', en: 'for the option that passes your rules' },
} as const;

/**
 * The finished card's money line, the same figure the "saved this month" hero adds up:
 * difference = original total − accepted alternative total, exact. When the safer option costs
 * more it is shown as what you pay for protection, not as savings.
 */
export function outcomeLine(verdict: GuardVerdict, lang: Lang): { lead: string; amount: string; tail?: string } | undefined {
  const d = verdict.amounts.difference;
  const kind = verdict.counterOffer?.proposal.kind;
  if (!d || !kind) return undefined;
  if (d.minor > 0) {
    const s = verdict.breakdown.find((b) => b.key === 'savings');
    return { lead: s ? s.total.label[lang] : pick(lang, 'ประหยัด', 'You save'), amount: fmtExact(d) };
  }
  if (d.minor < 0) {
    const p = verdict.amounts.protected;
    return {
      lead: '',
      amount: `+${fmtExact({ minor: -d.minor, currency: d.currency })}`,
      tail: `${EXTRA_FOR[kind][lang]}${p ? pick(lang, ` คุ้มครอง ${fmtExact(p)}`, `, protects ${fmtExact(p)}`) : ''}`,
    };
  }
  const fees = verdict.breakdown.find((b) => b.key === 'fees');
  return fees ? { lead: fees.total.label[lang], amount: fmtExact(fees.total.amount) } : undefined;
}
