import { ArrowRight, Lock } from 'lucide-react';
import { t } from '../copy';
import { useApp } from '../state';
import { Header } from './Header';
import { RulesEditor } from './RulesEditor';
import { Button } from './ui';

export function Onboarding() {
  const { state, dispatch } = useApp();
  const { lang } = state;
  return (
    <div className="relative z-10 flex min-h-full flex-col">
      <Header variant="brand" />
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col px-4 pb-8">
        <section className="anim-fade pt-4 text-center">
          <p className="inline-flex items-center gap-1.5 rounded-full bg-white/70 px-3 py-1 text-xs font-semibold text-azure ring-1 ring-azure/20 dark:bg-white/10 dark:text-sky">
            {t(lang, 'onbKicker')}
          </p>
          <h1 className="mt-3 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">
            <span className="text-gradient">{t(lang, 'onbTitle')}</span>
          </h1>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted dark:text-slate-300">{t(lang, 'onbBody')}</p>
          <p className="mt-2 text-sm font-semibold tracking-wide">{t(lang, 'principle')}</p>
        </section>

        <div className="mt-5">
          <RulesEditor policy={state.policy} lang={lang} onChange={(policy) => dispatch({ type: 'policy', policy })} />
        </div>

        <div className="sticky bottom-0 mt-5 pb-[max(env(safe-area-inset-bottom),0.5rem)] pt-2">
          <Button variant="primary" full className="min-h-13 text-base" onClick={() => dispatch({ type: 'onboard' })}>
            {t(lang, 'onbCta')} <ArrowRight size={18} aria-hidden="true" />
          </Button>
          <p className="mt-2 flex items-center justify-center gap-1.5 text-center text-xs text-muted dark:text-slate-400">
            <Lock size={13} aria-hidden="true" /> {t(lang, 'onbFoot')} · {t(lang, 'sandbox')}
          </p>
        </div>
      </main>
    </div>
  );
}
