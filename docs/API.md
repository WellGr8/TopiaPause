# TopiaPause API

One Cloudflare Worker serves the web app and these JSON endpoints under `/api/*`.

- **Base URL:** `https://topiapause.<your-subdomain>.workers.dev` in production, `http://127.0.0.1:8787` locally (`pnpm build && pnpm dev:worker`).
- **Auth:** none. The API runs in sandbox mode, and no endpoint moves real money.
- **Decisions:** every decision and every number comes from `packages/guard-engine`. LLMs only play the agent or phrase text.

| Endpoint | What it does | CORS | Rate limit (per IP) |
|---|---|---|---|
| `GET /api/health` | Feature detection: engine version and which integrations are live | any origin | – |
| `POST /api/guard/check` | **Public guard API.** Checks one agent proposal against the user's intent and policy | any origin | 120 / min |
| `POST /api/agent/chat` | U-Bot (mock): turns a message into an `AgentProposal` (LLM or scripted) | same origin | 20 / min |
| `POST /api/agent/execute` | Mock execution of a confirmed proposal; returns a receipt reference | same origin | 120 / min |
| `POST /api/voice/tts` | ElevenLabs text-to-speech, streamed back as `audio/mpeg` | same origin | 20 / min |

**Request rules:**
- Bodies must be `Content-Type: application/json` and at most **32 KB**.
- Input is validated with zod. Strings are length-capped and amounts must be finite and non-negative.

**Errors** always have this shape:

```json
{ "error": { "code": "invalid_input", "message": "proposal.kind: Invalid discriminator value. Expected 'subscription' | 'stay' | 'token_swap'" } }
```

| Status | `code` | When |
|---|---|---|
| 400 | `invalid_json`, `invalid_input` | Body doesn't parse or fails the schema (the message lists the paths) |
| 404 / 405 | `not_found`, `method_not_allowed` | Unknown route or wrong method |
| 413 | `payload_too_large` | Body over 32 KB |
| 415 | `unsupported_media_type` | Missing `Content-Type: application/json` |
| 422 | `unprocessable` | Valid shape, but the engine couldn't evaluate it |
| 429 | `rate_limited` | Over the per-IP limit (`Retry-After: 60`) |
| 502 | `tts_failed` | ElevenLabs returned an error |
| 503 | `tts_unavailable` | ElevenLabs is not configured; use browser speech |

---

## Stage demo (copy and paste)

```bash
pnpm build && pnpm dev:worker            # terminal 1
./scripts/demo-curl.sh                   # terminal 2 (local)
./scripts/demo-curl.sh https://topiapause.<you>.workers.dev   # deployed
```

The script posts the three scene payloads in [`scripts/demo/`](../scripts/demo) to `/api/guard/check` and prints a short summary (jq if installed, otherwise python3). Set `RAW=1` to print the full JSON. Each scene is also a single curl:

```bash
curl -X POST http://127.0.0.1:8787/api/guard/check -H 'Content-Type: application/json' -d @scripts/demo/subscription.json
curl -X POST http://127.0.0.1:8787/api/guard/check -H 'Content-Type: application/json' -d @scripts/demo/stay.json
curl -X POST http://127.0.0.1:8787/api/guard/check -H 'Content-Type: application/json' -d @scripts/demo/crypto.json
```

Output from a local `wrangler dev` run:

```text
▶ subscription  ช่วยสมัครแอปแต่งรูป PixelPro ให้หน่อย อยากลองดู
{ "decision": "pause", "findings": ["SUB_COMMITMENT", "SUB_OVER_CAP"],
  "counterOffer": "7-day free trial, then ฿299/month", "recheck": "allow",
  "metrics": { "monthlyEquivalent": 332.5, "cap": 300, "protectedAmount": 3990 } }

▶ stay  หาโรงแรมถูกๆ ใกล้อโศก คืนวันศุกร์ แต่แผนอาจเปลี่ยนนะ
{ "decision": "pause", "findings": ["STAY_HIDDEN_TOTAL", "STAY_FLEXIBILITY"],
  "counterOffer": "Asok Inn ฿1,445, free cancellation until Thursday", "recheck": "allow",
  "metrics": { "premium": 161, "premiumPct": 12.5, "protectedAmount": 1284 } }

▶ crypto  แลก 500 USDT เป็น TOKEN-X ครั้งเดียวพอ
{ "decision": "pause", "findings": ["CONC_CAP", "APPROVAL_SCOPE", "APPROVAL_EXPIRY"],
  "counterOffer": "Swap 200 USDT · one-time exact approval", "recheck": "allow",
  "metrics": { "postTradeSharePct": 45, "capPct": 30, "capUsd": 600, "aMaxUsd": 200, "counterSharePct": 30, "protectedAmount": 300 } }
```

---

## `GET /api/health`

```json
{ "ok": true, "engineVersion": "0.1.0", "agent": "U-Bot (mock)", "llm": "scripted", "tts": "unavailable" }
```

