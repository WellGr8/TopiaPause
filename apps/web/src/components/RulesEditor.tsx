import { fmtMoney, type Lang, type UserPolicy } from '@topiapause/shared';
import type { ReactNode } from 'react';
import { t } from '../copy';
import { Stepper, Toggle } from './ui';

export function RuleRow({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <li className="flex min-h-16 items-center gap-3 border-t border-line px-5 py-2 first:border-t-0">
      <div className="min-w-0 flex-1">
        <p className="font-medium leading-snug">{title}</p>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </li>
  );
}

const PAY_MIN_BAHT = 1;
const PAY_MAX_BAHT = 100_000;
const PAY_DEFAULT_BAHT = 1000;

function payBaht(policy: UserPolicy): number {
  const limit = policy.perPaymentLimit;
  if (!limit || limit.currency !== 'THB') return PAY_DEFAULT_BAHT;
  return Math.min(PAY_MAX_BAHT, Math.max(PAY_MIN_BAHT, Math.round(limit.minor / 100)));
}

export function RulesEditor({
  policy,
  lang,
  onChange,
}: {
  policy: UserPolicy;
  lang: Lang;
  onChange: (p: UserPolicy) => void;
}) {
  const cap = (policy.monthlySubscriptionCap?.minor ?? 30000) / 100;
  const tokenCap = Math.round((policy.tokenConcentrationCaps['TOKEN-X'] ?? 0.3) * 100);
  const payOn = policy.perPaymentLimit?.currency === 'THB';
  const baht = payBaht(policy);

  return (
    <ul>
      <RuleRow title={t(lang, 'payLimit')}>
        <div className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={PAY_MIN_BAHT}
            max={PAY_MAX_BAHT}
            step={1}
            disabled={!payOn}
            aria-label={t(lang, 'payLimitAmount')}
            value={payOn ? baht : ''}
            placeholder={String(PAY_DEFAULT_BAHT)}
            onChange={(e) => {
              const n = Math.round(Number(e.target.value));
              if (!Number.isInteger(n) || n < PAY_MIN_BAHT || n > PAY_MAX_BAHT) return;
              onChange({ ...policy, perPaymentLimit: { minor: n * 100, currency: 'THB' } });
            }}
            className="h-11 w-24 rounded-control border border-line bg-canvas px-2 text-right text-[17px] font-semibold tabular-nums disabled:opacity-40"
          />
          <Toggle
            label={t(lang, 'payLimit')}
            checked={payOn}
            onChange={(on) => {
              if (!on) {
                const { perPaymentLimit: _drop, ...rest } = policy;
                onChange(rest);
                return;
              }
              onChange({ ...policy, perPaymentLimit: { minor: baht * 100, currency: 'THB' } });
            }}
          />
        </div>
      </RuleRow>
      <RuleRow title={t(lang, 'blockAnnual')}>
        <Toggle label={t(lang, 'blockAnnual')} checked={policy.blockAnnualAutoRenew === true} onChange={(on) => onChange({ ...policy, blockAnnualAutoRenew: on })} />
      </RuleRow>
      <RuleRow title={t(lang, 'exactOnly')}>
        <Toggle label={t(lang, 'exactOnly')} checked={policy.approvalMode === 'exact'} onChange={(on) => onChange({ ...policy, approvalMode: on ? 'exact' : 'allow_unlimited' })} />
      </RuleRow>
      <RuleRow title={t(lang, 'rule1')} hint={t(lang, 'rule1Hint')}>
        <Stepper
          label={t(lang, 'rule1')}
          value={cap}
          step={50}
          min={100}
          max={2000}
          format={(v) => fmtMoney({ minor: Math.round(v * 100), currency: 'THB' })}
          onChange={(v) => onChange({ ...policy, monthlySubscriptionCap: { minor: Math.round(v * 100), currency: 'THB' } })}
        />
      </RuleRow>
      <RuleRow title={t(lang, 'rule2')} hint={t(lang, 'rule2Hint')}>
        <Stepper
          label={t(lang, 'rule2')}
          value={policy.maxRefundablePremiumPct}
          step={5}
          min={0}
          max={50}
          format={(v) => `+${v}%`}
          onChange={(v) => onChange({ ...policy, maxRefundablePremiumPct: v })}
        />
      </RuleRow>
      <RuleRow title={t(lang, 'rule3')} hint={t(lang, 'rule3Hint')}>
        <Stepper
          label={t(lang, 'rule3')}
          value={tokenCap}
          step={5}
          min={5}
          max={100}
          format={(v) => `${v}%`}
          onChange={(v) => onChange({ ...policy, tokenConcentrationCaps: { ...policy.tokenConcentrationCaps, 'TOKEN-X': v / 100 } })}
        />
      </RuleRow>
    </ul>
  );
}
