import type { Decision, Lang, SceneId, UserChoice } from '@topiapause/shared';

const dict = {
  appTagline: { th: 'หยุดคิดก่อน AI จ่ายเงินแทนคุณ', en: 'Think before your AI spends.' },
  principle: { th: 'AI เสนอ · กฎตัดสิน · คุณเซ็น', en: 'AI proposes · rules decide · you sign' },
  sandbox: { th: 'Sandbox · ไม่มีเงินจริง', en: 'Sandbox · no real money' },
  ubotSub: { th: 'แชทจำลอง · มี TopiaPause คุ้มกัน', en: 'Simulated agent · guarded by TopiaPause' },
  mockNote: {
    th: 'U-Bot ในเดโมนี้เป็นตัวจำลองที่ตอบตามสคริปต์ ยังไม่ได้เชื่อม U-Bot จริง',
    en: 'U-Bot here is a scripted mock until a real U-Bot API is available.',
  },

  // onboarding & rules
  onbKicker: { th: 'ตั้งกฎ 3 ข้อ ใช้เวลา 10 วินาที', en: 'Set 3 rules in 10 seconds' },
  onbTitle: { th: 'ให้ AI ทำตามที่คุณตั้งใจจริงๆ', en: 'Make your AI do what you meant' },
  onbBody: {
    th: 'AI ทำตามที่คุณพูด TopiaPause ดูให้ว่ามันตรงกับที่คุณตั้งใจ ก่อนจะจ่ายเงิน สมัคร จอง หรืออนุมัติสิทธิ์',
    en: 'AI agents do what you say. TopiaPause makes sure they do what you meant before they pay, subscribe, book or approve.',
  },
  onbCta: { th: 'เริ่มใช้ TopiaPause', en: 'Start with TopiaPause' },
  onbFoot: {
    th: 'ทุกตัวเลขมาจาก rules engine ที่ตรวจสอบได้ ไม่ใช่จาก AI',
    en: 'Every number comes from a tested rules engine, never from the AI.',
  },
  rule1Title: { th: 'งบสมัครสมาชิกรายเดือน', en: 'Monthly subscription cap' },
  rule1Body: { th: 'แจ้งเตือนเมื่อแพ็กเกจเฉลี่ยต่อเดือนเกินงบ หรือผูกมัดนานกว่าที่ตั้งใจ', en: 'Pause plans over this per month, or longer than you meant.' },
  rule2Title: { th: 'แผนอาจเปลี่ยน = ต้องคืนเงินได้', en: 'Plans may change = refundable' },
  rule2Body: { th: 'เสนอห้องที่ยกเลิกฟรีได้ ถ้าแพงกว่าไม่เกิน', en: 'Offer a free-cancellation option if it costs at most' },
  rule3Title: { th: 'เพดานคริปโต + อนุมัติครั้งเดียว', en: 'Crypto cap + one-time approvals' },
  rule3Body: { th: 'TOKEN-X ไม่เกินสัดส่วนนี้ของพอร์ต และอนุมัติสิทธิ์แค่เท่าที่ใช้', en: 'Keep TOKEN-X under this share, approve only the exact amount.' },
  perMonth: { th: '/เดือน', en: '/month' },
  ofPortfolio: { th: 'ของพอร์ต', en: 'of portfolio' },
  exactOnly: { th: 'อนุมัติแบบจำนวนพอดีเท่านั้น', en: 'Exact approvals only' },
  premiumMore: { th: 'แพงกว่า', en: 'more' },
  on: { th: 'เปิด', en: 'On' },
  off: { th: 'ปิด', en: 'Off' },
  rulesTitle: { th: 'กฎของคุณ', en: 'Your rules' },
  rulesBody: { th: 'TopiaPause ใช้กฎเหล่านี้ตรวจทุกข้อเสนอของ agent', en: 'TopiaPause checks every agent proposal against these.' },
  resetDemo: { th: 'รีเซ็ตเดโม', en: 'Reset demo' },
  showOnboarding: { th: 'ดูหน้าแนะนำอีกครั้ง', en: 'Show onboarding again' },

  // chat
  greet: {
    th: 'สวัสดีครับ ผมคือ U-Bot (mock) สั่งให้ผมสมัคร จอง หรือ swap ได้เลย ทุกคำสั่งที่ใช้เงินจะผ่าน TopiaPause ก่อนเสมอ',
    en: "Hi, I'm U-Bot (mock). Ask me to subscribe, book or swap. Anything that spends money goes through TopiaPause first.",
  },
  tryScene: { th: 'ลองฉากเดโม', en: 'Try a demo scene' },
  placeholder: { th: 'พิมพ์คำสั่ง เช่น "แลก 300 USDT ครั้งเดียว"', en: 'Type, e.g. "swap 300 USDT just once"' },
  send: { th: 'ส่ง', en: 'Send' },
  micSoon: { th: 'พูดสั่งงาน (เร็วๆ นี้)', en: 'Voice input (coming soon)' },
  newChat: { th: 'เริ่มใหม่', en: 'New chat' },

  // guard card
  guard: { th: 'TopiaPause Guard', en: 'TopiaPause Guard' },
  checking: { th: 'กำลังเทียบกับสิ่งที่คุณตั้งใจ…', en: 'Comparing with what you meant…' },
  youSaid: { th: 'คุณพูดว่า', en: 'You said' },
  agentAbout: { th: 'Agent กำลังจะ', en: 'Agent is about to' },
  saferOption: { th: 'ทางเลือกที่ตรงกว่า', en: 'Safer option' },
  recheckedAllow: { th: 'ตรวจซ้ำแล้ว ผ่านทุกกฎ', en: 'Re-checked: passes every rule' },
  useSafer: { th: 'ใช้ทางเลือกที่ปลอดภัยกว่า', en: 'Use safer option' },
  proceed: { th: 'ทำตามเดิม', en: 'Proceed anyway' },
  proceedBlocked: { th: 'ทำต่อไม่ได้ (ถูกบล็อก)', en: 'Blocked' },
  confirm: { th: 'ยืนยัน', en: 'Confirm' },
  cancel: { th: 'ยกเลิก', en: 'Cancel' },
  why: { th: 'ทำไม?', en: 'Why?' },
  whyCrypto: { th: 'ทำไมแค่', en: 'Why only' },
  details: { th: 'คำอธิบายและสมมติฐาน', en: 'Explanation & assumptions' },
  noCounter: { th: 'ไม่มีทางเลือกที่ผ่านกฎทั้งหมด ตัดสินใจเองได้ครับ', en: 'No option passes every rule. Your call.' },
  blockedNote: { th: 'รายการนี้ขัดกับกฎแบบที่ต้องหยุด ไม่มีการทำรายการ', en: 'This conflicts with a hard rule. Nothing will execute.' },
  allowNote: { th: 'ตรงกับที่คุณตั้งใจ ยืนยันเพื่อทำรายการจำลอง', en: 'Matches what you meant. Confirm to run the mock action.' },
  recheckTitle: { th: 'ทางเลือกใหม่ตรงกับที่คุณตั้งใจ', en: 'The new option matches what you meant' },
  recheckSub: { th: 'กำลังทำรายการจำลองผ่าน U-Bot (mock)…', en: 'Running the mock action via U-Bot (mock)…' },
  chosenCounter: { th: 'คุณเลือกทางเลือกที่ปลอดภัยกว่า', en: 'You chose the safer option' },
  chosenOriginal: { th: 'คุณเลือกทำตามข้อเสนอเดิม', en: 'You chose the original proposal' },
  chosenCancel: { th: 'คุณยกเลิกรายการนี้', en: 'You cancelled this action' },
  explanationSource: { th: 'คำอธิบายจาก template (ล็อกตัวเลขจาก engine)', en: 'Template explanation (numbers locked to the engine)' },
  listen: { th: 'ฟังคำเตือน', en: 'Listen' },
  stop: { th: 'หยุด', en: 'Stop' },
  voiceClip: { th: 'คลิป ElevenLabs ที่บันทึกไว้', en: 'Pre-generated ElevenLabs clip' },
  voiceSpeech: { th: 'เสียงเบราว์เซอร์ (สำรอง)', en: 'Browser voice (fallback)' },
  voiceNone: { th: 'อุปกรณ์นี้ไม่รองรับเสียง แสดงเป็นข้อความ', en: 'No voice on this device. Text only.' },

  // receipt
  receipt: { th: 'ใบเสร็จ', en: 'Receipt' },
  asked: { th: 'คุณขอ', en: 'You asked' },
  proposed: { th: 'Agent เสนอ', en: 'Agent proposed' },
  approved: { th: 'คุณอนุมัติ', en: 'You approved' },
  nothingApproved: { th: 'ไม่มี (ยกเลิก)', en: 'Nothing (cancelled)' },
  moneyProtected: { th: 'เงินที่ปกป้องไว้', en: 'Money protected' },
  decisionLbl: { th: 'ผลตรวจ', en: 'Guard decision' },
  time: { th: 'เวลา', en: 'Time' },
  execution: { th: 'การทำรายการ', en: 'Execution' },
  execMock: { th: 'จำลอง · สำเร็จ', en: 'Mock · success' },
  execSkipped: { th: 'ไม่ได้ทำรายการ', en: 'Not executed' },

  // activity
  activity: { th: 'กิจกรรม', en: 'Activity' },
  protectedMonth: { th: 'ปกป้องไว้แล้วเดือนนี้', en: 'Protected this month' },
  keptUnderCap: { th: 'กันไว้ไม่ให้เกินเพดานคริปโต', en: 'kept under your crypto cap' },
  checks: { th: 'ตรวจแล้ว', en: 'Checks' },
  paused: { th: 'หยุดไว้', en: 'Paused' },
  saferChosen: { th: 'เลือกทางที่ปลอดภัย', en: 'Safer chosen' },
  emptyActivity: { th: 'ยังไม่มีกิจกรรม ลองฉากเดโมในแชทดูครับ', en: 'No activity yet. Try a demo scene in chat.' },
  goChat: { th: 'ไปที่แชท', en: 'Go to chat' },

  // nav
  navChat: { th: 'แชท', en: 'Chat' },
  navActivity: { th: 'กิจกรรม', en: 'Activity' },
  navRules: { th: 'กฎ', en: 'Rules' },
  howItWorks: { th: 'ทำงานอย่างไร', en: 'How it works' },
  how1: { th: 'U-Bot (mock) เสนอรายการ', en: 'U-Bot (mock) proposes an action' },
  how2: { th: 'Rules engine เทียบกับที่คุณตั้งใจ', en: 'Rules engine compares it with your intent' },
  how3: { th: 'เสนอทางที่ตรงกว่า แล้วตรวจซ้ำ', en: 'Offers a better fit, then re-checks it' },
  how4: { th: 'คุณยืนยัน ได้ใบเสร็จ', en: 'You confirm and get a receipt' },
  language: { th: 'ภาษา', en: 'Language' },
  theme: { th: 'ธีม', en: 'Theme' },
} satisfies Record<string, Record<Lang, string>>;

export type CopyKey = keyof typeof dict;

export function t(lang: Lang, key: CopyKey): string {
  return dict[key][lang];
}

export const DECISION_LABEL: Record<Decision, Record<Lang, string>> = {
  allow: { th: 'ผ่าน · Allow', en: 'Allow' },
  pause: { th: 'หยุดก่อน · Pause', en: 'Pause' },
  block: { th: 'บล็อก · Block', en: 'Block' },
};

export const SCENE_TITLE: Record<SceneId, Record<Lang, string>> = {
  subscription: { th: 'สมัครแอป PixelPro', en: 'PixelPro subscription' },
  stay: { th: 'จองโรงแรมใกล้อโศก', en: 'Hotel near Asok' },
  crypto: { th: 'Swap USDT → TOKEN-X', en: 'Swap USDT → TOKEN-X' },
};

export const CHOICE_LABEL: Record<UserChoice, Record<Lang, string>> = {
  counter_offer: { th: 'เลือกทางเลือกที่ปลอดภัยกว่า', en: 'Chose the safer option' },
  original: { th: 'ทำตามข้อเสนอเดิม', en: 'Went with the original' },
  cancel: { th: 'ยกเลิก', en: 'Cancelled' },
};
