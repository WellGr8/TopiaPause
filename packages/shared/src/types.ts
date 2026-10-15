// Data contracts — mirrors docs/ARCHITECTURE.md §5.
// Money is always an integer of minor units (satang, cents, micro-USDT); see money.ts for
// the rounding policy. Rates and percentages are not money and stay plain numbers.

// ---- Money & common ----
export type Lang = 'th' | 'en';
export type Decision = 'allow' | 'pause' | 'block';
export type Currency = 'THB' | 'USD' | 'USDT';
export interface Money {
  /** Integer minor units: 399000 THB = ฿3,990.00, 200420883 USDT = 200.420883 USDT. */
  minor: number;
  currency: Currency;
}

// ---- User policy (memory) ----
export interface UserPolicy {
  monthlySubscriptionCap?: Money;
  /**
   * Max one charge, in THB satang. Absent: no per-payment cap.
   * A charge strictly above this is paused. Exactly the limit is allowed.
   */
  perPaymentLimit?: Money;
  /** Pause a subscription that is annual or set to auto-renew. Off by default. */
  blockAnnualAutoRenew?: boolean;
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
  agent: { name: string; adapter: 'mock' | 'real' | 'external' };
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

/** Valued in USDT (USDT = $1 is a documented assumption). Balances only list assets the engine can spend. */
export interface Portfolio {
  total: Money;
  holdings: Record<string, Money>;
  balances: Record<string, Money>;
}

export interface TokenSwapProposal extends ProposalBase {
  kind: 'token_swap';
  fromAsset: string;
  toAsset: string;
  amountIn: Money;
  /** f in parts-per-million: 3000 = 0.3 % */
  feePpm: number;
  /** g, paid from a non-target asset, in the portfolio's valuation currency */
  gas: Money;
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
  | 'UNLOCK_SOON'
  | 'AGENT_FOLLOWED_UNTRUSTED'
  | 'FX_UNAVAILABLE'
  | 'USER_PAYMENT_LIMIT'
  | 'USER_BLOCK_ANNUAL';

export type Evidence = Record<string, number | string | boolean | Money>;

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
  diff: Record<string, { from: number | string | Money; to: number | string | Money }>;
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
  /** Non-money numbers only (percentages, days, minutes). */
  metrics: Record<string, number>;
  /**
   * Every money figure the verdict shows, exact. With a counter-offer:
   * `difference` = original − alternative (signed; negative when the safer option costs more),
   * `protected` = money no longer at risk (non-refundable total, upfront charge, swap kept out).
   */
  amounts: Record<string, Money>;
  /** Line items that reconcile to the shown alternative / savings to the minor unit. */
  breakdown: BreakdownSection[];
  /** Informational context (market data, injected instructions). Never changes the decision. */
  notes: RiskNote[];
  assumptions: string[];
  explanation: Explanation;
  voiceText: { th: string; en: string; clipId?: string };
  engineVersion: string;
  /** What the check cost to run. Set by the caller (Worker or browser), not by the pure engine. */
  check?: CheckMeta;
}

// ---- Receipt breakdown ----
export type BreakdownOp = 'add' | 'sub' | 'total';

export interface BreakdownLine {
  key: string;
  label: { th: string; en: string };
  amount: Money;
  op: BreakdownOp;
}

/** Σ add − Σ sub === total, exactly. Optional `fx` shows the total in another currency at a stated rate. */
export interface BreakdownSection {
  /** savings: difference > 0. extra: the safer option costs more. fees: same price, hidden fees surfaced. */
  key: 'alternative' | 'savings' | 'extra' | 'fees';
  title: { th: string; en: string };
  lines: BreakdownLine[];
  total: BreakdownLine;
  fx?: { amount: Money; rate: string; asOf: string; source: string };
}

// ---- Untrusted context ----
/** Content the agent read. Untrusted: it can only add a pause, never loosen a rule or the intent. */
export interface UntrustedSource {
  kind: 'web_page' | 'email' | 'tool_output';
  url?: string;
  text: string;
}

// ---- Context notes ----
export type DataSource = 'live' | 'cache' | 'recorded' | 'sample';

export interface UnlockEvent {
  /** Symbol the data is about (may be a real token mapped from a sandbox asset). */
  symbol: string;
  /** Sandbox asset this event is shown for, e.g. TOKEN-X -> ARB. */
  asset: string;
  unlockDate: string;
  /** Cliff unlock value as % of market cap. */
  valueToMarketCapPct: number;
  cliffValueUsd?: number;
}

export interface MarketData {
  unlocks: UnlockEvent[];
  source: DataSource;
  /** When the data was fetched or recorded. */
  asOf: string;
}

export interface RiskNote {
  kind: 'unlock' | 'injection';
  severity: 'info' | 'warn';
  text: { th: string; en: string };
  source?: DataSource;
  asOf?: string;
}

// ---- Cost meter ----
export interface CheckMeta {
  where: 'worker' | 'browser';
  engine: 'rules';
  llmCalls: number;
  externalCalls: number;
  cacheHit: boolean;
  /** Age of external data used, in seconds; null when none was used. */
  dataAge: number | null;
  /** ESTIMATE, rounded up to the satang. */
  estCostTHB_satang: number;
  latencyMs: number;
  estimate: true;
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
  /** The user's own message, verbatim; intent is derived from it server-side. */
  userMessage: string;
  proposal: AgentProposal;
  policyToken?: string;
  sources?: UntrustedSource[];
  lang: Lang;
}

/** Decimal string ("3990.00") or integer minor units. */
export type MoneyInput = { currency: Currency } & ({ value: string | number } | { minor: number });

/**
 * Agent-agnostic request any external agent can send to POST /api/guard/check.
 * Agents never send policy or intent: the policy comes from the user's signed token and the
 * intent is derived by TopiaPause from the user's own message.
 */
export interface GenericGuardRequest {
  agent: { name: string; version?: string };
  /** The user's own message, verbatim. */
  userMessage: string;
  action:
    | { type: 'subscribe'; merchant: string; plan: string; interval: 'month' | 'year'; autoRenew?: boolean; trialDays?: number }
    | { type: 'book'; hotel: string; refundable: boolean; freeCancelUntil?: string; shownPrice?: MoneyInput }
    | {
        type: 'swap';
        from: string;
        to: string;
        approval: { type: 'exact' | 'unlimited'; amount?: MoneyInput; expirySec?: number; spender?: string };
        feePpm?: number;
        gas?: MoneyInput;
        portfolio: { total: MoneyInput; holdings: Record<string, MoneyInput>; balances: Record<string, MoneyInput> };
      };
  amount: MoneyInput;
  /** Options the agent saw but didn't pick; the guard can only counter-offer from these. */
  alternatives?: Array<{ name: string; amount: MoneyInput; interval?: 'month' | 'year'; trialDays?: number; refundable?: boolean; freeCancelUntil?: string }>;
  /** What the agent read (page, email, tool output). Untrusted; scanned for instructions aimed at agents. */
  sources?: UntrustedSource[];
  /** Issued by POST /api/policy to the user's own app. */
  policyToken?: string;
  lang?: Lang;
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
  readonly label: 'AI assistant (demo)' | 'U-Bot';
  chat(input: { sessionId: string; message: string; scene?: SceneId; lang: Lang }): Promise<{
    reply: string;
    proposal?: AgentProposal;
    intent?: ActionIntent;
  }>;
  execute(input: { proposal: AgentProposal; verdictId: string; userConfirmed: true }): Promise<Execution>;
}
