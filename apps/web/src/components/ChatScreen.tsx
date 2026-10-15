import { SCENE_ORDER, SCENES, type SceneId } from '@topiapause/shared';
import { ArrowUp, Globe } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { t } from '../copy';
import { useChatFlow } from '../lib/flow';
import { useApp, type ChatItem } from '../state';
import { GuardianCard } from './GuardianCard';
import { SavedHero, useSavings } from './SavedHero';
import { cx } from './ui';

/** Tickets already handed to the chat, including across a StrictMode remount. */
const openedTickets = new Set<string>();

function Bubble({ from, children }: { from: 'user' | 'ubot'; children: ReactNode }) {
  return (
    <div className={cx('animate-enter flex', from === 'user' && 'justify-end')}>
      <p
        className={cx(
          'max-w-[85%] rounded-card px-4 py-2.5 text-[15px] leading-relaxed',
          from === 'user' ? 'rounded-br-control bg-ink text-canvas' : 'rounded-bl-control border border-line bg-surface',
        )}
      >
        {children}
      </p>
    </div>
  );
}

function Item({ item }: { item: ChatItem }) {
  const { state, dispatch } = useApp();
  const { choose } = useChatFlow();
  switch (item.type) {
    case 'user':
      return <Bubble from="user">{item.text}</Bubble>;
    case 'ubot':
      return <Bubble from="ubot">{item.text}</Bubble>;
    case 'typing':
      return (
        <Bubble from="ubot">
          <span className="flex h-6 items-center gap-1" aria-label="typing">
            {[0, 1, 2].map((i) => (
              <span key={i} className="animate-dot h-1.5 w-1.5 rounded-full bg-muted" style={{ animationDelay: `${i * 0.15}s` }} />
            ))}
          </span>
        </Bubble>
      );
    case 'thinking':
      return (
        <Bubble from="ubot">
          <span className="text-sm text-muted" aria-label={t(state.lang, 'thinking')} role="status">
            {t(state.lang, 'thinking')}…
          </span>
        </Bubble>
      );
    case 'webpage':
      return (
        <figure className="animate-enter max-w-[85%] text-sm">
          <figcaption className="flex items-center gap-1.5 px-1 text-on-glow">
            <Globe size={14} aria-hidden="true" />
            {t(state.lang, 'injRead')} · {t(state.lang, 'injMockPage')}
          </figcaption>
          <div className="mt-1.5 rounded-card border border-line bg-surface px-4 py-3">
            <p className="font-mono text-xs text-muted">{item.url}</p>
            <p className="mt-1">{item.visible}</p>
            <p className="mt-2 rounded-control border border-dashed border-block/60 px-3 py-2">
              <span className="block text-xs font-medium text-block">{t(state.lang, 'injHidden')}</span>
              <span className="font-mono text-xs">{item.hidden}</span>
            </p>
          </div>
        </figure>
      );
    case 'guard':
      return (
        <GuardianCard
          run={item.run}
          lang={state.lang}
          onChoose={(c) => choose(item.run, c)}
          onReceipt={(receiptId) => dispatch({ type: 'openReceipt', receiptId })}
        />
      );
  }
}

export function ChatScreen() {
  const { state } = useApp();
  const { send, sendInjection } = useChatFlow();
  const savings = useSavings();
  const { lang } = state;
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const busy = state.chat.some((c) => c.type === 'typing' || c.type === 'thinking' || (c.type === 'guard' && c.run.stage !== 'done'));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state.chat, busy]);

  useEffect(() => {
    const ticket = state.openTicket;
    const scene: SceneId | undefined = state.openScene;
    if (!ticket || !scene || openedTickets.has(ticket)) return;
    openedTickets.add(ticket);
    void send(SCENES[scene].userText[lang], scene);
  }, [state.openTicket, state.openScene, lang, send]);

  const sceneChip = (id: (typeof SCENE_ORDER)[number]) => ({ id, label: SCENES[id].chip[lang], run: () => send(SCENES[id].userText[lang], id) });
  const [first, ...rest] = SCENE_ORDER.map(sceneChip);
  const chips = [first!, { id: 'injection', label: t(lang, 'injChip'), run: () => void sendInjection() }, ...rest];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v || busy) return;
    send(v);
    setText('');
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-xl space-y-3 px-4 py-4" aria-live="polite">
          {savings.counted.size > 0 && <SavedHero size="sm" className="px-1 pb-3 lg:hidden" />}
          <Bubble from="ubot">{t(lang, 'greet')}</Bubble>
          {state.chat.map((item) => (
            <Item key={item.id} item={item} />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="mx-auto w-full max-w-xl px-4 pb-3 pt-1">
        {!busy && (
          <div className="flex flex-wrap gap-2 pb-2">
            {chips.map((c) => (
              <button key={c.id} type="button" onClick={c.run} className="min-h-11 rounded-full border border-line bg-surface px-4 text-sm font-medium transition-colors hover:border-muted">
                {c.label}
              </button>
            ))}
          </div>
        )}
        <form onSubmit={submit} className="flex items-center gap-2 rounded-card border border-line bg-surface p-1.5 pl-4">
          <label className="sr-only" htmlFor="composer">
            {t(lang, 'placeholder')}
          </label>
          <input
            id="composer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t(lang, 'placeholder')}
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            aria-label={t(lang, 'send')}
            disabled={!text.trim() || busy}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control bg-ink text-canvas transition-opacity disabled:opacity-25"
          >
            <ArrowUp size={20} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
