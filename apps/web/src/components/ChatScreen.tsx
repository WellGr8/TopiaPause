import { SCENE_ORDER, SCENES } from '@topiapause/shared';
import { Bot, Mic, Send, ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { t } from '../copy';
import { useChatFlow } from '../lib/flow';
import { useApp, type ChatItem } from '../state';
import { SCENE_ICON } from './ActivityScreen';
import { GuardianCard } from './GuardianCard';
import { ReceiptCard } from './ReceiptCard';
import { IconButton, cx } from './ui';

function UbotBubble({ children }: { children: React.ReactNode }) {
  return (
    <div className="anim-fade flex items-end gap-2">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-navy text-aqua dark:bg-white dark:text-azure" aria-hidden="true">
        <Bot size={18} />
      </span>
      <div className="glass max-w-[85%] rounded-3xl rounded-bl-lg px-4 py-2.5 text-[15px] leading-relaxed">{children}</div>
    </div>
  );
}

function Item({ item }: { item: ChatItem }) {
  const { state } = useApp();
  const { choose, why } = useChatFlow();
  const { lang } = state;
  switch (item.type) {
    case 'user':
      return (
        <div className="anim-fade flex justify-end">
          <p className="max-w-[85%] rounded-3xl rounded-br-lg bg-gradient-to-br from-azure to-[#5b6cf0] px-4 py-2.5 text-[15px] leading-relaxed text-white shadow-md">
            {item.text}
          </p>
        </div>
      );
    case 'ubot':
      return <UbotBubble>{item.text}</UbotBubble>;
    case 'typing':
      return (
        <UbotBubble>
          <span className="flex h-5 items-center gap-1" aria-label="typing">
            {[0, 1, 2].map((i) => (
              <span key={i} className="typing-dot h-2 w-2 rounded-full bg-muted dark:bg-slate-300" />
            ))}
          </span>
        </UbotBubble>
      );
    case 'guard':
      return <GuardianCard run={item.run} lang={lang} onChoose={(c) => choose(item.run, c)} onWhy={(q) => why(item.run, q)} />;
    case 'guardNote':
      return (
        <div className="anim-fade flex items-start gap-2">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-sky to-peri text-white" aria-hidden="true">
            <ShieldCheck size={17} />
          </span>
          <div className="glass max-w-[85%] rounded-3xl rounded-tl-lg px-4 py-2.5 text-[15px] leading-relaxed">
            <p className="mb-0.5 text-xs font-bold text-azure dark:text-sky">{t(lang, 'guard')}</p>
            {item.text}
          </div>
        </div>
      );
    case 'receipt':
      return <ReceiptCard receipt={item.receipt} lang={lang} />;
  }
}

export function ChatScreen() {
  const { state } = useApp();
  const { send } = useChatFlow();
  const { lang } = state;
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);
  const busy = state.chat.some((c) => c.type === 'typing' || (c.type === 'guard' && (c.run.stage === 'checking' || c.run.stage === 'rechecking')));

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [state.chat]);

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
        <div className="mx-auto w-full max-w-3xl space-y-3 px-3 py-4 sm:px-4" aria-live="polite">
          <UbotBubble>{t(lang, 'greet')}</UbotBubble>
          {state.chat.map((item) => (
            <Item key={item.id} item={item} />
          ))}
          <div ref={endRef} />
        </div>
      </div>

      <div className="relative mx-auto w-full max-w-3xl px-3 pb-2 pt-2 before:pointer-events-none before:absolute before:inset-x-0 before:-top-6 before:bottom-0 before:-z-10 before:bg-gradient-to-t before:from-canvas before:via-canvas/85 before:to-transparent sm:px-4 dark:before:from-navy dark:before:via-navy/85">
        <p className="px-1 pb-1.5 text-xs font-semibold text-muted dark:text-slate-400">{t(lang, 'tryScene')}</p>
        <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 pb-2">
          {SCENE_ORDER.map((id) => {
            const Icon = SCENE_ICON[id];
            return (
              <button
                key={id}
                type="button"
                disabled={busy}
                onClick={() => send(SCENES[id].userText[lang], id)}
                className="glass inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-semibold transition duration-200 hover:-translate-y-0.5 disabled:opacity-50"
              >
                <Icon size={17} className="text-azure dark:text-sky" aria-hidden="true" />
                {SCENES[id].chip[lang]}
              </button>
            );
          })}
        </div>
        <form onSubmit={submit} className="glass flex items-center gap-1 rounded-3xl p-1.5">
          <IconButton label={t(lang, 'micSoon')} disabled>
            <Mic size={20} />
          </IconButton>
          <label className="sr-only" htmlFor="composer">
            {t(lang, 'placeholder')}
          </label>
          <input
            id="composer"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t(lang, 'placeholder')}
            autoComplete="off"
            className="min-h-11 min-w-0 flex-1 bg-transparent px-1 text-[16px] outline-none placeholder:text-muted/80 dark:placeholder:text-slate-400"
          />
          <button
            type="submit"
            aria-label={t(lang, 'send')}
            disabled={!text.trim() || busy}
            className={cx('btn-primary inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl')}
          >
            <Send size={19} aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
