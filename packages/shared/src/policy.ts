import type { UserPolicy } from './types';

export const DEFAULT_POLICY: UserPolicy = {
  monthlySubscriptionCap: { minor: 30000, currency: 'THB' },
  requireRefundableWhenFlexible: true,
  maxRefundablePremiumPct: 15,
  tokenConcentrationCaps: { 'TOKEN-X': 0.3 },
  approvalMode: 'exact',
  oneTimeApprovalMaxExpirySec: 900,
};
