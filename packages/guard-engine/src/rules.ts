import {
  DEMO_FX_USDT_THB,
  DEMO_FX_USD_THB,
  ROUNDING,
  convert,
  describeCounter,
  divRound,
  money,
  pctTenths,
  sub,
  toPpm,
  type ActionIntent,
  type AgentProposal,
  type BreakdownLine,
  type BreakdownSection,
  type CounterOffer,
  type Currency,
  type Finding,
  type FxRate,
  type Money,
  type StayProposal,
  type SubscriptionPlan,
  type SubscriptionProposal,
  type TokenSwapProposal,
  type UserPolicy,
} from '@topiapause/shared';
import { PPM, aMaxMicro, aMaxUnclamped, postTradeParts, withinCap } from './concentration';

export interface RuleResult {
  findings: Finding[];
  metrics: Record<string, number>;
  amounts: Record<string, Money>;
  breakdown: BreakdownSection[];
  assumptions: { th: string; en: string }[];
  counter?: { proposal: AgentProposal; diff: CounterOffer['diff'] };
}

export const DEFAULT_FX: FxRate[] = [DEMO_FX_USD_THB, DEMO_FX_USDT_THB];

const B = (m: Money) => BigInt(m.minor);
const validMoney = (m: Money | undefined): m is Money => !!m && Number.isSafeInteger(m.minor) && m.minor > 0;
const L = (key: string, th: string, en: string, amount: Money, op: BreakdownLine['op']): BreakdownLine => ({ key, label: { th, en }, amount, op });

function invalid(field: string): RuleResult {
  return {
    findings: [{ ruleId: 'INVALID_INPUT', severity: 'block', evidence: { field }, messageKey: 'invalid_input' }],
    metrics: {},
    amounts: {},
    breakdown: [],
    assumptions: [],
  };
}

function findFx(fx: FxRate[], from: Currency, to: Currency): FxRate | undefined {
  return fx.find((r) => r.base === from && r.quote === to);
}

/** Shows a non-THB total in THB at the stated rate (rounded once, half-even). */
function withThb(section: BreakdownSection, fx: FxRate[]): BreakdownSection {
  const cur = section.total.amount.currency;
  const rate = cur === 'THB' ? undefined : findFx(fx, cur, 'THB');
  if (!rate) return section;
  return { ...section, fx: { amount: convert(section.total.amount, rate), rate: rate.rate, asOf: rate.asOf, source: rate.source } };
}

/**
 * Original − alternative, the same figure the "saved this month" hero sums. Positive: a `savings`
 * section. Negative (the safer option costs more): an `extra` section showing what protection costs.
 */
function differenceSection(
  original: { amount: Money; th: string; en: string },
  alternative: { amount: Money; th: string; en: string },
  extraLabel: { th: string; en: string },
  amounts: Record<string, Money>,
  fx: FxRate[],
): BreakdownSection | undefined {
  if (original.amount.currency !== alternative.amount.currency) return undefined;
  const diff = sub(original.amount, alternative.amount);
  amounts.difference = diff;
  if (diff.minor === 0) return undefined;
  const o = (op: BreakdownLine['op']) => L('original', original.th, original.en, original.amount, op);
  const a = (op: BreakdownLine['op']) => L('alternative', alternative.th, alternative.en, alternative.amount, op);
  if (diff.minor > 0) {
    return withThb(
      { key: 'savings', title: { th: 'ส่วนต่างจากที่ agent เลือก', en: "Difference from the agent's pick" }, lines: [o('add'), a('sub')], total: L('saved', 'ประหยัด', 'You save', diff, 'total') },
      fx,
    );
  }
  return withThb(
    { key: 'extra', title: { th: 'ค่าความคุ้มครอง', en: 'What protection costs' }, lines: [a('add'), o('sub')], total: L('extra', extraLabel.th, extraLabel.en, money(-diff.minor, diff.currency), 'total') },
    fx,
  );
}

// ---------------- Subscription ----------------