- `llm` is `"llm"` when `LLM_API_KEY` and `LLM_MODEL` are set, otherwise `"scripted"`.
- `tts` is `"elevenlabs"` when `ELEVENLABS_API_KEY` and `ELEVENLABS_VOICE_ID` are set, otherwise `"unavailable"`.
- Secret values are never returned.

The web app calls this endpoint first. If it doesn't answer (for example under plain `vite dev`), the app runs the same engine in the browser.

## `POST /api/guard/check`

Any agent (U-Bot, an MCP tool, your own bot) can call this **before** it executes anything.

**Request:**

| Field | Type | Required | Notes |
|---|---|---|---|
| `userText` | string ≤ 1000 | yes | What the user actually said |
| `proposal` | `AgentProposal` | yes | `kind`: `subscription`, `stay` or `token_swap`. Shapes are in [`packages/shared/src/types.ts`](../packages/shared/src/types.ts) |
| `policy` | `UserPolicy` | no | Defaults to the demo policy: ฿300/month subscription cap, refundable premium ≤ 15%, TOKEN-X ≤ 30%, exact approvals, 15-minute expiry |
| `lang` | `"th"` \| `"en"` | no | Default `"th"`. Controls the localized `assumptions` text |
| `intent` | `ActionIntent` | no | If omitted, it is derived from `userText` with deterministic keyword rules |

Example (`scripts/demo/crypto.json`):

```json
{
  "userText": "แลก 500 USDT เป็น TOKEN-X ครั้งเดียวพอ",
  "lang": "th",
  "proposal": {
    "kind": "token_swap",
    "proposalId": "demo-crypto",
    "agent": { "name": "U-Bot (mock)", "adapter": "mock" },
    "summary": "Swap 500 USDT → TOKEN-X, approve unlimited",
    "fromAsset": "USDT",
    "toAsset": "TOKEN-X",
    "amountIn": { "amount": 500, "currency": "USDT" },
    "feeRate": 0,
    "gasUsd": 0,
    "approval": { "spender": "MockSwap Router (sandbox)", "type": "unlimited" },
    "portfolio": {
      "totalUsd": 2000,
      "holdingsUsd": { "TOKEN-X": 400, "USDT": 500, "ETH": 1100 },
      "balances": { "USDT": 500, "TOKEN-X": 400, "ETH": 0.41 }
    }
  }
}
```

**Response (`GuardVerdict`, trimmed):**

```json
{
  "verdictId": "v-demo-crypto",
  "decision": "pause",
  "findings": [
    { "ruleId": "CONC_CAP", "severity": "pause",
      "evidence": { "asset": "TOKEN-X", "postTradeSharePct": 45, "capPct": 30, "capUsd": 600, "aMax": 200, "amountIn": 500 } },
    { "ruleId": "APPROVAL_SCOPE", "severity": "pause", "evidence": { "approvalType": "unlimited", "commitment": "once" } },
    { "ruleId": "APPROVAL_EXPIRY", "severity": "pause", "evidence": { "expirySec": "none", "maxExpiryMin": 15 } }
  ],
  "counterOffer": {
    "proposal": { "kind": "token_swap", "summary": "Swap 200 USDT · one-time exact approval",
                  "amountIn": { "amount": 200, "currency": "USDT" },
                  "approval": { "type": "exact", "amount": { "amount": 200, "currency": "USDT" }, "expirySec": 900 } },
    "recheck": "allow",
    "diff": { "amountIn": { "from": 500, "to": 200 }, "approval": { "from": "unlimited", "to": 200 }, "expirySec": { "from": "none", "to": 900 } }
  },
  "metrics": { "postTradeSharePct": 45, "capPct": 30, "aMaxUsd": 200, "counterSharePct": 30, "protectedAmount": 300 },
  "assumptions": ["USDT = $1 และไม่มี slippage (กรณีแย่สุดต่อเพดาน)", "ค่า gas จ่ายจากสินทรัพย์อื่น", "ทำรายการจำลองเท่านั้น ไม่ใช่คำแนะนำการลงทุน"],
  "explanation": { "th": "เดี๋ยวก่อนครับ TOKEN-X จะเป็น 45% ของพอร์ต เกินเพดาน 30% …", "en": "Hold on. TOKEN-X would be 45% of your portfolio, above your 30% cap. …", "source": "template" },
  "voiceText": { "th": "พอร์ตคุณจะมี TOKEN-X ถึง 45% …", "en": "Your TOKEN-X share would hit 45% …", "clipId": "crypto-pause" },
  "engineVersion": "0.1.0"
}
```

**How an agent should use it:**
- `decision` is one of `allow`, `pause` or `block`.
- On `pause`, show the user the `counterOffer` and execute only what they confirm.
- A `counterOffer` is included only if the engine re-checked it and it passed (`recheck: "allow"`).
- `explanation` and `voiceText` contain only numbers that appear in `findings` / `metrics` (number lock).

