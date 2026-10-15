import { parseMoney, toDecimal } from './money';
import { SCENE_ORDER, SCENES, newId, sceneIntent } from './scenes';
import type { ActionIntent, AgentProposal, Execution, Lang, Money, SceneId, UBotAdapter } from './types';

// Scripted stand-in for U-Bot. It deliberately proposes the "trap" option for
// each scene so the guard has something to catch. Intent extraction here is a
// keyword heuristic — the production path replaces it with an LLM (JSON schema).

/** Short English tokens match as words so "plan" does not fire inside "explain". */
function has(t: string, ...words: string[]): boolean {
  return words.some((w) => {
    if (/^[a-z0-9]+$/.test(w) && w.length <= 5) return new RegExp(`(?:^|[^a-z0-9])${w}(?:[^a-z0-9]|$)`).test(t);
    return t.includes(w);
  });
}

const FOREIGN_COIN = /eth|btc|bitcoin|บิตคอย|บิทคอย|อีเธ/i;
const HAS_USDT = /usdt|ยูเอสดีที/i;
const FOOD = /ร้านอาหาร|โต๊ะ|กินข้าว/;
const WHY = /ทำไม|\bwhy\b|แพง/i;

/** A restaurant or a table is not a hotel. */
export function isFoodRequest(message: string): boolean {
  return FOOD.test(message);
}

/** Why only when the message asks why and names no demo scene. "แพง" inside a hotel request is not why. */
export function isWhyQuestion(message: string): boolean {
  return WHY.test(message) && !isFoodRequest(message) && detectScene(message) === undefined;
}

/** ETH, BTC, and the like are not in this demo. Only a message that names USDT can become a swap. */
export function unsupportedCoin(message: string): boolean {
  return FOREIGN_COIN.test(message) && !HAS_USDT.test(message);
}

export function usdtOnlyReply(lang: Lang): string {
  const chip = SCENES.crypto.chip[lang];
  return lang === 'th'
    ? `เดโมนี้แลกได้แค่ USDT → TOKEN-X ครับ ลอง ${chip}`
    : `This demo only swaps USDT → TOKEN-X. Try ${chip}.`;
}

export function detectScene(text: string): SceneId | undefined {
  if (isFoodRequest(text)) return undefined;
  const t = text.toLowerCase();
  if (has(t, 'swap', 'usdt', 'token', 'token-x', 'แลก', 'โทเคน', 'คริปโต')) return 'crypto';
  if (has(t, 'hotel', 'room', 'stay', 'sleep', 'asok', 'book', 'โรงแรม', 'ที่พัก', 'ห้อง', 'อโศก', 'นอน', 'จอง')) return 'stay';
  if (has(t, 'pixelpro', 'subscribe', 'plan', 'app', 'try', 'buy', 'แอป', 'สมัคร', 'แพ็กเกจ', 'ลองใช้', 'ลอง')) return 'subscription';
  return undefined;
}

export function unmatchedReply(lang: Lang): string {
  const chips = SCENE_ORDER.map((id) => SCENES[id].chip[lang]);
  if (lang === 'th') {
    return `ยังจับไม่ออกว่าจะให้ตรวจรายการไหน เพราะเดโมนี้กันเงินได้แค่ 3 แบบ: ${chips.join(' · ')} ลองกดปุ่มด้านล่าง หรือพิมพ์ให้ใกล้เคียงแบบนั้นได้เลยครับ`;
  }
  return `I couldn't tell which payment to check, because this demo only guards three kinds of spending: ${chips.join(' · ')}. Use one of those chips, or phrase the request that way.`;
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
      base.amount = amount;
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

function parseAmount(t: string): Money | undefined {
  const m = t.replace(/,/g, '').match(/(\d+(?:\.\d{1,6})?)\s*(usdt|\$|ดอลลาร์)?/);
  if (!m) return undefined;
  try {
    return parseMoney(m[1]!, 'USDT');
  } catch {
    return undefined;
  }
}

/**
 * The guard's intent comes from the user's own words only, never from the agent.
 * Preset demo messages map to their scene intent; anything else goes through the heuristic.
 */
export function deriveIntent(message: string, scene: SceneId, lang: Lang): ActionIntent {
  const preset = SCENES[scene];
  const exact = (['th', 'en'] as Lang[]).find((l) => preset.userText[l] === message);
  return exact ? sceneIntent(scene, message, lang) : extractIntentMock(message, scene, lang);
}

export interface ScriptedTurn {
  reply: string;
  proposal?: AgentProposal;
  intent?: ActionIntent;
  scene?: SceneId;
}

export function scriptedChat(input: { message: string; scene?: SceneId; lang: Lang }): ScriptedTurn {
  if (!input.scene && unsupportedCoin(input.message)) return { reply: usdtOnlyReply(input.lang) };
  const scene = input.scene ?? detectScene(input.message);
  if (!scene) return { reply: unmatchedReply(input.lang) };
  const preset = SCENES[scene];
  const intent = deriveIntent(input.message, scene, input.lang);
  const amount = scene === 'crypto' ? intent.amount : undefined;
  const proposal = preset.buildProposal({ amountMinor: amount?.minor });
  let reply = preset.reply[input.lang];
  if (amount && amount.minor !== 500_000_000) {
    reply = reply.replace(/500/g, toDecimal(amount).replace(/\.?0+$/, ''));
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
