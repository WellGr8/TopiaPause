// Maps a speech-to-text transcript to a pause-screen action.
// Keyword matching only: no model, no network. "Confirm" is the counter-offer,
// never the paused original. A negation ("ไม่เอา", "don't confirm") does not confirm.

export type VoiceAction = 'counter_offer' | 'cancel' | 'unclear';

const COUNTER_TH = ['เอาแบบถูก', 'เอาอันที่แนะนำ', 'เอาที่แนะนำ', 'ใช้อันที่แนะนำ', 'ใช้ทางเลือกนี้', 'เอาอันนี้', 'ยืนยัน', 'ตกลง'];
const CANCEL_TH = ['ไม่เอาแล้ว', 'ไม่ต้องการ', 'ไม่เอา', 'ยกเลิก'];
const COUNTER_EN = [
  'use the recommended',
  'take the recommended',
  'the recommended one',
  'recommended option',
  'the cheaper one',
  'cheaper one',
  'use this',
  'confirm',
  'yeah',
  'yes',
  'okay',
  'ok',
];
const CANCEL_EN = ['no thanks', 'never mind', 'cancel', 'nope', 'stop', 'no'];

function normalize(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”"`.!?,，。！？]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** True when a negation sits immediately before this match. */
function negatedAt(text: string, index: number): boolean {
  const before = text.slice(Math.max(0, index - 16), index).trim();
  if (before.endsWith('ไม่')) return true;
  return /(?:^|\s)(?:don't|dont|do not|never|not)$/.test(before);
}

function matched(text: string, phrase: string, spaced: boolean): boolean {
  const at = spaced ? ` ${text} `.indexOf(` ${phrase} `) : text.indexOf(phrase);
  if (at < 0) return false;
  return !negatedAt(text, at);
}

function anyOf(text: string, phrases: string[], spaced: boolean): boolean {
  return phrases.some((phrase) => matched(text, phrase, spaced));
}

export function mapVoiceIntent(transcript: string): VoiceAction {
  const text = normalize(transcript);
  if (!text) return 'unclear';
  const counter = anyOf(text, COUNTER_TH, false) || anyOf(text, COUNTER_EN, true);
  const cancel = anyOf(text, CANCEL_TH, false) || anyOf(text, CANCEL_EN, true);
  if (counter && cancel) return 'unclear';
  if (counter) return 'counter_offer';
  if (cancel) return 'cancel';
  return 'unclear';
}
