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
import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react';
import { currentHref, hrefFor, parseRoute, type ParsedRoute } from './lib/route';

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
  | { id: string; type: 'thinking' }
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
  /** The URL is `/`. Chat and activity stay in memory so Back does not wipe a session. */
  showLanding: boolean;
  screen: Screen;
  lang: Lang;
  theme: Theme;
  policy: UserPolicy;
  chat: ChatItem[];
  activity: ActivityEntry[];
  openReceiptId?: string;
  /** Scene a landing link asked the chat to open. Not persisted. */
  openScene?: SceneId;
  /** Unique per entry so a refresh does not replay, and StrictMode does not double-send. */
  openTicket?: string;
}

type Action =
  | { type: 'onboard'; scene: SceneId }
  | { type: 'home' }
  | { type: 'syncRoute'; route: ParsedRoute }
  | { type: 'consumeOpen' }
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
/**
 * Light unless the user toggled dark. A new key so an older `topiapause:theme`
 * value, or `theme` inside the v3 blob, cannot turn the page dark.
 * System `prefers-color-scheme` is never read.
 */
const THEME_KEY = 'topiapause:theme-choice';

function savedTheme(): Theme {
  try {
    return localStorage.getItem(THEME_KEY) === 'dark' ? 'dark' : 'light';
  } catch {
    return 'light';
  }
}

function newTicket(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function blank(): AppState {
  return {
    onboarded: false,
    showLanding: true,
    screen: 'chat',
    lang: 'th',
    theme: 'light',
    policy: DEFAULT_POLICY,
    chat: [],
    activity: [],
  };
}

function initial(): AppState {
  const route = typeof window === 'undefined' ? { view: 'landing' as const } : parseRoute(window.location.pathname, window.location.search);
  const atLanding = route.view === 'landing';
  const base: AppState = {
    ...blank(),
    theme: savedTheme(),
    showLanding: atLanding,
    onboarded: !atLanding,
    screen: route.view === 'landing' ? 'chat' : route.view,
    openScene: route.scene,
    openTicket: route.scene ? newTicket() : undefined,
  };
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<AppState> | null;
    if (saved) {
      return {
        ...base,
        ...saved,
        theme: base.theme,
        chat: [],
        screen: base.screen,
        showLanding: base.showLanding,
        onboarded: base.onboarded,
        openScene: base.openScene,
        openTicket: base.openTicket,
      };
    }
  } catch {
    // ignore corrupt storage
  }
  return base;
}

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case 'onboard':
      return {
        ...s,
        onboarded: true,
        showLanding: false,
        screen: 'chat',
        openScene: a.scene,
        openTicket: newTicket(),
      };
    case 'home':
      return { ...s, showLanding: true, openScene: undefined, openTicket: undefined };
    case 'syncRoute': {
      const { view, scene } = a.route;
      if (view === 'landing') return { ...s, showLanding: true, openScene: undefined, openTicket: undefined };
      const same = scene !== undefined && scene === s.openScene && s.openTicket !== undefined;
      return {
        ...s,
        showLanding: false,
        onboarded: true,
        screen: view,
        openScene: scene,
        openTicket: scene ? (same ? s.openTicket : newTicket()) : undefined,
      };
    }
    case 'consumeOpen':
      return { ...s, openScene: undefined, openTicket: undefined };
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
      return { ...blank(), lang: s.lang, theme: s.theme };
  }
}

const Ctx = createContext<{ state: AppState; dispatch: React.Dispatch<Action> } | null>(null);

type NavKind = 'push' | 'replace' | 'pop' | 'none';

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, rawDispatch] = useReducer(reducer, undefined, initial);
  const navKind = useRef<NavKind>('none');

  const dispatch = useMemo(() => {
    return (action: Action) => {
      if (action.type === 'onboard' || action.type === 'home' || action.type === 'reset') navKind.current = 'push';
      else if (action.type === 'screen' || action.type === 'openReceipt' || action.type === 'consumeOpen') navKind.current = 'replace';
      else if (action.type === 'syncRoute') navKind.current = 'pop';
      rawDispatch(action);
    };
  }, []);

  useEffect(() => {
    const { onboarded, lang, theme, policy, activity } = state;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ onboarded, lang, theme, policy, activity }));
  }, [state]);

  useEffect(() => {
    const dark = state.theme === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    localStorage.setItem(THEME_KEY, state.theme);
    document.documentElement.lang = state.lang;
  }, [state.theme, state.lang]);

  useEffect(() => {
    const kind = navKind.current;
    navKind.current = 'none';
    if (kind === 'pop') return;
    const href = hrefFor(state.showLanding ? 'landing' : state.screen, state.showLanding ? undefined : state.openScene);
    if (href === currentHref()) return;
    if (kind === 'push') history.pushState(null, '', href);
    else history.replaceState(null, '', href);
  }, [state.showLanding, state.screen, state.openScene]);

  useEffect(() => {
    const onPop = () => {
      dispatch({ type: 'syncRoute', route: parseRoute(window.location.pathname, window.location.search) });
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, [dispatch]);

  const value = useMemo(() => ({ state, dispatch }), [state, dispatch]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useApp outside AppProvider');
  return v;
}
