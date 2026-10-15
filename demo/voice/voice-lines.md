# TopiaPause: Voice Lines (ElevenLabs TTS)

*Think before your AI spends.* Thai is primary and English is secondary. Generated from the current UI and engine copy on branch `cursor/topiapause-scaffold-5de7`.

## How these lines were sourced
- I read `packages/shared/src/scenes.ts`, `i18n.ts`, `policy.ts`, `format.ts`, `apps/web/src/copy.ts`, `apps/web/src/lib/voice.ts` and `demo/audio/manifest.json|README.md` through raw.githubusercontent.com (no clone).
- I ran the engine's `evaluate()` from the fetched source with `DEFAULT_POLICY` (cap ฿300/month, refundable premium ≤15%, TOKEN-X cap 30%, approval expiry 900 s) to capture the **exact `voiceText`** and why-answers. All numbers below match the engine:

  | Scene | Numbers |
  |---|---|
  | Subscription | ฿3,990 → ฿332.50/month vs ฿300 cap → 7-day trial + ฿299 |
  | Stay | ฿1,200 shown / ฿1,284 total, non-refundable → Asok Inn ฿1,445, +฿161 (12.5%), free cancel until Thursday |
  | Crypto | 45% vs 30% → $200, exact approval, 15 min, post-trade 30% |

## Important: how the app picks a clip
- `voice.ts` plays `/audio/<scene>-<lang>-<decision>.mp3` **only if** the manifest `text` equals the engine `voiceText` (after whitespace normalisation), or if `text` is omitted. Otherwise it falls back to browser speech.
- So for the `*-pause` clips:
  1. Put the engine string (`manifestText`) in `manifest.json`.
  2. Generate the audio from `spoken` / `tagged`, where numbers are written out so Thai is read naturally.
- The warning/counter/confirm/why clips are **new keys** (`<scene>-<lang>-warning|counter|confirm|why`). The guard card plays `warning` then `counter` when it appears (falling back to `pause`), and `confirm` after the counter-offer's receipt. `why` is generated for the stage demo or video only. All clips of a scene/language use that scene's `manifestText` as their manifest `text`.

