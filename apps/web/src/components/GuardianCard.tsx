import {
  describeCounter,
  describeProposal,
  findingDetail,
  findingTitle,
  fmtMoney,
  type Finding,
  type GuardVerdict,
  type Lang,
  type RuleId,
} from '@topiapause/shared';
import {
  ArrowRight,
  BadgeCheck,
  CalendarClock,
  ChartPie,
  CircleQuestionMark,
  KeyRound,
  LockOpen,
  MessageCircleQuestionMark,
  ReceiptText,
  RotateCcw,
  ShieldCheck,
  Timer,
  TriangleAlert,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useMemo } from 'react';
import { t } from '../copy';
import { verdictFor } from '../lib/guard';
import { counterHighlights } from '../lib/highlights';
import type { GuardRun } from '../state';
import { Button, StatusPill, cx } from './ui';
import { VoiceButton } from './VoiceButton';

const RULE_ICON: Record<RuleId, LucideIcon> = {
  SUB_COMMITMENT: CalendarClock,
  SUB_OVER_CAP: Wallet,
  STAY_FLEXIBILITY: RotateCcw,
  STAY_HIDDEN_TOTAL: ReceiptText,
  APPROVAL_SCOPE: KeyRound,
  APPROVAL_EXPIRY: Timer,
  CONC_CAP: ChartPie,
  INSUFFICIENT_BALANCE: Wallet,
  INVALID_INPUT: TriangleAlert,
  LOW_CONFIDENCE: CircleQuestionMark,
  UNLOCK_SOON: LockOpen,
};

const RULE_ORDER: RuleId[] = [
  'INVALID_INPUT',
  'INSUFFICIENT_BALANCE',
  'CONC_CAP',
  'SUB_COMMITMENT',
  'STAY_FLEXIBILITY',
  'APPROVAL_SCOPE',
  'SUB_OVER_CAP',
  'STAY_HIDDEN_TOTAL',
  'APPROVAL_EXPIRY',
  'LOW_CONFIDENCE',
  'UNLOCK_SOON',
];

function FindingRow({ f, lang }: { f: Finding; lang: Lang }) {
  const Icon = RULE_ICON[f.ruleId];
  const tone =
    f.severity === 'block'
      ? 'bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200'
      : 'bg-indigo-100 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-100';
  return (
    <li className="flex gap-3">
      <span className={cx('mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl', tone)}>
        <Icon size={18} strokeWidth={2} aria-hidden="true" />
      </span>
      <div className="min-w-0">
        <p className="text-[15px] font-semibold leading-snug">{findingTitle(f.ruleId, lang)}</p>
        <p className="text-sm leading-relaxed text-muted dark:text-slate-300">{findingDetail(f, lang)}</p>
      </div>
    </li>
  );
}

export function RecheckCheck({ lang, verdict, running }: { lang: Lang; verdict: GuardVerdict; running: boolean }) {
  const share = verdict.metrics.counterSharePct;
  return (
    <div className="anim-fade flex items-center gap-4 rounded-2xl bg-teal-50/90 p-4 ring-1 ring-teal-200 dark:bg-teal-400/10 dark:ring-teal-300/20" role="status">
      <svg width="56" height="56" viewBox="0 0 52 52" className="check-pop shrink-0" aria-hidden="true">
        <circle className="check-circle" cx="26" cy="26" r="24" fill="none" stroke="#14b8a6" strokeWidth="3" />
        <path className="check-mark" d="M15 27 l7 7 l15 -16" fill="none" stroke="#0d9488" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <div>
        <p className="font-semibold text-teal-900 dark:text-teal-100">{t(lang, 'recheckTitle')}</p>
        <p className="text-sm text-teal-800 dark:text-teal-200">
          {t(lang, 'recheckedAllow')}
          {share !== undefined ? ` · ${share.toFixed(1)}%` : ''}
        </p>
        <p className="mt-0.5 text-xs text-teal-700 dark:text-teal-300">{running ? t(lang, 'recheckSub') : t(lang, 'chosenCounter')}</p>
      </div>
    </div>
  );
}

