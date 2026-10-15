import { z } from 'zod';

// Request validation for the public API. Shapes mirror packages/shared/src/types.ts;
// the engine re-validates numbers (INVALID_INPUT) but nothing unparsed reaches it.

const str = (max = 200) => z.string().max(max);
const amount = z.number().finite().nonnegative().max(1e12);

export const Lang = z.enum(['th', 'en']);
export const Scene = z.enum(['subscription', 'stay', 'crypto']);
export const Money = z.object({ amount, currency: z.enum(['THB', 'USD', 'USDT']) });

const Agent = z.object({ name: z.enum(['U-Bot (mock)', 'U-Bot']), adapter: z.enum(['mock', 'real']) });
const Base = { proposalId: str(), agent: Agent, summary: str(500).default('') };

export const SubscriptionProposal = z.object({
  ...Base,
  kind: z.literal('subscription'),
  merchant: str(),
  planId: str(),
  planName: str().optional(),
  price: Money,
  interval: z.enum(['month', 'year']),
  autoRenew: z.boolean(),
  trialDays: z.number().int().min(0).max(365),
  catalogAlternatives: z
    .array(
      z.object({
        planId: str(),
        name: str().optional(),
        price: Money,
        interval: z.enum(['month', 'year']),
        trialDays: z.number().int().min(0).max(365),
      }),
    )
    .max(20)
    .default([]),
});

const isoDate = z.string().max(40).refine((s) => !Number.isNaN(Date.parse(s)), 'Expected an ISO date');

export const StayProposal = z.object({
  ...Base,
  kind: z.literal('stay'),
  hotel: str(),
  nightlyPrice: Money,
  totalPrice: Money,
  quotedPrice: Money.optional(),
  refundable: z.boolean(),
  freeCancelUntil: isoDate.optional(),
  catalogAlternatives: z
    .array(
      z.object({
        hotel: str(),
        nightlyPrice: Money.optional(),
        totalPrice: Money,
        refundable: z.boolean(),
        freeCancelUntil: isoDate.optional(),
      }),
    )
    .max(20)
    .default([]),
});

export const TokenSwapProposal = z.object({
  ...Base,
  kind: z.literal('token_swap'),
  fromAsset: str(20),
  toAsset: str(20),
  amountIn: Money,
  feeRate: z.number().finite().min(0).max(0.5),
  gasUsd: amount,
  approval: z.object({
    spender: str(),
    type: z.enum(['exact', 'unlimited']),
    amount: Money.optional(),
    expirySec: z.number().int().nonnegative().max(31_536_000).optional(),
  }),
  portfolio: z.object({
    totalUsd: amount,
    holdingsUsd: z.record(str(20), amount),
    balances: z.record(str(20), amount),
  }),
});

export const AgentProposal = z.discriminatedUnion('kind', [SubscriptionProposal, StayProposal, TokenSwapProposal]);

export const UserPolicy = z.object({
  monthlySubscriptionCap: Money.optional(),
  requireRefundableWhenFlexible: z.boolean(),
  maxRefundablePremiumPct: z.number().finite().min(0).max(1000),
  tokenConcentrationCaps: z.record(str(20), z.number().finite().min(0).max(1)),
  approvalMode: z.enum(['exact', 'allow_unlimited']),
  oneTimeApprovalMaxExpirySec: z.number().int().positive().max(31_536_000),
  unlockWarnPctOfCirculating: z.number().finite().min(0).max(100).optional(),
});

export const ActionIntent = z.object({
  goal: z.enum(['try_app', 'book_stay', 'swap_token', 'other']),
  commitment: z.enum(['trial', 'once', 'ongoing', 'unspecified']),
  priceSensitivity: z.enum(['cheap', 'normal']),
  flexibilityNeeded: z.union([z.boolean(), z.literal('unknown')]),
  budget: Money.optional(),
  amount: Money.optional(),
  fromAsset: str(20).optional(),
  toAsset: str(20).optional(),
  language: Lang,
  confidence: z.number().min(0).max(1),
  rawText: str(1000),
});

export const GuardCheckRequest = z.object({
  userText: z.string().min(1).max(1000),
  proposal: AgentProposal,
  /** Defaults to the demo policy (cap ฿300, refundable premium 15%, TOKEN-X 30%, exact approvals). */
  policy: UserPolicy.optional(),
  lang: Lang.default('th'),
  intent: ActionIntent.optional(),
});

export const AgentChatRequest = z.object({
  sessionId: str().default(''),
  message: z.string().trim().min(1).max(1000),
  scene: Scene.optional(),
  lang: Lang.default('th'),
});

export const ExecuteRequest = z.object({
  proposal: AgentProposal,
  verdictId: z.string().min(1).max(200),
  userConfirmed: z.literal(true),
});

export const TtsRequest = z.object({
  text: z.string().trim().min(1).max(600),
  lang: Lang.default('th'),
});

/** What the LLM-backed U-Bot must return. */
export const LlmTurn = z.object({
  reply: z.string().min(1).max(600),
  scene: Scene.nullable(),
  proposal: AgentProposal.nullable().optional(),
});

export function issues(e: z.ZodError): string {
  return e.issues
    .slice(0, 5)
    .map((i) => `${i.path.join('.') || '(body)'}: ${i.message}`)
    .join('; ');
}