/** Price per month in the cap's currency: convert once (half-even), then split a year by 12 (half-even). */
function monthlyIn(p: { price: Money; interval: 'month' | 'year' }, currency: Currency, fx: FxRate[]): Money | undefined {
  let price = p.price;
  if (price.currency !== currency) {
    const rate = findFx(fx, price.currency, currency);
    if (!rate) return undefined;
    price = convert(price, rate);
  }
  return p.interval === 'year' ? money(divRound(B(price), 12n, ROUNDING.conversion), currency) : price;
}

export function subscriptionRules(intent: ActionIntent, p: SubscriptionProposal, policy: UserPolicy, fx: FxRate[] = DEFAULT_FX): RuleResult {
  if (!validMoney(p.price)) return invalid('price');
  const findings: Finding[] = [];
  const amounts: Record<string, Money> = { price: p.price };
  const metrics: Record<string, number> = {};
  const looseCommitment = intent.commitment === 'trial' || intent.commitment === 'unspecified';
  const assumptions = [
    { th: 'ราคาจาก catalog จำลอง (sandbox)', en: 'Prices come from a mock catalog (sandbox).' },
    { th: 'เทียบรายปีเป็นรายเดือนโดยหาร 12', en: 'Annual price is compared per month (divided by 12).' },
  ];

  if (looseCommitment && p.interval === 'year') {
    findings.push({
      ruleId: 'SUB_COMMITMENT',
      severity: 'pause',
      evidence: { price: p.price, interval: p.interval, commitment: intent.commitment, autoRenew: p.autoRenew },
      messageKey: 'sub_commitment',
    });
  }

  const cap = policy.monthlySubscriptionCap;
  const monthly = cap ? monthlyIn(p, cap.currency, fx) : undefined;
  const rate = cap && p.price.currency !== cap.currency ? findFx(fx, p.price.currency, cap.currency) : undefined;
  if (cap && monthly) {
    amounts.cap = cap;
    amounts.monthlyEquivalent = monthly;
    if (rate) {
      amounts.priceInCapCurrency = convert(p.price, rate);
      assumptions.push({
        th: `แปลง ${p.price.currency} เป็น ${cap.currency} ที่ ${rate.rate} (${rate.source}, ${rate.asOf})`,
        en: `${p.price.currency} converted to ${cap.currency} at ${rate.rate} (${rate.source}, ${rate.asOf}).`,
      });
    }
    if (monthly.minor > cap.minor) {
      findings.push({
        ruleId: 'SUB_OVER_CAP',
        severity: 'pause',
        evidence: { monthlyEquivalent: monthly, cap, price: p.price, ...(rate ? { fxRate: rate.rate, priceCurrency: p.price.currency } : {}) },
        messageKey: 'sub_over_cap',
      });
    }
  } else if (cap) {
    findings.push({
      ruleId: 'FX_UNAVAILABLE',
      severity: 'pause',
      evidence: { priceCurrency: p.price.currency, capCurrency: cap.currency },
      messageKey: 'fx_unavailable',
    });
    assumptions.push({ th: `ไม่มีอัตราแลกเปลี่ยน ${p.price.currency}→${cap.currency} จึงไม่ได้เทียบงบ`, en: `No ${p.price.currency}→${cap.currency} rate, so the cap was not applied.` });
  }

  const result: RuleResult = { findings, metrics, amounts, breakdown: [], assumptions };
  if (findings.length === 0) return result;

  const fitsCap = (a: SubscriptionPlan) => {
    if (!cap) return true;
    const m = monthlyIn(a, cap.currency, fx);
    return !!m && m.minor <= cap.minor;
  };
  const fits = (a: SubscriptionPlan) => validMoney(a.price) && (!looseCommitment || a.interval === 'month') && fitsCap(a);
  const wantsTrial = intent.commitment === 'trial';
  const cmp = (a: SubscriptionPlan, b: SubscriptionPlan) => {
    const ma = (cap && monthlyIn(a, cap.currency, fx)?.minor) ?? a.price.minor;
    const mb = (cap && monthlyIn(b, cap.currency, fx)?.minor) ?? b.price.minor;
    return (wantsTrial ? Number(b.trialDays > 0) - Number(a.trialDays > 0) : 0) || ma - mb;
  };
  const best = p.catalogAlternatives.filter(fits).sort(cmp)[0];
  if (!best) return result;

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
      price: { from: p.price, to: best.price },
      interval: { from: p.interval, to: best.interval },
      trialDays: { from: p.trialDays, to: best.trialDays },
    },
  };
  amounts.counterPrice = best.price;
  metrics.counterTrialDays = best.trialDays;
  result.assumptions.push({ th: 'จะเตือนก่อนตัดเงินครั้งแรก', en: 'You get a reminder before the first charge.' });

  // `protected`: the agent's upfront charge that no longer leaves the account today.
  if (best.price.currency === p.price.currency) {
    const upfront = best.trialDays > 0 ? money(0, p.price.currency) : best.price;
    if (p.price.minor > upfront.minor) amounts.protected = sub(p.price, upfront);
  }
  const name = p.planName ?? p.planId;
  const alt = proposal.planName ?? proposal.planId;
  const per = (i: 'month' | 'year') => (i === 'year' ? { th: 'ต่อปี', en: 'per year' } : { th: 'ต่อเดือน', en: 'per month' });
  const trial = best.trialDays > 0 ? { th: ` หลังทดลองฟรี ${best.trialDays} วัน`, en: ` after a ${best.trialDays}-day free trial` } : { th: '', en: '' };
  const section = differenceSection(
    { amount: p.price, th: `${name} ${per(p.interval).th}`, en: `${name}, ${per(p.interval).en}` },
    { amount: best.price, th: `${alt} ${per(best.interval).th}${trial.th}`, en: `${alt}, ${per(best.interval).en}${trial.en}` },
    { th: 'จ่ายเพิ่ม', en: 'You pay extra' },
    amounts,
    fx,
  );
  if (section) result.breakdown.push(section);
  return result;
}

