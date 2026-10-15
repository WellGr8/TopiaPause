import { Activity, MessageCircle, ShieldCheck, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { t, type CopyKey } from '../copy';
import { useApp, type Screen } from '../state';
import { useProtectedTotals } from './ActivityScreen';
import { LangThemeControls } from './Header';
import { Logo, cx } from './ui';

const ITEMS: Array<{ screen: Screen; icon: LucideIcon; label: CopyKey }> = [
  { screen: 'chat', icon: MessageCircle, label: 'navChat' },
  { screen: 'activity', icon: Activity, label: 'navActivity' },
  { screen: 'rules', icon: SlidersHorizontal, label: 'navRules' },
];

export function BottomNav() {
  const { state, dispatch } = useApp();
  return (
    <nav className="glass z-20 rounded-none border-x-0 border-b-0 pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {ITEMS.map(({ screen, icon: Icon, label }) => {
          const active = state.screen === screen || (screen === 'activity' && state.screen === 'receipt');
          return (
            <li key={screen}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => dispatch({ type: 'screen', screen })}
                className={cx(
                  'flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-semibold transition duration-200',
                  active ? 'text-azure dark:text-sky' : 'text-muted dark:text-slate-400',
                )}
              >
                <Icon size={22} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
                {t(state.lang, label)}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

export function Sidebar() {
  const { state, dispatch } = useApp();
  const { lang } = state;
  const { primary, secondary } = useProtectedTotals();
  return (
    <aside className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col gap-4 p-4 lg:flex">
      <div className="flex items-center gap-3 px-1 pt-1">
        <Logo size={44} />
        <div>
          <p className="text-lg font-bold leading-tight">TopiaPause</p>
          <p className="text-xs text-muted dark:text-slate-400">{t(lang, 'appTagline')}</p>
        </div>
      </div>

      <nav aria-label="Primary">
        <ul className="space-y-1">
          {ITEMS.map(({ screen, icon: Icon, label }) => {
            const active = state.screen === screen || (screen === 'activity' && state.screen === 'receipt');
            return (
              <li key={screen}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => dispatch({ type: 'screen', screen })}
                  className={cx(
                    'flex min-h-11 w-full items-center gap-3 rounded-2xl px-3 text-[15px] font-semibold transition duration-200',
                    active ? 'glass text-azure dark:text-sky' : 'text-muted hover:bg-white/50 dark:text-slate-300 dark:hover:bg-white/5',
                  )}
                >
                  <Icon size={20} aria-hidden="true" /> {t(lang, label)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="glass mood-ring rounded-3xl p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-muted dark:text-slate-300">
          <ShieldCheck size={15} className="text-azure dark:text-sky" aria-hidden="true" /> {t(lang, 'protectedMonth')}
        </p>
        <p className="text-gradient text-3xl font-bold tabular-nums">{primary}</p>
        {secondary && <p className="text-xs text-muted dark:text-slate-400">+ {secondary} {t(lang, 'keptUnderCap')}</p>}
      </div>

      <div className="glass rounded-3xl p-4">
        <p className="text-sm font-bold">{t(lang, 'howItWorks')}</p>
        <ol className="mt-2 space-y-2 text-sm text-muted dark:text-slate-300">
          {(['how1', 'how2', 'how3', 'how4'] as const).map((k, i) => (
            <li key={k} className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky to-peri text-[11px] font-bold text-navy">{i + 1}</span>
              {t(lang, k)}
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs font-semibold">{t(lang, 'principle')}</p>
      </div>

      <div className="mt-auto space-y-2">
        <p className="px-1 text-[11px] leading-snug text-muted dark:text-slate-400">{t(lang, 'mockNote')}</p>
        <LangThemeControls />
      </div>
    </aside>
  );
}
