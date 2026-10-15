import type {
  ActionIntent,
  AgentProposal,
  Lang,
  SceneId,
  StayProposal,
  SubscriptionProposal,
  TokenSwapProposal,
} from './types';

// Mock catalogs for the three demo scenes. All prices are fixed sandbox values.

export const MOCK_AGENT = { name: 'U-Bot (mock)', adapter: 'mock' } as const;

export interface ScenePreset {
  id: SceneId;
  chip: { th: string; en: string };
  userText: { th: string; en: string };
  reply: { th: string; en: string };
  buildProposal: (opts?: { amount?: number }) => AgentProposal;
  intent: Omit<ActionIntent, 'rawText' | 'language'>;
}

let seq = 0;
export function newId(prefix: string): string {
  seq += 1;
  const c = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  const rand = c?.randomUUID ? c.randomUUID().slice(0, 8) : Math.floor(Math.random() * 1e8).toString(16);
  return `${prefix}-${rand}-${seq}`;
}

export function subscriptionProposal(): SubscriptionProposal {
  return {
    kind: 'subscription',
    proposalId: newId('prop'),
    agent: { ...MOCK_AGENT },
    summary: 'PixelPro Annual ฿3,990/year, auto-renew',
    merchant: 'PixelPro',
    planId: 'pixelpro-annual',
    planName: 'PixelPro Annual',
    price: { amount: 3990, currency: 'THB' },
    interval: 'year',
    autoRenew: true,
    trialDays: 0,
    catalogAlternatives: [
      { planId: 'pixelpro-annual', name: 'PixelPro Annual', price: { amount: 3990, currency: 'THB' }, interval: 'year', trialDays: 0 },
      { planId: 'pixelpro-monthly', name: 'PixelPro Monthly', price: { amount: 299, currency: 'THB' }, interval: 'month', trialDays: 7 },
      { planId: 'pixelpro-plus-monthly', name: 'PixelPro Plus Monthly', price: { amount: 459, currency: 'THB' }, interval: 'month', trialDays: 0 },
    ],
  };
}

export function stayProposal(): StayProposal {
  return {
    kind: 'stay',
    proposalId: newId('prop'),
    agent: { ...MOCK_AGENT },
    summary: 'City Nest Asok ฿1,200 (non-refundable)',
    hotel: 'City Nest Asok',
    nightlyPrice: { amount: 1200, currency: 'THB' },
    totalPrice: { amount: 1284, currency: 'THB' },
    quotedPrice: { amount: 1200, currency: 'THB' },
    refundable: false,
    catalogAlternatives: [
      { hotel: 'Asok Inn', nightlyPrice: { amount: 1350, currency: 'THB' }, totalPrice: { amount: 1445, currency: 'THB' }, refundable: true, freeCancelUntil: '2026-10-22T18:00:00+07:00' },
      { hotel: 'Sukhumvit Grand', nightlyPrice: { amount: 2000, currency: 'THB' }, totalPrice: { amount: 2140, currency: 'THB' }, refundable: true, freeCancelUntil: '2026-10-22T12:00:00+07:00' },
      { hotel: 'Budget Box 21', nightlyPrice: { amount: 1100, currency: 'THB' }, totalPrice: { amount: 1310, currency: 'THB' }, refundable: false },
    ],
  };
}

export function swapProposal(amount = 500): TokenSwapProposal {
  return {
    kind: 'token_swap',
    proposalId: newId('prop'),
    agent: { ...MOCK_AGENT },
    summary: `Swap ${amount} USDT → TOKEN-X, approve unlimited`,
    fromAsset: 'USDT',
    toAsset: 'TOKEN-X',
    amountIn: { amount, currency: 'USDT' },
    feeRate: 0,
    gasUsd: 0,
    approval: { spender: 'MockSwap Router (sandbox)', type: 'unlimited' },
    portfolio: {
      totalUsd: 2000,
      holdingsUsd: { 'TOKEN-X': 400, USDT: 500, ETH: 1100 },
      balances: { USDT: 500, 'TOKEN-X': 400, ETH: 0.41 },
    },
  };
}

export const SCENES: Record<SceneId, ScenePreset> = {
  subscription: {
    id: 'subscription',
    chip: { th: 'ลองแอป PixelPro', en: 'Try PixelPro app' },
    userText: {
      th: 'ช่วยสมัครแอปแต่งรูป PixelPro ให้หน่อย อยากลองดู',
      en: 'Sign me up for the PixelPro photo app, I just want to try it.',
    },
    reply: {
      th: 'จัดให้ครับ! สมัคร PixelPro Annual ฿3,990/ปี ต่ออายุอัตโนมัติ ให้เลยนะครับ',
      en: "On it! I'll subscribe you to PixelPro Annual at ฿3,990/year with auto-renew.",
    },
    buildProposal: () => subscriptionProposal(),
    intent: { goal: 'try_app', commitment: 'trial', priceSensitivity: 'normal', flexibilityNeeded: 'unknown', confidence: 0.92 },
  },
  stay: {
    id: 'stay',
    chip: { th: 'โรงแรมถูกๆ ใกล้อโศก', en: 'Cheap hotel near Asok' },
    userText: {
      th: 'หาโรงแรมถูกๆ ใกล้อโศก คืนวันศุกร์ แต่แผนอาจเปลี่ยนนะ',
      en: 'Find me a cheap hotel near Asok for Friday night. My plans may change.',
    },
    reply: {
      th: 'เจอแล้วครับ City Nest Asok คืนละ ฿1,200 ถูกที่สุดในย่านนี้ จองให้เลยนะครับ',
      en: "Found one: City Nest Asok, ฿1,200 a night, cheapest in the area. Booking it now.",
    },
    buildProposal: () => stayProposal(),
    intent: { goal: 'book_stay', commitment: 'unspecified', priceSensitivity: 'cheap', flexibilityNeeded: true, confidence: 0.9 },
  },
  crypto: {
    id: 'crypto',
    chip: { th: 'แลก 500 USDT ครั้งเดียว', en: 'Swap 500 USDT once' },
    userText: {
      th: 'แลก 500 USDT เป็น TOKEN-X ครั้งเดียวพอ',
      en: 'Swap 500 USDT into TOKEN-X, just this once.',
    },
    reply: {
      th: 'ได้ครับ จะ swap 500 USDT เป็น TOKEN-X และขออนุมัติสิทธิ์ USDT แบบไม่จำกัด ครั้งหน้าจะได้เร็วขึ้นครับ',
      en: "Sure. Swapping 500 USDT into TOKEN-X, and I'll request unlimited USDT approval so next time is faster.",
    },
    buildProposal: (opts) => swapProposal(opts?.amount ?? 500),
    intent: {
      goal: 'swap_token',
      commitment: 'once',
      priceSensitivity: 'normal',
      flexibilityNeeded: 'unknown',
      amount: { amount: 500, currency: 'USDT' },
      fromAsset: 'USDT',
      toAsset: 'TOKEN-X',
      confidence: 0.95,
    },
  },
};

export const SCENE_ORDER: SceneId[] = ['subscription', 'stay', 'crypto'];

export function sceneIntent(scene: SceneId, rawText: string, language: Lang): ActionIntent {
  return { ...SCENES[scene].intent, rawText, language };
}
