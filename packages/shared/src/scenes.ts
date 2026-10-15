import { fmtMoney } from './format';
import { money } from './money';
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

export const MOCK_AGENT = { name: 'AI assistant (demo)', adapter: 'mock' } as const;

export interface ScenePreset {
  id: SceneId;
  chip: { th: string; en: string };
  userText: { th: string; en: string };
  reply: { th: string; en: string };
  /** `amountMinor` in the proposal currency's minor units (crypto: micro-USDT). */
  buildProposal: (opts?: { amountMinor?: number }) => AgentProposal;
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
    price: { minor: 399000, currency: 'THB' },
    interval: 'year',
    autoRenew: true,
    trialDays: 0,
    catalogAlternatives: [
      { planId: 'pixelpro-annual', name: 'PixelPro Annual', price: { minor: 399000, currency: 'THB' }, interval: 'year', trialDays: 0 },
      { planId: 'pixelpro-monthly', name: 'PixelPro Monthly', price: { minor: 29900, currency: 'THB' }, interval: 'month', trialDays: 7 },
      { planId: 'pixelpro-plus-monthly', name: 'PixelPro Plus Monthly', price: { minor: 45900, currency: 'THB' }, interval: 'month', trialDays: 0 },
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
    nightlyPrice: { minor: 120000, currency: 'THB' },
    totalPrice: { minor: 128400, currency: 'THB' },
    quotedPrice: { minor: 120000, currency: 'THB' },
    refundable: false,
    catalogAlternatives: [
      { hotel: 'Asok Inn', nightlyPrice: { minor: 135000, currency: 'THB' }, totalPrice: { minor: 144500, currency: 'THB' }, refundable: true, freeCancelUntil: '2026-10-22T18:00:00+07:00' },
      { hotel: 'Sukhumvit Grand', nightlyPrice: { minor: 200000, currency: 'THB' }, totalPrice: { minor: 214000, currency: 'THB' }, refundable: true, freeCancelUntil: '2026-10-22T12:00:00+07:00' },
      { hotel: 'Budget Box 21', nightlyPrice: { minor: 110000, currency: 'THB' }, totalPrice: { minor: 131000, currency: 'THB' }, refundable: false },
    ],
  };
}

const usdt = (whole: number) => money(whole * 1_000_000, 'USDT');

/** `amountMinor` in micro-USDT; default 500 USDT. */
export function swapProposal(amountMinor = 500_000_000): TokenSwapProposal {
  const amountIn = money(amountMinor, 'USDT');
  return {
    kind: 'token_swap',
    proposalId: newId('prop'),
    agent: { ...MOCK_AGENT },
    summary: `Swap ${fmtMoney(amountIn)} → TOKEN-X, approve unlimited`,
    fromAsset: 'USDT',
    toAsset: 'TOKEN-X',
    amountIn,
    feePpm: 0,
    gas: usdt(0),
    approval: { spender: 'MockSwap Router (sandbox)', type: 'unlimited' },
    portfolio: {
      total: usdt(2000),
      holdings: { 'TOKEN-X': usdt(400), USDT: usdt(500), ETH: usdt(1100) },
      balances: { USDT: usdt(500) },
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
      th: 'ได้ครับ จะแลก 500 USDT เป็น TOKEN-X และให้สิทธิ์ถอน USDT ได้ไม่จำกัด ครั้งหน้าจะได้เร็วขึ้นครับ',
      en: "Sure. Swapping 500 USDT into TOKEN-X, and I'll set unlimited USDT withdrawal permission so next time is faster.",
    },
    buildProposal: (opts) => swapProposal(opts?.amountMinor),
    intent: {
      goal: 'swap_token',
      commitment: 'once',
      priceSensitivity: 'normal',
      flexibilityNeeded: 'unknown',
      amount: usdt(500),
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