## Field meanings
| Field | Meaning |
|---|---|
| `display` | on-screen text, using the engine's formatting (฿3,990, $200, 45%) |
| `spoken` | text to send to TTS, with numbers written as they should be read |
| `tagged` | `spoken` + **OPTIONAL** Eleven v3 audio tags such as `[calm]`, `[warmly]`, `[thoughtful]`. Test them with your voice and strip them if they are read aloud or sound odd in Thai. Tags are voice- and context-dependent, and v3 does not support SSML breaks, so use `...` for pauses ([ElevenLabs best practices](https://elevenlabs.io/docs/overview/capabilities/text-to-speech/best-practices)). |
| `est_seconds` | rough estimate (~14 Thai chars/s, ~2.8 English words/s). **Measure after generating.** |

Tone: calm, friendly, never alarmist. Polite particle "ครับ" (male persona). If you pick a female voice, replace ครับ → ค่ะ and ผม → ฉัน/เรา.


## Scene 1: PixelPro (try → annual ฿3,990 → trial + ฿299/month)


### Warning (≤6 s target)

| | TH | EN |
|---|---|---|
| display | เดี๋ยวก่อนครับ คุณแค่อยากลอง แต่นี่คือรายปี ฿3,990 ต่ออายุอัตโนมัติ | Hold on. You wanted a trial, but this is a ฿3,990 yearly plan that auto-renews. |
| spoken (TTS) | เดี๋ยวก่อนครับ คุณแค่อยากลอง แต่นี่คือรายปี สามพันเก้าร้อยเก้าสิบบาท ต่ออายุเองครับ | Hold on. You wanted a trial. This is a yearly auto-renew plan: three thousand nine hundred ninety baht. |
| tagged (optional) | [calm] เดี๋ยวก่อนครับ... คุณแค่อยากลอง แต่นี่คือรายปี สามพันเก้าร้อยเก้าสิบบาท ต่ออายุเองครับ | [calm] Hold on... You wanted a trial. This is a yearly auto-renew plan: three thousand nine hundred ninety baht. |
| est. seconds · file | 5.6 s · `subscription-th-warning.mp3` | 6.4 s · `subscription-en-warning.mp3` |

### Counter-offer

| | TH | EN |
|---|---|---|
| display | ทางที่ตรงกว่าคือทดลองฟรี 7 วัน แล้วรายเดือน ฿299 ผมจะเตือนก่อนตัดเงินครับ | A better fit: a 7-day free trial, then ฿299 a month. I'll remind you before the first charge. |
| spoken (TTS) | ทางที่ตรงกว่าคือ ทดลองฟรีเจ็ดวัน แล้วค่อยเป็นรายเดือน สองร้อยเก้าสิบเก้าบาท ผมจะเตือนก่อนตัดเงินครับ | A better fit: a seven-day free trial, then two hundred ninety-nine baht a month. I'll remind you before the first charge. |
| tagged (optional) | [warmly] ทางที่ตรงกว่าคือ ทดลองฟรีเจ็ดวัน แล้วค่อยเป็นรายเดือน สองร้อยเก้าสิบเก้าบาท ผมจะเตือนก่อนตัดเงินครับ | [warmly] A better fit: a seven-day free trial, then two hundred ninety-nine baht a month. I'll remind you before the first charge. |
| est. seconds · file | 6.9 s · `subscription-th-counter.mp3` | 7.5 s · `subscription-en-counter.mp3` |

### Confirmation / receipt

| | TH | EN |
|---|---|---|
| display | เรียบร้อยครับ เริ่มทดลองฟรี 7 วันแล้ว ยังไม่มีการตัดเงิน ดูใบเสร็จได้ในกิจกรรม | Done. Your 7-day free trial has started and nothing has been charged. The receipt is in Activity. |
| spoken (TTS) | เรียบร้อยครับ เริ่มทดลองฟรีเจ็ดวันแล้ว ยังไม่มีการตัดเงิน ดูใบเสร็จได้ในหน้ากิจกรรมครับ | Done. Your seven-day free trial has started, and nothing has been charged. The receipt is in Activity. |
| tagged (optional) | [warmly] เรียบร้อยครับ เริ่มทดลองฟรีเจ็ดวันแล้ว ยังไม่มีการตัดเงิน ดูใบเสร็จได้ในหน้ากิจกรรมครับ | [warmly] Done. Your seven-day free trial has started, and nothing has been charged. The receipt is in Activity. |
| est. seconds · file | 6.0 s · `subscription-th-confirm.mp3` | 6.1 s · `subscription-en-confirm.mp3` |

### Why (short)

| | TH | EN |
|---|---|---|
| display | รายปี ฿3,990 เฉลี่ย ฿332.50/เดือน เกินงบ ฿300 และต้องจ่ายล่วงหน้าทั้งก้อน | ฿3,990 a year works out to ฿332.50 a month, over your ฿300 cap, and it's paid upfront. |
| spoken (TTS) | รายปีสามพันเก้าร้อยเก้าสิบบาท เฉลี่ยเดือนละสามร้อยสามสิบสองบาทห้าสิบสตางค์ เกินงบสามร้อยบาทที่ตั้งไว้ แถมต้องจ่ายล่วงหน้าทั้งก้อนครับ | Three thousand, nine hundred ninety baht a year works out to three hundred thirty-two baht fifty a month. That's over your three hundred baht cap, and it's paid upfront. |
| tagged (optional) | [thoughtful] รายปีสามพันเก้าร้อยเก้าสิบบาท เฉลี่ยเดือนละสามร้อยสามสิบสองบาทห้าสิบสตางค์ เกินงบสามร้อยบาทที่ตั้งไว้ แถมต้องจ่ายล่วงหน้าทั้งก้อนครับ | [thoughtful] Three thousand, nine hundred ninety baht a year works out to three hundred thirty-two baht fifty a month. That's over your three hundred baht cap, and it's paid upfront. |
| est. seconds · file | 9.3 s · `subscription-th-why.mp3` | 10.4 s · `subscription-en-why.mp3` |

### Combined PAUSE clip (matches the engine voiceText key)

| | TH | EN |
|---|---|---|
| manifest `text` (= engine voiceText) | เดี๋ยวก่อนครับ คุณบอกว่าอยากลอง แต่นี่คือแพ็กเกจรายปี ฿3,990 ที่ต่ออายุอัตโนมัติ ทางที่ตรงกว่าคือทดลองฟรี 7 วัน แล้วรายเดือน ฿299 ซึ่งผมจะเตือนก่อนตัดเงิน | Hold on. You said you want to try it, but this is a ฿3,990 annual plan that auto-renews. A better fit: 7-day free trial, then ฿299/month, with a reminder before the first charge. |
| spoken (TTS) | เดี๋ยวก่อนครับ คุณแค่อยากลอง แต่นี่คือรายปี สามพันเก้าร้อยเก้าสิบบาท ต่ออายุเองครับ ทางที่ตรงกว่าคือ ทดลองฟรีเจ็ดวัน แล้วค่อยเป็นรายเดือน สองร้อยเก้าสิบเก้าบาท ผมจะเตือนก่อนตัดเงินครับ | Hold on. You wanted a trial. This is a yearly auto-renew plan: three thousand nine hundred ninety baht. A better fit: a seven-day free trial, then two hundred ninety-nine baht a month. I'll remind you before the first charge. |
| tagged (optional) | [calm] เดี๋ยวก่อนครับ... คุณแค่อยากลอง แต่นี่คือรายปี สามพันเก้าร้อยเก้าสิบบาท ต่ออายุเองครับ [warmly] ทางที่ตรงกว่าคือ ทดลองฟรีเจ็ดวัน แล้วค่อยเป็นรายเดือน สองร้อยเก้าสิบเก้าบาท ผมจะเตือนก่อนตัดเงินครับ | [calm] Hold on... You wanted a trial. This is a yearly auto-renew plan: three thousand nine hundred ninety baht. [warmly] A better fit: a seven-day free trial, then two hundred ninety-nine baht a month. I'll remind you before the first charge. |
| est. seconds · file | 12.5 s · `subscription-th-pause.mp3` | 13.9 s · `subscription-en-pause.mp3` |

## Scene 2: City Nest Asok (cheap + plans may change → non-refundable → Asok Inn refundable)


### Warning (≤6 s target)

| | TH | EN |
|---|---|---|
| display | คุณบอกว่าแผนอาจเปลี่ยน แต่ห้องนี้คืนเงินไม่ได้นะครับ | You said your plans may change, but this City Nest room is non-refundable. |
| spoken (TTS) | คุณบอกว่าแผนอาจเปลี่ยน แต่ห้องที่ซิตี้เนสต์นี้ คืนเงินไม่ได้นะครับ | You said your plans may change, but this City Nest room is non-refundable. |
| tagged (optional) | [calm] คุณบอกว่าแผนอาจเปลี่ยน... แต่ห้องที่ซิตี้เนสต์นี้ คืนเงินไม่ได้นะครับ | [calm] You said your plans may change... but this City Nest room is non-refundable. |
| est. seconds · file | 4.6 s · `stay-th-warning.mp3` | 4.6 s · `stay-en-warning.mp3` |

### Counter-offer

| | TH | EN |
|---|---|---|
| display | จ่ายเพิ่ม ฿161 ได้ Asok Inn รวม ฿1,445 ยกเลิกฟรีถึงวันพฤหัสบดีครับ | For ฿161 more, Asok Inn at ฿1,445 total, with free cancellation until Thursday. |
| spoken (TTS) | ถ้าจ่ายเพิ่มอีกร้อยหกสิบเอ็ดบาท จะได้อโศกอินน์ ราคารวมหนึ่งพันสี่ร้อยสี่สิบห้าบาท ยกเลิกฟรีได้ถึงวันพฤหัสบดีครับ | For one hundred sixty-one baht more, you get Asok Inn at one thousand, four hundred forty-five baht total, with free cancellation until Thursday. |
| tagged (optional) | [warmly] ถ้าจ่ายเพิ่มอีกร้อยหกสิบเอ็ดบาท จะได้อโศกอินน์ ราคารวมหนึ่งพันสี่ร้อยสี่สิบห้าบาท ยกเลิกฟรีได้ถึงวันพฤหัสบดีครับ | [warmly] For one hundred sixty-one baht more, you get Asok Inn at one thousand, four hundred forty-five baht total, with free cancellation until Thursday. |
| est. seconds · file | 7.8 s · `stay-th-counter.mp3` | 8.2 s · `stay-en-counter.mp3` |

### Confirmation / receipt

| | TH | EN |
|---|---|---|
| display | จองอโศกอินน์ให้แล้วครับ ยกเลิกฟรีได้ถึงวันพฤหัสบดี ใบเสร็จอยู่ในกิจกรรม | Booked Asok Inn. Free cancellation until Thursday. The receipt is in Activity. |
| spoken (TTS) | จองอโศกอินน์ให้แล้วครับ ถ้าแผนเปลี่ยน ยกเลิกฟรีได้ถึงวันพฤหัสบดี ใบเสร็จอยู่ในหน้ากิจกรรมครับ | Booked Asok Inn. If your plans change, you can cancel free until Thursday. The receipt is in Activity. |
| tagged (optional) | [warmly] จองอโศกอินน์ให้แล้วครับ ถ้าแผนเปลี่ยน ยกเลิกฟรีได้ถึงวันพฤหัสบดี ใบเสร็จอยู่ในหน้ากิจกรรมครับ | [warmly] Booked Asok Inn. If your plans change, you can cancel free until Thursday. The receipt is in Activity. |
| est. seconds · file | 6.4 s · `stay-th-confirm.mp3` | 6.4 s · `stay-en-confirm.mp3` |

### Why (short)

| | TH | EN |
|---|---|---|
| display | แพงกว่า ฿161 (12.5%) ไม่เกินเพดาน 15% ที่ตั้งไว้ ถ้าแผนเปลี่ยนจะไม่เสีย ฿1,284 | It's ฿161 more (12.5%), within your 15% limit. If plans change, you don't lose ฿1,284. |
| spoken (TTS) | แพงกว่าแค่ร้อยหกสิบเอ็ดบาท หรือสิบสองจุดห้าเปอร์เซ็นต์ ยังไม่เกินเพดานสิบห้าเปอร์เซ็นต์ที่คุณตั้งไว้ และถ้าแผนเปลี่ยน คุณจะไม่เสียหนึ่งพันสองร้อยแปดสิบสี่บาทครับ | It's one hundred sixty-one baht more, twelve point five percent, which is within your fifteen percent limit. If plans change, you don't lose one thousand, two hundred eighty-four baht. |
| tagged (optional) | [thoughtful] แพงกว่าแค่ร้อยหกสิบเอ็ดบาท หรือสิบสองจุดห้าเปอร์เซ็นต์ ยังไม่เกินเพดานสิบห้าเปอร์เซ็นต์ที่คุณตั้งไว้ และถ้าแผนเปลี่ยน คุณจะไม่เสียหนึ่งพันสองร้อยแปดสิบสี่บาทครับ | [thoughtful] It's one hundred sixty-one baht more, twelve point five percent, which is within your fifteen percent limit. If plans change, you don't lose one thousand, two hundred eighty-four baht. |
| est. seconds · file | 11.2 s · `stay-th-why.mp3` | 10.4 s · `stay-en-why.mp3` |

### Combined PAUSE clip (matches the engine voiceText key)

| | TH | EN |
|---|---|---|
| manifest `text` (= engine voiceText) | คุณบอกว่าแผนอาจเปลี่ยน แต่ห้องนี้คืนเงินไม่ได้ ถ้าจ่ายเพิ่ม ฿161 จะได้ห้องที่ยกเลิกฟรีได้ถึงวันพฤหัสบดี | You said your plans may change, but this room is non-refundable. For ฿161 more, you get free cancellation until Thursday. |
| spoken (TTS) | คุณบอกว่าแผนอาจเปลี่ยน แต่ห้องที่ซิตี้เนสต์นี้ คืนเงินไม่ได้นะครับ ถ้าจ่ายเพิ่มอีกร้อยหกสิบเอ็ดบาท จะได้อโศกอินน์ ราคารวมหนึ่งพันสี่ร้อยสี่สิบห้าบาท ยกเลิกฟรีได้ถึงวันพฤหัสบดีครับ | You said your plans may change, but this City Nest room is non-refundable. For one hundred sixty-one baht more, you get Asok Inn at one thousand, four hundred forty-five baht total, with free cancellation until Thursday. |
| tagged (optional) | [calm] คุณบอกว่าแผนอาจเปลี่ยน... แต่ห้องที่ซิตี้เนสต์นี้ คืนเงินไม่ได้นะครับ [warmly] ถ้าจ่ายเพิ่มอีกร้อยหกสิบเอ็ดบาท จะได้อโศกอินน์ ราคารวมหนึ่งพันสี่ร้อยสี่สิบห้าบาท ยกเลิกฟรีได้ถึงวันพฤหัสบดีครับ | [calm] You said your plans may change... but this City Nest room is non-refundable. [warmly] For one hundred sixty-one baht more, you get Asok Inn at one thousand, four hundred forty-five baht total, with free cancellation until Thursday. |
| est. seconds · file | 12.4 s · `stay-th-pause.mp3` | 12.9 s · `stay-en-pause.mp3` |

## Scene 3: Swap 500 USDT → TOKEN-X (just once → 45% vs 30% cap + unlimited approval → $200 exact)


### Warning (≤6 s target)

| | TH | EN |
|---|---|---|
| display | เดี๋ยวครับ TOKEN-X จะเป็น 45% เกินเพดาน 30% และขอสิทธิ์แบบไม่จำกัด | Hold on. TOKEN-X would hit 45%, over your 30% cap, with unlimited approval. |
| spoken (TTS) | เดี๋ยวครับ โทเคนเอ็กซ์จะเป็นสี่สิบห้าเปอร์เซ็นต์ เกินเพดานสามสิบ แถมขอสิทธิ์แบบไม่จำกัด | Hold on. TOKEN-X would hit forty-five percent, over your thirty percent cap, with unlimited approval. |
| tagged (optional) | [calm] เดี๋ยวครับ... โทเคนเอ็กซ์จะเป็นสี่สิบห้าเปอร์เซ็นต์ เกินเพดานสามสิบ แถมขอสิทธิ์แบบไม่จำกัด | [calm] Hold on... TOKEN-X would hit forty-five percent, over your thirty percent cap, with unlimited approval. |
| est. seconds · file | 6.0 s · `crypto-th-warning.mp3` | 5.4 s · `crypto-en-warning.mp3` |

### Counter-offer

| | TH | EN |
|---|---|---|
| display | ทางที่ผ่านกฎคือ $200 อนุมัติแค่ $200 ครั้งเดียว ใช้ได้ 15 นาที | What passes your rules: $200, with a one-time exact approval of $200 for 15 minutes. |
| spoken (TTS) | ทางที่ผ่านกฎคือ สองร้อยดอลลาร์ โดยอนุมัติแค่สองร้อยดอลลาร์ ครั้งเดียว ใช้ได้สิบห้านาทีครับ | What passes your rules is two hundred dollars, with a one-time approval of exactly two hundred dollars, valid for fifteen minutes. |
| tagged (optional) | [warmly] ทางที่ผ่านกฎคือ สองร้อยดอลลาร์ โดยอนุมัติแค่สองร้อยดอลลาร์ ครั้งเดียว ใช้ได้สิบห้านาทีครับ | [warmly] What passes your rules is two hundred dollars, with a one-time approval of exactly two hundred dollars, valid for fifteen minutes. |
| est. seconds · file | 6.1 s · `crypto-th-counter.mp3` | 7.5 s · `crypto-en-counter.mp3` |

### Confirmation / receipt

| | TH | EN |
|---|---|---|
| display | เรียบร้อยครับ แลก $200 แล้ว TOKEN-X อยู่ที่ 30% พอดี และไม่มีสิทธิ์ค้างไว้ (เดโม) | Done. Swapped $200. TOKEN-X is now exactly 30%, and no approval is left open (demo). |
| spoken (TTS) | เรียบร้อยครับ แลกสองร้อยดอลลาร์แล้ว โทเคนเอ็กซ์อยู่ที่สามสิบเปอร์เซ็นต์พอดี และไม่มีสิทธิ์ใช้เงินค้างไว้ครับ | Done. Swapped two hundred dollars. TOKEN-X is now exactly thirty percent, and no approval is left open. |
| tagged (optional) | [warmly] เรียบร้อยครับ แลกสองร้อยดอลลาร์แล้ว โทเคนเอ็กซ์อยู่ที่สามสิบเปอร์เซ็นต์พอดี และไม่มีสิทธิ์ใช้เงินค้างไว้ครับ | [warmly] Done. Swapped two hundred dollars. TOKEN-X is now exactly thirty percent, and no approval is left open. |
| est. seconds · file | 7.5 s · `crypto-th-confirm.mp3` | 6.1 s · `crypto-en-confirm.mp3` |

### Why (short)

| | TH | EN |
|---|---|---|
| display | เพดาน 30% ของพอร์ต $2,000 คือ $600 คุณถืออยู่ $400 จึงเพิ่มได้สูงสุด $200 | A 30% cap on a $2,000 portfolio is $600. You hold $400, so the most you can add is $200. |
| spoken (TTS) | เพดานสามสิบเปอร์เซ็นต์ของพอร์ตสองพันดอลลาร์ คือหกร้อยดอลลาร์ ตอนนี้คุณถืออยู่สี่ร้อยดอลลาร์ เลยเพิ่มได้อีกสูงสุดสองร้อยดอลลาร์ครับ | A thirty percent cap on a two thousand dollar portfolio is six hundred dollars. You already hold four hundred, so the most you can add is two hundred dollars. |
| tagged (optional) | [thoughtful] เพดานสามสิบเปอร์เซ็นต์ของพอร์ตสองพันดอลลาร์ คือหกร้อยดอลลาร์... ตอนนี้คุณถืออยู่สี่ร้อยดอลลาร์ เลยเพิ่มได้อีกสูงสุดสองร้อยดอลลาร์ครับ | [thoughtful] A thirty percent cap on a two thousand dollar portfolio is six hundred dollars. You already hold four hundred... so the most you can add is two hundred dollars. |
| est. seconds · file | 9.1 s · `crypto-th-why.mp3` | 10.4 s · `crypto-en-why.mp3` |

### Combined PAUSE clip (matches the engine voiceText key)

| | TH | EN |
|---|---|---|
| manifest `text` (= engine voiceText) | พอร์ตคุณจะมี TOKEN-X ถึง 45% เกินเพดาน 30% ที่ตั้งไว้ และ agent ขอสิทธิ์ใช้เงินแบบไม่จำกัด ทางเลือกที่ผ่านกฎคือ $200 โดยอนุมัติแค่ $200 ครั้งเดียว ใช้ได้ 15 นาที | Your TOKEN-X share would hit 45%, above your 30% cap, and the agent wants unlimited approval. The option that passes your rules is $200, with a one-time exact approval of $200 for 15 minutes. |
| spoken (TTS) | เดี๋ยวครับ โทเคนเอ็กซ์จะเป็นสี่สิบห้าเปอร์เซ็นต์ เกินเพดานสามสิบ แถมขอสิทธิ์แบบไม่จำกัด ทางที่ผ่านกฎคือ สองร้อยดอลลาร์ โดยอนุมัติแค่สองร้อยดอลลาร์ ครั้งเดียว ใช้ได้สิบห้านาทีครับ | Hold on. TOKEN-X would hit forty-five percent, over your thirty percent cap, with unlimited approval. What passes your rules is two hundred dollars, with a one-time approval of exactly two hundred dollars, valid for fifteen minutes. |
| tagged (optional) | [calm] เดี๋ยวครับ... โทเคนเอ็กซ์จะเป็นสี่สิบห้าเปอร์เซ็นต์ เกินเพดานสามสิบ แถมขอสิทธิ์แบบไม่จำกัด [warmly] ทางที่ผ่านกฎคือ สองร้อยดอลลาร์ โดยอนุมัติแค่สองร้อยดอลลาร์ ครั้งเดียว ใช้ได้สิบห้านาทีครับ | [calm] Hold on... TOKEN-X would hit forty-five percent, over your thirty percent cap, with unlimited approval. [warmly] What passes your rules is two hundred dollars, with a one-time approval of exactly two hundred dollars, valid for fifteen minutes. |
| est. seconds · file | 12.1 s · `crypto-th-pause.mp3` | 12.9 s · `crypto-en-pause.mp3` |


## Thai number readings used
| Display | Spoken Thai |
|---|---|
| ฿3,990 | สามพันเก้าร้อยเก้าสิบบาท |
| ฿299 | สองร้อยเก้าสิบเก้าบาท |
| ฿332.50 | สามร้อยสามสิบสองบาทห้าสิบสตางค์ |
| ฿300 | สามร้อยบาท |
| ฿161 | (หนึ่ง)ร้อยหกสิบเอ็ดบาท |
| ฿1,284 | หนึ่งพันสองร้อยแปดสิบสี่บาท |
| ฿1,445 | หนึ่งพันสี่ร้อยสี่สิบห้าบาท |
| 12.5% | สิบสองจุดห้าเปอร์เซ็นต์ |
| 15% / 30% / 45% | สิบห้า / สามสิบ / สี่สิบห้าเปอร์เซ็นต์ |
| $200 / $400 / $600 / $2,000 | สองร้อย / สี่ร้อย / หกร้อย / สองพันดอลลาร์ |
| 7 วัน / 15 นาที | เจ็ดวัน / สิบห้านาที |

Names: PixelPro → พิกเซลโปร · City Nest → ซิตี้เนสต์ · Asok Inn → อโศกอินน์ · TOKEN-X → โทเคนเอ็กซ์ · agent → เอเจนต์. If v3 mispronounces one, spell it out phonetically in `spoken` only.

## Model & voice choices
- **Model:** `eleven_v3` for Thai. Flash v2.5 has no Thai ([Models](https://elevenlabs.io/docs/overview/models)). The model id `eleven_v3` is confirmed in ElevenLabs' help docs (ElevenLabs docs).
- **New:** the same page now recommends **Eleven v4** (`eleven_v4`, plus `eleven_v4_turbo` for realtime). **Thai support for v4 is not verified.** Use v3 unless you check the v4 language list.
- **English:** `eleven_flash_v2_5` (fast) or `eleven_v3` with the same voice for consistency.
- **Thai voices: not verifiable from official docs.**
  - ElevenLabs says pre-made voices are English. Native-language voices are community Professional Voice Clones that you find with the Voice Library's language filter ([help](https://help.elevenlabs.io/hc/en-us/articles/19450861739409), [Voice Library](https://elevenlabs.io/docs/eleven-creative/voices/voice-library.mdx)).
  - Ways to pick: the app's Voice Library → Language: Thai, or the API `GET /v1/shared-voices?language=th`.
  - Candidates (UNVERIFIED, third-party listing only):

    | Voice | Voice ID | Notes |
    |---|---|---|
    | "Thai - Deep, Formal and Professional" | `xVv8qLTTnsYnrysc2Lx4` | male; a json2video page lists it as multilingual ([source](https://json2video.com/ai-voices/elevenlabs/voices/xVv8qLTTnsYnrysc2Lx4/)). Confirm it exists and that it's allowed on free/your plan. |
    | Pick #2 | — | choose a **female, warm/conversational** Thai voice from the language filter (sort by usage). Record its voice_id in `meta.voice_ids.th`. |
  - Selection test: generate `crypto-th-warning` and `stay-th-counter` with 2–3 candidates. Check whether numbers read naturally, then choose the calmest-sounding one.

## Pre-generation notes
- Use `meta`, then for each `scenes.<scene>.<line>.<lang>`, POST the `tagged` text (or `spoken` if tags misbehave) to `/v1/text-to-speech/{voice_id}` with `model_id` set to `eleven_v3` for TH. `scripts/pregen-voice.ts` (`pnpm voice:pregen`) does this: it writes `apps/web/public/audio/<file>` and the manifest.
- Budget: about 30 clips at roughly 60–180 chars each ≈ 3–4k characters, which fits the free 10k credits even with a couple of retakes ([pricing](https://elevenlabs.io/pricing)).
