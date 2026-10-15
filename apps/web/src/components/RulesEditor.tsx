import { fmtMoney, type Lang, type UserPolicy } from '@topiapause/shared';
import { BedDouble, Coins, Sparkles, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { t } from '../copy';
import { Stepper, Toggle, cx } from './ui';

function RuleCard({ icon: Icon, index, title, body, children, tint }: {
  icon: LucideIcon;
  index: number;
  title: string;
  body: string;
  children: ReactNode;
  tint: string;
}) {
  return (
    <li className="glass anim-card rounded-3xl p-4" style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex gap-3">
        <span className={cx('flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-white shadow-md', tint)}>
          <Icon size={22} strokeWidth={2} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted dark:text-slate-400">0{index + 1}</p>
          <h3 className="font-bold leading-snug">{title}</h3>
          <p className="mt-0.5 text-sm leading-relaxed text-muted dark:text-slate-300">{body}</p>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-end gap-2">{children}</div>
    </li>
  );
}

export function RulesEditor({ policy, lang, onChange }: { policy: UserPolicy; lang: Lang; onChange: (p: UserPolicy) => void }) {
  const cap = policy.monthlySubscriptionCap?.amount ?? 300;
  const tokenCap = Math.round((policy.tokenConcentrationCaps['TOKEN-X'] ?? 0.3) * 100);

  return (
    <ol className="space-y-3">
      <RuleCard icon={Sparkles} index={0} title={t(lang, 'rule1Title')} body={t(lang, 'rule1Body')} tint="bg-gradient-to-br from-sky to-azure">
        <Stepper
          label={t(lang, 'rule1Title')}
          value={cap}
          step={50}
          min={100}
          max={2000}
          format={(v) => `${fmtMoney({ amount: v, currency: 'THB' })}${t(lang, 'perMonth')}`}
          onChange={(v) => onChange({ ...policy, monthlySubscriptionCap: { amount: v, currency: 'THB' } })}
        />
      </RuleCard>

      <RuleCard icon={BedDouble} index={1} title={t(lang, 'rule2Title')} body={t(lang, 'rule2Body')} tint="bg-gradient-to-br from-peri to-azure">
        <Stepper
          label={t(lang, 'rule2Title')}
          value={policy.maxRefundablePremiumPct}
          step={5}
          min={0}
          max={50}
          format={(v) => `+${v}%`}
          onChange={(v) => onChange({ ...policy, maxRefundablePremiumPct: v })}
        />
        <Toggle
          label={t(lang, 'rule2Title')}
          checked={policy.requireRefundableWhenFlexible}
          onChange={(v) => onChange({ ...policy, requireRefundableWhenFlexible: v })}
        />
      </RuleCard>

      <RuleCard icon={Coins} index={2} title={t(lang, 'rule3Title')} body={t(lang, 'rule3Body')} tint="bg-gradient-to-br from-aqua to-sky">
        <Stepper
          label={t(lang, 'rule3Title')}
          value={tokenCap}
          step={5}
          min={5}
          max={100}
          format={(v) => `${v}%`}
          onChange={(v) => onChange({ ...policy, tokenConcentrationCaps: { ...policy.tokenConcentrationCaps, 'TOKEN-X': v / 100 } })}
        />
        <label className="flex items-center gap-1 text-sm font-medium">
          {t(lang, 'exactOnly')}
          <Toggle
            label={t(lang, 'exactOnly')}
            checked={policy.approvalMode === 'exact'}
            onChange={(v) => onChange({ ...policy, approvalMode: v ? 'exact' : 'allow_unlimited' })}
          />
        </label>
      </RuleCard>
    </ol>
  );
}
