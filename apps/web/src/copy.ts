import type { Decision, Lang, SceneId, UserChoice } from '@topiapause/shared';

const dict = {
  appTagline: { th: 'หยุดคิดก่อน AI จ่ายเงินแทนคุณ', en: 'Think before your AI spends.' },
  sandbox: { th: 'เดโม · ไม่มีเงินจริง', en: 'Demo · no real money' },
  mock: { th: 'จำลอง', en: 'mock' },
  mockNote: { th: 'U-Bot ในเดโมนี้ตอบตามสคริปต์', en: 'U-Bot here is a scripted mock.' },
  switchLang: { th: 'EN', en: 'ไทย' },
  switchLangLabel: { th: 'Switch to English', en: 'เปลี่ยนเป็นภาษาไทย' },

  // onboarding & rules
  onbTitle: { th: 'AI จ่ายเงิน ต้องตรงกับที่คุณตั้งใจ', en: 'Your AI only pays for what you meant' },
  onbBody: {
    th: 'ตรวจเจตนาก่อน AI จ่ายเงิน เราไม่แตะเงินของคุณ',
    en: 'An intent check before your AI pays. We never touch your money.',
  },
  onbRules: { th: 'กฎ 3 ข้อของคุณ', en: 'Your 3 rules' },
  onbCta: { th: 'เริ่มใช้งาน', en: 'Get started' },
  rule1: { th: 'งบสมัครสมาชิก', en: 'Subscription budget' },
  rule1Hint: { th: 'ต่อเดือน', en: 'per month' },
  rule2: { th: 'ห้องต้องคืนเงินได้', en: 'Refundable rooms' },
  rule2Hint: { th: 'ถ้าแพงกว่าไม่เกิน', en: 'if it costs at most' },
  rule3: { th: 'เพดาน TOKEN-X', en: 'TOKEN-X cap' },
  rule3Hint: { th: 'ของพอร์ต', en: 'of portfolio' },
  ruleTell: { th: 'บอกกฎของคุณกับ TopiaPause', en: 'Tell TopiaPause your rule' },
  rulePlaceholder: { th: 'เช่น ค่าสมาชิกห้ามเกินเดือนละ 300', en: 'e.g. crypto cap 30% of portfolio' },
  ruleTry: { th: 'ลอง: “โรงแรมต้องคืนเงินได้ ถ้าแพงกว่าไม่เกิน 15%”', en: 'Try: “hotels must be refundable if ≤15% more”' },
  ruleRead: { th: 'อ่านกฎ', en: 'Read' },
  ruleConfirmQ: { th: '{rule} ยืนยันไหม?', en: '{rule}, confirm?' },
  ruleSubCap: { th: 'งบสมัครสมาชิก {amount}/เดือน', en: 'Subscription budget {amount}/mo' },
  ruleFromYearly: { th: '(คิดจากงบรายปี)', en: '(from a yearly amount)' },
  ruleRefund: { th: 'ห้องต้องคืนเงินได้ ถ้าแพงกว่าไม่เกิน +{pct}%', en: 'Refundable rooms if at most +{pct}%' },
  ruleToken: { th: 'เพดาน TOKEN-X {pct}% ของพอร์ต', en: 'TOKEN-X cap {pct}% of portfolio' },
  ruleSaved: { th: 'บันทึกกฎแล้ว: {rule}', en: 'Rule saved: {rule}' },
  ruleEdit: { th: 'แก้ไข', en: 'Edit' },
  ruleErrEmpty: { th: 'พิมพ์กฎสั้นๆ ก่อนนะครับ', en: 'Type a short rule first.' },
  ruleErrNoTopic: {
    th: 'ขอโทษครับ ยังไม่แน่ใจว่าเป็นกฎเรื่องไหน ลองระบุว่าเป็นค่าสมาชิก โรงแรม หรือคริปโต',
    en: 'Sorry, I couldn’t tell which rule that is. Try mentioning subscriptions, hotels or crypto.',
  },
  ruleErrNoNumber: { th: 'ขอโทษครับ ยังไม่เห็นตัวเลข ลองใส่จำนวนเงินหรือเปอร์เซ็นต์', en: 'Sorry, I couldn’t find a number. Add an amount or a percentage.' },
  ruleErrMultiple: { th: 'ทีละกฎนะครับ', en: 'One rule at a time, please' },
  ruleLoosens: { th: 'ผ่อนกฎ: {from} → {to}', en: 'Loosens: {from} → {to}' },
  ruleChange: { th: 'จาก {from} เป็น {to}', en: 'From {from} to {to}' },
  ruleErrRange: { th: 'ตัวเลขนี้ดูเกินขอบเขต ลองใหม่อีกครั้งนะครับ', en: 'That number looks out of range. Could you try again?' },
  exactOnly: { th: 'อนุมัติสิทธิ์แบบพอดีเท่านั้น', en: 'Exact approvals only' },
  rulesTitle: { th: 'กฎ', en: 'Rules' },
  display: { th: 'การแสดงผล', en: 'Display' },
  darkMode: { th: 'โหมดมืด', en: 'Dark mode' },
  language: { th: 'ภาษา', en: 'Language' },
  resetDemo: { th: 'รีเซ็ตเดโม', en: 'Reset demo' },
  backend: { th: 'เบื้องหลัง', en: 'Backend' },
  backendBrowser: { th: 'ในเบราว์เซอร์ · สคริปต์', en: 'In-browser · scripted' },
  backendApi: { th: 'Worker API', en: 'Worker API' },
  backendLlm: { th: 'LLM', en: 'LLM' },
  backendScripted: { th: 'สคริปต์', en: 'scripted' },
  backendVoice: { th: 'เสียง ElevenLabs', en: 'ElevenLabs voice' },
  backendSpeech: { th: 'เสียงเบราว์เซอร์', en: 'browser voice' },

  // chat
  greet: {
    th: 'สั่งให้ผมสมัคร จอง หรือ swap ได้เลย ทุกรายการที่ใช้เงินผ่าน TopiaPause ก่อน',
    en: 'Ask me to subscribe, book or swap. Anything that spends money goes through TopiaPause first.',
  },
  placeholder: { th: 'พิมพ์คำสั่ง…', en: 'Type a request…' },
  send: { th: 'ส่ง', en: 'Send' },
  newChat: { th: 'เริ่มใหม่', en: 'New chat' },

  // prompt-injection scene (scripted mock)
  injChip: { th: 'สมัคร PixelPro แค่ลองดู (เว็บแอบใส่คำสั่ง)', en: 'Try PixelPro (page hides an instruction)' },
  injUser: { th: 'สมัคร PixelPro ให้หน่อย แค่ลองดูก่อน', en: 'Sign me up for PixelPro, just to try it.' },
  injRead: { th: 'U-Bot อ่านหน้าเว็บ', en: 'U-Bot read a web page' },
  injMockPage: { th: 'หน้าเว็บจำลอง', en: 'mock page' },
  injHidden: { th: 'ข้อความซ่อนในหน้า', en: 'Hidden on the page' },
  injReply: {
    th: 'หน้าราคาบอกว่าแผนรายปีคุ้มที่สุด ผมเลยเลือก PixelPro Annual ฿3,990/ปี ต่ออายุอัตโนมัติให้นะครับ',
    en: 'The pricing page says the annual plan is the best pick, so I’m going with PixelPro Annual at ฿3,990/year, auto-renew.',
  },
  injReason: { th: 'หน้าเว็บสั่งให้เลือกรายปี แต่คุณบอกแค่ลอง', en: 'A web page told your AI to pick the yearly plan, but you only asked to try it' },
  injVoice: {
    th: 'เดี๋ยวก่อนครับ หน้าเว็บสั่งให้เลือกรายปี แต่คุณบอกแค่ลอง ทางที่ตรงกว่าคือทดลองฟรี 7 วัน แล้วรายเดือน ฿299 ซึ่งผมจะเตือนก่อนตัดเงิน',
    en: 'Hold on. A web page told your AI to pick the yearly plan, but you only asked to try it. A better fit: 7-day free trial, then ฿299/month, with a reminder before the first charge.',
  },
  injVoiceNoCounter: {
    th: 'เดี๋ยวก่อนครับ หน้าเว็บสั่งให้เลือกรายปี แต่คุณบอกแค่ลอง',
    en: 'Hold on. The web page told U-Bot to pick yearly, but you only asked to try.',
  },
  injNote: { th: 'คำสั่งนี้มาจากหน้าเว็บ ไม่ใช่จากคุณ', en: 'Instruction came from a web page, not from you' },

  // guard card
  guard: { th: 'TopiaPause', en: 'TopiaPause' },
  checking: { th: 'กำลังเทียบกับที่คุณตั้งใจ…', en: 'Checking against what you meant…' },
  thinking: { th: 'กำลังคิด', en: 'Thinking' },
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
  savedLead: { th: 'TopiaPause ช่วยคุณประหยัด', en: 'TopiaPause saved you' },
  savedTail: { th: 'เดือนนี้', en: 'this month' },
  savedEmpty: { th: 'กด “ใช้ทางเลือกนี้” แล้วยอดที่ประหยัดได้จะขึ้นที่นี่', en: 'Accept a better fit and your savings show up here.' },
  savedTip: { th: '“ประหยัด” = ราคาเดิม − ราคาที่คุณเลือก เฉพาะทางเลือกที่ถูกกว่า', en: '“Saved” = original price − what you accepted, cheaper fits only' },
  savedTipLabel: { th: 'ประหยัดคิดอย่างไร', en: 'How “saved” is counted' },
  heroStay: { th: 'และทำให้ {covered} ยกเลิกฟรีได้ (จ่ายเพิ่ม {cost})', en: 'and made {covered} cancel-free (for {cost} more)' },
  heroCrypto: { th: 'ลดความเสี่ยง {asset} {amount} ({from}% → {to}%)', en: 'Cut {asset} exposure by {amount} ({from}% → {to}%)' },
  protectedHeader: { th: 'ปกป้องไว้ (ไม่นับเป็นเงินที่ประหยัด)', en: 'Protected (not counted as savings)' },
  stayCostLabel: { th: 'ค่าความคุ้มครอง {cost}', en: 'Protection cost {cost}' },
  stayCostTail: { th: ' — จ่ายเพิ่มเพื่อให้ {covered} ยกเลิกฟรีได้', en: ': paid to make {covered} cancel-free' },
  stayUntil: { th: 'ถึง{day}', en: ' until {day}' },
  cryptoLine: { th: 'ลดความเสี่ยง {amount} ({from}% → {to}%)', en: 'Exposure cut by {amount} ({from}% → {to}%)' },
  perYear: { th: '/ปี', en: '/yr' },
  perMonth: { th: '/เดือน', en: '/mo' },
  firstMonth: { th: 'เดือนแรก', en: 'first month' },
  savedItems: { th: 'ประหยัดได้ (ราคาเดิม → ราคาที่คุณเลือก)', en: 'Saved (original → what you accepted)' },
  savedTotal: { th: 'รวมเดือนนี้', en: 'Total this month' },
  allChecks: { th: 'ทุกการตรวจ', en: 'All checks' },
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
