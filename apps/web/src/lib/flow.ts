import {
  extractIntentMock,
  mockExecute,
  newId,
  scriptedChat,
  type AgentProposal,
  type Execution,
  type Receipt,
  type SceneId,
  type UserChoice,
} from '@topiapause/shared';
import { createContext, createElement, useCallback, useContext, useEffect, useMemo, useRef, type ReactNode } from 'react';
import { useApp, type GuardRun } from '../state';
import { apiChat, apiExecute, apiGuardCheck, type ChatTurn } from './api';
import { protectedCurrency, verdictFor } from './guard';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const delay = (ms: number) => (reduced() ? Math.min(ms, 150) : ms);
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, delay(ms)));
const SCENE_OF = { subscription: 'subscription', stay: 'stay', token_swap: 'crypto' } as const;

export function proposalAmount(p: AgentProposal): number {
  return p.kind === 'subscription' ? p.price.amount : p.kind === 'stay' ? p.totalPrice.amount : p.amountIn.amount;
}

type Flow = ReturnType<typeof useChatFlowImpl>;
const FlowCtx = createContext<Flow | null>(null);

/** One flow instance for the whole app so timers survive tab switches. */
export function FlowProvider({ children }: { children: ReactNode }) {
  const flow = useChatFlowImpl();
  return createElement(FlowCtx.Provider, { value: flow }, children);
}

export function useChatFlow(): Flow {
  const f = useContext(FlowCtx);
  if (!f) throw new Error('useChatFlow outside FlowProvider');
  return f;
}

function useChatFlowImpl() {
  const { state, dispatch } = useApp();
  const ref = useRef(state);
  ref.current = state;
  const timers = useRef<number[]>([]);
  const later = (fn: () => void, ms: number) => {
    timers.current.push(window.setTimeout(fn, delay(ms)));
  };
  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const send = useCallback(
    async (text: string, scene?: SceneId) => {
      const { lang, policy } = ref.current;
      dispatch({ type: 'push', item: { id: newId('u'), type: 'user', text } });
      const typingId = newId('typing');
      dispatch({ type: 'push', item: { id: typingId, type: 'typing' } });

      const typing = wait(850);
      const turn: ChatTurn = (await apiChat({ message: text, scene, lang })) ?? { ...scriptedChat({ message: text, scene, lang }), source: 'scripted' };
      await typing;
      dispatch({ type: 'replace', id: typingId, item: { id: typingId, type: 'ubot', text: turn.reply } });
      const runScene = turn.scene ?? (turn.proposal ? SCENE_OF[turn.proposal.kind] : undefined);
      if (!turn.proposal || !runScene) return;
      const intent = turn.intent ?? extractIntentMock(text, runScene, lang);
      const run: GuardRun = {
        runId: newId('run'),
        scene: runScene,
        userText: text,
        intent,
        proposal: turn.proposal,
        policy,
        stage: 'checking',
        agentSource: turn.source,
      };
      await wait(350);
      dispatch({ type: 'push', item: { id: run.runId, type: 'guard', run } });
      const checking = wait(1150);
      const remote = await apiGuardCheck({ userText: text, proposal: run.proposal, policy, lang, intent });
      await checking;
      dispatch({
        type: 'updateRun',
        runId: run.runId,
        patch: remote ? { stage: 'verdict', verdict: remote, verdictLang: lang, guardSource: 'api' } : { stage: 'verdict', guardSource: 'browser' },
      });
    },
    [dispatch],
  );

  const finalize = useCallback(
    async (run: GuardRun, choice: UserChoice) => {
      const { lang } = ref.current;
      const verdict = verdictFor(run, lang);
      const chosen = choice === 'counter_offer' ? verdict.counterOffer?.proposal : choice === 'original' ? run.proposal : undefined;
      const execution: Execution = chosen
        ? ((await apiExecute(chosen, verdict.verdictId)) ?? mockExecute())
        : { mode: 'mock', status: 'skipped' };
      const receipt: Receipt = {
        receiptId: newId('rcpt'),
        createdAt: new Date().toISOString(),
        language: lang,
        userText: run.userText,
        intent: run.intent,
        originalProposal: run.proposal,
        verdict,
        userChoice: choice,
        execution,
      };
      const protectedAmount =
        choice === 'counter_offer'
          ? (verdict.metrics.protectedAmount ?? 0)
          : choice === 'cancel' && verdict.decision !== 'allow'
            ? proposalAmount(run.proposal)
            : 0;
      dispatch({ type: 'updateRun', runId: run.runId, patch: { stage: 'done', choice, receiptId: receipt.receiptId, protectedAmount } });
      dispatch({
        type: 'activity',
        entry: {
          id: newId('act'),
          at: receipt.createdAt,
          scene: run.scene,
          decision: verdict.decision,
          choice,
          protectedAmount,
          currency: protectedCurrency(run),
          receipt,
        },
      });
    },
    [dispatch],
  );

  const choose = useCallback(
    (run: GuardRun, choice: UserChoice) => {
      if (choice === 'counter_offer') {
        dispatch({ type: 'updateRun', runId: run.runId, patch: { stage: 'rechecking', choice } });
        later(() => void finalize(run, choice), 1900);
      } else {
        void finalize(run, choice);
      }
    },
    [dispatch, finalize],
  );

  return useMemo(() => ({ send, choose }), [send, choose]);
}
