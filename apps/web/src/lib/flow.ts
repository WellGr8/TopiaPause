import {
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
import { protectedCurrency, verdictFor } from './guard';

const reduced = () => typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const delay = (ms: number) => (reduced() ? Math.min(ms, 150) : ms);

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
    (text: string, scene?: SceneId) => {
      const { lang, policy } = ref.current;
      dispatch({ type: 'push', item: { id: newId('u'), type: 'user', text } });
      const typingId = newId('typing');
      dispatch({ type: 'push', item: { id: typingId, type: 'typing' } });

      later(() => {
        const turn = scriptedChat({ message: text, scene, lang });
        dispatch({ type: 'replace', id: typingId, item: { id: typingId, type: 'ubot', text: turn.reply } });
        if (!turn.proposal || !turn.intent || !turn.scene) return;
        const run: GuardRun = {
          runId: newId('run'),
          scene: turn.scene,
          userText: text,
          intent: turn.intent,
          proposal: turn.proposal,
          policy,
          stage: 'checking',
        };
        later(() => dispatch({ type: 'push', item: { id: run.runId, type: 'guard', run } }), 350);
        later(() => dispatch({ type: 'updateRun', runId: run.runId, patch: { stage: 'verdict' } }), 1500);
      }, 850);
    },
    [dispatch],
  );

  const finalize = useCallback(
    (run: GuardRun, choice: UserChoice) => {
      const { lang } = ref.current;
      const verdict = verdictFor(run, lang);
      const execution: Execution = choice === 'cancel' ? { mode: 'mock', status: 'skipped' } : mockExecute();
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
        later(() => finalize(run, choice), 1900);
      } else {
        finalize(run, choice);
      }
    },
    [dispatch, finalize],
  );

  return useMemo(() => ({ send, choose }), [send, choose]);
}
