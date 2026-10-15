# TopiaPause — Pre-Research Dossier v2 (U-Hackathon 2026 · Track AI)

**Think before your AI spends.**
*"AI agents do what you say. TopiaPause makes sure they do what you meant."*

> **สถานะ:** Research & Planning เท่านั้น ยังไม่มีโค้ดแอป · อัปเดต: พฤหัสบดี 15 ต.ค. 2026, 12:00 ICT
> **ป้ายกำกับแหล่งข้อมูล**
> - **[OFFICIAL]** แหล่งทางการของผู้จัดงานหรือสปอนเซอร์ (Luma คือ source of truth)
> - **[DOCS]** เอกสารทางการของผู้ให้บริการ, หน่วยงานรัฐ หรือ spec
> - **[NON-OFFICIAL]** สื่อหรือบทวิเคราะห์จากบุคคลที่สาม
> - **[USER]** ข้อมูลจากผู้ใช้หรือ brief ที่ยังไม่พบแหล่งทางการยืนยัน
> - **[INFERRED]** การอนุมานหรือข้อเสนอของเรา
> - **[VERIFY]** ต้องยืนยันในงาน
>
> **หมายเหตุ:** เอกสารนี้ไม่ประเมินโอกาสชนะ แต่ชี้ว่าส่วนไหนตรงเกณฑ์และส่วนไหนเสี่ยง

---

## 1. สรุปผู้บริหาร (Executive Summary)

- **TopiaPause** คือ *guard layer* ชั้นที่สองสำหรับ AI agent ที่ใช้จ่ายเงินแทนผู้ใช้ หน้าที่ของมันคือจับ **intent mismatch** หรือช่องว่างระหว่างสิ่งที่ผู้ใช้ *พูด* กับสิ่งที่ agent *กำลังจะทำ*
- **3 ฉากเดโม** ครอบคลุมทั้งชีวิตประจำวันและคริปโต (ไม่ได้เน้น Web3):

  | ผู้ใช้พูดว่า | agent กำลังจะทำ |
  |---|---|
  | "ลองแอปนี้ดู" | สมัคร **annual plan** |
  | "โรงแรมถูกๆ" | จอง **non-refundable** |
  | "ครั้งเดียว" | ขอ **unlimited token approval** และพอร์ตเกิน concentration cap |

- **หลักการ:** *AI proposes, rules decide, you sign.*
  - ตัวเลขทุกตัวมาจาก **deterministic rules engine**
  - LLM ทำหน้าที่เข้าใจภาษา อธิบาย และต่อรองเท่านั้น
  - ElevenLabs อ่านคำเตือนออกเสียงเป็นภาษาไทยด้วย **Eleven v3**
- **การเชื่อมกับ U-Bot:** U-Bot เสนอ → TopiaPause ตรวจและอธิบายด้วยเสียง → ผู้ใช้ยืนยันในแชทเดิม → U-Bot ทำรายการและออก receipt
  - **ยังไม่พบข้อมูลสาธารณะของ U-Bot** ในเดโมจึงใช้ *mock U-Bot ที่ขับด้วย LLM* และติดป้ายบอกตรงๆ ว่าเป็น mock
- **หลักฐานโลกจริง:**
  - FTC ได้ข้อตกลงกับ Amazon (Prime) **2.5 พันล้านดอลลาร์**
  - FTC Fees Rule สำหรับโรงแรมมีผลตั้งแต่ 12 พ.ค. 2025
  - การโจมตีที่อาศัย infinite approval: Socket ~$3.3M, LI.FI ~$11.6M
  - ผู้เล่นใหญ่อย่าง Visa, Mastercard, Google AP2, OpenAI/Stripe ACP ล้วนสร้าง "intent/limit" ไว้ที่ชั้น payment
- **ช่องว่างที่ TopiaPause เติม:** ชั้น *consumer-facing explanation + intent-matching alternative ที่คำนวณได้* ก่อนผู้ใช้เซ็น (เป็นข้อสรุปของเรา [INFERRED]: ในแหล่งที่ตรวจ ไม่พบระบบที่ทำครบทั้ง 3 ฉากในลักษณะนี้)

---

## 2. ข้อเท็จจริงของงาน และการ map กับเกณฑ์

### 2.1 ข้อเท็จจริงทางการ [OFFICIAL — https://luma.com/lqrbtu27 ตรวจซ้ำ 15 ต.ค. 2026]

- U-Hackathon จัดภายใน FLOW Summit ที่ Avani Sukhumvit Bangkok
- **เวลา:** พฤ. 15 ต.ค. 10:00–18:00 · ศ. 16 ต.ค. 10:00–21:00
- **รูปแบบ:** Hack → Mentor → Present → Judge
  - "Qualified Project demo on the stage Friday afternoon"
  - "judges pick six finalists on merit. Then the U-Center DAO Community votes live to choose the grand prize."