export function GuardianCard({
  run,
  lang,
  onChoose,
  onWhy,
}: {
  run: GuardRun;
  lang: Lang;
  onChoose: (choice: 'counter_offer' | 'original' | 'cancel') => void;
  onWhy: (question: string) => void;
}) {
  const verdict = useMemo(() => verdictFor(run, lang), [run, lang]);
  const checking = run.stage === 'checking';
  const findings = [...verdict.findings].sort((a, b) => RULE_ORDER.indexOf(a.ruleId) - RULE_ORDER.indexOf(b.ruleId));
  const shown = findings.slice(0, 3);
  const co = verdict.counterOffer;
  const highlights = counterHighlights(verdict, lang);
  const blocked = verdict.decision === 'block';
  const active = run.stage === 'verdict';

  const whyLabel =
    run.proposal.kind === 'token_swap' && co && co.proposal.kind === 'token_swap'
      ? `${t(lang, 'whyCrypto')} ${fmtMoney({ amount: co.proposal.amountIn.amount, currency: 'USD' })}?`
      : t(lang, 'why');

  return (
    <article
      className="glass mood-ring anim-card rounded-3xl p-4 sm:p-5"
      aria-label={t(lang, 'guard')}
      aria-busy={checking}
    >
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-sky via-azure to-peri text-white shadow-md">
            <ShieldCheck size={22} strokeWidth={2.2} aria-hidden="true" />
          </span>
          <div>
            <p className="text-[15px] font-bold leading-tight">{t(lang, 'guard')}</p>
            {checking ? (
              <p className="text-xs text-muted dark:text-slate-400">{t(lang, 'checking')}</p>
            ) : (
              <div className="mt-1">
                <StatusPill decision={verdict.decision} lang={lang} />
              </div>
            )}
          </div>
        </div>
        {!checking && <VoiceButton text={verdict.voiceText[lang]} lang={lang} clipId={verdict.voiceText.clipId} />}
      </header>

      {checking ? (
        <div className="mt-4 space-y-2.5" aria-hidden="true">
          <div className="shimmer h-4 w-4/5 rounded-full" />
          <div className="shimmer h-4 w-3/5 rounded-full" />
          <div className="shimmer h-16 w-full rounded-2xl" />
        </div>
      ) : (
        <div className="anim-fade">
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            <div className="rounded-2xl bg-white/70 p-3 ring-1 ring-slate-900/5 dark:bg-white/5 dark:ring-white/10">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-slate-400">{t(lang, 'youSaid')}</p>
              <p className="mt-1 text-[15px] leading-snug">“{run.userText}”</p>
            </div>
            <div
              className={cx(
                'rounded-2xl p-3 ring-1',
                verdict.decision === 'allow'
                  ? 'bg-white/70 ring-slate-900/5 dark:bg-white/5 dark:ring-white/10'
                  : blocked
                    ? 'bg-amber-50/90 ring-amber-200 dark:bg-amber-400/10 dark:ring-amber-300/20'
                    : 'bg-indigo-50/90 ring-indigo-200 dark:bg-indigo-400/10 dark:ring-indigo-300/20',
              )}
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-slate-400">{t(lang, 'agentAbout')}</p>
              <p className="mt-1 text-[15px] font-medium leading-snug">{describeProposal(run.proposal, lang)}</p>
            </div>
          </div>

          {shown.length > 0 && (
            <ul className="mt-4 space-y-3">
              {shown.map((f) => (
                <FindingRow key={f.ruleId} f={f} lang={lang} />
              ))}
            </ul>
          )}
          {findings.length > shown.length && (
            <p className="mt-2 text-xs text-muted dark:text-slate-400">+{findings.length - shown.length}</p>
          )}

          {co && (
            <section
              className="mt-4 rounded-2xl bg-gradient-to-br from-sky/15 via-peri/15 to-aqua/20 p-3.5 ring-1 ring-azure/25 dark:from-sky/10 dark:via-peri/10 dark:to-aqua/10"
              aria-label={t(lang, 'saferOption')}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold uppercase tracking-wide text-azure dark:text-sky">{t(lang, 'saferOption')}</p>
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-teal-800 dark:text-teal-200">
                  <BadgeCheck size={14} aria-hidden="true" /> {t(lang, 'recheckedAllow')}
                </span>
              </div>
              <p className="mt-1 text-lg font-bold leading-snug">{describeCounter(co.proposal, lang)}</p>
              <dl className="mt-2.5 grid grid-cols-1 gap-1.5 min-[380px]:grid-cols-2">
                {highlights.map((h) => (
                  <div key={h.label} className="rounded-xl bg-white/75 px-2.5 py-2 dark:bg-white/5">
                    <dt className="text-[11px] font-medium text-muted dark:text-slate-400">{h.label}</dt>
                    <dd className="flex flex-wrap items-center gap-1 text-sm font-semibold tabular-nums">
                      {h.from && (
                        <>
                          <span className="font-normal text-muted line-through decoration-1 dark:text-slate-400">{h.from}</span>
                          <ArrowRight size={13} className="text-muted" aria-hidden="true" />
                        </>
                      )}
                      <span>{h.to}</span>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}
          {!co && verdict.decision === 'pause' && <p className="mt-3 text-sm text-muted dark:text-slate-300">{t(lang, 'noCounter')}</p>}
          {blocked && <p className="mt-3 text-sm font-medium text-amber-900 dark:text-amber-200">{t(lang, 'blockedNote')}</p>}
          {verdict.decision === 'allow' && <p className="mt-3 text-sm text-muted dark:text-slate-300">{t(lang, 'allowNote')}</p>}

          <details className="group mt-3 text-sm">
            <summary className="flex min-h-11 cursor-pointer list-none items-center gap-1 font-medium text-azure dark:text-sky">
              <span className="transition group-open:rotate-90">›</span> {t(lang, 'details')}
            </summary>
            <p className="leading-relaxed">{verdict.explanation[lang]}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-muted dark:text-slate-400">
              {verdict.assumptions.map((a) => (
                <li key={a}>{a}</li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-muted dark:text-slate-500">
              {t(lang, 'explanationSource')} · engine v{verdict.engineVersion}
            </p>
          </details>

          {active && (
            <div className="mt-3 space-y-2">
              {co && (
                <Button variant="primary" full onClick={() => onChoose('counter_offer')}>
                  <ShieldCheck size={18} aria-hidden="true" /> {t(lang, 'useSafer')}
                </Button>
              )}
              {verdict.decision === 'allow' && (
                <Button variant="primary" full onClick={() => onChoose('original')}>
                  {t(lang, 'confirm')}
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                {verdict.decision !== 'allow' && (
                  <Button onClick={() => onChoose('original')} disabled={blocked} aria-disabled={blocked}>
                    {blocked ? t(lang, 'proceedBlocked') : t(lang, 'proceed')}
                  </Button>
                )}
                <Button onClick={() => onChoose('cancel')} className={verdict.decision === 'allow' ? 'col-span-2' : undefined}>
                  {t(lang, 'cancel')}
                </Button>
              </div>
              {verdict.decision !== 'allow' && (
                <button
                  type="button"
                  onClick={() => onWhy(whyLabel)}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 text-sm font-semibold text-azure hover:bg-white/60 dark:text-sky dark:hover:bg-white/10"
                >
                  <MessageCircleQuestionMark size={17} aria-hidden="true" /> {whyLabel}
                </button>
              )}
            </div>
          )}

          {(run.stage === 'rechecking' || (run.stage === 'done' && run.choice === 'counter_offer')) && (
            <div className="mt-4">
              <RecheckCheck lang={lang} verdict={verdict} running={run.stage === 'rechecking'} />
            </div>
          )}

          {run.stage === 'done' && run.choice && run.choice !== 'counter_offer' && (
            <p className="mt-4 flex items-center gap-2 rounded-2xl bg-white/60 px-3 py-2.5 text-sm font-medium dark:bg-white/5">
              <ArrowRight size={18} className="text-muted" aria-hidden="true" />
              {run.choice === 'original' ? t(lang, 'chosenOriginal') : t(lang, 'chosenCancel')}
            </p>
          )}
        </div>
      )}
    </article>
  );
}
