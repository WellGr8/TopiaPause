import { describeProposal, fmtMoney, type Lang, type Receipt } from '@topiapause/shared';
import { ReceiptText } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../copy';
import { StatusPill } from './ui';

export function formatTime(iso: string, lang: Lang): string {
  return new Date(iso).toLocaleString(lang === 'th' ? 'th-TH' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });
}

function protectedOf(r: Receipt): { amount: number; currency: 'THB' | 'USD' } {
  const currency = r.originalProposal.kind === 'token_swap' ? 'USD' : 'THB';
  const p = r.originalProposal;
  const original = p.kind === 'subscription' ? p.price.amount : p.kind === 'stay' ? p.totalPrice.amount : p.amountIn.amount;
  const amount =
    r.userChoice === 'counter_offer'
      ? (r.verdict.metrics.protectedAmount ?? 0)
      : r.userChoice === 'cancel' && r.verdict.decision !== 'allow'
        ? original
        : 0;
  return { amount, currency };
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-3 border-t border-slate-900/5 py-2.5 first:border-t-0 dark:border-white/10">
      <dt className="text-sm text-muted dark:text-slate-400">{label}</dt>
      <dd className="text-[15px] leading-snug">{children}</dd>
    </div>
  );
}

export function ReceiptCard({ receipt, lang }: { receipt: Receipt; lang: Lang }) {
  const chosen =
    receipt.userChoice === 'counter_offer' && receipt.verdict.counterOffer
      ? receipt.verdict.counterOffer.proposal
      : receipt.userChoice === 'original'
        ? receipt.originalProposal
        : null;
  const prot = protectedOf(receipt);
  const executed = receipt.execution.status === 'success';

  return (
    <article className="glass anim-card rounded-3xl p-4 sm:p-5" aria-label={t(lang, 'receipt')}>
      <header className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-slate-900/5 dark:bg-white/10">
            <ReceiptText size={18} aria-hidden="true" />
          </span>
          <div>
            <p className="font-bold leading-tight">{t(lang, 'receipt')}</p>
            <p className="font-mono text-[11px] text-muted dark:text-slate-400">{receipt.receiptId}</p>
          </div>
        </div>
        <span className="rounded-full bg-slate-900/5 px-2.5 py-1 text-xs font-semibold text-muted dark:bg-white/10 dark:text-slate-300">
          {t(lang, 'sandbox')}
        </span>
      </header>

      <div className="mt-3 rounded-2xl bg-gradient-to-br from-sky/15 via-peri/15 to-aqua/20 p-3.5 ring-1 ring-azure/20">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted dark:text-slate-300">{t(lang, 'moneyProtected')}</p>
        <p className="text-gradient text-3xl font-bold tabular-nums">{fmtMoney(prot)}</p>
      </div>

      <dl className="mt-2">
        <Row label={t(lang, 'asked')}>“{receipt.userText}”</Row>
        <Row label={t(lang, 'proposed')}>{describeProposal(receipt.originalProposal, lang)}</Row>
        <Row label={t(lang, 'approved')}>
          {chosen ? <span className="font-semibold">{describeProposal(chosen, lang)}</span> : t(lang, 'nothingApproved')}
        </Row>
        <Row label={t(lang, 'decisionLbl')}>
          <StatusPill decision={receipt.verdict.decision} lang={lang} size="sm" />
        </Row>
        <Row label={t(lang, 'execution')}>
          {executed ? t(lang, 'execMock') : t(lang, 'execSkipped')}
          {receipt.execution.ref && <span className="ml-1 font-mono text-xs text-muted dark:text-slate-400">{receipt.execution.ref}</span>}
        </Row>
        <Row label={t(lang, 'time')}>{formatTime(receipt.createdAt, lang)}</Row>
      </dl>
    </article>
  );
}
