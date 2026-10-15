import { fmtMoney, fmtNumber, type Lang, type UserPolicy } from '@topiapause/shared';
import { Check } from 'lucide-react';
import { useId, useState, type FormEvent } from 'react';
import { t, type CopyKey } from '../copy';
import { applyRule, parseRule, type ParsedRule, type ParseResult } from '../lib/rules';
import { Button, TextButton } from './ui';

export function describeRule(rule: ParsedRule, lang: Lang): string {
  switch (rule.kind) {
    case 'subscriptionCap': {
      const s = t(lang, 'ruleSubCap', { amount: fmtMoney({ amount: rule.amount, currency: 'THB' }) });
      return rule.fromYearly ? `${s} ${t(lang, 'ruleFromYearly')}` : s;
    }
    case 'refundablePremium':
      return t(lang, 'ruleRefund', { pct: fmtNumber(rule.pct, 1) });
    case 'tokenCap':
      return t(lang, 'ruleToken', { pct: fmtNumber(rule.pct, 1) });
  }
}

const ERROR: Record<Extract<ParseResult, { ok: false }>['reason'], CopyKey> = {
  empty: 'ruleErrEmpty',
  noTopic: 'ruleErrNoTopic',
  noNumber: 'ruleErrNoNumber',
  outOfRange: 'ruleErrRange',
};

type Status = { kind: 'idle' } | { kind: 'confirm'; rule: ParsedRule } | { kind: 'error'; key: CopyKey } | { kind: 'saved'; text: string };

/** "Tell TopiaPause your rule": deterministic parse, then an explicit confirm before the policy changes. */
export function RuleInput({ policy, lang, onChange }: { policy: UserPolicy; lang: Lang; onChange: (p: UserPolicy) => void }) {
  const id = useId();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<Status>({ kind: 'idle' });

  const read = (e: FormEvent) => {
    e.preventDefault();
    const r = parseRule(text);
    setStatus(r.ok ? { kind: 'confirm', rule: r.rule } : { kind: 'error', key: ERROR[r.reason] });
  };
  const confirm = (rule: ParsedRule) => {
    onChange(applyRule(policy, rule));
    setStatus({ kind: 'saved', text: describeRule(rule, lang) });
    setText('');
  };

  return (
    <section aria-labelledby={`${id}-label`}>
      <label id={`${id}-label`} htmlFor={`${id}-input`} className="mb-2 block px-1 text-sm text-muted">
        {t(lang, 'ruleTell')}
      </label>
      <form onSubmit={read} className="flex items-center gap-2 rounded-card border border-line bg-surface p-1.5 pl-4">
        <input
          id={`${id}-input`}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (status.kind !== 'idle') setStatus({ kind: 'idle' });
          }}
          placeholder={t(lang, 'rulePlaceholder')}
          autoComplete="off"
          className="min-h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-muted"
        />
        <Button type="submit" className="min-h-11 shrink-0 px-3 text-sm" disabled={!text.trim()}>
          {t(lang, 'ruleRead')}
        </Button>
      </form>

      <div aria-live="polite" className="mt-2 min-h-11 px-1">
        {status.kind === 'idle' && <p className="pt-1 text-xs text-muted">{t(lang, 'ruleTry')}</p>}
        {status.kind === 'error' && <p className="animate-enter pt-1 text-sm">{t(lang, status.key)}</p>}
        {status.kind === 'saved' && (
          <p className="animate-enter flex items-center gap-1.5 pt-1 text-sm text-allow">
            <Check size={16} aria-hidden="true" />
            {t(lang, 'ruleSaved', { rule: status.text })}
          </p>
        )}
        {status.kind === 'confirm' && (
          <div className="animate-enter flex items-center gap-2 rounded-card border border-line bg-surface py-1.5 pl-4 pr-1.5">
            <p className="min-w-0 flex-1 text-sm font-medium">{t(lang, 'ruleConfirmQ', { rule: describeRule(status.rule, lang) })}</p>
            <TextButton onClick={() => setStatus({ kind: 'idle' })}>{t(lang, 'ruleEdit')}</TextButton>
            <Button type="button" variant="primary" className="min-h-10 shrink-0 px-4 text-sm" onClick={() => confirm(status.rule)}>
              {t(lang, 'confirm')}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}
