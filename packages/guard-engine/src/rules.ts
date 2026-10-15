import {
  CURRENCY_DECIMALS,
  describeCounter,
  type ActionIntent,
  type AgentProposal,
  type CounterOffer,
  type Finding,
  type Money,
  type StayProposal,
  type SubscriptionPlan,
  type SubscriptionProposal,
  type TokenSwapProposal,
  type UserPolicy,
} from '@topiapause/shared';
import { aMax, postTradeShare, withinCap } from './concentration';

export interface RuleResult {
  findings: Finding[];
  metrics: Record<string, number>;
  assumptions: { th: string; en: string }[];
  counter?: { proposal: AgentProposal; diff: CounterOffer['diff'] };
}

const minor = (m: Money) => Math.round(m.amount * 10 ** CURRENCY_DECIMALS[m.currency]);
const major = (n: number, m: Money) => n / 10 ** CURRENCY_DECIMALS[m.currency];
const round1 = (x: number) => Math.round(x * 10) / 10;
const validMoney = (m: Money | undefined) => !!m && Number.isFinite(m.amount) && m.amount > 0;

function invalid(field: string): RuleResult {
  return {
    findings: [{ ruleId: 'INVALID_INPUT', severity: 'block', evidence: { field }, messageKey: 'invalid_input' }],
    metrics: {},
    assumptions: [],
  };
}

// ---------------- Subscription ----------------

function monthlyMinor(p: { price: Money; interval: 'month' | 'year' }): number {
  const m = minor(p.price);
  return p.interval === 'year' ? Math.round(m / 12) : m;
}

export function subscriptionRules(intent: ActionIntent, p: SubscriptionProposal, policy: UserPolicy): RuleResult {
  if (!validMoney(p.price)) return invalid('price');
  const findings: Finding[] = [];
  const monthly = monthlyMinor(p);
  const metrics: Record<string, number> = {
    price: p.price.amount,
    monthlyEquivalent: major(monthly, p.price),
  };
  const looseCommitment = intent.commitment === 'trial' || intent.commitment === 'unspecified';

  if (looseCommitment && p.interval === 'year') {
    findings.push({
      ruleId: 'SUB_COMMITMENT',
      severity: 'pause',
      evidence: { price: p.price.amount, currency: p.price.currency, interval: p.interval, commitment: intent.commitment, autoRenew: p.autoRenew },
      messageKey: 'sub_commitment',
    });
  }

  const cap = policy.monthlySubscriptionCap;
  const capApplies = cap && cap.currency === p.price.currency;
  if (capApplies) metrics.cap = cap.amount;
  if (capApplies && monthly > minor(cap)) {
    findings.push({
      ruleId: 'SUB_OVER_CAP',
      severity: 'pause',
      evidence: { monthlyEquivalent: major(monthly, p.price), cap: cap.amount, price: p.price.amount, currency: p.price.currency },
      messageKey: 'sub_over_cap',
    });
  }

  const result: RuleResult = {
    findings,
    metrics,
    assumptions: [
      { th: 'ราคาจาก catalog จำลอง (sandbox)', en: 'Prices come from a mock catalog (sandbox).' },
      { th: 'เทียบรายปีเป็นรายเดือนโดยหาร 12', en: 'Annual price is compared per month (divided by 12).' },
    ],
  };
  if (findings.length === 0) return result;

  const fits = (a: SubscriptionPlan) =>
    a.price.currency === p.price.currency &&
    (!looseCommitment || a.interval === 'month') &&
    (!capApplies || monthlyMinor(a) <= minor(cap));
  const wantsTrial = intent.commitment === 'trial';
  const best = p.catalogAlternatives
    .filter(fits)
    .sort((a, b) => (wantsTrial ? Number(b.trialDays > 0) - Number(a.trialDays > 0) : 0) || minor(a.price) - minor(b.price))[0];

  if (best) {
    const proposal: SubscriptionProposal = {
      ...p,
      proposalId: `${p.proposalId}-counter`,
      planId: best.planId,
      planName: best.name ?? best.planId,
      price: best.price,
      interval: best.interval,
      trialDays: best.trialDays,
      summary: '',
    };
    proposal.summary = describeCounter(proposal, 'en');
    result.counter = {
      proposal,
      diff: {
        plan: { from: p.planName ?? p.planId, to: proposal.planName ?? proposal.planId },
        price: { from: p.price.amount, to: best.price.amount },
        interval: { from: p.interval, to: best.interval },
        trialDays: { from: p.trialDays, to: best.trialDays },
      },
    };
    metrics.counterPrice = best.price.amount;
    metrics.counterTrialDays = best.trialDays;
    const upfrontNow = best.trialDays > 0 ? 0 : best.price.amount;
    metrics.protectedAmount = Math.max(0, p.price.amount - upfrontNow);
    result.assumptions.push({ th: 'จะเตือนก่อนตัดเงินครั้งแรก', en: 'You get a reminder before the first charge.' });
  }
  return result;
}

// ---------------- Stay ----------------

