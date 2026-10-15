import { Activity, MessageCircle, SlidersHorizontal, type LucideIcon } from 'lucide-react';
import { t, type CopyKey } from '../copy';
import { useApp, type Screen } from '../state';
import { LangButton } from './Header';
import { SavedHero } from './SavedHero';
import { Logo, cx } from './ui';

const ITEMS: Array<{ screen: Screen; icon: LucideIcon; label: CopyKey }> = [
  { screen: 'chat', icon: MessageCircle, label: 'navChat' },
  { screen: 'activity', icon: Activity, label: 'navActivity' },
  { screen: 'rules', icon: SlidersHorizontal, label: 'navRules' },
];

export function BottomNav() {
  const { state, dispatch } = useApp();
  return (
    <nav className="border-t border-line pb-[env(safe-area-inset-bottom)] lg:hidden" aria-label="Primary">
      <ul className="mx-auto grid max-w-md grid-cols-3">
        {ITEMS.map(({ screen, icon: Icon, label }) => {
          const active = state.screen === screen;
          return (
            <li key={screen}>
              <button
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => dispatch({ type: 'screen', screen })}
                className={cx('flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-xs font-medium', active ? 'text-ink' : 'text-muted')}
              >
                <Icon size={20} strokeWidth={active ? 2.2 : 1.8} aria-hidden="true" />
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
  return (
    <aside className="hidden h-full w-64 shrink-0 flex-col border-r border-line px-4 py-5 lg:flex">
      <div className="flex items-center gap-2.5 px-2">
        <Logo size={28} />
        <span className="font-semibold">TopiaPause</span>
      </div>

      <nav aria-label="Primary" className="mt-8">
        <ul className="space-y-0.5">
          {ITEMS.map(({ screen, label }) => {
            const active = state.screen === screen;
            return (
              <li key={screen}>
                <button
                  type="button"
                  aria-current={active ? 'page' : undefined}
                  onClick={() => dispatch({ type: 'screen', screen })}
                  className={cx(
                    'flex min-h-11 w-full items-center rounded-control px-3 text-[15px] font-medium transition-colors',
                    active ? 'bg-surface text-ink shadow-card' : 'text-muted hover:text-ink',
                  )}
                >
                  {t(lang, label)}
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      <SavedHero className="mt-10 px-2" />

      <div className="mt-auto flex items-center justify-between px-2">
        <p className="text-xs text-muted">{t(lang, 'sandbox')}</p>
        <LangButton />
      </div>
    </aside>
  );
}
