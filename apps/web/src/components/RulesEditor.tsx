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

export function RulesEditor({
  policy,
  lang,
  onChange,
  extended = false,
}: {
  policy: UserPolicy;
  lang: Lang;
  onChange: (p: UserPolicy) => void;
  extended?: boolean;
}) {
  const cap = (policy.monthlySubscriptionCap?.minor ?? 30000) / 100;
  const tokenCap = Math.round((policy.tokenConcentrationCaps['TOKEN-X'] ?? 0.3) * 100);

  return (
    <ul>
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
      {extended && (
        <RuleRow title={t(lang, 'exactOnly')}>
          <Toggle
            label={t(lang, 'exactOnly')}
            checked={policy.approvalMode === 'exact'}
            onChange={(v) => onChange({ ...policy, approvalMode: v ? 'exact' : 'allow_unlimited' })}
          />
        </RuleRow>
      )}
    </ul>
  );
}
