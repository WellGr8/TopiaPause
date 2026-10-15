import { Bot, Moon, RotateCcw, Sun } from 'lucide-react';
import { t } from '../copy';
import { useApp } from '../state';
import { IconButton, Logo, cx } from './ui';

export function LangThemeControls() {
  const { state, dispatch } = useApp();
  const { lang, theme } = state;
  return (
    <div className="flex items-center gap-0.5">
      <div className="mr-1 inline-flex rounded-2xl bg-white/60 p-0.5 ring-1 ring-slate-900/10 dark:bg-white/10 dark:ring-white/15" role="group" aria-label={t(lang, 'language')}>
        {(['th', 'en'] as const).map((l) => (
          <button
            key={l}
            type="button"
            aria-pressed={lang === l}
            onClick={() => dispatch({ type: 'lang', lang: l })}
            className={cx(
              'h-10 min-w-11 rounded-[14px] px-2 text-sm font-bold transition duration-200',
              lang === l ? 'bg-navy text-white dark:bg-white dark:text-navy' : 'text-muted dark:text-slate-300',
            )}
          >
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <IconButton label={t(lang, 'theme')} onClick={() => dispatch({ type: 'theme', theme: theme === 'dark' ? 'light' : 'dark' })}>
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </IconButton>
    </div>
  );
}

export function Header({ variant, title }: { variant: 'brand' | 'chat'; title?: string }) {
  const { state, dispatch } = useApp();
  const { lang } = state;
  return (
    <header className="glass sticky top-0 z-20 rounded-none border-x-0 border-t-0 px-3 pb-2 pt-[max(env(safe-area-inset-top),0.5rem)] lg:rounded-b-3xl lg:border-x">
      <div className="mx-auto flex max-w-3xl items-center gap-2.5">
        {variant === 'chat' ? (
          <>
            <span className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-navy to-navy-2 text-aqua dark:from-white dark:to-slate-200 dark:text-azure">
              <Bot size={24} strokeWidth={2} aria-hidden="true" />
              <span className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-white bg-teal-400 dark:border-navy" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 font-bold leading-tight">
                U-Bot <span className="rounded-md bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-950 dark:bg-amber-300/20 dark:text-amber-100">mock</span>
              </p>
              <p className="truncate text-xs text-muted dark:text-slate-400">{t(lang, 'ubotSub')}</p>
            </div>
            {state.chat.length > 0 && (
              <IconButton label={t(lang, 'newChat')} onClick={() => dispatch({ type: 'clearChat' })}>
                <RotateCcw size={19} />
              </IconButton>
            )}
          </>
        ) : (
          <div className="flex min-w-0 flex-1 items-center gap-2.5">
            <Logo size={36} />
            <div className="min-w-0">
              <p className="font-bold leading-tight">{title ?? 'TopiaPause'}</p>
              <p className="truncate text-xs text-muted dark:text-slate-400">{t(lang, 'appTagline')}</p>
            </div>
          </div>
        )}
        <div className={variant === 'chat' ? 'lg:hidden' : undefined}>
          <LangThemeControls />
        </div>
      </div>
    </header>
  );
}
