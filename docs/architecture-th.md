# TopiaPause — สรุปสถาปัตยกรรม (ภาษาไทย)

**Think before your AI spends.** · *AI agents do what you say. TopiaPause makes sure they do what you meant.*

## เป้าหมาย
TopiaPause เป็น guard layer ชั้นที่สองของ AI agent ที่จ่ายเงินแทนผู้ใช้ หน้าที่คือจับ **intent mismatch** หรือช่องว่างระหว่างสิ่งที่ผู้ใช้พูดกับสิ่งที่ agent กำลังจะทำ ตัวอย่างเช่น:

| ผู้ใช้พูดว่า | agent กำลังจะทำ |
|---|---|
| "ลองดู" | สมัคร annual plan |
| "ถูกๆ แผนอาจเปลี่ยน" | จองห้อง non-refundable |
| "ครั้งเดียว" | ขอ unlimited approval |
| (swap คริปโต) | ทำให้พอร์ตเกิน cap |

**หลักการ: AI proposes, rules decide, you sign.**
- LLM ทำหน้าที่ด้านภาษาเท่านั้น
- ตัวเลขทุกตัวมาจาก guard-engine ถ้า LLM ใส่ตัวเลขอื่นมา ระบบจะใช้ template แทน
- ทำรายการแบบ mock เท่านั้น และต้องรอผู้ใช้ยืนยันก่อน

## ส่วนประกอบ
| ส่วน | หน้าที่ |
|---|---|
| **apps/web** | React + TS + Vite + Tailwind ประกอบด้วยแชทที่ติดป้าย "U-Bot (mock)", Guardian card, ปุ่มเสียง, receipt |
| **workers/api** | Cloudflare Worker เก็บ key, มี `UBotAdapter` (mock = LLM + catalog), proxy ไปยัง ElevenLabs และ Tokenomist |
| **packages/guard-engine** | pure TS (ไม่มี I/O) รวม rules, สูตร a_max, precedence block > pause > allow, counter-offer, re-check และ unit tests |
| **packages/shared** | types กลาง (UserPolicy, ActionIntent, AgentProposal, GuardVerdict, Receipt), JSON schema, template TH/EN |
| **demo/audio** | คลิปเสียงไทยและอังกฤษที่สร้างไว้ล่วงหน้าด้วย ElevenLabs Eleven v3 |

## Flow (ฉาก "ครั้งเดียว")
1. ผู้ใช้สั่ง
2. U-Bot (mock) เสนอ swap 500 พร้อม unlimited approval
3. `/api/guard/check`: LLM ดึง intent (`once`) → engine ได้ **PAUSE** (45% > 30% และ unlimited ไม่ตรงกับ once) → counter-offer คือ swap 200 ด้วย exact approval → re-check ได้ **ALLOW** → LLM อธิบายโดยล็อกตัวเลข
4. Guardian card แสดงขึ้น พร้อมเสียงเตือนภาษาไทย
5. ผู้ใช้ถามว่า "ทำไมแค่ 200?"
6. ผู้ใช้ยืนยัน
7. mock execute
8. ออก receipt (TH/EN)

## API
| Endpoint | หน้าที่ |
|---|---|
| `POST /api/agent/chat` | คุยกับ U-Bot (mock) |
| `POST /api/agent/execute` | ทำรายการแบบ mock |
| `POST /api/guard/check` | ตรวจ proposal แล้วคืน GuardVerdict |
| `POST /api/voice/tts` | TTS: ไทยใช้ Eleven v3, อังกฤษใช้ Flash v2.5 |
| `POST /api/voice/stt` | Scribe (optional) |
| `GET /api/market/unlocks` | Tokenomist (optional) |

## Secrets
- `LLM_API_KEY`
- `ELEVENLABS_API_KEY` (+ voice id และ model id)
- `TOKENOMIST_API_KEY` (optional)

ทั้งหมดเก็บใน Worker secret เท่านั้น ห้ามใส่ใน `VITE_*`

## Deploy
- **แนะนำ:** Worker ตัวเดียวที่ serve static assets ของ SPA และ `/api/*` ด้วย (มี URL เดียว ไม่ต้องจัดการ CORS)
- **ทางเลือก:** Pages + Worker แยกกัน
- **สำรอง:** Vercel/Netlify

## การทดสอบ (guard-engine)
| เคส | ผลที่คาดหวัง |
|---|---|
| ฐาน | a_max = **$200** |
| fee 0.3% | **$200.420884** |
| gas $2 | **$199.40** |
| swap 200 | allow |
| H = 600 | block |
| ยอดไม่พอ | block |

นอกจากนี้ต้องมีเคส subscription (annual ฿3,990 เทียบกับ trial + monthly ฿299), เคส stay (non-refundable ฿1,284 เทียบกับ refundable ฿1,445, +12.5%), เคสที่ re-check ต้องได้ allow ทุกครั้ง และเคส number lock

## MVP กับ Stretch
- **MVP:** 3 ฉากพร้อม preset, engine และ tests, LLM chat + guard check, Guardian card, counter-offer, receipt, เสียงไทย ElevenLabs, deploy + QR
- **Stretch (เรียงลำดับ):**
  1. Negotiation "ทำไม?"
  2. Voice input
  3. หน้าตั้งค่ากฎ
  4. Tokenomist
  5. Base Sepolia proof
  6. U-Bot จริง (ถ้ามี API)

## Milestones (deadline ศ. 14:00 ยังไม่ยืนยัน, เป้าคือส่งให้ได้ภายใน 13:15)
| เวลา | งาน |
|---|---|
| พฤ. 12:45 | scaffold + deploy |
| 14:00 | engine tests ผ่าน |
| 16:15 | UI + preset |
| 17:15 | LLM |
| **18:00** | **deploy v1** |
| 20:30 | เสียง |
| 21:30 | receipt + polish |
| 24:00 | deck + write-up |
| **ศ. 11:15** | **freeze** |
| **13:15** | **submit** |

ดูรายละเอียดเต็มได้ที่ [ARCHITECTURE.md](ARCHITECTURE.md)