// ---------------- Stay ----------------

export function stayRules(intent: ActionIntent, p: StayProposal, policy: UserPolicy, fx: FxRate[] = DEFAULT_FX): RuleResult {
  if (!validMoney(p.totalPrice) || !validMoney(p.nightlyPrice)) return invalid('totalPrice');
  const findings: Finding[] = [];
  const total = p.totalPrice;
  const cur = total.currency;
  const amounts: Record<string, Money> = { total };
  const metrics: Record<string, number> = {};
  const breakdown: BreakdownSection[] = [];
  let counter: RuleResult['counter'];

  const quoted = p.quotedPrice && p.quotedPrice.currency === cur ? p.quotedPrice : undefined;
  const fees = quoted && total.minor > quoted.minor ? sub(total, quoted) : undefined;
  if (quoted && fees) {
    amounts.fees = fees;
    findings.push({ ruleId: 'STAY_HIDDEN_TOTAL', severity: 'pause', evidence: { quoted, total, fees }, messageKey: 'stay_hidden_total' });
  }

  const needsRefundable = policy.requireRefundableWhenFlexible && intent.flexibilityNeeded !== false && !p.refundable;
  if (needsRefundable) {
    const best = p.catalogAlternatives
      .filter((a) => a.refundable && validMoney(a.totalPrice) && a.totalPrice.currency === cur)
      .sort((a, b) => a.totalPrice.minor - b.totalPrice.minor)[0];
    const evidence: Finding['evidence'] = {
      total,
      maxPremiumPct: policy.maxRefundablePremiumPct,
      hasRefundableOption: !!best,
      hasCounter: false,
    };
    if (best) {
      const premium = sub(best.totalPrice, total);
      const premiumPct = pctTenths(B(premium), B(total));
      const withinLimit = B(premium) * 100_000n <= BigInt(Math.round(policy.maxRefundablePremiumPct * 1000)) * B(total);
      Object.assign(evidence, {
        refundableHotel: best.hotel,
        refundableTotal: best.totalPrice,
        premium,
        premiumPct,
        hasCounter: withinLimit,
        freeCancelUntil: best.freeCancelUntil ?? '',
      });
      amounts.refundableTotal = best.totalPrice;
      amounts.premium = premium;
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
          diff: { hotel: { from: p.hotel, to: best.hotel }, total: { from: total, to: best.totalPrice }, refundable: { from: 'no', to: 'yes' } },
        };
        // `protected`: the non-refundable total you would lose if plans change.
        amounts.protected = total;
        const section = differenceSection(
          {
            amount: total,
            th: fees ? `${p.hotel} ยอดจริง (รวมค่าธรรมเนียมที่ไม่ได้แสดง)` : `${p.hotel} คืนเงินไม่ได้`,
            en: fees ? `${p.hotel}, real total incl. hidden fees` : `${p.hotel}, non-refundable`,
          },
          { amount: best.totalPrice, th: `${best.hotel} ยกเลิกฟรี`, en: `${best.hotel}, free cancellation` },
          { th: 'จ่ายเพิ่มเพื่อห้องยกเลิกฟรี', en: 'Extra for a refundable room' },
          amounts,
          fx,
        );
        if (section) breakdown.push(section);
      }
    }
    findings.push({ ruleId: 'STAY_FLEXIBILITY', severity: 'pause', evidence, messageKey: 'stay_flexibility' });
  } else if (quoted && fees) {
    const proposal: StayProposal = { ...p, proposalId: `${p.proposalId}-counter`, quotedPrice: total };
    counter = { proposal, diff: { shownPrice: { from: quoted, to: total } } };
    amounts.protected = fees;
    amounts.difference = money(0, cur);
    breakdown.push(
      withThb(
        {
          key: 'fees',
          title: { th: 'ค่าธรรมเนียมที่ซ่อนอยู่', en: 'Hidden fees, surfaced' },
          lines: [L('total', 'ยอดจริงรวมค่าธรรมเนียม', 'Real total with fees', total, 'add'), L('shown', 'ราคาที่ agent แสดง', 'Price the agent showed', quoted, 'sub')],
          total: L('fees', 'ค่าธรรมเนียมที่เห็นก่อนจ่าย', 'Fees you see before paying', fees, 'total'),
        },
        fx,
      ),
    );
  }

  return {
    findings,
    metrics,
    amounts,
    breakdown,
    counter,
    assumptions: [
      { th: 'ราคารวมภาษีและค่าธรรมเนียมบังคับแล้ว', en: 'Totals include taxes and mandatory fees.' },
      { th: 'ห้องและราคาจาก catalog จำลอง (sandbox)', en: 'Rooms and prices come from a mock catalog (sandbox).' },
    ],
  };
}