export function stayRules(intent: ActionIntent, p: StayProposal, policy: UserPolicy): RuleResult {
  if (!validMoney(p.totalPrice) || !validMoney(p.nightlyPrice)) return invalid('totalPrice');
  const findings: Finding[] = [];
  const total = minor(p.totalPrice);
  const cur = p.totalPrice.currency;
  const metrics: Record<string, number> = { total: p.totalPrice.amount };
  let counter: RuleResult['counter'];

  const hiddenTotal = p.quotedPrice && p.quotedPrice.currency === cur && total > minor(p.quotedPrice);
  if (hiddenTotal && p.quotedPrice) {
    const fees = major(total - minor(p.quotedPrice), p.totalPrice);
    metrics.fees = fees;
    findings.push({
      ruleId: 'STAY_HIDDEN_TOTAL',
      severity: 'pause',
      evidence: { quoted: p.quotedPrice.amount, total: p.totalPrice.amount, fees, currency: cur },
      messageKey: 'stay_hidden_total',
    });
  }

  const needsRefundable = policy.requireRefundableWhenFlexible && intent.flexibilityNeeded !== false && !p.refundable;
  if (needsRefundable) {
    const best = p.catalogAlternatives
      .filter((a) => a.refundable && a.totalPrice.currency === cur)
      .sort((a, b) => minor(a.totalPrice) - minor(b.totalPrice))[0];
    const evidence: Finding['evidence'] = {
      total: p.totalPrice.amount,
      maxPremiumPct: policy.maxRefundablePremiumPct,
      hasRefundableOption: !!best,
      hasCounter: false,
      currency: cur,
    };
    if (best) {
      const premiumMinor = minor(best.totalPrice) - total;
      const premiumPct = round1((premiumMinor / total) * 100);
      const withinLimit = premiumMinor * 100 <= policy.maxRefundablePremiumPct * total;
      Object.assign(evidence, {
        refundableHotel: best.hotel,
        refundableTotal: best.totalPrice.amount,
        premium: major(premiumMinor, p.totalPrice),
        premiumPct,
        hasCounter: withinLimit,
        freeCancelUntil: best.freeCancelUntil ?? '',
      });
      metrics.refundableTotal = best.totalPrice.amount;
      metrics.premium = major(premiumMinor, p.totalPrice);
      metrics.premiumPct = premiumPct;
      if (withinLimit) {
        const proposal: StayProposal = {
          ...p,
          proposalId: `${p.proposalId}-counter`,
          hotel: best.hotel,
          nightlyPrice: best.nightlyPrice ?? best.totalPrice,
          totalPrice: best.totalPrice,
          quotedPrice: best.totalPrice,
          refundable: true,
          freeCancelUntil: best.freeCancelUntil,
          summary: '',
        };
        proposal.summary = describeCounter(proposal, 'en');
        counter = {
          proposal,
          diff: {
            hotel: { from: p.hotel, to: best.hotel },
            total: { from: p.totalPrice.amount, to: best.totalPrice.amount },
            refundable: { from: 'no', to: 'yes' },
          },
        };
        metrics.protectedAmount = p.totalPrice.amount;
      }
    }
    findings.push({ ruleId: 'STAY_FLEXIBILITY', severity: 'pause', evidence, messageKey: 'stay_flexibility' });
  } else if (hiddenTotal) {
    const proposal: StayProposal = { ...p, proposalId: `${p.proposalId}-counter`, quotedPrice: p.totalPrice };
    counter = { proposal, diff: { shownPrice: { from: p.quotedPrice!.amount, to: p.totalPrice.amount } } };
    metrics.protectedAmount = metrics.fees ?? 0;
  }

  return {
    findings,
    metrics,
    counter,
    assumptions: [
      { th: 'ราคารวมภาษีและค่าธรรมเนียมบังคับแล้ว', en: 'Totals include taxes and mandatory fees.' },
      { th: 'ห้องและราคาจาก catalog จำลอง (sandbox)', en: 'Rooms and prices come from a mock catalog (sandbox).' },
    ],
  };
}

// ---------------- Token swap ----------------

