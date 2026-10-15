import { evaluate } from '@topiapause/guard-engine';
import {
  DEFAULT_POLICY,
  findingDetail,
  fmtExact,
  fmtMoney,
  isMoney,
  sceneIntent,
  SCENES,
  type AgentProposal,
  type Finding,
  type GuardVerdict,
  type Lang,
  type Money,
  type RuleId,
  type SceneId,
} from '@topiapause/shared';
import { t, type CopyKey } from '../copy';

// The first screen speaks in plain words. Every amount is taken from the same
// engine verdict as the interactive demo, so the figures cannot drift from the scenes.

export const LANDING_SCENES = ['subscription', 'stay', 'crypto'] as const satisfies readonly SceneId[];

const CHIP: Record<SceneId, CopyKey> = {
  subscription: 'landChipApp',
  stay: 'landChipStay',
  crypto: 'landChipCoin',
};

const HINT: Record<SceneId, CopyKey> = {
  subscription: 'landHintApp',
  stay: 'landHintStay',
  crypto: 'landHintCoin',
};

export interface LandingDetail {
  ruleId: RuleId;
  text: string;
}

export interface LandingOffer {
  /** The number the eye should land on. */
  amount: string;
  /** Short label under the amount, such as "เดือนแรก". */
  note?: string;
  /** Struck-through price the agent was about to pay. */
  was?: string;
  /** Pill, already phrased: "ประหยัด ฿3,691.00". */
  saved?: string;
}

export interface LandingPreview {
  scene: SceneId;
  chip: string;
  hint: string;
  user: string;
  agentLabel: string;
  agent: string;
  lead: string;
  offer: LandingOffer;
  /** Shown only inside the details disclosure. */
  ruleLine: string;
  /** Engine voice line. The listen button plays this; the lines above stay plain. */
  voiceText: string;
  clipId: string;
  details: LandingDetail[];
}

function cash(findings: Finding[], ruleId: RuleId, key: string): Money | undefined {
  const v = findings.find((f) => f.ruleId === ruleId)?.evidence[key];
  return isMoney(v) ? v : undefined;
}

function amount(verdict: GuardVerdict, key: string): Money | undefined {
  const v = verdict.amounts[key];
  return isMoney(v) ? v : undefined;
}

function counterOf(verdict: GuardVerdict): AgentProposal | undefined {
  return verdict.counterOffer?.proposal;
}

function preview(scene: SceneId, lang: Lang): LandingPreview {
  const preset = SCENES[scene];
  const proposal = preset.buildProposal();
  const verdict = evaluate({
    intent: sceneIntent(scene, preset.userText[lang], lang),
    proposal,
    policy: DEFAULT_POLICY,
    lang,
  });
  const common = {
    scene,
    chip: t(lang, CHIP[scene]),
    hint: t(lang, HINT[scene]),
    agentLabel: `U-Bot (${t(lang, 'mock')})`,
    voiceText: verdict.voiceText[lang],
    clipId: verdict.voiceText.clipId ?? `${scene}-pause`,
    details: verdict.findings.map((f) => ({ ruleId: f.ruleId, text: findingDetail(f, lang) })),
  };

  if (proposal.kind === 'subscription') {
    const yearly = fmtExact(proposal.price);
    const counter = counterOf(verdict);
    const month = counter?.kind === 'subscription' ? fmtExact(counter.price) : yearly;
    const saved = amount(verdict, 'difference');
    const cap = amount(verdict, 'cap') ?? cash(verdict.findings, 'SUB_OVER_CAP', 'cap');
    return {
      ...common,
      user: lang === 'th' ? 'ลองแอปนี้ให้หน่อย' : 'Try this app for me.',
      agent: lang === 'th' ? `สมัครรายปี ${yearly} ให้นะครับ` : `Signing you up yearly for ${yearly}.`,
      lead: lang === 'th' ? 'เดี๋ยวครับ คุณแค่อยากลอง' : 'One moment. You only wanted to try it.',
      offer: {
        amount: month,
        note: lang === 'th' ? 'เดือนแรก' : 'first month',
        was: yearly,
        saved: saved ? (lang === 'th' ? `ประหยัด ${fmtExact(saved)}` : `saved ${fmtExact(saved)}`) : undefined,
      },
      ruleLine: cap ? (lang === 'th' ? `งบสมาชิก ${fmtExact(cap)} ของคุณทำงานแล้ว` : `Your ${fmtExact(cap)} app budget just stepped in.`) : '',
    };
  }

  if (proposal.kind === 'stay') {
    const shown = fmtExact(proposal.quotedPrice ?? proposal.nightlyPrice);
    const total = fmtExact(proposal.totalPrice);
    const counter = counterOf(verdict);
    const safer = counter?.kind === 'stay' ? fmtExact(counter.totalPrice) : total;
    const extra = cash(verdict.findings, 'STAY_FLEXIBILITY', 'premium');
    return {
      ...common,
      user: lang === 'th' ? 'จองที่พักให้หน่อย' : 'Book a place to stay.',
      agent: lang === 'th' ? `ที่เห็น ${shown} แต่จ่ายจริง ${total}` : `It shows ${shown}, but you would pay ${total}.`,
      lead: lang === 'th' ? 'เดี๋ยวครับ แผนคุณอาจเปลี่ยน' : 'One moment. Your plans may change.',
      offer: {
        amount: safer,
        note: extra ? (lang === 'th' ? `จ่ายเพิ่ม ${fmtExact(extra)} ยกเลิกได้` : `${fmtExact(extra)} more, and you can cancel`) : lang === 'th' ? 'ยกเลิกได้' : 'You can cancel',
      },
      ruleLine: lang === 'th' ? 'กฎที่พักต้องยกเลิกได้ของคุณทำงานแล้ว' : 'Your “I may need to cancel” rule just stepped in.',
    };
  }

  const swap = proposal.kind === 'token_swap' ? proposal : null;
  const spending = swap ? fmtMoney(swap.amountIn) : '';
  const counter = counterOf(verdict);
  const safer = counter?.kind === 'token_swap' ? fmtMoney(counter.amountIn) : spending;
  return {
    ...common,
    user: lang === 'th' ? 'ลงทุนเหรียญให้หน่อย' : 'Invest in a coin for me.',
    agent: lang === 'th' ? `จะเอา ${spending} ไปลงเหรียญเดียว` : `Putting ${spending} into one coin.`,
    lead: lang === 'th' ? 'เดี๋ยวครับ' : 'One moment.',
    offer: {
      amount: safer,
      was: spending,
      note: lang === 'th' ? 'ให้ดึงเงินได้แค่ครั้งนี้' : 'Only this one payment',
    },
    ruleLine: lang === 'th' ? 'กฎไม่ให้ลงเงินก้อนใหญ่ในเหรียญเดียวของคุณทำงานแล้ว' : 'Your “don’t put a large sum into one coin” rule just stepped in.',
  };
}

const cache = new Map<string, LandingPreview>();

export function landingPreview(scene: SceneId, lang: Lang): LandingPreview {
  const key = `${scene}|${lang}`;
  let hit = cache.get(key);
  if (!hit) {
    hit = preview(scene, lang);
    cache.set(key, hit);
  }
  return hit;
}

/** Lines a visitor reads before opening the technical disclosure. */
export function landingPlainText(scene: SceneId, lang: Lang): string {
  const p = landingPreview(scene, lang);
  const o = p.offer;
  return [p.user, p.agentLabel, p.agent, p.lead, o.note, o.amount, o.was, o.saved].filter(Boolean).join('\n');
}
