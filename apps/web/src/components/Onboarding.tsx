import { Bed, Bot, Coins, Moon, Shield, Smartphone, Store, Sun, UserRound, Volume2 } from 'lucide-react';
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

const SCENE_ICON = {
  subscription: Smartphone,
  stay: Bed,
  crypto: Coins,
} as const;

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
  const steps = [
    { icon: UserRound, label: t(lang, 'landYou') },
    { icon: Bot, label: t(lang, 'landAgent') },
    { icon: Shield, label: 'TopiaPause' },
    { icon: Store, label: t(lang, 'landShop') },
  ];
  return (
    <ol className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[17px] leading-snug text-ink">
      {steps.map((step, i) => (
        <li key={step.label} className="inline-flex items-center gap-1.5">
          {i > 0 && (
            <span aria-hidden="true" className="mr-0.5">
              →
            </span>
          )}
          <step.icon size={18} aria-hidden="true" />
          <span className={step.label === 'TopiaPause' ? 'font-semibold' : undefined}>{step.label}</span>
        </li>
      ))}
    </ol>
  );
}

function Bubble({ side, name, initial, children }: { side: 'user' | 'agent'; name: string; initial: string; children: string }) {
  const mine = side === 'user';
  return (
    <div className={cx('flex items-end gap-2', mine && 'justify-end')}>
      {!mine && (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-line text-[15px] font-semibold" aria-hidden="true">
          {initial}
        </span>
      )}
      <div className={cx('max-w-[85%]', mine && 'text-right')}>
        <p className="mb-1 text-[17px] font-semibold">{name}</p>
        <p className={cx('rounded-2xl px-4 py-3 text-left text-[17px] leading-relaxed', mine ? 'rounded-br-md bg-ink text-canvas' : 'rounded-bl-md border border-line bg-surface')}>{children}</p>
      </div>
      {mine && (
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ink text-[15px] font-semibold text-canvas" aria-hidden="true">
          {initial}
        </span>
      )}
    </div>
  );
}

function Pause({ preview, lang }: { preview: LandingPreview; lang: 'th' | 'en' }) {
  const play = () => {
    void speak({ text: preview.voiceText, lang, clipId: preview.clipId }, { onStart: () => {}, onEnd: () => {}, onBlocked: () => {} });
  };
  const offer = preview.offer;
  return (
    <div role="region" aria-label="TopiaPause">
      <p className="text-[17px] font-semibold">TopiaPause</p>
      <div data-testid="pause-plain" className="mt-1">
        <p className="text-[17px] leading-relaxed">{preview.lead}</p>
        <p className="mt-2 text-[40px] font-semibold leading-none tracking-tight tabular-nums">{offer.amount}</p>
        {offer.note && <p className="mt-1 text-[17px] leading-relaxed">{offer.note}</p>}
        {offer.was && <p className="mt-1 text-[17px] leading-relaxed line-through">{offer.was}</p>}
        {offer.saved && <p className="mt-2 inline-flex items-center rounded-full border border-line px-3 py-1 text-[17px] font-medium">{offer.saved}</p>}
      </div>
      <button
        type="button"
        onClick={play}
        aria-label={t(lang, 'landListen')}
        className="mt-3 inline-flex min-h-12 items-center gap-2 rounded-full border border-line bg-surface px-4 text-[17px] font-medium text-ink"
      >
        <Volume2 size={20} aria-hidden="true" />
        {t(lang, 'listen')}
      </button>
      <details data-testid="pause-details" className="mt-2">
        <summary className="flex min-h-12 cursor-pointer items-center text-[17px] font-medium">{t(lang, 'landDetails')}</summary>
        {preview.ruleLine && <p className="pb-2 text-[17px] leading-relaxed">{preview.ruleLine}</p>}
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

  const you = t(lang, 'landYou');

  return (
    <>
      <Ambient variant="landing" />
      <div className="relative z-10 mx-auto min-h-dvh w-full max-w-xl px-5 pb-[max(env(safe-area-inset-bottom),2rem)] pt-[max(env(safe-area-inset-top),1.25rem)] text-[17px] leading-relaxed text-ink sm:px-8 sm:pt-10">
        <div className="flex items-center justify-between gap-3">
          <HomeLink className="inline-flex">
            <Logo size={28} />
            <span className="text-[17px] font-semibold">TopiaPause</span>
          </HomeLink>
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

        <h1 className="mt-6 whitespace-pre-line text-[32px] font-semibold leading-[1.15] tracking-tight sm:mt-10 sm:text-[40px]">{t(lang, 'onbTitle')}</h1>
        <p className="mt-2 text-[17px] leading-relaxed">{t(lang, 'onbBody')}</p>

        <div
          id="landing-hero"
          role="tabpanel"
          aria-labelledby={`landing-scene-${scene}`}
          className="mt-5 space-y-4"
          aria-live="polite"
          data-reduced={reduced ? 'true' : 'false'}
          data-step={step}
        >
          {step >= 1 && (
            <Bubble side="user" name={you} initial={you.slice(0, 1)}>
              {preview.user}
            </Bubble>
          )}
          {step >= 2 && (
            <Bubble side="agent" name={preview.agentLabel} initial="AI">
              {preview.agent}
            </Bubble>
          )}
          {step >= 3 && <Pause preview={preview} lang={lang} />}
        </div>

        <div
          ref={scrollerRef}
          role="tablist"
          aria-label={t(lang, 'landExamples')}
          onKeyDown={onKey}
          onScroll={onScroll}
          className="mt-5 flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-0 [-ms-overflow-style:none] [scrollbar-width:none] md:grid md:grid-cols-3 md:overflow-visible md:snap-none [&::-webkit-scrollbar]:hidden"
        >
          {LANDING_SCENES.map((id) => {
            const card = landingPreview(id, lang);
            const Icon = SCENE_ICON[id];
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
                  'flex w-[85%] shrink-0 snap-start flex-col items-start gap-1 rounded-card border bg-surface px-4 py-3 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink md:w-auto',
                  selected ? 'border-ink shadow-card' : 'border-line',
                  'no-underline',
                )}
              >
                <Icon size={22} aria-hidden="true" />
                <span className="text-[17px] font-semibold leading-snug">{card.chip}</span>
                <span className="text-[17px] leading-snug">{card.hint}</span>
              </a>
            );
          })}
        </div>

        <div className="mt-1 flex justify-center md:hidden">
          {LANDING_SCENES.map((id) => {
            const label = landingPreview(id, lang).chip;
            const on = scene === id;
            return (
              <button key={id} type="button" aria-label={label} aria-current={on ? 'true' : undefined} onClick={() => focusScene(id, false)} className="inline-flex h-12 w-12 items-center justify-center">
                <span aria-hidden="true" className={cx('h-2 w-2 rounded-full', on ? 'bg-ink' : 'border border-line bg-transparent')} />
              </button>
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
          className="btn-gradient text-on-brand mt-2 inline-flex min-h-12 w-full items-center justify-center rounded-control px-4 text-[17px] font-semibold no-underline"
        >
          {t(lang, 'onbCta')}
        </a>
        <FlowLine lang={lang} />
        <p className="mt-3 text-center text-[17px]">{t(lang, 'sandbox')}</p>
        <p className="mt-2 text-center text-[17px]">{t(lang, 'partner')}</p>
        <p className="mt-1 text-center text-[15px] text-muted">{t(lang, 'mockNote')}</p>
      </div>
    </>
  );
}
