import { t } from '../copy';
import { useApp } from '../state';
import { LangButton } from './Header';
import { RulesEditor } from './RulesEditor';
import { Button, Card, Logo, WaveStrip } from './ui';

export function Onboarding() {
  const { state, dispatch } = useApp();
  const { lang } = state;
  return (
    <div className="mx-auto flex min-h-full w-full max-w-md flex-col px-5 pb-[max(env(safe-area-inset-bottom),1.25rem)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <Logo size={28} />
          <span className="font-semibold">TopiaPause</span>
        </div>
        <LangButton />
      </div>

      <section className="animate-enter mt-12">
        <WaveStrip className="w-14" />
        <h1 className="mt-5 text-[32px] font-semibold leading-tight tracking-tight">{t(lang, 'onbTitle')}</h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{t(lang, 'onbBody')}</p>
      </section>

      <section className="mt-10" aria-labelledby="onb-rules">
        <h2 id="onb-rules" className="mb-2 px-1 text-sm text-muted">
          {t(lang, 'onbRules')}
        </h2>
        <Card>
          <RulesEditor policy={state.policy} lang={lang} onChange={(policy) => dispatch({ type: 'policy', policy })} />
        </Card>
      </section>

      <div className="mt-auto pt-8">
        <Button variant="primary" full onClick={() => dispatch({ type: 'onboard' })}>
          {t(lang, 'onbCta')}
        </Button>
        <p className="mt-3 text-center text-xs text-muted">{t(lang, 'sandbox')}</p>
      </div>
    </div>
  );
}
