import type { Decision, Lang, SceneId, UserChoice } from '@topiapause/shared';

const dict = {
  appTagline: { th: 'หยุดคิดก่อน AI จ่ายเงินแทนคุณ', en: 'Think before your AI spends.' },
  sandbox: { th: 'เดโม · ไม่มีเงินจริง', en: 'Demo · no real money' },
  mock: { th: 'จำลอง', en: 'mock' },
  mockNote: { th: 'U-Bot ในเดโมนี้ตอบตามสคริปต์', en: 'U-Bot here is a scripted mock.' },
  switchLang: { th: 'EN', en: 'ไทย' },
  switchLangLabel: { th: 'Switch to English', en: 'เปลี่ยนเป็นภาษาไทย' },

  // onboarding & rules
  onbTitle: { th: 'ให้ AI ทำตามที่คุณตั้งใจ', en: 'Make your AI do what you meant' },
  onbBody: {
    th: 'TopiaPause หยุดรายการที่ไม่ตรงกับที่คุณพูด ก่อนเงินจะออกจากกระเป๋า',
    en: 'TopiaPause stops anything that doesn’t match what you said, before money moves.',
  },
  onbRules: { th: 'กฎ 3 ข้อของคุณ', en: 'Your 3 rules' },
  onbCta: { th: 'เริ่มใช้งาน', en: 'Get started' },
  rule1: { th: 'งบสมัครสมาชิก', en: 'Subscription budget' },
  rule1Hint: { th: 'ต่อเดือน', en: 'per month' },
  rule2: { th: 'ห้องต้องคืนเงินได้', en: 'Refundable rooms' },
  rule2Hint: { th: 'ถ้าแพงกว่าไม่เกิน', en: 'if it costs at most' },
  rule3: { th: 'เพดาน TOKEN-X', en: 'TOKEN-X cap' },
  rule3Hint: { th: 'ของพอร์ต', en: 'of portfolio' },
  exactOnly: { th: 'อนุมัติสิทธิ์แบบพอดีเท่านั้น', en: 'Exact approvals only' },
  rulesTitle: { th: 'กฎ', en: 'Rules' },
  display: { th: 'การแสดงผล', en: 'Display' },
  darkMode: { th: 'โหมดมืด', en: 'Dark mode' },
  language: { th: 'ภาษา', en: 'Language' },
  resetDemo: { th: 'รีเซ็ตเดโม', en: 'Reset demo' },

  // chat
  greet: {
    th: 'สั่งให้ผมสมัคร จอง หรือ swap ได้เลย ทุกรายการที่ใช้เงินผ่าน TopiaPause ก่อน',
    en: 'Ask me to subscribe, book or swap. Anything that spends money goes through TopiaPause first.',
  },
  placeholder: { th: 'พิมพ์คำสั่ง…', en: 'Type a request…' },
  send: { th: 'ส่ง', en: 'Send' },
  newChat: { th: 'เริ่มใหม่', en: 'New chat' },

  // guard card
  guard: { th: 'TopiaPause', en: 'TopiaPause' },
  checking: { th: 'กำลังเทียบกับที่คุณตั้งใจ…', en: 'Checking against what you meant…' },
  betterFit: { th: 'ทางเลือกที่ตรงกว่า', en: 'Better fit' },
  passesRules: { th: 'ผ่านกฎทุกข้อ', en: 'Passes every rule' },
  useThis: { th: 'ใช้ทางเลือกนี้', en: 'Use this' },
  proceed: { th: 'ทำตามเดิม', en: 'Keep original' },
  confirm: { th: 'ยืนยัน', en: 'Confirm' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  showReasons: { th: 'ดูเหตุผล', en: 'See why' },
  hideReasons: { th: 'ซ่อนเหตุผล', en: 'Hide' },
  youSaid: { th: 'คุณพูดว่า', en: 'You said' },
  agentAbout: { th: 'Agent จะ', en: 'Agent will' },
  findings: { th: 'สิ่งที่ไม่ตรง', en: 'What doesn’t match' },
  assumptions: { th: 'สมมติฐาน', en: 'Assumptions' },
  engineNote: { th: 'ตัวเลขทั้งหมดจาก rules engine', en: 'All numbers from the rules engine' },
  noCounter: { th: 'ไม่มีทางเลือกที่ผ่านทุกกฎ', en: 'No option passes every rule.' },
  blockedNote: { th: 'ขัดกับกฎ ไม่มีการทำรายการ', en: 'Breaks a rule. Nothing will run.' },
  rechecking: { th: 'กำลังตรวจทางเลือกใหม่…', en: 'Re-checking the new option…' },
  doneCounter: { th: 'ตรวจซ้ำผ่าน · ทำรายการแล้ว', en: 'Re-checked · done' },
  doneOriginal: { th: 'ทำตามเดิมแล้ว', en: 'Went with the original' },
  doneCancel: { th: 'ยกเลิกแล้ว · ไม่มีการจ่ายเงิน', en: 'Cancelled · nothing paid' },
  saved: { th: 'ปกป้องไว้', en: 'Protected' },
  viewReceipt: { th: 'ดูใบเสร็จ', en: 'Receipt' },
  listen: { th: 'ฟัง', en: 'Listen' },
  stop: { th: 'หยุดเสียง', en: 'Stop' },

  // activity + receipt
  activity: { th: 'กิจกรรม', en: 'Activity' },
  protectedMonth: { th: 'ปกป้องไว้เดือนนี้', en: 'Protected this month' },
  inCrypto: { th: 'ในคริปโต', en: 'in crypto' },
  statLine: { th: 'ตรวจ {n} ครั้ง · หยุด {p} · เลือกทางที่ตรงกว่า {s}', en: '{n} checks · {p} paused · {s} better fits' },
  emptyActivity: { th: 'ยังไม่มีรายการ', en: 'Nothing yet' },
  goChat: { th: 'ลองในแชท', en: 'Try it in chat' },
  asked: { th: 'คุณขอ', en: 'You asked' },
  proposed: { th: 'Agent เสนอ', en: 'Agent proposed' },
  approved: { th: 'คุณอนุมัติ', en: 'You approved' },
  nothingApproved: { th: 'ไม่มี', en: 'Nothing' },
  execution: { th: 'รายการ', en: 'Execution' },
  execMock: { th: 'จำลอง', en: 'Mock' },
  execSkipped: { th: 'ไม่ได้ทำ', en: 'Not run' },
  time: { th: 'เวลา', en: 'Time' },

  // nav
  navChat: { th: 'แชท', en: 'Chat' },
  navActivity: { th: 'กิจกรรม', en: 'Activity' },
  navRules: { th: 'กฎ', en: 'Rules' },
} satisfies Record<string, Record<Lang, string>>;

export type CopyKey = keyof typeof dict;

export function t(lang: Lang, key: CopyKey, vars?: Record<string, string | number>): string {
  let s: string = dict[key][lang];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, String(v));
  return s;
}

export const DECISION_LABEL: Record<Decision, Record<Lang, string>> = {
  allow: { th: 'ผ่าน', en: 'Looks right' },
  pause: { th: 'หยุดก่อน', en: 'Pause' },
  block: { th: 'บล็อก', en: 'Blocked' },
};

export const SCENE_TITLE: Record<SceneId, Record<Lang, string>> = {
  subscription: { th: 'PixelPro', en: 'PixelPro' },
  stay: { th: 'โรงแรมใกล้อโศก', en: 'Hotel near Asok' },
  crypto: { th: 'Swap TOKEN-X', en: 'Swap TOKEN-X' },
};

export const CHOICE_LABEL: Record<UserChoice, Record<Lang, string>> = {
  counter_offer: { th: 'ทางที่ตรงกว่า', en: 'Better fit' },
  original: { th: 'ทำตามเดิม', en: 'Original' },
  cancel: { th: 'ยกเลิก', en: 'Cancelled' },
};
