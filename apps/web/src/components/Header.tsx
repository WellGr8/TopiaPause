import { RotateCcw } from 'lucide-react';
import { t } from '../copy';
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
      className={`inline-flex h-11 min-w-11 items-center justify-center rounded-control px-2 text-sm font-medium text-on-glow hover:text-ink ${className ?? ''}`}
    >
      {t(lang, 'switchLang')}
    </button>
  );
}

export function Header() {
  const { state, dispatch } = useApp();
  const { lang, screen } = state;
  const title = screen === 'activity' ? t(lang, 'activity') : screen === 'rules' ? t(lang, 'rulesTitle') : null;
  return (
    <header className="border-b border-line px-4 pt-[env(safe-area-inset-top)]">
      <div className="mx-auto flex h-14 max-w-xl items-center gap-2">
        <span className="lg:hidden">
          <Logo size={26} />
        </span>
        {title ? (
          <h1 className="flex-1 font-semibold">{title}</h1>
        ) : (
          <p className="flex-1 font-semibold">
            U-Bot <span className="font-normal text-on-glow">· {t(lang, 'mock')}</span>
          </p>
        )}
        {screen === 'chat' && state.chat.length > 0 && (
          <IconButton className="text-on-glow!" label={t(lang, 'newChat')} onClick={() => dispatch({ type: 'clearChat' })}>
            <RotateCcw size={18} />
          </IconButton>
        )}
        <LangButton className="lg:hidden" />
      </div>
    </header>
  );
}
