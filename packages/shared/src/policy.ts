import type { UserPolicy } from './types';

export const DEFAULT_POLICY: UserPolicy = {
  monthlySubscriptionCap: { minor: 30000, currency: 'THB' },
  blockAnnualAutoRenew: false,
  requireRefundableWhenFlexible: true,
  maxRefundablePremiumPct: 15,
  tokenConcentrationCaps: { 'TOKEN-X': 0.3 },
  approvalMode: 'exact',
  oneTimeApprovalMaxExpirySec: 900,
};

/**
 * True when `next` is looser than `base` in any direction an agent would want:
 * a missing or higher spend cap, a dropped refundable rule, a higher premium or
 * token cap, unlimited approvals, or a longer one-time approval.
 */
export function policyLoosens(next: UserPolicy, base: UserPolicy = DEFAULT_POLICY): boolean {
  const cap = next.monthlySubscriptionCap;
  const baseCap = base.monthlySubscriptionCap;
  if (baseCap && (!cap || cap.currency !== baseCap.currency || cap.minor > baseCap.minor)) return true;
  const basePay = base.perPaymentLimit;
  const nextPay = next.perPaymentLimit;
  if (basePay && (!nextPay || nextPay.currency !== basePay.currency || nextPay.minor > basePay.minor)) return true;
  if (base.blockAnnualAutoRenew && !next.blockAnnualAutoRenew) return true;
  if (base.requireRefundableWhenFlexible && !next.requireRefundableWhenFlexible) return true;
  if (next.maxRefundablePremiumPct > base.maxRefundablePremiumPct) return true;
  for (const [asset, limit] of Object.entries(base.tokenConcentrationCaps)) {
    const n = next.tokenConcentrationCaps[asset];
    if (n === undefined || n > limit) return true;
  }
  if (base.approvalMode === 'exact' && next.approvalMode === 'allow_unlimited') return true;
  if (next.oneTimeApprovalMaxExpirySec > base.oneTimeApprovalMaxExpirySec) return true;
  return false;
}