From JavaScript (CORS is open):

```js
const verdict = await fetch('https://topiapause.<you>.workers.dev/api/guard/check', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userText, proposal }),
}).then((r) => r.json());
```

## `POST /api/agent/chat`

This is U-Bot (mock). With `LLM_API_KEY` + `LLM_MODEL`, it calls any **OpenAI-compatible** `POST {LLM_BASE_URL}/chat/completions` with `response_format: { type: "json_object" }`. Works with OpenAI, OpenRouter, Groq, Together, vLLM and similar providers.

- **How the LLM output is used:** the LLM acts as an over-eager agent and returns `{ reply, scene, proposal }`. That output is zod-validated. The user's portfolio and the merchant catalog are then restored from the sandbox catalog, so the agent can't invent them.
- **Fallback:** if the key is missing, the call times out (12 s) or the output is invalid, the endpoint answers with the scripted keyword mock (`source: "scripted"`).
- **Intent:** always derived deterministically, so the guard doesn't depend on the LLM.

```bash
curl -X POST http://127.0.0.1:8787/api/agent/chat -H 'Content-Type: application/json' \
  -d '{"message":"swap 300 USDT to TOKEN-X once","lang":"en"}'
```

```json
{ "reply": "Sure. Swapping 300 USDT into TOKEN-X, and I'll request unlimited USDT approval so next time is faster.",
  "proposal": { "kind": "token_swap", "amountIn": { "amount": 300, "currency": "USDT" }, "approval": { "type": "unlimited" }, "…": "…" },
  "intent": { "goal": "swap_token", "commitment": "once", "amount": { "amount": 300, "currency": "USDT" }, "confidence": 0.85, "…": "…" },
  "scene": "crypto",
  "source": "scripted" }
```

Request: `{ "message": string ≤ 1000, "lang"?: "th" | "en", "scene"?: "subscription" | "stay" | "crypto", "sessionId"?: string }`.

## `POST /api/agent/execute`

The user must have confirmed (`userConfirmed: true`, literally). The response is a mock execution; no money moves.

```bash
curl -X POST http://127.0.0.1:8787/api/agent/execute -H 'Content-Type: application/json' \
  -d "{\"proposal\": $(jq -c .proposal scripts/demo/stay.json), \"verdictId\": \"v-demo-stay\", \"userConfirmed\": true}"
```

```json
{ "execution": { "mode": "mock", "status": "success", "ref": "mock-tx-7f899c9f-4" } }
```

## `POST /api/voice/tts`

ElevenLabs text-to-speech. The key stays on the Worker.

- **Request:** `{ "text": string ≤ 600, "lang"?: "th" | "en" }`.
- **Upstream call:** `POST https://api.elevenlabs.io/v1/text-to-speech/{ELEVENLABS_VOICE_ID}?output_format=mp3_44100_128` with `model_id = ELEVENLABS_MODEL_ID` (default `eleven_v3`).
- **Response:** the mp3 is streamed back as `audio/mpeg`. It is also cached at the edge by (voice, model, text), and `X-TTS-Cache` says `hit` or `miss`.

```bash
curl -X POST http://127.0.0.1:8787/api/voice/tts -H 'Content-Type: application/json' \
  -d '{"text":"หยุดก่อนครับ","lang":"th"}' --output warning.mp3
```

Without a key it answers `503`, and the web app falls back to the browser's `speechSynthesis`:

```json
{ "error": { "code": "tts_unavailable", "message": "ElevenLabs is not configured (missing ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID). Use browser speech instead." } }
```

---

## Configuration

| Name | Kind | Default | Used by |
|---|---|---|---|
| `LLM_API_KEY` | **secret** | – | `/api/agent/chat` |
| `LLM_MODEL` | var | `""` (LLM off) | `/api/agent/chat`, e.g. `gpt-4o-mini` |
| `LLM_BASE_URL` | var | `https://api.openai.com/v1` | `/api/agent/chat` |
| `ELEVENLABS_API_KEY` | **secret** | – | `/api/voice/tts` |
| `ELEVENLABS_VOICE_ID` | var | `""` (TTS off) | `/api/voice/tts` |
| `ELEVENLABS_MODEL_ID` | var | `eleven_v3` | `/api/voice/tts` |
| `ALLOWED_ORIGIN` | var | `""` | Extra origin allowed to call the same-origin routes |
| `RATE_LIMITER`, `RATE_LIMITER_PAID` | binding | 120/min, 20/min | Workers Rate Limiting |

- Vars live in [`workers/api/wrangler.jsonc`](../workers/api/wrangler.jsonc).
- Secrets go in `workers/api/.dev.vars` locally (copy `.dev.vars.example`). In production, set them with `wrangler secret put <NAME>` or let the deploy workflow push them.
