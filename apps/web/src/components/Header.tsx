import { RotateCcw } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../copy';
import { isPlainClick } from '../lib/route';
import { useApp } from '../state';
import { IconButton, Logo } from './ui';

export function LangButton({ className }: { className?: string }) {
  const { state, dispatch } = useApp();
  const { lang } = state;
  return (
    <button
      type="button"
      aria-label={t(lang, 'switchLangLabel')}
      onClick={() => dispatch({ type: 'lang', lang: lang === 'th' ? 'en' : 'th' })}
      className={`inline-flex h-12 min-w-12 items-center justify-center rounded-control px-2 text-[17px] font-medium text-ink hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className ?? ''}`}
    >
      {t(lang, 'switchLang')}
    </button>
  );
}

export function HomeLink({ className, children }: { className?: string; children: ReactNode }) {
  const { state, dispatch } = useApp();
  return (
    <a
      href="/"
      aria-label={t(state.lang, 'homeLabel')}
      className={`items-center gap-2.5 rounded-control text-ink no-underline hover:bg-ink/10 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink ${className ?? ''}`}
      onClick={(e) => {
        if (!isPlainClick(e)) return;
        e.preventDefault();
        if (!state.showLanding) dispatch({ type: 'home' });
      }}
    >
      {children}
    </a>
  );
}

export function Header() {
  const { state, dispatch } = useApp();
  const { lang, screen } = state;
  const title = screen === 'activity' ? t(lang, 'activity') : screen === 'rules' ? t(lang, 'rulesTitle') : null;
  return (
    <header data-glass data-testid="app-header" className="glass-bar px-4 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-2">
        <HomeLink className="inline-flex p-1 lg:hidden">
          <Logo size={26} />
        </HomeLink>
        <HomeLink className="hidden px-2 text-[15px] font-medium lg:inline-flex">{t(lang, 'home')}</HomeLink>
        {title ? (
          <h1 className="min-w-0 flex-1 truncate font-semibold text-ink">{title}</h1>
        ) : (
          <p className="min-w-0 flex-1 truncate font-semibold text-ink">{t(lang, 'agentName')}</p>
        )}
        {screen === 'chat' && state.chat.length > 0 && (
          <IconButton
            className="border border-ink/25 bg-white/85 text-ink! shadow-[0_1px_2px_rgb(10_22_48/0.16)] hover:bg-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink dark:border-white/40 dark:bg-white/15 dark:hover:bg-white/25"
            label={t(lang, 'newChat')}
            onClick={() => dispatch({ type: 'clearChat' })}
          >
            <RotateCcw size={18} />
          </IconButton>
        )}
        <LangButton className="lg:hidden" />
      </div>
    </header>
  );
}