// ---------------- Token swap ----------------

export function swapRules(intent: ActionIntent, p: TokenSwapProposal, policy: UserPolicy, fx: FxRate[] = DEFAULT_FX): RuleResult {
  const a = p.amountIn;
  if (!validMoney(a) || a.currency !== 'USDT') return invalid('amountIn');
  if (!Number.isSafeInteger(p.feePpm) || p.feePpm < 0 || p.feePpm >= 1_000_000) return invalid('feePpm');
  if (!Number.isSafeInteger(p.gas?.minor) || p.gas.minor < 0 || p.gas.currency !== 'USDT') return invalid('gas');
  if (!validMoney(p.portfolio.total) || p.portfolio.total.currency !== 'USDT') return invalid('portfolio');

  const findings: Finding[] = [];
  const zero = money(0, 'USDT');
  const balance = p.portfolio.balances[p.fromAsset] ?? zero;
  const V = p.portfolio.total;
  const H = p.portfolio.holdings[p.toAsset] ?? zero;
  const feePpm = BigInt(p.feePpm);
  const amounts: Record<string, Money> = { amountIn: a, balance, portfolio: V, holding: H, gas: p.gas };
  const metrics: Record<string, number> = { feePct: Number(divRound(feePpm * 1000n, PPM, ROUNDING.percent)) / 10 };
  const breakdown: BreakdownSection[] = [];

  if (balance.currency !== a.currency || a.minor > balance.minor) {
    findings.push({ ruleId: 'INSUFFICIENT_BALANCE', severity: 'block', evidence: { amountIn: a, balance, asset: p.fromAsset }, messageKey: 'insufficient_balance' });
  }

  const capRate = policy.tokenConcentrationCaps[p.toAsset];
  let newAmount = a;
  let concBreached = false;
  if (capRate !== undefined) {
    const base = { portfolio: B(V), holding: B(H), gas: B(p.gas), feePpm, capPpm: toPpm(capRate) };
    const parts = postTradeParts(base, B(a));
    const capValue = money(divRound(base.capPpm * B(V), PPM, ROUNDING.limit), 'USDT');
    const uncapped = aMaxUnclamped(base);
    const max = money(aMaxMicro({ ...base, balance: B(balance) }), 'USDT');
    metrics.postTradeSharePct = pctTenths(parts.numer, parts.denom);
    metrics.capPct = pctTenths(base.capPpm, PPM);
    amounts.capValue = capValue;
    amounts.aMax = max;
    if (!withinCap(base, B(a))) {
      concBreached = true;
      newAmount = max.minor < a.minor ? max : a;
      findings.push({
        ruleId: 'CONC_CAP',
        severity: max.minor === 0 ? 'block' : 'pause',
        evidence: {
          asset: p.toAsset,
          postTradeSharePct: metrics.postTradeSharePct,
          capPct: metrics.capPct,
          capValue,
          aMax: max,
          amountIn: a,
          portfolio: V,
          holding: H,
          feePct: metrics.feePct,
          gas: p.gas,
        },
        messageKey: 'conc_cap',
      });
      if (max.minor > 0) {
        // Reconciles to a_max exactly: cap × V − cap × g − H ± fee effect (floored) − balance clamp.
        const capAfterGas = money(divRound(base.capPpm * (B(V) - B(p.gas)), PPM, ROUNDING.limit), 'USDT');
        const gasShare = sub(capValue, capAfterGas);
        const headroom = sub(capAfterGas, H);
        const feeAdj = money(uncapped - B(headroom), 'USDT');
        const clamp = money(uncapped - B(max), 'USDT');
        const pct = metrics.capPct;
        const lines: BreakdownLine[] = [L('cap', `เพดาน ${pct}% ของพอร์ต`, `${pct}% cap on your portfolio`, capValue, 'add')];
        if (gasShare.minor) lines.push(L('gas', `ส่วนของค่า gas (${pct}%)`, `Gas share (${pct}%)`, gasShare, 'sub'));
        lines.push(L('holding', `ถือ ${p.toAsset} อยู่แล้ว`, `${p.toAsset} you already hold`, H, 'sub'));
        if (feeAdj.minor) {
          lines.push(
            L('fee', `ปรับตามค่าธรรมเนียม ${metrics.feePct}% (ปัดลง)`, `Fee effect ${metrics.feePct}% (rounded down)`, money(Math.abs(feeAdj.minor), 'USDT'), feeAdj.minor > 0 ? 'add' : 'sub'),
          );
        }
        if (clamp.minor) lines.push(L('balance', `จำกัดด้วยยอด ${p.fromAsset} ที่มี`, `Limited by your ${p.fromAsset} balance`, clamp, 'sub'));
        breakdown.push(
          withThb({ key: 'alternative', title: { th: 'ซื้อเพิ่มได้สูงสุด', en: 'Most you can add' }, lines, total: L('aMax', 'ทางเลือกที่ผ่านกฎ', 'Passes your rules', max, 'total') }, fx),
        );
      }
    }
  }

  const once = intent.commitment === 'once';
  const ap = p.approval;
  const overApproved = ap.type === 'unlimited' || (ap.amount !== undefined && ap.amount.minor > a.minor);
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
    amounts,
    breakdown,
    assumptions: [
      { th: 'USDT = $1 และไม่มี slippage (กรณีแย่สุดต่อเพดาน)', en: 'USDT = $1, zero slippage (worst case for the cap).' },
      { th: 'ค่า gas จ่ายจากสินทรัพย์อื่น', en: 'Gas is paid from a non-target asset.' },
      { th: 'ทำรายการจำลองเท่านั้น ไม่ใช่คำแนะนำการลงทุน', en: 'Mock execution only. Not financial advice.' },
    ],
  };

  const blocked = findings.some((f) => f.severity === 'block');
  if (findings.length > 0 && !blocked && newAmount.minor > 0) {
    const expiry = once ? Math.min(ap.expirySec ?? maxExp, maxExp) : ap.expirySec;
    const proposal: TokenSwapProposal = {
      ...p,
      proposalId: `${p.proposalId}-counter`,
      amountIn: newAmount,
      approval: { spender: ap.spender, type: 'exact', amount: newAmount, expirySec: expiry },
      summary: '',
    };
    proposal.summary = describeCounter(proposal, 'en');
    const diff: CounterOffer['diff'] = {};
    if (newAmount.minor !== a.minor) diff.amountIn = { from: a, to: newAmount };
    if (ap.type !== 'exact' || ap.amount?.minor !== newAmount.minor) diff.approval = { from: ap.type === 'unlimited' ? 'unlimited' : (ap.amount ?? a), to: newAmount };
    if (expiry !== ap.expirySec) diff.expirySec = { from: ap.expirySec ?? 'none', to: expiry ?? 'none' };
    result.counter = { proposal, diff };
    amounts.counterAmountIn = newAmount;
    if (expiry !== undefined) metrics.counterExpiryMin = expiry / 60;
    if (capRate !== undefined) {
      const parts = postTradeParts({ portfolio: B(V), holding: B(H), gas: B(p.gas), feePpm }, B(newAmount));
      metrics.counterSharePct = pctTenths(parts.numer, parts.denom);
    }
    amounts.difference = sub(a, newAmount);
    if (concBreached) {
      const kept = amounts.difference;
      amounts.protected = kept;
      breakdown.push(
        withThb(
          {
            key: 'savings',
            title: { th: `ไม่เข้า ${p.toAsset} เกินเพดาน`, en: `Kept out of ${p.toAsset}` },
            lines: [L('original', 'agent จะ swap', 'Agent wanted to swap', a, 'add'), L('alternative', 'ทางเลือกที่ผ่านกฎ', 'Passes your rules', newAmount, 'sub')],
            total: L('saved', `ยังอยู่ใน ${p.fromAsset}`, `Stays in ${p.fromAsset}`, kept, 'total'),
          },
          fx,
        ),
      );
    }
  } else {
    result.breakdown = [];
  }
  return result;
}

