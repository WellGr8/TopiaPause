import { describeProposal, findingDetail, findingTitle, fmtMoney, type Lang } from '@topiapause/shared';
import { Play, ShieldAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { t } from '../copy';
import { protectedCurrency, verdictFor } from '../lib/guard';
import { approvedLine, offerOf, reasonLine, sortedFindings } from '../lib/summary';
import { speak, speakClip, stopVoice } from '../lib/voice';
import type { GuardRun } from '../state';
import { Button, Card, Status, TextButton, WaveStrip, Waveform, cx } from './ui';

type Voice = 'idle' | 'speaking' | 'blocked';

/** Runs that already auto-played, so remounts (tab switches) don't replay. */
const autoplayed = new Set<string>();

function useVoice(run: GuardRun, text: string, lang: Lang, clipId?: string) {
  const [state, setState] = useState<Voice>('idle');
  const play = () =>
    speak(
      { text, lang, clipId },
      { onStart: () => setState('speaking'), onEnd: () => setState('idle'), onBlocked: () => setState('blocked') },
    );
  const ready = run.stage === 'verdict';
  useEffect(() => {
    if (!ready || autoplayed.has(run.runId)) return;
    autoplayed.add(run.runId);
    void play();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, run.runId]);
  useEffect(() => () => stopVoice(), []);
  const toggle = () => (state === 'speaking' ? stopVoice() : void play());
  return { state, toggle };
}

/** After the counter-offer's receipt, plays the pre-generated confirmation clip once (silent without one). */
function useConfirmClip(run: GuardRun, voiceText: string, lang: Lang, clipId?: string) {
  const [speaking, setSpeaking] = useState(false);
  const due = run.stage === 'done' && run.choice === 'counter_offer' && Boolean(run.receiptId) && Boolean(clipId);
  useEffect(() => {
    const key = `${run.runId}:confirm`;
    if (!due || autoplayed.has(key)) return;
    autoplayed.add(key);
    void speakClip(
      { clipId: clipId!, lang, voiceText, line: 'confirm' },
      { onStart: () => setSpeaking(true), onEnd: () => setSpeaking(false), onBlocked: () => setSpeaking(false) },
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [due, run.runId]);
  return speaking;
}

function Check() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="shrink-0 text-allow" aria-hidden="true">
      <circle cx="12" cy="12" r="10.5" fill="none" stroke="currentColor" strokeWidth="2" className="animate-draw" strokeDasharray="66" strokeDashoffset="66" />
      <path d="M7.5 12.5l3 3 6-6.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="animate-draw [animation-delay:300ms]" strokeDasharray="16" strokeDashoffset="16" />
    </svg>
  );
}

export function GuardianCard({
  run,
  lang,
  onChoose,
  onReceipt,
}: {
  run: GuardRun;
  lang: Lang;
  onChoose: (choice: 'counter_offer' | 'original' | 'cancel') => void;
  onReceipt: (receiptId: string) => void;
}) {
  const verdict = useMemo(() => verdictFor(run, lang), [run, lang]);
  const offer = offerOf(verdict, lang);
  const injected = Boolean(run.injectedFrom);
  const voiceText = injected ? t(lang, verdict.counterOffer ? 'injVoice' : 'injVoiceNoCounter') : verdict.voiceText[lang];
  const clipId = injected ? (verdict.counterOffer ? 'injection-pause' : undefined) : verdict.voiceText.clipId;
  const voice = useVoice(run, voiceText, lang, clipId);
  const confirming = useConfirmClip(run, voiceText, lang, injected ? undefined : clipId);
  const [open, setOpen] = useState(false);
  const choose = (choice: 'counter_offer' | 'original' | 'cancel') => {
    stopVoice();
    onChoose(choice);
  };
  const { decision } = verdict;
  const thinking = run.stage === 'checking' || run.stage === 'rechecking' || voice.state === 'speaking';

  if (run.stage === 'checking') {
    return (
      <Card as="article" className="animate-enter overflow-hidden" aria-busy="true" aria-label={t(lang, 'guard')} data-guard={run.stage}>
        <WaveStrip className="rounded-none" />
        <p className="px-5 py-4 text-[15px] text-muted">{t(lang, 'checking')}</p>
      </Card>
    );
  }

  if (run.stage === 'rechecking' || run.stage === 'done') {
    const chosen = run.choice === 'counter_offer' ? verdict.counterOffer?.proposal : run.choice === 'original' ? run.proposal : undefined;
    const status =
      run.stage === 'rechecking'
        ? t(lang, 'rechecking')
        : run.choice === 'counter_offer'
          ? t(lang, 'doneCounter')
          : run.choice === 'original'
            ? t(lang, 'doneOriginal')
            : t(lang, 'doneCancel');
    return (
      <Card
        as="article"
        className="animate-enter overflow-hidden"
        aria-label={t(lang, 'guard')}
        role="status"
        data-guard={run.stage}
        data-voice={confirming ? 'speaking' : 'idle'}
      >
        {run.stage === 'rechecking' || confirming ? <WaveStrip className="rounded-none" /> : <div className="h-0.5" />}
        <div className="px-5 pb-2 pt-4">
          <p className={cx('flex items-center gap-2 text-sm font-semibold', run.stage === 'done' && run.choice === 'counter_offer' ? 'text-allow' : 'text-muted')}>
            {run.stage === 'done' && run.choice === 'counter_offer' && <Check />}
            {status}
          </p>
          {chosen && <p className="mt-1 text-[17px] font-semibold leading-snug">{approvedLine(chosen, lang)}</p>}
          {run.stage === 'done' && (
            <div className="mt-1 flex items-center justify-between">
              <p className="text-sm text-muted">
                {(run.protectedAmount ?? 0) > 0 && (
                  <>
                    {t(lang, 'saved')}{' '}
                    <span className="font-semibold text-ink tabular-nums">{fmtMoney({ amount: run.protectedAmount ?? 0, currency: protectedCurrency(run) })}</span>
                  </>
                )}
              </p>
              {run.receiptId && (
                <TextButton className="text-brand hover:text-brand" onClick={() => onReceipt(run.receiptId!)}>
                  {t(lang, 'viewReceipt')} →
                </TextButton>
              )}
            </div>
          )}
        </div>
      </Card>
    );
  }

  const blocked = decision === 'block';
  const findings = sortedFindings(verdict);

  return (
    <Card as="article" className="animate-enter overflow-hidden" aria-label={t(lang, 'guard')} data-guard={run.stage} data-decision={decision} data-voice={voice.state}>
      <WaveStrip className="rounded-none" still={!thinking} />
      <div className="px-5 pb-2 pt-4">
        {injected && (
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium text-block">
            <ShieldAlert size={15} className="shrink-0" aria-hidden="true" />
            {t(lang, 'injNote')}
          </p>
        )}
        <div className="flex items-start gap-3">
          <h3 className="flex-1 text-[19px] font-semibold leading-snug">
            <Status decision={decision} lang={lang} /> <span className="text-muted">—</span>{' '}
            {injected ? t(lang, 'injReason') : reasonLine(verdict, run.proposal, lang)}
          </h3>
          <button
            type="button"
            onClick={voice.toggle}
            aria-label={voice.state === 'speaking' ? t(lang, 'stop') : t(lang, 'listen')}
            aria-pressed={voice.state === 'speaking'}
            className="-mr-2 -mt-2 inline-flex h-11 min-w-11 shrink-0 items-center justify-center gap-1.5 rounded-control px-2 text-muted hover:text-ink"
          >
            {voice.state !== 'speaking' && <Play size={13} fill="currentColor" aria-hidden="true" />}
            <Waveform active={voice.state === 'speaking'} />
          </button>
        </div>

        {offer && (
          <div className="mt-4 border-t border-line pt-4">
            <div className="flex items-baseline justify-between gap-2">
              <p className="text-sm font-medium text-brand">{t(lang, 'betterFit')}</p>
              <p className="text-xs text-muted">{t(lang, 'passesRules')}</p>
            </div>
            <p className="mt-1 text-[40px] font-semibold leading-none tracking-tight tabular-nums">
              {offer.value}
              {offer.unit && <span className="ml-1 text-lg font-medium tracking-normal text-muted">{offer.unit}</span>}
            </p>
            <p className="mt-2 text-sm text-muted">{offer.detail}</p>
          </div>
        )}
        {!offer && decision === 'pause' && <p className="mt-3 text-sm text-muted">{t(lang, 'noCounter')}</p>}
        {blocked && <p className="mt-3 text-sm text-block">{t(lang, 'blockedNote')}</p>}

        <div className="mt-5 flex gap-2">
          {offer ? (
            <>
              <Button variant="primary" className="flex-[1.3] whitespace-nowrap" onClick={() => choose('counter_offer')}>
                {t(lang, 'useThis')}
              </Button>
              <Button className="flex-1 whitespace-nowrap" onClick={() => choose('original')}>
                {t(lang, 'proceed')}
              </Button>
            </>
          ) : decision === 'allow' ? (
            <Button variant="primary" full onClick={() => choose('original')}>
              {t(lang, 'confirm')}
            </Button>
          ) : blocked ? (
            <Button variant="primary" full onClick={() => choose('cancel')}>
              {t(lang, 'cancel')}
            </Button>
          ) : (
            <Button full onClick={() => choose('original')}>
              {t(lang, 'proceed')}
            </Button>
          )}
        </div>

        <div className="mt-1 flex items-center justify-between">
          <TextButton aria-expanded={open} onClick={() => setOpen((o) => !o)}>
            {open ? t(lang, 'hideReasons') : t(lang, 'showReasons')}
            <span className={cx('transition-transform', open && 'rotate-180')} aria-hidden="true">
              ⌄
            </span>
          </TextButton>
          {!blocked && <TextButton onClick={() => choose('cancel')}>{t(lang, 'cancel')}</TextButton>}
        </div>

        {open && (
          <div className="animate-enter space-y-3 border-t border-line pb-3 pt-3 text-sm">
            <dl className="space-y-2">
              <div>
                <dt className="text-xs text-muted">{t(lang, 'youSaid')}</dt>
                <dd>“{run.userText}”</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{t(lang, 'agentAbout')}</dt>
                <dd>{describeProposal(run.proposal, lang)}</dd>
              </div>
            </dl>
            {findings.length > 0 && (
              <div>
                <p className="text-xs text-muted">{t(lang, 'findings')}</p>
                <ul className="mt-1 space-y-1.5">
                  {findings.map((f) => (
                    <li key={f.ruleId}>
                      <span className="font-medium">{findingTitle(f.ruleId, lang)}</span>
                      <span className="text-muted"> — {findingDetail(f, lang)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {verdict.assumptions.length > 0 && (
              <div>
                <p className="text-xs text-muted">{t(lang, 'assumptions')}</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-muted">
                  {verdict.assumptions.map((a) => (
                    <li key={a}>{a}</li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs text-muted">
              {t(lang, 'engineNote')} · v{verdict.engineVersion}
            </p>
          </div>
        )}
      </div>
    </Card>
  );
}
