import { SCENES, newId, sceneIntent } from './scenes';
import type { ActionIntent, AgentProposal, Execution, Lang, SceneId, UBotAdapter } from './types';

// Scripted stand-in for U-Bot. It deliberately proposes the "trap" option for
// each scene so the guard has something to catch. Intent extraction here is a
// keyword heuristic — the production path replaces it with an LLM (JSON schema).

const has = (t: string, ...words: string[]) => words.some((w) => t.includes(w));

export function detectScene(text: string): SceneId | undefined {
  const t = text.toLowerCase();
  if (has(t, 'swap', 'usdt', 'token', 'แลก', 'โทเคน', 'คริปโต')) return 'crypto';
  if (has(t, 'hotel', 'room', 'stay', 'โรงแรม', 'ที่พัก', 'ห้อง')) return 'stay';
  if (has(t, 'app', 'subscribe', 'plan', 'แอป', 'สมัคร', 'แพ็กเกจ')) return 'subscription';
  return undefined;
}

export function extractIntentMock(text: string, scene: SceneId, language: Lang): ActionIntent {
  const t = text.toLowerCase();
  const base = sceneIntent(scene, text, language);
  let cues = 0;

  if (scene === 'subscription') {
    if (has(t, 'try', 'trial', 'ลอง', 'ทดลอง')) {
      base.commitment = 'trial';
      cues++;
    } else if (has(t, 'annual', 'year', 'long term', 'รายปี', 'ยาวๆ', 'ทั้งปี')) {
      base.commitment = 'ongoing';
      cues++;
    } else base.commitment = 'unspecified';
  }
  if (scene === 'stay') {
    base.flexibilityNeeded = has(t, 'may change', 'flexible', 'cancel', 'อาจเปลี่ยน', 'ยกเลิก', 'ไม่แน่นอน')
      ? true
      : has(t, 'fixed', 'sure', 'แน่นอน', 'ชัวร์')
        ? false
        : 'unknown';
    if (base.flexibilityNeeded !== 'unknown') cues++;
    base.priceSensitivity = has(t, 'cheap', 'budget', 'ถูก', 'ประหยัด') ? 'cheap' : 'normal';
  }
  if (scene === 'crypto') {
    const amount = parseAmount(t);
    if (amount !== undefined) {
      base.amount = { amount, currency: 'USDT' };
      cues++;
    }
    if (has(t, 'once', 'one time', 'ครั้งเดียว')) {
      base.commitment = 'once';
      cues++;
    } else base.commitment = 'unspecified';
  }
  base.confidence = cues > 0 ? base.confidence : 0.6;
  return base;
}

function parseAmount(t: string): number | undefined {
  const m = t.replace(/,/g, '').match(/(\d+(?:\.\d+)?)\s*(usdt|\$|ดอลลาร์)?/);
  if (!m) return undefined;
  const n = Number(m[1]);
  return Number.isFinite(n) ? n : undefined;
}

export interface ScriptedTurn {
  reply: string;
  proposal?: AgentProposal;
  intent?: ActionIntent;
  scene?: SceneId;
}

export function scriptedChat(input: { message: string; scene?: SceneId; lang: Lang }): ScriptedTurn {
  const scene = input.scene ?? detectScene(input.message);
  if (!scene) {
    return {
      reply:
        input.lang === 'th'
          ? 'ตอนนี้ผม (U-Bot mock) ทำเดโมได้ 3 อย่าง: สมัครแอป, จองโรงแรม, และ swap โทเคน ลองกดปุ่มด้านล่างได้เลยครับ'
          : 'Right now I (U-Bot mock) can demo three things: app subscriptions, hotel bookings and token swaps. Try a chip below.',
    };
  }
  const preset = SCENES[scene];
  const intent = input.scene && input.message === preset.userText[input.lang]
    ? sceneIntent(scene, input.message, input.lang)
    : extractIntentMock(input.message, scene, input.lang);
  const amount = scene === 'crypto' ? intent.amount?.amount : undefined;
  const proposal = preset.buildProposal({ amount });
  let reply = preset.reply[input.lang];
  if (scene === 'crypto' && amount !== undefined && amount !== 500) {
    reply = reply.replace(/500/g, String(amount));
  }
  return { reply, proposal, intent, scene };
}

export function mockExecute(): Execution {
  return { mode: 'mock', status: 'success', ref: newId('mock-tx') };
}

export class MockUBotAdapter implements UBotAdapter {
  readonly label = 'U-Bot (mock)' as const;

  async chat(input: { sessionId: string; message: string; scene?: SceneId; lang: Lang }) {
    const turn = scriptedChat(input);
    return { reply: turn.reply, proposal: turn.proposal, intent: turn.intent };
  }

  async execute(input: { proposal: AgentProposal; verdictId: string; userConfirmed: true }): Promise<Execution> {
    if (!input.verdictId || input.userConfirmed !== true) {
      return { mode: 'mock', status: 'skipped' };
    }
    return mockExecute();
  }
}