/** User-set rules. Absent fields match today's demo: no per-payment cap, annual block off. */
export function userRuleFindings(proposal: AgentProposal, policy: UserPolicy, fx: FxRate[]): Finding[] {
  const findings: Finding[] = [];
  const limit = policy.perPaymentLimit;
  if (limit && limit.currency === 'THB' && Number.isSafeInteger(limit.minor) && limit.minor >= 0) {
    const raw = proposal.kind === 'subscription' ? proposal.price : proposal.kind === 'stay' ? proposal.totalPrice : proposal.amountIn;
    if (raw.currency === 'THB') {
      if (raw.minor > limit.minor) {
        findings.push({
          ruleId: 'USER_PAYMENT_LIMIT',
          severity: 'pause',
          evidence: { amount: raw, limit },
          messageKey: 'user_payment_limit',
        });
      }
    } else {
      const rate = findFx(fx, raw.currency, 'THB');
      if (!rate) {
        findings.push({
          ruleId: 'FX_UNAVAILABLE',
          severity: 'pause',
          evidence: { priceCurrency: raw.currency, capCurrency: 'THB' },
          messageKey: 'fx_unavailable',
        });
      } else {
        const thb = convert(raw, rate);
        if (thb.minor > limit.minor) {
          findings.push({
            ruleId: 'USER_PAYMENT_LIMIT',
            severity: 'pause',
            evidence: { amount: thb, limit, fxRate: rate.rate },
            messageKey: 'user_payment_limit',
          });
        }
      }
    }
  }
  if (policy.blockAnnualAutoRenew && proposal.kind === 'subscription' && (proposal.interval === 'year' || proposal.autoRenew)) {
    findings.push({
      ruleId: 'USER_BLOCK_ANNUAL',
      severity: 'pause',
      evidence: { interval: proposal.interval, autoRenew: proposal.autoRenew, price: proposal.price },
      messageKey: 'user_block_annual',
    });
  }
  return findings;
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

