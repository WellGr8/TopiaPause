// Maps a speech-to-text transcript to a pause-screen action.
// Keyword matching only: no model, no network. A match never selects the paused original.
// "Confirm" is the counter-offer. A negation immediately before a confirm word does not confirm.

export type VoiceAction = 'counter_offer' | 'cancel' | 'unclear';

const COUNTER_PHRASES = [
  'เอาแบบถูก',
  'เอาอันนี้',
  'อันนี้',
  'อันถูก',
  'ถูกกว่า',
  'แบบถูก',
  'รายเดือน',
  'ทดลอง',
  'ที่แนะ',
  'แนะนำ',
  'นะนำ',
  'ตกลง',
  'โอเค',
  'ยืนยัน',
  'ใช่',
  'okay',
  'yes',
  'yeah',
  'confirm',
  'recommended',
  'cheaper',
];

const CANCEL_PHRASES = ['ไม่เอา', 'ไม่ต้อง', 'ไม่ซื้อ', 'พอแล้ว', 'ยกเลิก', 'หยุด', 'never mind', 'no thanks', 'cancel', 'nope', 'stop'];

const FUZZY = ['แนะนำ', 'ตกลง', 'ยกเลิก', 'โอเค'];

function spaced(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[“”"`.!?,，。！？]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Drop sentence particles only from the end, so นะนำ stays นะนำ. */
function stripParticles(flat: string): string {
  let out = flat;
  const tail = /(ครับ|คับ|ค่ะ|คะ|นะ|จ้ะ|จ้า|เลย)+$/;
  while (tail.test(out)) out = out.replace(tail, '');
  return out;
}

function flatten(raw: string): string {
  return stripParticles(spaced(raw).replace(/\s+/g, ''));
}

function levenshtein(a: string, b: string): number {
  const left = [...a];
  const right = [...b];
  if (Math.abs(left.length - right.length) > 1) return 2;
  const rows = left.length + 1;
  const cols = right.length + 1;
  const dp: number[][] = Array.from({ length: rows }, () => Array<number>(cols).fill(0));
  for (let i = 0; i < rows; i++) dp[i]![0] = i;
  for (let j = 0; j < cols; j++) dp[0]![j] = j;
  for (let i = 1; i < rows; i++) {
    for (let j = 1; j < cols; j++) {
      const cost = left[i - 1] === right[j - 1] ? 0 : 1;
      dp[i]![j] = Math.min(dp[i - 1]![j]! + 1, dp[i]![j - 1]! + 1, dp[i - 1]![j - 1]! + cost);
    }
  }
  return dp[left.length]![right.length]!;
}

/** Negation anywhere earlier in a short utterance blocks a confirm word. */
function thaiNegated(text: string, index: number): boolean {
  return text.slice(0, index).includes('ไม่');
}

function englishNegated(text: string, index: number): boolean {
  return /\b(?:don't|dont|do not|never|not)\b/.test(text.slice(0, index));
}

function phraseHit(text: string, phrase: string, thai: boolean): boolean {
  let from = 0;
  while (from <= text.length) {
    const at = text.indexOf(phrase, from);
    if (at < 0) return false;
    const negated = thai ? thaiNegated(text, at) : englishNegated(text, at);
    if (!negated) return true;
    from = at + phrase.length;
  }
  return false;
}

function wordHit(text: string, word: string): boolean {
  const re = new RegExp(`(?:^|\\s)${word}(?:\\s|$)`, 'g');
  for (const match of text.matchAll(re)) {
    const at = match.index ?? 0;
    if (!englishNegated(text, at)) return true;
  }
  return false;
}

function fuzzyHit(token: string): 'counter_offer' | 'cancel' | undefined {
  const tokenChars = [...token];
  if (tokenChars.length < 2) return undefined;
  for (const word of FUZZY) {
    if (token === word) continue;
    const wordChars = [...word];
    // A 2-character word only accepts a substitution, so a single character cannot match โอเค.
    if (wordChars.length <= 2 && tokenChars.length !== wordChars.length) continue;
    if (Math.abs(tokenChars.length - wordChars.length) > 1) continue;
    if (levenshtein(token, word) <= 1) return word === 'ยกเลิก' ? 'cancel' : 'counter_offer';
  }
  return undefined;
}

export function mapVoiceIntent(transcript: string): VoiceAction {
  const space = spaced(transcript);
  const flat = flatten(transcript);
  if (!flat) return 'unclear';

  let counter = false;
  let cancel = false;

  if (flat === 'เอา' || flat === 'ได้' || flat === 'ok') counter = true;
  if (flat === 'ไม่') cancel = true;

  for (const phrase of COUNTER_PHRASES) {
    const thai = /[ก-๙]/.test(phrase);
    if (phraseHit(thai ? flat : space, phrase, thai)) counter = true;
  }
  if (wordHit(space, 'ok') || wordHit(space, 'use this')) counter = true;

  for (const phrase of CANCEL_PHRASES) {
    const thai = /[ก-๙]/.test(phrase);
    if ((thai ? flat : space).includes(phrase)) cancel = true;
  }
  if (wordHit(space, 'no')) cancel = true;

  const tokens = space.split(' ').filter(Boolean);
  for (const token of [flat, ...tokens]) {
    const hit = fuzzyHit(stripParticles(token.replace(/\s+/g, '')));
    if (hit === 'counter_offer' && !thaiNegated(flat, Math.max(0, flat.indexOf(stripParticles(token))))) counter = true;
    if (hit === 'cancel') cancel = true;
  }

  if (counter && cancel) return 'unclear';
  if (counter) return 'counter_offer';
  if (cancel) return 'cancel';
  return 'unclear';
}
