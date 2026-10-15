import { Moon, Sun } from 'lucide-react';
import { useEffect, useState } from 'react';
import { t } from '../copy';
import { LANDING_SCENES, landingPreview, type LandingPreview } from '../lib/landing';
import { speak, stopVoice } from '../lib/voice';
import { useApp } from '../state';
import { Ambient } from './Ambient';
import { LangButton } from './Header';
import { Logo } from './ui';
import type { SceneId } from '@topiapause/shared';

function reducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(reducedMotion);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const on = () => setReduced(mq.matches);
    on();
    mq.addEventListener?.('change', on);
    return () => mq.removeEventListener?.('change', on);
  }, []);
  return reduced;
}

/** Reveals the chat one beat at a time. Reduced motion shows the finished chat immediately. */
function useReveal(scene: SceneId, lang: string, reduced: boolean): number {
  const [step, setStep] = useState(reduced ? 3 : 0);
  useEffect(() => {
    if (reduced) {
      setStep(3);
      return;
    }
    setStep(0);
    const ids = [650, 1300, 1950].map((ms, i) => window.setTimeout(() => setStep(i + 1), ms));
    return () => ids.forEach(clearTimeout);
  }, [scene, lang, reduced]);
  return step;
}

function FlowLine({ lang }: { lang: 'th' | 'en' }) {
  const steps = [t(lang, 'landYou'), t(lang, 'landAgent'), 'TopiaPause', t(lang, 'landShop')];
  return (
    <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] leading-snug text-ink">
      {steps.map((label, i) => (
        <span key={label} className="inline-flex items-center gap-2">
          {i > 0 && <span aria-hidden="true">→</span>}
          <span className={label === 'TopiaPause' ? 'font-semibold underline decoration-2 underline-offset-4' : undefined}>{label}</span>
        </span>
      ))}
    </p>
  );
}

function Pause({ preview, lang }: { preview: LandingPreview; lang: 'th' | 'en' }) {
  const play = () => {
    void speak(
      { text: preview.voiceText, lang, clipId: preview.clipId },
      { onStart: () => {}, onEnd: () => {}, onBlocked: () => {} },
    );
  };
  return (
    <div className="mt-5 border-l-2 border-ink pl-4" role="region" aria-label="TopiaPause">
      <p className="text-[17px] font-semibold">TopiaPause</p>
      <div data-testid="pause-plain" className="mt-2 space-y-2 text-[17px] leading-relaxed">
        <p>{preview.lead}</p>
        {preview.reasons.map((line) => (
          <p key={line}>{line}</p>
        ))}
        {preview.ruleLine && <p>{preview.ruleLine}</p>}
        <p className="font-semibold">{preview.better}</p>
      </div>
      <button
        type="button"
        onClick={play}
        className="mt-4 inline-flex min-h-12 w-full items-center justify-center rounded-control bg-ink px-4 text-[17px] font-semibold text-canvas"
      >
        {t(lang, 'landListen')}
      </button>
      <details data-testid="pause-details" className="mt-3">
        <summary className="flex min-h-12 cursor-pointer items-center text-[17px] font-medium">{t(lang, 'landDetails')}</summary>
        <ul className="space-y-2 pb-2 text-[17px] leading-relaxed">
          {preview.details.map((d) => (
            <li key={d.ruleId}>
              <span className="font-semibold">{d.ruleId}</span> {d.text}
            </li>
          ))}
        </ul>
      </details>
    </div>
  );
}

export function Onboarding() {
  const { state, dispatch } = useApp();
  const { lang, theme } = state;
  const [scene, setScene] = useState<SceneId>('subscription');
  const reduced = useReducedMotion();
  const step = useReveal(scene, lang, reduced);
  const preview = landingPreview(scene, lang);

  useEffect(() => () => stopVoice(), []);

  return (
    <>
      <Ambient variant="landing" />
      <div className="relative z-10 mx-auto min-h-full w-full max-w-xl overflow-y-auto px-5 pb-[max(env(safe-area-inset-bottom),2rem)] pt-[max(env(safe-area-inset-top),1.25rem)] text-[17px] leading-relaxed text-ink sm:px-8 sm:pt-10">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Logo size={28} />
            <span className="text-[17px] font-semibold">TopiaPause</span>
          </div>
          <div className="flex items-center">
            <button
              type="button"
              aria-label={t(lang, 'darkMode')}
              aria-pressed={theme === 'dark'}
              onClick={() => dispatch({ type: 'theme', theme: theme === 'dark' ? 'light' : 'dark' })}
              className="inline-flex h-12 w-12 items-center justify-center rounded-control text-ink"
            >
              {theme === 'dark' ? <Sun size={22} aria-hidden="true" /> : <Moon size={22} aria-hidden="true" />}
            </button>
            <LangButton />
          </div>
        </div>

        <h1 className="mt-8 text-[28px] font-semibold leading-tight tracking-tight sm:mt-12 sm:text-[34px]">{t(lang, 'onbTitle')}</h1>
        <p className="mt-3 text-[17px] leading-relaxed">{t(lang, 'onbBody')}</p>
        <FlowLine lang={lang} />

        <div className="mt-6" aria-live="polite" data-reduced={reduced ? 'true' : 'false'} data-step={step}>
          {step >= 1 && (
            <p className="text-right text-[17px]">
              <span className="mb-1 block font-semibold">{t(lang, 'landYou')}</span>
              {preview.user}
            </p>
          )}
          {step >= 2 && (
            <p className="mt-5 text-[17px]">
              <span className="mb-1 block font-semibold">{preview.agentLabel}</span>
              {preview.agent}
            </p>
          )}
          {step >= 3 && <Pause preview={preview} lang={lang} />}
        </div>

        <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label={t(lang, 'landExamples')}>
          {LANDING_SCENES.map((id) => (
            <button
              key={id}
              type="button"
              aria-pressed={scene === id}
              onClick={() => setScene(id)}
              className={`inline-flex min-h-12 items-center rounded-full px-4 text-[17px] font-medium ${scene === id ? 'bg-ink text-canvas' : 'text-ink underline decoration-1 underline-offset-4'}`}
            >
              {landingPreview(id, lang).chip}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => dispatch({ type: 'onboard' })}
          className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-control bg-ink px-4 text-[17px] font-semibold text-canvas"
        >
          {t(lang, 'onbCta')}
        </button>
        <p className="mt-4 text-center text-[17px]">{t(lang, 'sandbox')}</p>
      </div>
    </>
  );
}
