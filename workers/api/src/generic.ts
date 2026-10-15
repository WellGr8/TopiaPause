import { MoneyError, money, newId, parseMoney, type AgentProposal, type Money } from '@topiapause/shared';
import type { z } from 'zod';
import { HttpError } from './http';
import type { GenericCheck, MoneyInput } from './schemas';

// Maps the agent-agnostic request (any agent: ShopBot, a browser agent, ...) onto the engine's
// proposal types. Alternatives the agent saw become the only options a counter-offer may use.

type Generic = z.output<typeof GenericCheck>;

function toMoney(m: z.output<typeof MoneyInput>, field: string): Money {
  try {
    return 'minor' in m ? money(m.minor, m.currency) : parseMoney(m.value, m.currency);
  } catch (e) {
    throw new HttpError(400, 'invalid_input', `${field}: ${e instanceof MoneyError ? e.message : 'invalid amount'}`);
  }
}

export function genericToProposal(g: Generic): AgentProposal {
  const agent = { name: g.agent.name, adapter: 'external' as const };
  const base = { proposalId: newId('ext'), agent, summary: `${g.agent.name}: ${g.action.type}` };
  const amount = toMoney(g.amount, 'amount');
  const a = g.action;

  if (a.type === 'subscribe') {
    return {
      ...base,
      kind: 'subscription',
      merchant: a.merchant,
      planId: a.plan,
      planName: a.plan,
      price: amount,
      interval: a.interval,
      autoRenew: a.autoRenew,
      trialDays: a.trialDays,
      catalogAlternatives: g.alternatives.map((x, i) => ({
        planId: x.name,
        name: x.name,
        price: toMoney(x.amount, `alternatives.${i}.amount`),
        interval: x.interval ?? 'month',
        trialDays: x.trialDays ?? 0,
      })),
    };
  }

  if (a.type === 'book') {
    return {
      ...base,
      kind: 'stay',
      hotel: a.hotel,
      nightlyPrice: amount,
      totalPrice: amount,
      quotedPrice: a.shownPrice ? toMoney(a.shownPrice, 'action.shownPrice') : undefined,
      refundable: a.refundable,
      freeCancelUntil: a.freeCancelUntil,
      catalogAlternatives: g.alternatives.map((x, i) => ({
        hotel: x.name,
        totalPrice: toMoney(x.amount, `alternatives.${i}.amount`),
        refundable: x.refundable ?? false,
        freeCancelUntil: x.freeCancelUntil,
      })),
    };
  }

  const record = (r: Record<string, z.output<typeof MoneyInput>>, field: string) =>
    Object.fromEntries(Object.entries(r).map(([k, v]) => [k, toMoney(v, `${field}.${k}`)]));
  return {
    ...base,
    kind: 'token_swap',
    fromAsset: a.from,
    toAsset: a.to,
    amountIn: amount,
    feePpm: a.feePpm,
    gas: a.gas ? toMoney(a.gas, 'action.gas') : money(0, amount.currency),
    approval: {
      spender: a.approval.spender ?? `${g.agent.name} router`,
      type: a.approval.type,
      amount: a.approval.amount ? toMoney(a.approval.amount, 'action.approval.amount') : undefined,
      expirySec: a.approval.expirySec,
    },
    portfolio: {
      total: toMoney(a.portfolio.total, 'action.portfolio.total'),
      holdings: record(a.portfolio.holdings, 'action.portfolio.holdings'),
      balances: record(a.portfolio.balances, 'action.portfolio.balances'),
    },
  };
}
