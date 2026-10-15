import { Bot, Moon, Shield, Store, Sun, UserRound, Volume2 } from 'lucide-react';
import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { t } from '../copy';
import { LANDING_SCENES, landingPreview, type LandingPreview } from '../lib/landing';
import { hrefFor, isPlainClick } from '../lib/route';
import { speak, stopVoice } from '../lib/voice';
import { useApp } from '../state';
import { Ambient } from './Ambient';
import { HomeLink, LangButton } from './Header';
import { Logo, cx } from './ui';
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

function FlowLine({ lang }: { lang: 'th' | 'en' }) {
  const steps = [
    { icon: UserRound, label: t(lang, 'landYou') },
    { icon: Bot, label: t(lang, 'landAgent') },
    { icon: Shield, label: 'TopiaPause' },
    { icon: Store, label: t(lang, 'landShop') },
  ];
  return (
    <ol className="mt-2 flex flex-wrap items-center justify-center gap-x-1.5 gap-y-0.5 text-[12px] leading-none text-muted">
      {steps.map((step, i) => (
        <li key={step.label} className="inline-flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden="true" className="mr-0.5">
              →
            </span>
          )}
          <step.icon size={12} aria-hidden="true" />
          <span className={step.label === 'TopiaPause' ? 'font-semibold text-ink' : undefined}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function CompareCard({ preview, lang }: { preview: LandingPreview; lang: 'th' | 'en' }) {
  const play = () => {
    void speak({ text: preview.voiceText, lang, clipId: preview.clipId }, { onStart: () => {}, onEnd: () => {}, onBlocked: () => {} });
  };
  const offer = preview.offer;
  const you = t(lang, 'landYou');
  return (
    <div role="region" aria-label="TopiaPause" className="rounded-card border border-line bg-surface px-3.5 py-3 shadow-card">
      <p className="truncate text-[13px] leading-snug text-muted">
        <span className="font-medium text-ink">{you}</span> <span>{preview.user}</span>
        <span aria-hidden="true"> → </span>
        <span>{preview.agentLabel}</span>
      </p>
      <div data-testid="pause-plain" className="mt-2">
        <p className="text-[15px] leading-snug line-through decoration-muted">{preview.agent}</p>
        <p className="mt-2 text-[13px] font-semibold">TopiaPause</p>
        <p className="text-[14px] leading-snug">{preview.lead}</p>
        <p className="mt-1 text-[34px] font-semibold leading-none tracking-tight tabular-nums">{offer.amount}</p>
        {offer.note && <p className="mt-1 text-[14px] leading-snug text-muted">{offer.note}</p>}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          {offer.saved && <p className="inline-flex items-center rounded-full border border-line bg-canvas px-3 py-1 text-[14px] font-medium">{offer.saved}</p>}
          <button
            type="button"
            onClick={play}
            aria-label={t(lang, 'landListen')}
            className="inline-flex min-h-12 items-center gap-1.5 rounded-full border border-line bg-canvas px-3 text-[15px] font-medium text-ink"
          >
            <Volume2 size={16} aria-hidden="true" />
            {t(lang, 'listen')}
          </button>
        </div>
      </div>
      <details data-testid="pause-details" className="hidden">
        <summary>{t(lang, 'landDetails')}</summary>
        {preview.ruleLine && <p>{preview.ruleLine}</p>}
        <ul>
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
  const preview = landingPreview(scene, lang);
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Partial<Record<SceneId, HTMLAnchorElement | null>>>({});
  const scrollLock = useRef(0);

  useEffect(() => () => stopVoice(), [scene]);

  const focusScene = (id: SceneId, focus: boolean) => {
    setScene(id);
    const el = tabRefs.current[id];
    if (focus) el?.focus();
    const scroller = scrollerRef.current;
    if (!el || !scroller || scroller.scrollWidth <= scroller.clientWidth + 1) return;
    scrollLock.current = performance.now() + 450;
    el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', inline: 'start', block: 'nearest' });
  };

  const onScroll = () => {
    if (performance.now() < scrollLock.current) return;
    const scroller = scrollerRef.current;
    if (!scroller || scroller.scrollWidth <= scroller.clientWidth + 1) return;
    const edge = scroller.getBoundingClientRect().left;
    let best: SceneId | undefined;
    let bestDist = Infinity;
    for (const id of LANDING_SCENES) {
      const el = tabRefs.current[id];
      if (!el) continue;
      const dist = Math.abs(el.getBoundingClientRect().left - edge);
      if (dist < bestDist) {
        best = id;
        bestDist = dist;
      }
    }
    if (best && best !== sceneRef.current) setScene(best);
  };

  const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = LANDING_SCENES.indexOf(sceneRef.current);
    const n = LANDING_SCENES.length;
    let next = -1;
    if (e.key === 'ArrowRight') next = (i + 1) % n;
    else if (e.key === 'ArrowLeft') next = (i - 1 + n) % n;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = n - 1;
    else return;
    e.preventDefault();
    const id = LANDING_SCENES[next];
    if (id) focusScene(id, true);
  };

  return (
    <>
      <Ambient variant="landing" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full max-w-xl flex-col px-5 pt-[max(env(safe-area-inset-top),0.75rem)] text-[15px] leading-snug text-ink sm:px-8 sm:pt-6">
        <div className="flex items-center justify-between gap-2">
          <HomeLink className="inline-flex">
            <Logo size={26} />
            <span className="text-[16px] font-semibold">TopiaPause</span>
          </HomeLink>
          <div className="flex items-center">
            <button
              type="button"
              aria-label={t(lang, 'darkMode')}
              aria-pressed={theme === 'dark'}
              onClick={() => dispatch({ type: 'theme', theme: theme === 'dark' ? 'light' : 'dark' })}
              className="inline-flex h-11 w-11 items-center justify-center rounded-control text-ink"
            >
              {theme === 'dark' ? <Sun size={20} aria-hidden="true" /> : <Moon size={20} aria-hidden="true" />}
            </button>
            <LangButton className="h-11! min-w-11 px-1.5 text-[15px]!" />
          </div>
        </div>

        <h1 className="mt-3 whitespace-pre-line text-[28px] font-semibold leading-[1.12] tracking-tight sm:mt-5 sm:text-[34px]">{t(lang, 'onbTitle')}</h1>
        <p className="mt-1 text-[15px] leading-snug">{t(lang, 'onbBody')}</p>

        <div id="landing-hero" role="tabpanel" aria-labelledby={`landing-scene-${scene}`} className="mt-3" aria-live="polite" data-reduced={reduced ? 'true' : 'false'} data-step="3">
          <CompareCard preview={preview} lang={lang} />
        </div>

        <div className="sticky bottom-0 z-20 mt-auto bg-canvas/95 pt-3 pb-[max(env(safe-area-inset-bottom),0.75rem)] backdrop-blur-md sm:static">
          <div
            ref={scrollerRef}
            role="tablist"
            aria-label={t(lang, 'landExamples')}
            onKeyDown={onKey}
            onScroll={onScroll}
            className="flex gap-1.5"
          >
            {LANDING_SCENES.map((id) => {
              const card = landingPreview(id, lang);
              const selected = scene === id;
              return (
                <a
                  key={id}
                  ref={(node) => {
                    tabRefs.current[id] = node;
                  }}
                  href={hrefFor('chat', id)}
                  role="tab"
                  id={`landing-scene-${id}`}
                  data-scene={id}
                  aria-selected={selected}
                  aria-controls="landing-hero"
                  tabIndex={selected ? 0 : -1}
                  onClick={(e) => {
                    if (!isPlainClick(e)) return;
                    e.preventDefault();
                    if (selected) dispatch({ type: 'onboard', scene: id });
                    else focusScene(id, false);
                  }}
                  className={cx(
                    'inline-flex min-h-11 flex-1 items-center justify-center rounded-full border px-2 text-center text-[14px] font-medium leading-tight no-underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink',
                    selected ? 'border-ink bg-ink text-canvas' : 'border-line bg-surface text-ink',
                  )}
                >
                  {card.chip}
                </a>
              );
            })}
          </div>

          <a
            href={hrefFor('chat', scene)}
            onClick={(e) => {
              if (!isPlainClick(e)) return;
              e.preventDefault();
              dispatch({ type: 'onboard', scene });
            }}
            className="btn-gradient text-on-brand mt-2.5 inline-flex min-h-12 w-full items-center justify-center rounded-control px-4 text-[17px] font-semibold no-underline"
          >
            {t(lang, 'onbCta')}
          </a>
          <FlowLine lang={lang} />
          <p className="mt-1.5 text-center text-[12px] leading-snug text-muted">{t(lang, 'sandbox')}</p>
          <p className="mt-0.5 text-center text-[13px] leading-snug">{t(lang, 'partner')}</p>
        </div>
      </div>
    </>
  );
}
