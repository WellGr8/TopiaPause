// Data contracts — mirrors docs/ARCHITECTURE.md §5.
// Money amounts in contracts are in MAJOR units (e.g. 3990 THB, 200.420883 USDT).
// The guard engine converts them to integer minor units before doing any math.

// ---- Money & common ----
export type Lang = 'th' | 'en';
export type Decision = 'allow' | 'pause' | 'block';
export type Currency = 'THB' | 'USD' | 'USDT';
export interface Money {
  amount: number;
  currency: Currency;
}

// ---- User policy (memory) ----
export interface UserPolicy {
  monthlySubscriptionCap?: Money;
  requireRefundableWhenFlexible: boolean;
  maxRefundablePremiumPct: number;
  tokenConcentrationCaps: Record<string, number>;
  approvalMode: 'exact' | 'allow_unlimited';
  oneTimeApprovalMaxExpirySec: number;
  unlockWarnPctOfCirculating?: number;
}

// ---- What the user meant (LLM-extracted, schema-validated) ----
export interface ActionIntent {
  goal: 'try_app' | 'book_stay' | 'swap_token' | 'other';
  commitment: 'trial' | 'once' | 'ongoing' | 'unspecified';
  priceSensitivity: 'cheap' | 'normal';
  flexibilityNeeded: boolean | 'unknown';
  budget?: Money;
  amount?: Money;
  fromAsset?: string;
  toAsset?: string;
  language: Lang;
  /** 0..1; < 0.7 -> pause (LOW_CONFIDENCE) */
  confidence: number;
  rawText: string;
}

// ---- What the agent is about to do ----
export type AgentProposal = SubscriptionProposal | StayProposal | TokenSwapProposal;
export type ProposalKind = AgentProposal['kind'];

export interface ProposalBase {
  proposalId: string;
  agent: { name: 'U-Bot (mock)' | 'U-Bot'; adapter: 'mock' | 'real' };
  /** Agent's own wording (display only, never used for decisions). */
  summary: string;
}

export interface SubscriptionPlan {
  planId: string;
  name?: string;
  price: Money;
  interval: 'month' | 'year';
  trialDays: number;
}

export interface SubscriptionProposal extends ProposalBase {
  kind: 'subscription';
  merchant: string;
  planId: string;
  planName?: string;
  price: Money;
  interval: 'month' | 'year';
  autoRenew: boolean;
  trialDays: number;
  catalogAlternatives: SubscriptionPlan[];
}

export interface StayAlternative {
  hotel: string;
  nightlyPrice?: Money;
  totalPrice: Money;
  refundable: boolean;
  freeCancelUntil?: string;
}

export interface StayProposal extends ProposalBase {
  kind: 'stay';
  hotel: string;
  nightlyPrice: Money;
  /** Total incl. mandatory fees. */
  totalPrice: Money;
  /** Price the agent showed the user. If lower than totalPrice -> STAY_HIDDEN_TOTAL. */
  quotedPrice?: Money;
  refundable: boolean;
  freeCancelUntil?: string;
  catalogAlternatives: StayAlternative[];
}

export interface TokenApproval {
  spender: string;
  type: 'exact' | 'unlimited';
  amount?: Money;
  expirySec?: number;
}

export interface Portfolio {
  totalUsd: number;
  holdingsUsd: Record<string, number>;
  balances: Record<string, number>;
}

export interface TokenSwapProposal extends ProposalBase {
  kind: 'token_swap';
  fromAsset: string;
  toAsset: string;
  amountIn: Money;
  /** f, e.g. 0.003 */
  feeRate: number;
  /** g, paid from a non-target asset */
  gasUsd: number;
  approval: TokenApproval;
  portfolio: Portfolio;
}

// ---- Guard output ----
export type RuleId =
  | 'SUB_COMMITMENT'
  | 'SUB_OVER_CAP'
  | 'STAY_FLEXIBILITY'
  | 'STAY_HIDDEN_TOTAL'
  | 'APPROVAL_SCOPE'
  | 'APPROVAL_EXPIRY'
  | 'CONC_CAP'
  | 'INSUFFICIENT_BALANCE'
  | 'INVALID_INPUT'
  | 'LOW_CONFIDENCE'
  | 'UNLOCK_SOON';

export type Evidence = Record<string, number | string | boolean>;

export interface Finding {
  ruleId: RuleId;
  severity: Decision;
  /** Engine-computed numbers only. */
  evidence: Evidence;
  messageKey: string;
}

export interface CounterOffer {
  proposal: AgentProposal;
  /** Must be 'allow' to be offered. */
  recheck: Decision;
  diff: Record<string, { from: number | string; to: number | string }>;
}

export interface Explanation {
  th: string;
  en: string;
  source: 'llm' | 'template';
}

export interface GuardVerdict {
  verdictId: string;
  decision: Decision;
  findings: Finding[];
  counterOffer?: CounterOffer;
  metrics: Record<string, number>;
  assumptions: string[];
  explanation: Explanation;
  voiceText: { th: string; en: string; clipId?: string };
  engineVersion: string;
}

// ---- Receipt ----
export type UserChoice = 'counter_offer' | 'original' | 'cancel';

export interface Execution {
  mode: 'mock' | 'testnet';
  status: 'success' | 'failed' | 'skipped';
  ref?: string;
}

export interface Receipt {
  receiptId: string;
  createdAt: string;
  language: Lang;
  userText: string;
  intent: ActionIntent;
  originalProposal: AgentProposal;
  verdict: GuardVerdict;
  userChoice: UserChoice;
  execution: Execution;
}

// ---- API (workers/api) ----
export type SceneId = 'subscription' | 'stay' | 'crypto';

export interface AgentChatRequest {
  sessionId: string;
  message: string;
  scene?: SceneId;
  policy: UserPolicy;
  lang: Lang;
}
export interface AgentChatResponse {
  reply: string;
  proposal?: AgentProposal;
  intent?: ActionIntent;
  source: 'llm' | 'scripted';
}

export interface GuardCheckRequest {
  userText: string;
  proposal: AgentProposal;
  policy: UserPolicy;
  lang: Lang;
  intent?: ActionIntent;
  followUp?: string;
}

export interface ExecuteRequest {
  proposal: AgentProposal;
  verdictId: string;
  userConfirmed: true;
}
export interface ExecuteResponse {
  execution: Execution;
}

export interface TtsRequest {
  text: string;
  lang: Lang;
  clipId?: string;
}

export interface ApiError {
  error: { code: string; message: string };
}

// ---- U-Bot adapter (§7) ----
export interface UBotAdapter {
  readonly label: 'U-Bot (mock)' | 'U-Bot';
  chat(input: { sessionId: string; message: string; scene?: SceneId; lang: Lang }): Promise<{
    reply: string;
    proposal?: AgentProposal;
    intent?: ActionIntent;
  }>;
  execute(input: { proposal: AgentProposal; verdictId: string; userConfirmed: true }): Promise<Execution>;
}
