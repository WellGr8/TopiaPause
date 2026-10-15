import { describeProposal, fmtMoney, fmtWeekday, type Lang, type Receipt } from '@topiapause/shared';
import { ChevronDown } from 'lucide-react';
import type { ReactNode } from 'react';
import { CHOICE_LABEL, SCENE_TITLE, t } from '../copy';
import { fmtExact, type SavedLine } from '../lib/savings';
import { approvedLine } from '../lib/summary';
import { useApp, type ActivityEntry } from '../state';
import { SavedHero, rich, useSavings } from './SavedHero';
import { Card, Status, TextButton, cx } from './ui';

function shortTime(iso: string, lang: Lang): string {
  const d = new Date(iso);
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', {
    ...(today ? {} : { day: 'numeric', month: 'short' }),
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

export function formatTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

export function useProtectedTotals() {
  const { state } = useApp();
  const now = new Date();
  const month = state.activity.filter((a) => {
    const d = new Date(a.at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  });
  const thb = month.filter((a) => a.currency === 'THB').reduce((s, a) => s + a.protectedAmount, 0);
  const usd = month.filter((a) => a.currency === 'USD').reduce((s, a) => s + a.protectedAmount, 0);
  const primary = thb === 0 && usd > 0 ? fmtMoney({ amount: usd, currency: 'USD' }) : fmtMoney({ amount: thb, currency: 'THB' });
  const secondary = thb > 0 && usd > 0 ? fmtMoney({ amount: usd, currency: 'USD' }) : undefined;
  return { month, primary, secondary };
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-3 py-1.5">
      <dt className="text-muted">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function ReceiptDetails({ r, lang }: { r: Receipt; lang: Lang }) {
  const chosen = r.userChoice === 'counter_offer' ? r.verdict.counterOffer?.proposal : r.userChoice === 'original' ? r.originalProposal : undefined;
  return (
    <dl className="animate-enter px-5 pb-4 text-sm">
      <Field label={t(lang, 'asked')}>“{r.userText}”</Field>
      <Field label={t(lang, 'proposed')}>{describeProposal(r.originalProposal, lang)}</Field>
      <Field label={t(lang, 'approved')}>
        <span className="font-medium">{chosen ? approvedLine(chosen, lang) : t(lang, 'nothingApproved')}</span>
      </Field>
      <Field label={t(lang, 'execution')}>
        {r.execution.status === 'success' ? t(lang, 'execMock') : t(lang, 'execSkipped')}
        {r.execution.ref && <span className="ml-1.5 font-mono text-xs text-muted">{r.execution.ref}</span>}
      </Field>
      <Field label={t(lang, 'time')}>{formatTime(r.createdAt, lang)}</Field>
      <p className="pt-1 font-mono text-xs text-muted">{r.receiptId}</p>
    </dl>
  );
}

function priceChange(l: SavedLine, lang: Lang): string {
  const per = (i: 'month' | 'year') => t(lang, i === 'year' ? 'perYear' : 'perMonth');
  const to = l.accepted.interval === 'month' && l.original.interval === 'year' ? ` ${t(lang, 'firstMonth')}` : per(l.accepted.interval);
  return `${fmtExact(l.originalMinor, 'THB')}${per(l.original.interval)} → ${fmtExact(l.acceptedMinor, 'THB')}${to}`;
}

function Row({ a, savedMinor, open, lang, onToggle }: { a: ActivityEntry; savedMinor?: number; open: boolean; lang: Lang; onToggle: () => void }) {
  return (
    <li className="border-t border-line first:border-t-0">
      <button type="button" aria-expanded={open} onClick={onToggle} className="flex min-h-16 w-full items-center gap-3 px-5 py-3 text-left">
        <span className="min-w-0 flex-1">
          <span className="block font-medium">{SCENE_TITLE[a.scene][lang]}</span>
          <span className="block text-sm text-muted">
            <Status decision={a.decision} lang={lang} className="font-medium" /> · {CHOICE_LABEL[a.choice][lang]} · {shortTime(a.at, lang)}
          </span>
        </span>
        {savedMinor !== undefined && <span className="shrink-0 font-semibold tabular-nums">+{fmtExact(savedMinor, 'THB')}</span>}
        <ChevronDown size={16} className={cx('shrink-0 text-muted transition-transform', open && 'rotate-180')} aria-hidden="true" />
      </button>
      {open && <ReceiptDetails r={a.receipt} lang={lang} />}
    </li>
  );
}

export function ActivityScreen() {
  const { state, dispatch } = useApp();
  const { lang } = state;
  const { month } = useProtectedTotals();
  const { saved, protected: protectedLines, thb } = useSavings();
  const savedById = new Map(saved.map((l) => [l.entry.id, l.savedMinor]));
  const paused = month.filter((a) => a.decision !== 'allow').length;
  const better = month.filter((a) => a.choice === 'counter_offer').length;

  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-8 pt-6">
      <SavedHero size="lg" />
      <p className="mt-3 text-sm text-muted">{t(lang, 'statLine', { n: month.length, p: paused, s: better })}</p>

      {saved.length > 0 && (
        <section className="mt-8" aria-labelledby="saved-items">
          <h2 id="saved-items" className="mb-2 px-1 text-sm text-muted">
            {t(lang, 'savedItems')}
          </h2>
          <ul className="divide-y divide-line">
            {saved.map((l) => (
              <li key={l.entry.id} className="flex items-baseline gap-3 px-1 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block font-medium">{SCENE_TITLE[l.entry.scene][lang]}</span>
                  <span className="block text-sm text-muted tabular-nums">{priceChange(l, lang)}</span>
                </span>
                <span className="shrink-0 font-semibold tabular-nums text-allow">+{fmtExact(l.savedMinor, 'THB')}</span>
              </li>
            ))}
            <li className="flex items-baseline gap-3 px-1 py-2.5">
              <span className="flex-1 text-sm text-muted">{t(lang, 'savedTotal')}</span>
              <span className="shrink-0 text-right font-semibold tabular-nums">{fmtExact(thb, 'THB')}</span>
            </li>
          </ul>
        </section>
      )}

      {protectedLines.length > 0 && (
        <section className="mt-8" aria-labelledby="protected-items">
          <h2 id="protected-items" className="mb-2 px-1 text-sm text-muted">
            {t(lang, 'protectedHeader')}
          </h2>
          <ul className="divide-y divide-line">
            {protectedLines.map((l) => (
              <li key={l.entry.id} className="px-1 py-2.5">
                <span className="block font-medium">{SCENE_TITLE[l.entry.scene][lang]}</span>
                <span className="block text-sm text-muted tabular-nums">
                  {l.scene === 'stay' ? (
                    <>
                      {rich(lang, 'stayCostLabel', { cost: fmtExact(l.costMinor, 'THB') }, ['cost'])}
                      {t(lang, 'stayCostTail', { covered: fmtExact(l.coveredMinor, 'THB') })}
                      {l.freeCancelUntil && t(lang, 'stayUntil', { day: fmtWeekday(l.freeCancelUntil, lang) })}
                    </>
                  ) : (
                    rich(lang, 'cryptoLine', { amount: fmtExact(l.reducedMinor, 'USDT'), from: l.fromPct, to: l.toPct }, ['amount'])
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mt-8">
        {state.activity.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-muted">{t(lang, 'emptyActivity')}</p>
            <TextButton className="text-brand hover:text-brand" onClick={() => dispatch({ type: 'screen', screen: 'chat' })}>
              {t(lang, 'goChat')} →
            </TextButton>
          </div>
        ) : (
          <>
          <h2 className="mb-2 px-1 text-sm text-muted">{t(lang, 'allChecks')}</h2>
          <Card as="section" aria-label={t(lang, 'allChecks')}>
            <ul>
              {state.activity.map((a) => (
                <Row
                  key={a.id}
                  a={a}
                  savedMinor={savedById.get(a.id)}
                  lang={lang}
                  open={state.openReceiptId === a.receipt.receiptId}
                  onToggle={() => dispatch({ type: 'toggleReceipt', receiptId: a.receipt.receiptId })}
                />
              ))}
            </ul>
          </Card>
          </>
        )}
      </div>
    </div>
  );
}
