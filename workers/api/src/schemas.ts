import { z } from 'zod';

// Request validation for the public API. Shapes mirror packages/shared/src/types.ts;
// the engine re-validates numbers (INVALID_INPUT) but nothing unparsed reaches it.
// Money is always integer minor units (satang, cents, micro-USDT): no floats on the wire.

const str = (max = 200) => z.string().max(max);
const MAX_MINOR = 1e15;

export const Lang = z.enum(['th', 'en']);
export const Scene = z.enum(['subscription', 'stay', 'crypto']);
export const Currency = z.enum(['THB', 'USD', 'USDT']);
export const Money = z.object({ minor: z.number().int().min(0).max(MAX_MINOR), currency: Currency });

/** Agents may send either integer minor units or an exact decimal string ("3990.00"). */
export const MoneyInput = z.union([
  z.object({ minor: z.number().int().min(0).max(MAX_MINOR), currency: Currency }),
  z.object({ value: z.union([z.string().max(40), z.number().finite().nonnegative()]), currency: Currency }),
]);

const Agent = z.object({ name: z.string().min(1).max(80), adapter: z.enum(['mock', 'real', 'external']) });
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

const Approval = z.object({
  spender: str(),
  type: z.enum(['exact', 'unlimited']),
  amount: Money.optional(),
  expirySec: z.number().int().nonnegative().max(31_536_000).optional(),
});

export const TokenSwapProposal = z.object({
  ...Base,
  kind: z.literal('token_swap'),
  fromAsset: str(20),
  toAsset: str(20),
  amountIn: Money,
  /** Fee in parts per million (3000 = 0.3 %). */
  feePpm: z.number().int().min(0).max(500_000),
  gas: Money,
  approval: Approval,
  portfolio: z.object({
    total: Money,
    holdings: z.record(str(20), Money),
    balances: z.record(str(20), Money),
  }),
});

export const AgentProposal = z.discriminatedUnion('kind', [SubscriptionProposal, StayProposal, TokenSwapProposal]);

/** Only accepted by POST /api/policy (the user's own app), never from an agent. */
export const UserPolicy = z.object({
  monthlySubscriptionCap: Money.optional(),
  requireRefundableWhenFlexible: z.boolean(),
  maxRefundablePremiumPct: z.number().finite().min(0).max(1000),
  tokenConcentrationCaps: z.record(str(20), z.number().finite().min(0).max(1)),
  approvalMode: z.enum(['exact', 'allow_unlimited']),
  oneTimeApprovalMaxExpirySec: z.number().int().positive().max(31_536_000),
  unlockWarnPctOfCirculating: z.number().finite().min(0).max(100).optional(),
});

export const PolicyRequest = z.object({
  policy: UserPolicy,
});

export const ConfirmRequest = z.object({
  verdictId: z.string().min(1).max(2000),
  /** Only the counter-offer. The paused original is not confirmable through the API. */
  choice: z.enum(['original', 'counter_offer']),
});

/** Untrusted content the agent read. Can only add a pause; never loosens a rule or the intent. */
export const Sources = z
  .array(z.object({ kind: z.enum(['web_page', 'email', 'tool_output']), url: z.string().max(500).optional(), text: z.string().max(8000) }))
  .max(10)
  .optional();

const common = {
  /** The user's own message, verbatim. TopiaPause derives intent from it; agents cannot supply intent. */
  userMessage: z.string().trim().min(1).max(1000),
  /** Signed by POST /api/policy for the user's app. Absent: the default demo policy. */
  policyToken: z.string().max(4000).optional(),
  sources: Sources,
  lang: Lang.default('th'),
};

/** Full internal proposal (what U-Bot sends). */
export const ProposalCheck = z.object({ ...common, proposal: AgentProposal });

const Alternative = z.object({
  name: str(),
  amount: MoneyInput,
  interval: z.enum(['month', 'year']).optional(),
  trialDays: z.number().int().min(0).max(365).optional(),
  refundable: z.boolean().optional(),
  freeCancelUntil: isoDate.optional(),
});

export const GenericAction = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('subscribe'),
    merchant: str(),
    plan: str(),
    interval: z.enum(['month', 'year']),
    autoRenew: z.boolean().default(true),
    trialDays: z.number().int().min(0).max(365).default(0),
  }),
  z.object({
    type: z.literal('book'),
    hotel: str(),
    refundable: z.boolean(),
    freeCancelUntil: isoDate.optional(),
    /** Price the agent showed the user, if different from `amount` (the real total). */
    shownPrice: MoneyInput.optional(),
  }),
  z.object({
    type: z.literal('swap'),
    from: str(20),
    to: str(20),
    approval: z.object({
      type: z.enum(['exact', 'unlimited']),
      amount: MoneyInput.optional(),
      expirySec: z.number().int().nonnegative().max(31_536_000).optional(),
      spender: str().optional(),
    }),
    feePpm: z.number().int().min(0).max(500_000).default(0),
    gas: MoneyInput.optional(),
    portfolio: z.object({
      total: MoneyInput,
      holdings: z.record(str(20), MoneyInput),
      balances: z.record(str(20), MoneyInput),
    }),
  }),
]);

/** Agent-agnostic form any external agent can send. */
export const GenericCheck = z.object({
  ...common,
  agent: z.object({ name: str(80), version: str(40).optional() }),
  action: GenericAction,
  amount: MoneyInput,
  alternatives: z.array(Alternative).max(20).default([]),
});

export const GuardCheckRequest = z.union([ProposalCheck, GenericCheck]);

export const AgentChatRequest = z.object({
  sessionId: str().default(''),
  message: z.string().trim().min(1).max(1000),
  scene: Scene.optional(),
  lang: Lang.default('th'),
});

export const ExecuteRequest = z.object({
  proposal: AgentProposal,
  verdictId: z.string().min(1).max(2000),
  userConfirmed: z.literal(true),
  /** Issued by POST /api/confirm. Required when the verdict paused. */
  confirmation: z.string().min(1).max(2000).optional(),
});

export const TtsRequest = z
  .object({
    clipId: z.string().trim().min(1).max(80).optional(),
    text: z.string().trim().min(1).max(300).optional(),
    lang: Lang.default('th'),
  })
  .refine((b) => Boolean(b.clipId || b.text), { message: 'clipId or text is required' });

/** Bilingual paraphrase of a guard explanation. The number lock still has to accept it. */
export const ExplainDraft = z.object({
  th: z.string().trim().min(1).max(800),
  en: z.string().trim().min(1).max(800),
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
