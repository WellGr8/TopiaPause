import { describe, expect, it } from 'vitest';
import { mapVoiceIntent } from '../src/voiceIntent';

describe('mapVoiceIntent', () => {
  it.each([
    ['เอาแบบถูก', 'counter_offer'],
    ['เอาอันที่แนะนำ', 'counter_offer'],
    ['ยืนยัน', 'counter_offer'],
    ['ตกลงครับ', 'counter_offer'],
    ['ยกเลิก', 'cancel'],
    ['ไม่เอา', 'cancel'],
    ['ไม่เอาแบบถูก', 'cancel'],
    ['ไม่ยืนยัน', 'unclear'],
    ['confirm', 'counter_offer'],
    ['yes', 'counter_offer'],
    ['take the recommended one', 'counter_offer'],
    ['the cheaper one', 'counter_offer'],
    ['use this', 'counter_offer'],
    ['cancel', 'cancel'],
    ['no thanks', 'cancel'],
    ["don't confirm", 'unclear'],
    ['do not take the recommended', 'unclear'],
    ['ยืนยันและยกเลิก', 'unclear'],
    ['confirm and cancel', 'unclear'],
    ['อะไรนะ', 'unclear'],
    ['', 'unclear'],
    ['นี่นะนำ', 'counter_offer'],
    ['คุณพี่แนะนำ', 'counter_offer'],
    ['เอา อันที่ แนะนำ', 'counter_offer'],
    ['โอเคครับ', 'counter_offer'],
    ['ไม่เอาที่แนะนำ', 'cancel'],
    ['ไม่ต้อง', 'cancel'],
    ['तगलग', 'unclear'],
    ['asdf qwerty', 'unclear'],
    ['ตกลง ยกเลิก', 'unclear'],
    ['ตกลอง', 'counter_offer'],
  ] as const)('%j → %s', (transcript, action) => {
    expect(mapVoiceIntent(transcript)).toBe(action);
  });

  it('does not treat a negation as confirming the paused original', () => {
    expect(mapVoiceIntent('ไม่เอา')).not.toBe('counter_offer');
    expect(mapVoiceIntent("don't confirm")).not.toBe('counter_offer');
    expect(mapVoiceIntent('ไม่เอาอันที่แนะนำ')).toBe('cancel');
  });
});
