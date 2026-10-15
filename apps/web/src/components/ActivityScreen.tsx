import { fmtMoney, type SceneId } from '@topiapause/shared';
import { BedDouble, Coins, ShieldCheck, Sparkles, type LucideIcon } from 'lucide-react';
import { CHOICE_LABEL, SCENE_TITLE, t } from '../copy';
import { useApp } from '../state';
import { formatTime } from './ReceiptCard';
import { Button, Glass, StatusPill, cx } from './ui';

export const SCENE_ICON: Record<SceneId, LucideIcon> = { subscription: Sparkles, stay: BedDouble, crypto: Coins };

const NODE: Record<string, string> = {
  allow: 'bg-teal-500 ring-teal-200',
  pause: 'bg-indigo-500 ring-indigo-200',
  block: 'bg-amber-500 ring-amber-200',
};

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
  return { thb, usd, month, primary, secondary };
}

export function ActivityScreen() {
  const { state, dispatch } = useApp();
  const { lang } = state;
  const { primary, secondary, month } = useProtectedTotals();
  const paused = month.filter((a) => a.decision !== 'allow').length;
  const safer = month.filter((a) => a.choice === 'counter_offer').length;

  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-6 pt-2">
      <Glass className="mood-ring p-5">
        <div className="flex items-center gap-2 text-sm font-semibold text-muted dark:text-slate-300">
          <ShieldCheck size={18} className="text-azure dark:text-sky" aria-hidden="true" />
          {t(lang, 'protectedMonth')}
        </div>
        <p className="text-gradient mt-1 text-5xl font-bold tracking-tight tabular-nums">{primary}</p>
        {secondary && (
          <p className="mt-1 text-sm font-medium">
            + {secondary} <span className="text-muted dark:text-slate-400">{t(lang, 'keptUnderCap')}</span>
          </p>
        )}
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          {[
            [t(lang, 'checks'), month.length],
            [t(lang, 'paused'), paused],
            [t(lang, 'saferChosen'), safer],
          ].map(([label, n]) => (
            <div key={String(label)} className="rounded-2xl bg-white/60 px-2 py-2.5 dark:bg-white/5">
              <dd className="text-2xl font-bold tabular-nums">{n}</dd>
              <dt className="text-xs text-muted dark:text-slate-400">{label}</dt>
            </div>
          ))}
        </dl>
      </Glass>

      <section aria-label={t(lang, 'activity')}>
        <h2 className="px-1 pb-2 text-lg font-bold">{t(lang, 'activity')}</h2>
        {state.activity.length === 0 ? (
          <Glass className="p-6 text-center">
            <p className="text-muted dark:text-slate-300">{t(lang, 'emptyActivity')}</p>
            <Button variant="primary" className="mt-3" onClick={() => dispatch({ type: 'screen', screen: 'chat' })}>
              {t(lang, 'goChat')}
            </Button>
          </Glass>
        ) : (
          <ol className="relative space-y-3 pl-6 before:absolute before:bottom-3 before:left-[9px] before:top-3 before:w-0.5 before:rounded-full before:bg-gradient-to-b before:from-sky before:via-peri before:to-aqua">
            {state.activity.map((a) => {
              const Icon = SCENE_ICON[a.scene];
              return (
                <li key={a.id} className="anim-fade relative">
                  <span className={cx('absolute -left-6 top-5 h-[18px] w-[18px] rounded-full ring-4', NODE[a.decision])} aria-hidden="true" />
                  <Glass className="flex items-center gap-3 p-3.5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-white/80 text-azure dark:bg-white/10 dark:text-sky">
                      <Icon size={20} aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold">{SCENE_TITLE[a.scene][lang]}</p>
                        <StatusPill decision={a.decision} lang={lang} size="sm" />
                      </div>
                      <p className="text-sm text-muted dark:text-slate-400">
                        {CHOICE_LABEL[a.choice][lang]} · {formatTime(a.at, lang)}
                      </p>
                    </div>
                    {a.protectedAmount > 0 && (
                      <p className="shrink-0 text-right text-sm font-bold text-teal-800 tabular-nums dark:text-teal-200">
                        +{fmtMoney({ amount: a.protectedAmount, currency: a.currency })}
                      </p>
                    )}
                  </Glass>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </div>
  );
}