export function swapRules(intent: ActionIntent, p: TokenSwapProposal, policy: UserPolicy): RuleResult {
  const a = p.amountIn.amount;
  if (!Number.isFinite(a) || a <= 0) return invalid('amountIn');
  if (!Number.isFinite(p.feeRate) || p.feeRate < 0 || p.feeRate >= 1) return invalid('feeRate');
  if (!Number.isFinite(p.gasUsd) || p.gasUsd < 0) return invalid('gasUsd');
  if (!Number.isFinite(p.portfolio.totalUsd) || p.portfolio.totalUsd <= 0) return invalid('portfolio');

  const findings: Finding[] = [];
  const balance = p.portfolio.balances[p.fromAsset] ?? 0;
  const V = p.portfolio.totalUsd;
  const H = p.portfolio.holdingsUsd[p.toAsset] ?? 0;
  const metrics: Record<string, number> = {
    amountIn: a,
    balance,
    portfolioUsd: V,
    holdingUsd: H,
    feePct: Math.round(p.feeRate * 10_000) / 100,
    gasUsd: p.gasUsd,
  };

  if (a > balance) {
    findings.push({
      ruleId: 'INSUFFICIENT_BALANCE',
      severity: 'block',
      evidence: { amountIn: a, balance, asset: p.fromAsset },
      messageKey: 'insufficient_balance',
    });
  }

  const cap = policy.tokenConcentrationCaps[p.toAsset];
  let newAmount = a;
  let concBreached = false;
  if (cap !== undefined) {
    const base = { portfolioUsd: V, holdingUsd: H, feeRate: p.feeRate, gasUsd: p.gasUsd };
    const share = postTradeShare(base, a);
    const max = aMax({ ...base, balance, cap });
    metrics.postTradeSharePct = round1(share * 100);
    metrics.capPct = round1(cap * 100);
    metrics.capUsd = Math.round(cap * V * 100) / 100;
    metrics.aMaxUsd = max;
    if (!withinCap({ ...base, cap }, a)) {
      concBreached = true;
      newAmount = Math.min(a, max);
      findings.push({
        ruleId: 'CONC_CAP',
        severity: max === 0 ? 'block' : 'pause',
        evidence: {
          asset: p.toAsset,
          postTradeSharePct: metrics.postTradeSharePct,
          capPct: metrics.capPct,
          capUsd: metrics.capUsd,
          aMax: max,
          amountIn: a,
          portfolioUsd: V,
          holdingUsd: H,
          feePct: metrics.feePct,
          gasUsd: p.gasUsd,
        },
        messageKey: 'conc_cap',
      });
    }
  }

  const once = intent.commitment === 'once';
  const ap = p.approval;
  const overApproved = ap.type === 'unlimited' || (ap.amount !== undefined && ap.amount.amount > a);
  if (overApproved && (once || (ap.type === 'unlimited' && policy.approvalMode === 'exact'))) {
    findings.push({
      ruleId: 'APPROVAL_SCOPE',
      severity: 'pause',
      evidence: { asset: p.fromAsset, amountIn: a, approvalType: ap.type, commitment: intent.commitment },
      messageKey: 'approval_scope',
    });
  }
  const maxExp = policy.oneTimeApprovalMaxExpirySec;
  if (once && (ap.expirySec === undefined || ap.expirySec > maxExp)) {
    findings.push({
      ruleId: 'APPROVAL_EXPIRY',
      severity: 'pause',
      evidence: { expirySec: ap.expirySec ?? 'none', maxExpirySec: maxExp, maxExpiryMin: maxExp / 60 },
      messageKey: 'approval_expiry',
    });
  }

  const result: RuleResult = {
    findings,
    metrics,
    assumptions: [
      { th: 'USDT = $1 และไม่มี slippage (กรณีแย่สุดต่อเพดาน)', en: 'USDT = $1, zero slippage (worst case for the cap).' },
      { th: 'ค่า gas จ่ายจากสินทรัพย์อื่น', en: 'Gas is paid from a non-target asset.' },
      { th: 'ทำรายการจำลองเท่านั้น ไม่ใช่คำแนะนำการลงทุน', en: 'Mock execution only. Not financial advice.' },
    ],
  };

  const blocked = findings.some((f) => f.severity === 'block');
  if (findings.length > 0 && !blocked && newAmount > 0) {
    const expiry = once ? Math.min(ap.expirySec ?? maxExp, maxExp) : ap.expirySec;
    const proposal: TokenSwapProposal = {
      ...p,
      proposalId: `${p.proposalId}-counter`,
      amountIn: { ...p.amountIn, amount: newAmount },
      approval: { spender: ap.spender, type: 'exact', amount: { ...p.amountIn, amount: newAmount }, expirySec: expiry },
      summary: '',
    };
    proposal.summary = describeCounter(proposal, 'en');
    const diff: CounterOffer['diff'] = {};
    if (newAmount !== a) diff.amountIn = { from: a, to: newAmount };
    if (ap.type !== 'exact' || ap.amount?.amount !== newAmount) {
      diff.approval = { from: ap.type === 'unlimited' ? 'unlimited' : ap.amount?.amount ?? a, to: newAmount };
    }
    if (expiry !== ap.expirySec) diff.expirySec = { from: ap.expirySec ?? 'none', to: expiry ?? 'none' };
    result.counter = { proposal, diff };
    metrics.counterAmountIn = newAmount;
    if (expiry !== undefined) metrics.counterExpiryMin = expiry / 60;
    if (cap !== undefined) {
      metrics.counterSharePct = round1(
        postTradeShare({ portfolioUsd: V, holdingUsd: H, feeRate: p.feeRate, gasUsd: p.gasUsd }, newAmount) * 100,
      );
    }
    metrics.protectedAmount = concBreached ? Math.round((a - newAmount) * 100) / 100 : 0;
  }
  return result;
}

export function confidenceRule(intent: ActionIntent): Finding[] {
  if (Number.isFinite(intent.confidence) && intent.confidence >= 0.7) return [];
  return [
    {
      ruleId: 'LOW_CONFIDENCE',
      severity: 'pause',
      evidence: { confidencePct: Math.round((intent.confidence || 0) * 100) },
      messageKey: 'low_confidence',
    },
  ];
}