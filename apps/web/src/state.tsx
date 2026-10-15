import {
  DEFAULT_POLICY,
  type ActionIntent,
  type AgentProposal,
  type Currency,
  type Decision,
  type GuardVerdict,
  type Lang,
  type Receipt,
  type SceneId,
  type UntrustedSource,
  type UserChoice,
  type UserPolicy,
} from '@topiapause/shared';
import { createContext, useContext, useEffect, useMemo, useReducer, type ReactNode } from 'react';

export type Screen = 'chat' | 'activity' | 'rules';
export type Theme = 'light' | 'dark';

export type GuardStage = 'checking' | 'verdict' | 'rechecking' | 'done';

export interface GuardRun {
  runId: string;
  scene: SceneId;
  userText: string;
  intent: ActionIntent;
  proposal: AgentProposal;
  /** Snapshot so later rule edits don't rewrite history. */
  policy: UserPolicy;
  stage: GuardStage;
  choice?: UserChoice;
  receiptId?: string;
  protectedAmount?: number;
  /** Verdict from POST /api/guard/check (server-side guard-engine), if the API answered. */
  verdict?: GuardVerdict;
  verdictLang?: Lang;
  guardSource?: 'api' | 'browser';
  agentSource?: 'llm' | 'scripted';
  /** Set when the proposal followed an instruction found on a web page (prompt-injection scene). */
  injectedFrom?: string;
  /** Untrusted content the agent read, sent to the guard as `sources`. */
  sources?: UntrustedSource[];
}

export type ChatItem =
  | { id: string; type: 'user'; text: string }
  | { id: string; type: 'ubot'; text: string }
  | { id: string; type: 'typing' }
  | { id: string; type: 'webpage'; url: string; visible: string; hidden: string }
  | { id: string; type: 'guard'; run: GuardRun };

export interface ActivityEntry {
  id: string;
  at: string;
  scene: SceneId;
  decision: Decision;
  choice: UserChoice;
  protectedAmount: number;
  currency: Currency;
  receipt: Receipt;
}

export interface AppState {
  onboarded: boolean;
  screen: Screen;
  lang: Lang;
  theme: Theme;
  policy: UserPolicy;
  chat: ChatItem[];
  activity: ActivityEntry[];
  openReceiptId?: string;
}

type Action =
  | { type: 'onboard' }
  | { type: 'screen'; screen: Screen }
  | { type: 'lang'; lang: Lang }
  | { type: 'theme'; theme: Theme }
  | { type: 'policy'; policy: UserPolicy }
  | { type: 'push'; item: ChatItem }
  | { type: 'replace'; id: string; item: ChatItem }
  | { type: 'updateRun'; runId: string; patch: Partial<GuardRun> }
  | { type: 'activity'; entry: ActivityEntry }
  | { type: 'openReceipt'; receiptId: string }
  | { type: 'toggleReceipt'; receiptId: string }
  | { type: 'clearChat' }
  | { type: 'reset' };

// v3: money is integer minor units (satang, micro-USDT); older saved activity is dropped.
const STORAGE_KEY = 'topiapause:v3';
/** Light by default; dark only once the user flips the toggle (system preference is ignored). */
const THEME_KEY = 'topiapause:theme';

function savedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function initial(): AppState {
  const base: AppState = {
    onboarded: false,
    screen: 'chat',
    lang: 'th',
    theme: savedTheme(),
    policy: DEFAULT_POLICY,
    chat: [],
    activity: [],
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AppState> | null;
    if (saved) return { ...base, ...saved, theme: base.theme, chat: [], screen: 'chat' };
  } catch {
    // ignore corrupt storage
  }
  return base;
}

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'onboard':
      return { ...s, onboarded: true, screen: 'chat' };
    case 'screen':
      return { ...s, screen: a.screen };
    case 'lang':
      return { ...s, lang: a.lang };
    case 'theme':
      return { ...s, theme: a.theme };
    case 'policy':
      return { ...s, policy: a.policy };
    case 'push':
      return { ...s, chat: [...s.chat, a.item] };
    case 'replace':
      return { ...s, chat: s.chat.map((c) => (c.id === a.id ? a.item : c)) };
    case 'updateRun':
      return {
        ...s,
        chat: s.chat.map((c) => (c.type === 'guard' && c.run.runId === a.runId ? { ...c, run: { ...c.run, ...a.patch } } : c)),
      };
    case 'openReceipt':
      return { ...s, screen: 'activity', openReceiptId: a.receiptId };
    case 'toggleReceipt':
      return { ...s, openReceiptId: s.openReceiptId === a.receiptId ? undefined : a.receiptId };
    case 'activity':
      return { ...s, activity: [a.entry, ...s.activity] };
    case 'clearChat':
      return { ...s, chat: [] };
    case 'reset':
      return { ...initial(), onboarded: false, policy: DEFAULT_POLICY, activity: [], lang: s.lang, theme: s.theme };
  }
}

const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, initial);

  useEffect(() => {
    const { onboarded, lang, theme, policy, activity } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ onboarded, lang, theme, policy, activity }));
  }, [state]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', state.theme === 'dark');
    localStorage.setItem(THEME_KEY, state.theme);
    document.documentElement.lang = state.lang;
  }, [state.theme, state.lang]);

  const value = useMemo(() => ({ state, dispatch }), [state]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
