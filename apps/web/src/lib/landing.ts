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

export interface LandingDetail {
  ruleId: RuleId;
  text: string;
}

export interface LandingPreview {
  scene: SceneId;
  chip: string;
  user: string;
  agentLabel: string;
  agent: string;
  lead: string;
  reasons: string[];
  ruleLine: string;
  better: string;
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
      agent: lang === 'th' ? `กำลังสมัครแพ็กเกจรายปี ${yearly} ให้ครับ` : `Subscribing you to the yearly plan at ${yearly}.`,
      lead: lang === 'th' ? 'เดี๋ยวครับ คุณแค่อยากลอง' : 'One moment. You only wanted to try it.',
      reasons: [
        lang === 'th'
          ? `คุณแค่อยากลองใช้ แต่ AI กำลังจะสมัครรายปี ${yearly} ซึ่งตัดเงินทุกปี`
          : `You only wanted to try it, but the AI is about to buy a yearly plan for ${yearly} that charges every year.`,
      ],
      ruleLine: cap
        ? lang === 'th'
          ? `งบสมาชิก ${fmtMoney(cap)} ของคุณทำงานแล้ว`
          : `Your ${fmtMoney(cap)} app budget just stepped in.`
        : '',
      better: saved
        ? lang === 'th'
          ? `เดือนแรก ${month} ประหยัด ${fmtExact(saved)}`
          : `First month ${month}, saving ${fmtExact(saved)}.`
        : lang === 'th'
          ? `เดือนแรก ${month}`
          : `First month ${month}.`,
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
      user: lang === 'th' ? 'จองที่พักให้หน่อย แผนอาจเปลี่ยน' : 'Book a place to stay. My plans may change.',
      agent: lang === 'th' ? `จองที่พักให้ ราคาที่เห็น ${shown} แต่ต้องจ่าย ${total} และยกเลิกไม่ได้` : `Booking a stay. It shows ${shown}, but you would pay ${total}, and you cannot cancel.`,
      lead: lang === 'th' ? 'เดี๋ยวครับ แผนคุณอาจเปลี่ยน' : 'One moment. Your plans may change.',
      reasons: [
        lang === 'th' ? `ราคาที่เห็น ${shown} แต่ต้องจ่ายจริง ${total}` : `It shows ${shown}, but the real amount is ${total}.`,
        lang === 'th' ? `ที่พักนี้ยกเลิกไม่ได้ ถ้าแผนเปลี่ยน เงิน ${total} จะไม่ได้คืน` : `You cannot cancel this stay. If your plans change, ${total} is gone.`,
      ],
      ruleLine: lang === 'th' ? 'กฎที่พักต้องยกเลิกได้ของคุณทำงานแล้ว' : 'Your “I may need to cancel” rule just stepped in.',
      better: extra
        ? lang === 'th'
          ? `ที่พักที่ยกเลิกได้ ${safer} จ่ายเพิ่ม ${fmtExact(extra)}`
          : `A stay you can cancel: ${safer}, ${fmtExact(extra)} more.`
        : lang === 'th'
          ? `ที่พักที่ยกเลิกได้ ${safer}`
          : `A stay you can cancel: ${safer}.`,
    };
  }

  const swap = proposal.kind === 'token_swap' ? proposal : null;
  const spending = swap ? fmtExact(swap.amountIn) : '';
  const counter = counterOf(verdict);
  const safer = counter?.kind === 'token_swap' ? fmtExact(counter.amountIn) : spending;
  return {
    ...common,
    user: lang === 'th' ? 'ลงทุนเหรียญให้หน่อย แค่ครั้งนี้' : 'Invest in a coin for me, just this once.',
    agent: lang === 'th' ? `จะเอา ${spending} ไปลงเหรียญเดียว และเปิดให้ดึงเงินได้ไม่จำกัด` : `Putting ${spending} into one coin, and leaving the door open to take money with no limit.`,
    lead: lang === 'th' ? 'เดี๋ยวครับ' : 'One moment.',
    reasons: [
      lang === 'th'
        ? `AI กำลังจะเอา ${spending} ไปลงเหรียญเดียวมากเกินไป เสี่ยงเสียเงินก้อนใหญ่`
        : `The AI is about to put ${spending} into one coin. You could lose a large sum.`,
      lang === 'th' ? 'AI กำลังจะให้สิทธิ์ดึงเงินได้ไม่จำกัด' : 'The AI is about to let itself take money with no limit.',
    ],
    ruleLine: lang === 'th' ? 'กฎไม่ให้ลงเงินก้อนใหญ่ในเหรียญเดียวของคุณทำงานแล้ว' : 'Your “don’t put a large sum into one coin” rule just stepped in.',
    better: lang === 'th' ? `ทางที่ปลอดภัยกว่าคือลงแค่ ${safer} และให้ดึงเงินได้แค่ครั้งนี้` : `A safer step: put in only ${safer}, and only allow this one payment.`,
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
  return [p.user, p.agentLabel, p.agent, p.lead, ...p.reasons, p.ruleLine, p.better].join('\n');
}