- **Track 1 AI:** "Build any application using AI tooling, solving real problem delivering value. No Web3 experience needed."
- **AI tools:** "All fair game, on both tracks. There is no 'Did you write this by hand' inquisition."
- **ทีม:** "Up to 3 of them excluding you. Solo builder? You can ask for in event teammate." ผู้ใช้แข่ง **solo**
- **ห้าม Existing Project** แต่ทำ pre-research ได้
- **รางวัล:** prize pool 1,000,000 THB, ถ้วยรางวัล Top 3 ต่อ track, certificate, "Surprise bounty from partner on the brief"
- **FLOW Summit** เป็นงาน official launch ของ U-topia app ผู้ถือบัตร Gala ได้ "Hackathon winner voting rights" [OFFICIAL — https://flowsummitbangkok.com/] [INFERRED: Gala holders น่าจะเป็นผู้โหวต]
- **ข้อมูลที่ไม่ใช่ทางการ:** thailandhackathons.com ระบุทีม 4 คน และกฎ "ต้องอธิบายโค้ดเอง" ซึ่ง **ไม่ตรงกับ Luma ให้ยึด Luma**

### 2.2 เกณฑ์การตัดสินและสิ่งที่ต้องส่ง [USER — ไม่พบบน Luma]

**สิ่งที่ต้องส่ง:** Code, Pitch Deck, Write-up, Demo Website ภายใน **ศ. 14:00** [VERIFY]

| เกณฑ์ | น้ำหนัก | TopiaPause ตอบอย่างไร | หลักฐานที่ต้องโชว์ |
|---|---|---|---|
| App execution | **40%** | แอป deploy จริง ใช้ได้บนมือถือ, 3 ฉากทำงาน end-to-end, ใช้ LLM และ TTS จริง | URL สด, QR, flow ครบ: proposal → PAUSE → voice → alternative → re-check → confirm → receipt |
| Practicality | **40%** | ปัญหาจริง (subscription trap, ค่าธรรมเนียมและเงื่อนไขซ่อน, infinite approval) และ agentic commerce กำลังมา | ตัวเลข FTC และ exploit (หัวข้อ 3), ผู้ใช้ทั่วไปเข้าใจได้ใน 10 วินาที |
| Usability & design | 10% | คำเตือนเป็นการ์ดในแชท, ภาษาไทยและอังกฤษ, เสียง, ปุ่มเดียวเพื่อใช้ alternative | ภาพหน้าจอมือถือ, accessibility (เสียง + ข้อความ) |
| Innovation & ecosystem | 5% | intent-matching alternative ที่คำนวณได้, ElevenLabs (และ Tokenomist ถ้ามีเวลา) | ตาราง differentiation |
| U-Bot integration | 5% | API contract แบบ agent → guard, mock U-Bot ที่ติดป้ายชัด, พร้อมเสียบ API จริง | แผนภาพ flow, สเปก contract |

[INFERRED] เกณฑ์ execution + practicality รวมกันได้ 80% จึงควรลงเวลากับ **ความเสถียรของ flow และความน่าเชื่อของปัญหา** มากกว่าฟีเจอร์เสริม

### 2.3 คำถามที่ต้องยืนยันวันนี้

- Submission: ช่องทาง, deadline จริง, ต้องเปิด repo เป็น public ไหม
- เกณฑ์ข้างต้นเป็นทางการไหม
- เวลา demo บนเวที
- รายละเอียด partner bounty
- U-Bot มี API, sandbox หรือ brand asset ให้ใช้ไหม
- ElevenLabs/Tokenomist มี hackathon credits ไหม
- Hall เปิดค้างคืนไหม

---

## 3. ปัญหา และหลักฐานจากโลกจริง

### 3.1 Problem Statement
AI agent กำลังเปลี่ยนจาก "แนะนำ" เป็น "ลงมือจ่ายเงิน" แต่คำสั่งของคนเป็นภาษาธรรมชาติที่กำกวม เช่น "ลองดู", "ถูกๆ", "ครั้งเดียว" ส่วน agent ต้องเลือก plan, เงื่อนไข และสิทธิ์ที่เป็นรูปธรรม ช่องว่างนี้ทำให้เกิดธุรกรรมที่ **ถูกต้องทางเทคนิคแต่ผิดเจตนา**: ผูกมัดนานเกินไป ยกเลิกหรือคืนเงินไม่ได้ หรือเปิดสิทธิ์กว้างเกินไป และทั้งหมดเกิดขึ้นเร็วจนผู้ใช้ไม่ทันอ่าน

### 3.2 หลักฐาน

**(ก) Subscription trap / negative option**

- **FTC v. Amazon (ROSCA):** FTC ได้ข้อตกลงรวม **2.5 พันล้านดอลลาร์** (civil penalty 1 พันล้าน + คืนเงินผู้บริโภค 1.5 พันล้าน) ในคดีที่กล่าวหาว่าสมัคร Prime โดยผู้บริโภคไม่ยินยอมชัดเจนและยกเลิกยาก คำสั่งกำหนดให้ต้องมีปุ่มปฏิเสธที่ชัดเจนและยกเลิกได้ง่าย [DOCS — https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-secures-historic-25-billion-settlement-against-amazon · https://www.ftc.gov/legal-library/browse/cases-proceedings/2123050-amazoncom-inc-rosca-ftc-v]
- **FTC "Click-to-Cancel" (Negative Option Rule)** ถูก **ศาลอุทธรณ์ Eighth Circuit เพิกถอน (vacated) เมื่อ 8 ก.ค. 2025** ด้วยเหตุผลเชิงกระบวนการ (ไม่ได้ทำ preliminary regulatory analysis) ไม่ใช่เพราะศาลเห็นว่าการปฏิบัติดังกล่าวถูกกฎหมาย [DOCS — คำพิพากษา (สำเนาโดย NFIB): https://www.nfib.com/wp-content/uploads/2025/07/2025-07-08-FTC-Negative-Option-Lawsuit-Opinion.pdf] [NON-OFFICIAL — Reuters: https://www.reuters.com/legal/legalindustry/us-click-cancel-rule-blocked-by-appeals-court-2025-07-08/]
  → **ห้ามพูดบนเวทีว่า "click-to-cancel มีผลบังคับใช้"** ให้พูดว่า "regulators are actively fighting subscription traps" แล้วยกคดี Amazon

**(ข) ราคาและเงื่อนไขที่พัก**

- **FTC Rule on Unfair or Deceptive Fees (16 CFR Part 464)** มีผล **12 พ.ค. 2025** ครอบคลุม short-term lodging (โรงแรม, vacation rentals) และ live-event tickets ต้องแสดง *total price* รวม mandatory fees อย่างเด่นชัด [DOCS — https://www.ftc.gov/news-events/news/press-releases/2025/05/ftc-rule-unfair-or-deceptive-fees-take-effect-may-12-2025 · https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-464]
- [INFERRED] กฎนี้เรื่อง *fees* ไม่ใช่ refundability แต่ยืนยันว่า "ราคาที่เห็นกับเงื่อนไขจริง" เป็นปัญหาที่ผู้กำกับดูแลให้ความสำคัญ ส่วนห้อง non-refundable ที่ถูกกว่าเป็นแนวปฏิบัติทั่วไปของ OTA ซึ่งเป็นจุดที่ agent เลือกผิดเจตนาได้ง่าย [VERIFY: หาแหล่ง สคบ./ไทย ถ้ามีเวลา]

**(ค) Unlimited / infinite token approval**

- **Socket/Bungee (16 ม.ค. 2024):** ช่องโหว่ arbitrary call ใช้ `transferFrom` ดึงเงินจาก wallet ที่เคยให้ approval ค้างไว้ ~230 wallets เสียหาย ~$3.3M [NON-OFFICIAL — CertiK: https://www.certik.com/blog/socket-tech-incident-analysis]
- **LI.FI (16 ก.ค. 2024):** ดึงเงิน ~$11.6M จาก ~153 wallets ที่ให้ infinite approval [OFFICIAL incident report — https://li.fi/knowledge-hub/incident-report-16th-july]
- มาตรฐาน: `approve(spender, value)` และ EIP-20 เตือนเรื่อง allowance race [DOCS — https://eips.ethereum.org/EIPS/eip-20]

**(ง) Agentic commerce มาแล้ว** (ดูหัวข้อ 8)
Visa Intelligent Commerce, Mastercard Agent Pay, OpenAI Instant Checkout (ACP), Google AP2 ล้วนมีแนวคิด "spending limits / mandates / one-time allowance" ซึ่งแปลว่าอุตสาหกรรมยอมรับว่า *intent กับ limit* เป็นปัญหาหลัก

---

## 4. Concept และกายวิภาคของ Agent

### 4.1 Concept Statement
**TopiaPause** คือ second-layer guard ที่อยู่ระหว่าง AI agent ผู้เสนอธุรกรรมกับการยืนยันของผู้ใช้

1. แปลงคำพูดของผู้ใช้เป็น **intent ที่มีโครงสร้าง**
2. เทียบกับ **ข้อเสนอของ agent**
3. ใช้ **deterministic rules** ตัดสิน ALLOW / PAUSE / BLOCK
4. อธิบาย **ออกเสียง** (ไทย/อังกฤษ)
5. เสนอ **alternative ที่ตรงเจตนา** แล้ว **ตรวจซ้ำ** (re-check)
6. ให้ผู้ใช้ยืนยันในแชทเดิม

### 4.2 Agent Anatomy
| ชั้น | หน้าที่ | ใครทำ |
|---|---|---|
| **Perceive** | รับข้อความหรือเสียง (STT), ภาษา TH/EN, บริบทผู้ใช้ (กฎส่วนตัว, พอร์ต mock) | Browser + ElevenLabs Scribe (optional) |
| **Understand** | ดึง **UserIntent** เป็น JSON (เช่น `commitment: trial`, `flexibility: high`, `frequency: once`) | LLM (structured output) |
| **Plan (U-Bot)** | สร้าง **AgentProposal** (plan, ราคา, เงื่อนไข, สิทธิ์) | Mock U-Bot (LLM + catalog mock) |
| **Check** | เทียบ intent กับ proposal, คำนวณตัวเลข, ตัดสินตาม precedence BLOCK > PAUSE > ALLOW | **Deterministic engine** (pure TS) |
| **Explain / Negotiate** | สร้างคำอธิบายจาก Decision JSON และตอบคำถาม "ทำไม?" | LLM + template + number check |
| **Speak** | อ่านคำเตือนออกเสียง | ElevenLabs TTS (v3 ภาษาไทย) |
| **Act** | ผู้ใช้กดยืนยัน แล้ว mock U-Bot "execute" ใน sandbox และออก receipt | App (ไม่มีเงินจริง) |
| **Memory** | กฎส่วนตัว (cap, budget, prefer refundable), ประวัติ decision/receipt | localStorage (เดโม) |

### 4.3 Guardrails

1. ตัวเลขทุกตัว (ราคา, ส่วนต่าง, %, a_max) มาจาก engine ถ้า LLM ใส่ตัวเลขที่ไม่อยู่ในชุดของ engine ระบบจะแสดง template แทน
2. ตรวจ schema ของ JSON ทุกจุด ถ้าไม่ผ่านให้ fallback ไปใช้ preset
3. LLM สั่ง execute เองไม่ได้ ต้องมีการยืนยันจากผู้ใช้เสมอ
4. แสดง assumptions และระบุว่า "ไม่ใช่คำแนะนำการลงทุน"
5. ป้าย **"Mock U-Bot · Sandbox · No real money"** มองเห็นได้ตลอด

---

## 5. การเชื่อมกับ U-Bot

### 5.1 ข้อมูลสาธารณะของ U-Bot

- ค้นเว็บแล้ว **ไม่พบเอกสารสาธารณะของ "U-Bot" จาก U-topia** ผลที่เจอเป็นผลิตภัณฑ์อื่นที่ชื่อคล้ายกัน (IYULAB U-Bot, UBot Studio) ซึ่ง **ไม่เกี่ยวข้อง**
- เอกสารทางการพบ **Topi AI** (assistant บน Telegram ที่ทำ swap, tracking และมีคำสั่งอย่าง /explore-token) [OFFICIAL — https://u-topia.gitbook.io/u-topia-overview/topi-ai-your-web3-trading-assistant]
- u-topia.com ระบุว่า app มี "swap, send and receive built in" [OFFICIAL — https://u-topia.com/]
- [USER] U-Bot คือ chat AI agent ของ U-topia ที่ทำงานคล้าย Grok Bot → **ต้องยืนยันกับ mentor** ว่ามี API หรือไม่ และสัมพันธ์กับ Topi AI อย่างไร

### 5.2 Integration Flow (ข้อความแทนแผนภาพ)
```
ผู้ใช้ ──(พิมพ์/พูด)──▶ [U-Bot chat (mock)]
                         │ 1. Plan → AgentProposal
                         ▼
                 [TopiaPause Guard API]

                 2. Extract UserIntent (LLM)
                 3. Rules engine → Decision (ALLOW/PAUSE/BLOCK)
                 4. Alternative → re-check → ALLOW?
                 5. Explanation (LLM+template) + TTS (ElevenLabs)
                         │
                         ▼
          [Guardian card ในแชท + เสียงเตือน]
                         │ 6. ผู้ใช้: "ใช้ทางเลือก" / "ยืนยันเดิม" / "ยกเลิก"
                         ▼
          [U-Bot execute (sandbox)] ──▶ 7. Receipt (TH/EN)
```

### 5.3 Mock Honesty

- UI แชทเลียนแบบรูปแบบ U-Bot แต่ใช้ชื่อ **"U-Bot (mock)"** และไม่ใช้โลโก้ทางการถ้ายังไม่ได้รับอนุญาต
- ประโยคบนเวที: "U-Bot here is a mock powered by an LLM. TopiaPause talks to it through a guard API contract, so plugging in the real U-Bot only needs an adapter."
- ถ้า mentor ให้ API จริง ให้เขียน adapter ตาม contract ในหัวข้อ 9.4 แต่ **ห้ามทำรายการด้วยเงินจริง**

---

## 6. การเชื่อมกับ ElevenLabs

### 6.1 โมเดลและภาษา [DOCS]
| โมเดล | ภาษาไทย | Latency | ใช้ทำอะไร |
|---|---|---|---|
| **Eleven v3** | **รองรับ** (74 ภาษา) | ไม่มีตัวเลขเผยแพร่ | เสียงเตือนภาษาไทย (pre-generate) |
| Flash v2.5 | **ไม่รองรับ** (32 ภาษา ไม่มีไทย) | ~75ms | เสียงอังกฤษแบบ realtime |
| Multilingual v2 | ไม่รองรับ | — | — |

แหล่ง:

- https://elevenlabs.io/docs/overview/models
- https://help.elevenlabs.io/hc/en-us/articles/17883183930129
- [NON-OFFICIAL] https://software-listing.com/blog/elevenlabs-voice-agents-thai-vietnamese-indonesian-2026

[VERIFY] ต้องทดสอบว่า v3 เรียกผ่าน TTS API ด้วย model_id ได้จริงบนบัญชีที่ใช้, และจดเวลาตอบสนองจริง

### 6.2 Speech-to-Text (optional) [DOCS]

- **Scribe** รองรับภาษาไทย (`tha`) ในกลุ่มความแม่นยำ "Good (>10% ถึง ≤20% WER)"
- Endpoint: `POST /v1/speech-to-text`
- ราคา: Scribe v2 **$0.22/ชม.**, Scribe v2 Realtime **$0.39/ชม.** (~150ms)
- คุณสมบัติเสริม keyterms (+20%) ช่วยให้จดจำคำเช่น "USDT", "TOKEN-X", "annual" ได้แม่นขึ้น
- แหล่ง: https://elevenlabs.io/speech-to-text · https://elevenlabs.io/pricing/api · https://elevenlabs.io/docs/api-reference/speech-to-text/convert
- ทางเลือกฟรี: Web Speech API ในเบราว์เซอร์ (ต้องทดสอบภาษาไทยบนมือถือ) [INFERRED]

### 6.3 ค่าใช้จ่าย [DOCS — https://elevenlabs.io/pricing · https://elevenlabs.io/pricing/api]

- **Free:** 10,000 credits/เดือน, concurrency 2 (multilingual) / 4 (Flash)
- **Starter:** $6 ได้ 30k credits · **Creator:** $22 ได้ 121k credits
- ราคา API ต่อ 1,000 ตัวอักษร:
  - v2/v3 ≈ **$0.10** · Flash ≈ **$0.05**
  - หน้า pricing แสดงตัวเลขต่างกันในบางส่วน ($0.08 / $0.04) [VERIFY]
- [INFERRED] ประโยคเตือนภาษาไทยหนึ่งประโยคประมาณ 150–250 ตัวอักษร ถ้า pre-generate 20 ประโยค (3 ฉาก × TH/EN + ประโยคเสริม) จะใช้ราว 5k ตัวอักษร ซึ่งพอใน free tier แต่การสร้างเสียงสดระหว่างที่กรรมการลองเล่นอาจทำให้ credits หมด จึงแนะนำ Starter $6 หรือขอ credits จากสปอนเซอร์

### 6.4 แนวทางใช้งาน

- **Pre-generate** ประโยคเดโม 3 ฉาก × TH/EN แล้วเก็บเป็นไฟล์ static (หลีกเลี่ยงความเสี่ยงด้าน latency ของ v3 บนเวที)
- ข้อความที่ต้องสร้างสด (เช่น คำตอบ negotiation) ให้ใช้ Worker `/api/tts` พร้อม cache ด้วย hash ของข้อความ, จำกัดความยาว และ rate-limit
- **เก็บ API key ไว้ใน Cloudflare Worker secret เท่านั้น** ห้ามอยู่ใน bundle ของฝั่ง client
- **Fallback:** ไฟล์เสียงที่ cache ไว้ → `speechSynthesis` ของเบราว์เซอร์ → ข้อความอย่างเดียว

---

## 7. Tokenomist (Optional Rule)

- **API:** `https://api.tokenomist.ai`, header `x-api-key`
- **Endpoints:** Token List → tokenId → **Unlock Events v5** `/v5/unlock/events/{tokenId}`
- **Free account** สร้าง key ได้แต่ข้อมูลจำกัด (unlock events: 3 ครั้งในอดีต, 1 ครั้งในอนาคต); มีปุ่ม Request Free Trial; rate limit 120 req/min; data ใช้ได้แบบ non-commercial
- แหล่ง [DOCS]: https://docs.tokenomist.ai/api-documents/introduction · https://docs.tokenomist.ai/api-documents/unlock-events/v5 · https://www.tokenomist.ai/pricing
- **Rule T1 (เฉพาะฉากคริปโต):** ถ้าโทเคนที่จะซื้อมี unlock ≥ X% ของ circulating ภายใน 7 วัน → PAUSE และอธิบาย (ไม่ BLOCK และไม่ใช่คำแนะนำการลงทุน)
  - mock TOKEN-X จะ "shadow" โทเคนจริงที่มีข้อมูล unlock ใกล้ๆ
  - ดึงผ่าน Worker และ cache ไว้
- **Priority:** Tier 2 อยู่ใต้ ElevenLabs เพราะเกณฑ์ ecosystem มีน้ำหนักเพียง 5%

---

## 8. ภูมิทัศน์คู่แข่ง และ Differentiation
| ผู้เล่น | ทำอะไร | ทำงานที่ชั้นไหน | อธิบายผลกระทบและเสนอ alternative ตาม intent ให้ผู้บริโภคไหม |
|---|---|---|---|
| **Visa Intelligent Commerce** | tokenized credentials ให้ agent, ผู้ใช้ตั้ง spending limits และ conditions ได้, Intelligent Commerce Connect รองรับ ACP/MPP/UCP/Trusted Agent Protocol [OFFICIAL — https://corporate.visa.com/en/sites/visa-perspectives/newsroom/visa-intelligent-commerce-connect-ai-shopping-for-businesses.html] | Network/credential | จำกัดวงเงินได้ ไม่พบการอธิบาย intent mismatch |
| **Mastercard Agent Pay** | Agentic Tokens ลงทะเบียนและยืนยัน agent, ทำงานตาม "permissions and limits you define" [OFFICIAL — https://www.mastercard.com/news/press/2025/april/mastercard-unveils-agent-pay-pioneering-agentic-payments-technology-to-power-commerce-in-the-age-of-ai · https://www.mastercard.com/global/en/news-and-trends/stories/2025/agentic-commerce-momentum.html] | Network/token | ไม่พบ |
| **Google AP2 (v0.2)** | **Checkout Mandate + Payment Mandate** แบบ open (ข้อจำกัดที่ผู้ใช้อนุมัติ) และ closed (รายการจริง), SD-JWT, รองรับทั้ง human-present และ not-present (คำว่า Intent/Cart Mandate เป็นของ v0.1) [DOCS — https://ap2-protocol.org/ap2/specification/ · https://ap2-protocol.org/ap2/flows/] | Protocol/crypto proof | พิสูจน์ว่าทำตาม constraint ได้ แต่ไม่ได้อธิบายให้ผู้ใช้หรือหาทางเลือก |
| **OpenAI + Stripe ACP** | Instant Checkout ใน ChatGPT, Delegated Payment พร้อม **allowance: one_time, max_amount, expires_at** (beta) [DOCS — https://developers.openai.com/commerce/specs/checkout · https://github.com/agentic-commerce-protocol/agentic-commerce-protocol · https://openai.com/index/buy-it-in-chatgpt/] | Checkout protocol | จำกัดเพดานเงิน ไม่ได้ตรวจว่า plan ตรงเจตนา |
| **Coinbase x402** | HTTP 402 Payment Required ใช้ header PAYMENT-REQUIRED / PAYMENT-SIGNATURE (v2) [DOCS — https://docs.x402.org/core-concepts/http-402] | Machine payments | ไม่ได้ทำส่วนนี้ |
| **Coinbase AgentKit + CDP Policy Engine** | AgentKit "does not gate transfers behind human approval, enforce spend caps, or allowlist destinations" ส่วน policy อยู่ใน CDP (เช่น netUSDChange, allowlist) [DOCS — https://github.com/coinbase/agentkit · https://docs.cdp.coinbase.com/wallets/security-and-policies/policy-engine/overview] | Wallet policy | cap/allowlist เท่านั้น |
| **MetaMask ERC-7715** | `wallet_requestExecutionPermissions` เช่น erc20-token-periodic (periodAmount, expiry), ผู้ใช้ปรับค่าได้ [DOCS — https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/] | Wallet permission | ผู้ใช้ปรับเอง ไม่ได้คำนวณจากพอร์ต |
| Blockaid / Rabby / Safe | simulation และ threat detection ก่อนเซ็น [DOCS — https://blockaid.io/transaction-security] | Wallet security | ตรวจหาภัย ไม่ได้ตรวจเจตนา |

**Differentiation [INFERRED]:**

- ผู้เล่นใหญ่สร้าง **rails** (token, mandate, allowance, limit) ส่วน TopiaPause คือ **ชั้นความเข้าใจของผู้บริโภค** ที่อยู่บน rails เหล่านั้น
  - อ่านคำพูดผู้ใช้ เทียบกับ proposal
  - อธิบายเป็นภาษาไทยด้วยเสียง
  - **คำนวณ alternative ที่ตรงเจตนา** (monthly แทน annual, refundable แทน non-refundable, exact approval และ a_max แทน unlimited)
- ใช้ร่วมกับ AP2/ACP/7715 ได้: alternative ของเราสามารถแปลงเป็น mandate หรือ allowance ที่แคบลง
- **ห้ามอ้าง** ว่าเป็นรายแรกที่ทำ agent payment security ให้พูดว่า "we didn't find a consumer-facing layer that explains and recalculates across these cases"

---

## 9. สถาปัตยกรรมและ Stack

### 9.1 ส่วนประกอบ
| ส่วน | เทคโนโลยี | เหตุผล |
|---|---|---|
| Frontend | **React + TypeScript + Vite** (static SPA) | เร็ว, AI coding tools ถนัด, deploy เป็น static ได้ |
| Hosting | **Cloudflare Workers Static Assets** หรือ Pages | ฟรี, ใช้ร่วมกับ Worker ได้, SPA fallback [DOCS — https://developers.cloudflare.com/workers/static-assets/] |
| API proxy | **Cloudflare Worker** | เก็บ key ใน secrets, rate-limit, cache |
| LLM | Hosted LLM ที่รองรับ **JSON schema / structured output** | ภาษาไทยดี, ใช้บนมือถือได้ [VERIFY ราคาและ free tier ของ provider ที่เลือก] |
| Rules engine | **Pure TypeScript** ในฝั่ง client + unit tests (Vitest) | deterministic, ทดสอบซ้ำได้, ไม่พึ่ง network |
| Voice | ElevenLabs TTS (v3 ภาษาไทย / Flash ภาษาอังกฤษ), Scribe (optional) | สปอนเซอร์ + accessibility |
| Data | Catalog mock (แอป, โรงแรม, โทเคน) + กฎผู้ใช้ใน localStorage | ไม่มีเงินจริง |

### 9.2 Worker Endpoints
| Endpoint | หน้าที่ |
|---|---|
| `POST /api/agent/propose` | mock U-Bot: รับข้อความผู้ใช้และ scene แล้วคืน AgentProposal (LLM + catalog, ตรวจ schema) |
| `POST /api/intent` | ข้อความผู้ใช้ → UserIntent JSON |
| `POST /api/explain` | Decision JSON → ข้อความ TH/EN (ตรวจตัวเลขซ้ำ) |
| `POST /api/tts` | ElevenLabs proxy พร้อม cache |
| `POST /api/stt` (optional) | Scribe proxy |
| `GET /api/unlocks` (optional) | Tokenomist proxy พร้อม cache |

### 9.3 Data Model (อธิบายเป็นตาราง ไม่ใช่โค้ด)
**UserIntent**
| Field | ความหมาย |
|---|---|
| goal | `try_app` / `book_stay` / `swap_token` |
| commitment | `trial` / `once` / `ongoing` / `unspecified` |
| budget | จำนวน + สกุลเงิน (ถ้าผู้ใช้ระบุ) |
| priceSensitivity | `cheap` / `normal` |
| flexibilityNeeded | true / false / unknown (เช่น "อาจเปลี่ยนแผน") |
| language | th / en |
| confidence | 0–1 |
| rawText | ข้อความเดิม |

**AgentProposal**
| Field | ความหมาย |
|---|---|
| proposalId, agent | ระบุตัว เช่น "U-Bot (mock)" |
| actionType | `subscription` / `booking` / `token_swap` |
| merchant / item | ชื่อแอป, โรงแรม หรือคู่โทเคน |
| amount, currency, totalPrice | ราคารวม fees |
| recurrence | interval (month/year), autoRenew, trialDays |
| refundPolicy | refundable, freeCancelUntil |
| tokenApproval | spender, allowanceType (exact/unlimited), amount, expiry |
| alternativesSeen | ตัวเลือกอื่นใน catalog (สำหรับ engine) |

**UserRules** (memory): monthlySubscriptionCap, requireRefundableWhenFlexible, maxPriceGapForRefundable (%), tokenConcentrationCap c, maxApproval = exact

**GuardDecision**: verdict (ALLOW/PAUSE/BLOCK), triggeredRules (ruleId, severity, evidence ที่เป็นตัวเลข), metrics, alternative (proposal ที่แก้แล้ว + recheckVerdict), explanationKeys, assumptions

**Receipt**: เวลา, intent, proposal เดิม, decision, ทางเลือกที่ผู้ใช้เลือก, ผลการ execute ใน sandbox, ภาษา

### 9.4 API Contract: Agent ↔ Guard [INFERRED]

- **Request** `POST /guard/check`: { userText, userIntent?, proposal: AgentProposal, userRules, context }
- **Response**: GuardDecision
- **Rule ของ contract:**
  1. Agent ต้องส่ง proposal *ก่อน* execute ทุกครั้ง
  2. ถ้า verdict ≠ ALLOW ต้องได้การยืนยันจากผู้ใช้
  3. Agent ใช้ `alternative.proposal` ได้เฉพาะเมื่อ `recheckVerdict = ALLOW`
  4. Guard ไม่ถือ credential และไม่ execute เอง
- Map กับมาตรฐาน: alternative แปลงเป็น ACP allowance (`one_time`, max_amount, expires_at), ERC-7715 permission หรือ AP2 open-mandate constraints ได้ (อนาคต)

### 9.5 Rules (ภาษาคน) และ Precedence **BLOCK > PAUSE > ALLOW**
| Rule | Trigger | ผล | Alternative |
|---|---|---|---|
| S1 Commitment mismatch | intent = trial/unspecified แต่ proposal = annual | PAUSE | monthly plan หรือ free trial + เตือนก่อน renew |
| S2 Over cap | ราคาเฉลี่ยต่อเดือน > monthlySubscriptionCap | PAUSE | plan ที่ไม่เกิน cap |
| H1 Flexibility mismatch | flexibilityNeeded ≠ false และห้อง non-refundable | PAUSE | ห้อง refundable ที่ถูกที่สุด ถ้าส่วนต่าง ≤ maxPriceGap |
| H2 Hidden total | totalPrice > ราคาที่แสดงตอนแรก | PAUSE | แสดง total และเทียบกับตัวเลือกอื่นด้วย total |
| C1 Concentration | สัดส่วนหลังซื้อ > c | PAUSE (BLOCK ถ้า a_max = 0) | swap a_max |
| C2 Approval scope | intent = once แต่ approval = unlimited | PAUSE | exact approval + expiry สั้น |
| C3 Insufficient balance / invalid | amount > ยอดคงเหลือ, input ผิด | BLOCK | — |
| T1 Unlock (optional) | unlock ใหญ่ภายใน 7 วัน | PAUSE (ข้อมูลประกอบ) | — |
| G1 Low confidence | intent confidence < 0.7 | PAUSE | ถามผู้ใช้ยืนยัน |

### 9.6 สูตรฉากคริปโต (จาก pre-research v1)

- **สูตร:** a_max = min(B, max(0, (c(V−g) − H) / (c + (1−c)(1−f)))) ปัดลงตาม decimals
- **ที่มา:**
  - token ที่ได้รับ = a(1−f)(1−σ)
  - กรณีแย่ที่สุดต่อเพดานคือ σ = 0 เพราะตัวส่วน c + (1−c)k เพิ่มขึ้นเมื่อ k เพิ่ม
- **ตัวอย่าง** (V=2000, H=400, B=500, c=0.30):

  | กรณี | a_max |
  |---|---|
  | f=0, g=0 | **$200** (ถ้า swap 500 จะได้ 900/2000 = 45%) |
  | f=0.3% | **$200.420884** |
  | gas $2 | **$199.40** |

---

## 10. สามฉากเดโมพร้อมสคริปต์
> catalog เป็น mock ทั้งหมด ตัวเลขด้านล่างเป็นตัวอย่างที่จะใส่ใน catalog [INFERRED] และ engine เป็นผู้คำนวณจริงในแอป

### ฉาก 1: "ลองแอปนี้ดู" → annual plan (Subscription)

- **ผู้ใช้ (เสียง):** "ช่วยสมัครแอปแต่งรูป PixelPro ให้หน่อย อยากลองดู"
- **U-Bot (mock):** "สมัคร PixelPro Annual ฿3,990/ปี ต่ออายุอัตโนมัติ ให้เลยนะครับ"
- **TopiaPause → PAUSE** (S1, S2: cap ฿300/เดือน แต่ annual ≈ ฿332.50/เดือน และต้องจ่ายล่วงหน้า ฿3,990)
- **เสียง (TH):** "เดี๋ยวก่อนครับ คุณบอกว่าอยากลอง แต่นี่คือแพ็กเกจรายปี ฿3,990 ที่ต่ออายุอัตโนมัติ ทางที่ตรงกว่าคือทดลองฟรี 7 วัน แล้วรายเดือน ฿299 ซึ่งผมจะเตือนก่อนตัดเงิน"
- **Alternative:** free trial 7 วัน + monthly ฿299 (≤ cap ฿300) + reminder ก่อนตัดเงิน → re-check ได้ ALLOW (ไม่ผูกมัดเกินเจตนาและไม่เกิน cap)
- **ผู้ใช้:** "เอาแบบทดลอง" → receipt

### ฉาก 2: "โรงแรมถูกๆ" → non-refundable (Booking)

- **ผู้ใช้:** "หาโรงแรมถูกๆ ใกล้อโศก คืนวันศุกร์ แต่แผนอาจเปลี่ยนนะ"
- **U-Bot:** "จอง City Nest ฿1,200 (non-refundable) ให้เลยครับ"
- **TopiaPause → PAUSE** (H1: flexibilityNeeded = true; H2: total รวม fees = ฿1,284)
- **Engine:**
  - ห้อง refundable ที่ถูกที่สุดคือ Asok Inn ฿1,350 (total ฿1,445)
  - ส่วนต่าง total = ฿161 (≈12.5%) ซึ่งไม่เกิน maxPriceGap 15%
- **เสียง:** "คุณบอกว่าแผนอาจเปลี่ยน แต่ห้องนี้คืนเงินไม่ได้ ถ้าจ่ายเพิ่ม ฿161 จะได้ห้องที่ยกเลิกฟรีได้ถึงวันพฤหัส"
- **Alternative:** Asok Inn refundable → re-check ALLOW → ยืนยัน → receipt

### ฉาก 3: "ครั้งเดียว" → unlimited approval + concentration (Crypto)

- **ผู้ใช้:** "แลก 500 USDT เป็น TOKEN-X ครั้งเดียวพอ"
- **U-Bot:** swap 500 + approve unlimited
- **TopiaPause → PAUSE** (C1: 45% > 30%; C2: unlimited ทั้งที่ intent = once; T1 ถ้ามี)
- **เสียง:** "พอร์ตคุณจะมี TOKEN-X ถึง 45% เกินเพดาน 30% ที่ตั้งไว้ และ agent ขอสิทธิ์ใช้เงินแบบไม่จำกัด ทางเลือกที่ผ่านกฎคือ 200 ดอลลาร์ โดยอนุมัติแค่ 200 ครั้งเดียว"
- **ผู้ใช้ถาม:** "ทำไมแค่ 200?" → LLM อธิบายด้วยตัวเลขจาก engine (30% × 2,000 − 400)
- **Alternative** → re-check ALLOW → ยืนยัน → receipt (sandbox; testnet เป็น stretch)

---

## 11. MVP Scope และ Timeline 26 ชั่วโมง

### 11.1 Scope
**MUST** (เกณฑ์ execution + practicality 80%)

1. UI แชทแบบ U-Bot (mock) + Guardian cards inline
2. Rules engine (S1, S2, H1, H2, C1, C2, C3, G1) + alternative + re-check + unit tests ≥ 12 เคส
3. LLM: intent extraction + mock proposal + explanation (พร้อม number check) ผ่าน Worker
4. 3 ฉากที่มีทั้ง preset buttons (fallback) และการพิมพ์อิสระ
5. ElevenLabs TTS ภาษาไทยแบบ pre-generate + live ผ่าน Worker
6. Receipt (TH/EN) + deploy URL + QR

**SHOULD**

- Voice input (Web Speech หรือ Scribe)
- Negotiation Q&A ("ทำไม?")
- หน้าตั้งกฎผู้ใช้

**COULD**

- Tokenomist T1
- Base Sepolia exact-approve proof

**WON'T**

- เงินจริง
- U-Bot จริง (ถ้าไม่มี API)
- Browser LLM
- Multi-user / backend DB

### 11.2 Timeline (พฤ. 12:00 → ศ. 14:00 ≈ 26 ชม.) [USER deadline — VERIFY]
| เวลา | งาน | Definition of Done |
|---|---|---|
| พฤ. 12:00–12:45 | Repo, Vite, Worker skeleton, deploy hello | URL ใช้งานได้ |
| 12:45–14:00 | Rules engine + data model + unit tests (3 ฉาก) | tests ผ่าน |
| 14:00–15:00 | พักกลางวัน + ถาม mentor (U-Bot API, เกณฑ์, credits) | ได้คำตอบ |
| 15:00–16:15 | UI แชท + Guardian card + preset flow ฉาก 3 → 1 → 2 | ฉาก preset ครบ |
| 16:15–17:15 | Worker: `/api/intent` + `/api/agent/propose` (LLM JSON) + fallback | พิมพ์อิสระได้ |
| 17:15–18:00 | `/api/explain` + number check; **deploy v1** | v1 ออนไลน์ |
| 19:00–20:30 | ElevenLabs: pre-generate + `/api/tts` + ปุ่มเล่นเสียง | ได้ยินเสียงไทย |
| 20:30–21:30 | Receipt, re-check UI, mobile polish | flow ครบบนมือถือ |
| 21:30–22:30 | Voice input / negotiation (SHOULD) | ทำงาน หรือตัดทิ้ง |
| 22:30–24:00 | Deck + write-up draft + วิดีโอสำรอง | ไฟล์พร้อม |
| ศ. 10:00–10:45 | ทดสอบจาก session ใหม่และมือถือ | ไม่มีบั๊กร้ายแรง |
| 10:45–11:15 | แก้บั๊ก, COULD ถ้ามีเวลา | — |
| **11:15** | **Feature freeze** | — |
| 11:30–12:00 | Submission briefing | — |
| 12:00–13:00 | ตรวจ deck, write-up, README | — |
| **13:00–13:15** | **Submit** | — |
| 13:15–14:00 | ตรวจว่าส่งครบ, ซ้อม | — |

---

## 12. ความเสี่ยง และการรับมือคำถามกรรมการ

### 12.1 Risk Register
| # | ความเสี่ยง | การรับมือ |
|---|---|---|
| R1 | Solo + scope 3 ฉาก | engine ใช้ร่วมกันทุกฉาก, preset ก่อน, ตัด SHOULD/COULD ได้ทันที |
| R2 | LLM ช้า หรือ JSON เสีย | schema validation, timeout, fallback เป็น preset/regex |
| R3 | LLM พูดตัวเลขผิด | number post-check + template |
| R4 | v3 ภาษาไทยช้า หรือ credits หมด | pre-generate, cache, `speechSynthesis` |
| R5 | Key หลุด | Worker secrets, ตั้ง spend cap, rotate หลังงาน |
| R6 | ถูกมองว่าเป็น "expense tracker" | เน้นช่วง *ก่อน* จ่ายและ intent mismatch ไม่ใช่การติดตามรายจ่าย |
| R7 | ถูกมองว่า "Web3 เกินไป" | คริปโตเป็นแค่ 1 ใน 3 ฉาก และไม่ใช่ฉากแรก |
| R8 | U-Bot ไม่มี API | mock ที่ติดป้ายชัด + API contract + adapter |
| R9 | อ้างข้อกฎหมายผิด (click-to-cancel) | พูดตามหัวข้อ 3.2(ก) |
| R10 | Wi-Fi ล่ม | hotspot, ไฟล์เสียง static, preset, วิดีโอสำรอง |
| R11 | ข้อสงสัยเรื่อง existing project | commit แรกหลังเริ่มงาน, เอกสารนี้เป็น research เท่านั้น |

### 12.2 Judge Attack Q&A
| คำถาม | คำตอบ |
|---|---|
| "AI อยู่ตรงไหน หรือเป็นแค่ if-else?" | AI ทำ 3 อย่างที่ rules ทำไม่ได้: เข้าใจคำกำกวม ("ลองดู", "แผนอาจเปลี่ยน"), สร้าง proposal ในบท agent, และอธิบาย/ต่อรองสองภาษา ส่วน rules ตัดสินเรื่องเงินโดยตั้งใจ เพราะ LLM hallucinate ตัวเลขได้ |
| "Visa/Mastercard/AP2 ทำแล้วไม่ใช่เหรอ?" | ระบบเหล่านั้นเป็น rails ที่จำกัดวงเงินหรือพิสูจน์ mandate เราเป็นชั้นที่ผู้ใช้เห็น อธิบายว่าผิดเจตนาตรงไหน และคำนวณทางเลือก ซึ่ง alternative แปลงเป็น allowance ของ ACP หรือ ERC-7715 ได้ |
| "U-Bot จริงไหม?" | ยังเป็น mock ที่ติดป้ายชัด แต่มี API contract พร้อมเสียบตัวจริง (ระบุสิ่งที่ mentor ตอบ) |
| "ถ้าผู้ใช้อยากได้ annual จริง?" | PAUSE ไม่ใช่ BLOCK ผู้ใช้กดยืนยันข้อเสนอเดิมได้ เราแค่ทำให้เป็นการตัดสินใจที่รู้ตัว |
| "ใช้จริงยังไง? ใครจ่าย?" | ฝังใน agent/super app (เช่น U-topia) เป็น trust layer ลดข้อพิพาทและการขอคืนเงิน [INFERRED] |
| "Prompt injection?" | agent ไม่ถือ credential, guard ตัดสินหลัง LLM เสมอ, alternative ต้อง re-check |
| "ทำไมต้องมีเสียง?" | คำเตือนที่อ่านออกเสียงหยุดการกดผ่านได้ดีกว่า และช่วยผู้ใช้ที่ไม่ถนัดอ่านศัพท์การเงิน [INFERRED: ยังไม่มีข้อมูลวิจัยรองรับในเอกสารนี้] |

---

## 13. โครง Pitch 3 นาที
| เวลา | เนื้อหา |
|---|---|
| 0:00–0:20 | **Hook:** "AI agents do what you say. TopiaPause makes sure they do what you meant." พร้อมภาพคำว่า "ลองดู" ที่กลายเป็นบิล ฿3,990/ปี |
| 0:20–0:50 | **Problem + evidence:** agentic commerce มาแล้ว (Visa, Mastercard, ChatGPT checkout), subscription traps (FTC v. Amazon $2.5B), infinite approvals (LI.FI ~$11.6M) |
| 0:50–2:00 | **Live demo:** ฉาก 1 เต็ม (เสียงไทย) → ฉาก 2 แบบเร็ว → ฉาก 3 พร้อม "ทำไมแค่ 200?" |
| 2:00–2:25 | **How it works:** AI proposes, rules decide, you sign · LLM สำหรับภาษา, engine สำหรับตัวเลข · ElevenLabs Eleven v3 สำหรับเสียงไทย |
| 2:25–2:45 | **U-Bot integration:** แผนภาพ guard API contract, mock ที่ระบุชัด, ใช้ได้กับทุก agent |
| 2:45–3:00 | **Close:** ข้อจำกัด (sandbox) + สิ่งต่อไป + "Think before your AI spends." + QR |

---

## 14. คำถามสำหรับ Mentor

1. U-Bot คือผลิตภัณฑ์อะไร สัมพันธ์กับ Topi AI อย่างไร และมี API, webhook หรือ sandbox ให้ทีมใช้ไหม?
2. ตอนนี้ U-Bot ยืนยันกับผู้ใช้ก่อนทำธุรกรรมอย่างไร และมีการตรวจ plan, refund หรือ approval scope ไหม?
3. เกณฑ์ (execution 40 / practicality 40 / design 10 / innovation 5 / U-Bot 5) เป็นทางการไหม และ "U-Bot integration" ต้องถึงระดับไหน (mock + contract พอไหม)?
4. Partner bounty ของ ElevenLabs / Tokenomist / U-topia คืออะไร และมี credits ไหม?
5. ใช้ชื่อหรือรูปแบบ UI ของ U-Bot ในเดโมได้ไหม?
6. ฉากไหนเกี่ยวกับผู้ใช้ U-topia มากที่สุด (subscription, travel หรือ crypto)?
7. Submission format และเวลา demo บนเวทีเป็นอย่างไร?

---

## 15. แหล่งอ้างอิง

**[OFFICIAL] ผู้จัด / สปอนเซอร์ / บริษัท**

- Luma U-Hackathon 2026: https://luma.com/lqrbtu27
- FLOW Summit: https://flowsummitbangkok.com/
- U-topia: https://u-topia.com/ · https://u-topia.com/blog/flow-summit-hackathon · https://u-topia.com/utspecs
- Topi AI (gitbook): https://u-topia.gitbook.io/u-topia-overview/topi-ai-your-web3-trading-assistant
- Visa Intelligent Commerce Connect: https://corporate.visa.com/en/sites/visa-perspectives/newsroom/visa-intelligent-commerce-connect-ai-shopping-for-businesses.html
- Mastercard Agent Pay: https://www.mastercard.com/news/press/2025/april/mastercard-unveils-agent-pay-pioneering-agentic-payments-technology-to-power-commerce-in-the-age-of-ai · https://www.mastercard.com/global/en/news-and-trends/stories/2025/agentic-commerce-momentum.html
- OpenAI Instant Checkout: https://openai.com/index/buy-it-in-chatgpt/
- LI.FI incident report: https://li.fi/knowledge-hub/incident-report-16th-july

**[DOCS] เอกสารเทคนิค / รัฐ / spec**

- ElevenLabs: https://elevenlabs.io/docs/overview/models · https://elevenlabs.io/pricing · https://elevenlabs.io/pricing/api · https://elevenlabs.io/speech-to-text · https://elevenlabs.io/docs/api-reference/speech-to-text/convert · https://elevenlabs.io/docs/overview/administration/billing · https://help.elevenlabs.io/hc/en-us/articles/17883183930129
- Tokenomist: https://docs.tokenomist.ai/api-documents/introduction · https://docs.tokenomist.ai/api-documents/unlock-events/v5 · https://www.tokenomist.ai/pricing
- Google AP2: https://ap2-protocol.org/ap2/specification/ · https://ap2-protocol.org/ap2/flows/
- ACP: https://developers.openai.com/commerce/specs/checkout · https://github.com/agentic-commerce-protocol/agentic-commerce-protocol
- x402: https://docs.x402.org/core-concepts/http-402
- Coinbase AgentKit / CDP: https://github.com/coinbase/agentkit · https://docs.cdp.coinbase.com/wallets/security-and-policies/policy-engine/overview
- MetaMask ERC-7715: https://docs.metamask.io/smart-accounts-kit/concepts/advanced-permissions/
- EIP-20: https://eips.ethereum.org/EIPS/eip-20
- FTC Amazon: https://www.ftc.gov/news-events/news/press-releases/2025/09/ftc-secures-historic-25-billion-settlement-against-amazon
- FTC Fees Rule: https://www.ftc.gov/news-events/news/press-releases/2025/05/ftc-rule-unfair-or-deceptive-fees-take-effect-may-12-2025 · https://www.ecfr.gov/current/title-16/chapter-I/subchapter-D/part-464
- คำพิพากษา Eighth Circuit (สำเนาจาก NFIB): https://www.nfib.com/wp-content/uploads/2025/07/2025-07-08-FTC-Negative-Option-Lawsuit-Opinion.pdf
- Cloudflare: https://developers.cloudflare.com/workers/static-assets/

**[NON-OFFICIAL]**

- Reuters (click-to-cancel): https://www.reuters.com/legal/legalindustry/us-click-cancel-rule-blocked-by-appeals-court-2025-07-08/
- CertiK (Socket): https://www.certik.com/blog/socket-tech-incident-analysis
- software-listing.com (ElevenLabs Thai): https://software-listing.com/blog/elevenlabs-voice-agents-thai-vietnamese-indonesian-2026
- thailandhackathons.com (ไม่ใช่ทางการ / ขัดกับ Luma): https://thailandhackathons.com/events/u-hackathon-2026
- ชื่อซ้ำที่ไม่เกี่ยวข้อง: IYULAB U-Bot https://iyulab.com/en/solutions/u-llm/
