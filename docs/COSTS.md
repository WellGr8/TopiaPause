# What one guard check costs

Every figure on the GuardCard meter is an **estimate**, rounded **up** to the satang (`ROUNDING.cost` in `packages/shared/src/money.ts`) so the meter never understates. The arithmetic lives in `packages/shared/src/costs.ts` and is covered by `packages/shared/test/money.test.ts`.

FX for the estimate is the fixed demo rate **USD/THB = 32.50** (`DEMO_FX_USD_THB`, as of 2026-10-15). A live rate would only change the satang conversion, not the USD prices below.

## Unit prices

| Piece | Price | Source |
|---|---|---|
| gpt-4o-mini input | $0.00015 / 1k tokens = 150 nano-USD / token | [OpenAI API pricing](https://openai.com/api/pricing) |
| gpt-4o-mini output | $0.0006 / 1k tokens = 600 nano-USD / token | same |
| Tokenomist Standard | $249.95 / month for 50,000 calls ≈ **$0.005 / call** | [Tokenomist pricing](https://tokenomist.ai/pricing), [upcoming unlocks v5](https://docs.tokenomist.ai/api-documents/upcoming-unlock-events/v5). Failed calls are not charged. |
| Cloudflare Workers | $0.30 / million requests = **$0.0000003 / request** (Paid plan, after the included 10M) | [Workers pricing](https://developers.cloudflare.com/workers/platform/pricing/) |
| ElevenLabs voice | **$0 per check** | Clips are generated once by `scripts/pregen-voice.ts` ([ElevenLabs pricing](https://elevenlabs.io/pricing)). The check itself does not call TTS. |
| ElevenLabs Scribe v2 (speech-to-text) | **$0.22 per audio hour** | [ElevenLabs API pricing, Speech to Text](https://elevenlabs.io/pricing/api?price.section=speech_to_text). A spoken reply is capped at 6 seconds, so one call is `0.22 × 6 / 3600 × 32.50 × 100 = 1.1916…` satang, which ceilings to **2 satang (฿0.02)**. No keyterm prompting and no entity detection, so those extras ($0.05 and $0.07 per hour) are not added. |

Prices are stored as integer nano-USD (`1 USD = 1e9`).

## What a check actually spends

The decision is rules, not a model. `/api/guard/check` makes **0 LLM calls**.

| Check | Calls | nano-USD | satang (ceil at 32.50) | Meter |
|---|---|---|---|---|
| Rule check, no market data (subscription, stay) | 1 Worker request | 300 | **1** (฿0.01) | `Rule check · 0 AI calls · ≈฿0.01` |
| Crypto, Tokenomist cache hit or no key | 1 Worker request | 300 | **1** | same, plus `cached data` when a hit served it |
| Crypto, one live Tokenomist fetch | 1 Worker request + 1 API call | 5,000,300 | **17** (฿0.17) | `1 data call · ≈฿0.17` |
| Same check in the browser (API down) | nothing leaves the device | 0 | **0** | `Rule check on device · ≈฿0.00` |
| Spoken reply (`POST /api/voice/stt`, ≤ 6 s) | 1 Scribe v2 call | 366,667 | **2** (฿0.02) | Not on the guard meter |

Speech-to-text is a separate paid call. It is not added to `estimateCostThb` for a guard check, and `/api/guard/check` still makes **0 AI calls**. The 366,667 nano-USD figure is `ceil(0.22 × 1e9 × 6 / 3600)`, so the integer price does not understate the $0.22/hour rate.

Worked example for the live fetch: `5,000,300 × 32.50 × 100 / 1e9 = 16.250975` satang, which ceilings to 17.

Tokenomist is fetched at most **once per hour per isolate** (in-memory) and, on a custom domain, once per colo (Cache API). Every later crypto check in that hour is the ฿0.01 row. The bundled sample used without a key costs nothing and is labelled "sample data, not live".

An LLM explanation draft is not wired up (`llmCalls` stays 0). If one were added, 1,000 input + 200 output tokens of gpt-4o-mini would be `1000×150 + 200×600 = 270,000` nano-USD ≈ ฿0.01 on top, still an estimate.

## What is not in the meter

- The user's own agent (ShopBot, U-Bot) calling its model. TopiaPause only meters the check.
- Verdict-ticket HMAC and policy-token HMAC. Both are local `crypto.subtle` calls.
- Rate limiting. The Workers binding is included with the request.
