# TopiaPause

**Think before your AI spends.** · **หยุดคิดก่อน AI จ่ายเงินแทนคุณ**

> AI agents do what you say. TopiaPause makes sure they do what you meant.

TopiaPause is a guard layer for AI agents that spend money for you. Before an agent pays, subscribes, books or approves, TopiaPause compares **what you said** with **what the agent is about to do**. If they don't match, it pauses, warns you out loud in Thai or English, and offers an alternative that fits what you meant. It re-checks that alternative, and nothing happens until you confirm.

**AI proposes, rules decide, you sign.** The LLM handles language. Every number comes from a deterministic, unit-tested rules engine.

> ⚠️ Hackathon prototype (U-Hackathon 2026, Track AI, built on-site 15–16 Oct 2026).
> **No real money moves.** The agent in this demo is **"U-Bot (mock)"**, a scripted stand-in for U-topia's U-Bot, labelled as such until a real U-Bot API is available.

<p align="center">
  <img src="docs/screenshots/v2/m01-onboarding.png" width="200" alt="Onboarding: set 3 rules on one screen" />
  <img src="docs/screenshots/v2/m03-subscription-guard.png" width="200" alt="Guard card: annual plan paused, monthly offer" />
  <img src="docs/screenshots/v2/m05-crypto-guard.png" width="200" alt="Guard card: crypto swap paused with a_max counter-offer" />
  <img src="docs/screenshots/v2/m07-activity.png" width="200" alt="Activity with protected total" />
</p>

## Demo scenes

| You say | Agent tries to | TopiaPause |
|---|---|---|
| "I want to try this photo app" | buy an **annual** auto-renew plan (฿3,990) | Pauses and offers a 7-day free trial + monthly ฿299 within your ฿300 cap |
| "Cheap hotel near Asok, plans may change" | book a **non-refundable** room (shown ฿1,200, real total ฿1,284) | Pauses, shows the total-price gap, offers the cheapest refundable room (+฿161, 12.5%) |
| "Swap 500 USDT into TOKEN-X, just once" | request **unlimited approval** and push TOKEN-X to 45% (your cap is 30%) | Pauses and offers the max allowed swap (**200 USDT**) with a one-time exact approval that expires in 15 minutes |

Each scene runs end to end: proposal → guard card (status + one-line reason, one counter-offer, voice autoplays) → "use this" → re-check → mock execute → receipt in the activity list.

### Screenshots

Mobile (390×844, Thai, light) unless noted. Current design (v2) is in [`docs/screenshots/v2/`](docs/screenshots/v2/); the first design is kept in [`docs/screenshots/`](docs/screenshots/) for comparison.

**Before / after: subscription guard card** (the whole card now fits on one screen inside the chat)

<img src="docs/screenshots/v2/before-after-subscription-guard.png" width="600" alt="Before and after: subscription guard card" />

| Screen | Scene 1: subscription | Scene 2: stay | Scene 3: crypto |
|---|---|---|---|
| Guard card in chat | <img src="docs/screenshots/v2/m03-subscription-guard.png" width="180" alt="Scene 1 guard card" /> | <img src="docs/screenshots/v2/m04-stay-guard.png" width="180" alt="Scene 2 guard card" /> | <img src="docs/screenshots/v2/m05-crypto-guard.png" width="180" alt="Scene 3 guard card" /> |
| Re-check | <img src="docs/screenshots/v2/m03-subscription-recheck.png" width="180" alt="Scene 1 re-check" /> | <img src="docs/screenshots/v2/m04-stay-recheck.png" width="180" alt="Scene 2 re-check" /> | <img src="docs/screenshots/v2/m05-crypto-recheck.png" width="180" alt="Scene 3 re-check" /> |
| Done | <img src="docs/screenshots/v2/m03-subscription-done.png" width="180" alt="Scene 1 done" /> | <img src="docs/screenshots/v2/m04-stay-done.png" width="180" alt="Scene 2 done" /> | <img src="docs/screenshots/v2/m05-crypto-done.png" width="180" alt="Scene 3 done" /> |

| Onboarding | Empty chat | "See why" expanded | Activity | Receipt (expanded row) | Rules |
|---|---|---|---|---|---|
| <img src="docs/screenshots/v2/m01-onboarding.png" width="140" alt="Onboarding" /> | <img src="docs/screenshots/v2/m02-chat-empty.png" width="140" alt="Empty chat" /> | <img src="docs/screenshots/v2/m03-subscription-reasons.png" width="140" alt="Reasons expanded" /> | <img src="docs/screenshots/v2/m07-activity.png" width="140" alt="Activity" /> | <img src="docs/screenshots/v2/m06-activity-receipt.png" width="140" alt="Receipt row" /> | <img src="docs/screenshots/v2/m08-rules.png" width="140" alt="Rules" /> |

| Dark / English guard card | Dark / English done |
|---|---|
| <img src="docs/screenshots/v2/m09-dark-en-crypto-guard.png" width="180" alt="Dark English guard card" /> | <img src="docs/screenshots/v2/m09-dark-en-crypto-done.png" width="180" alt="Dark English done" /> |

Desktop (1440×900):

<img src="docs/screenshots/v2/d02-desktop-subscription-guard.png" width="720" alt="Desktop guard card" />
<img src="docs/screenshots/v2/d03-desktop-activity.png" width="720" alt="Desktop activity with receipt" />
<img src="docs/screenshots/v2/d01-desktop-onboarding.png" width="360" alt="Desktop onboarding" /> <img src="docs/screenshots/v2/d04-desktop-rules.png" width="360" alt="Desktop rules" />

## How it works

User (chat) → **U-Bot (mock)** proposes → **TopiaPause Guard** (intent → deterministic rules → counter-offer → re-check) → voice warning → you confirm → mock execute → receipt.

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for diagrams, data contracts and the API ([Thai summary](docs/architecture-th.md), [research](docs/pre-research-v2.md)).

## What is real vs mocked

| Piece | Status |
|---|---|
| Guard engine (`packages/guard-engine`): all rules, precedence, `a_max`, counter-offer, re-check, number lock, `AGENT_FOLLOWED_UNTRUSTED` | **Real.** Pure TypeScript. The web app and the Worker run the same code. Money is integer minor units (satang, cents, micro-USDT). |
| Numbers on screen (prices, %, `a_max`, saved ฿3,691.00, protection cost ฿161.00, 300 USDT exposure cut) | **Real engine output.** The UI classifies them; it does not invent them. |
| Worker API (`workers/api`) | **Real.** `POST /api/guard/check` runs the engine with zod validation, CORS, a 32 KB body cap, and per-IP rate limits. Policy is a signed token (`POST /api/policy`). Verdict tickets are signed and single-use in the isolate (replay → 409, forged → 403, smuggled policy → 400). See [docs/API.md](docs/API.md). |
| U-Bot / u.bot | **Simulated.** u.bot has no public API, so the agent role is a stand-in. The four demo chips use a deterministic script. Free-text `POST /api/agent/chat` calls an OpenAI-compatible LLM only when `LLM_API_KEY` + `LLM_MODEL` are set, and catalog prices and the portfolio are restored afterwards. Without a key, chat stays scripted. |
| Tokenomist | **Sample data** in the demo. The unlock note is labelled "sample data, not live" unless `TOKENOMIST_API_KEY` is set. The note never changes the decision. |
| Explanations | Number-locked TH/EN templates (`lockExplanation`). With an LLM key, a paraphrase is shown only when every number already came from the engine. |
| Voice | Pregenerated ElevenLabs clips in `apps/web/public/audio/` (web-64k) play when their manifest text matches the engine line. Subscription and stay match. Crypto clips still say "$200" and the English injection clip still says "U-Bot", while the engine says "200 USDT" and "A web page told your AI to pick the yearly plan, but you only asked to try it". The player compares the text and, on a mismatch, falls back to live `POST /api/voice/tts` (an engine line only; needs `ELEVENLABS_API_KEY`) and then browser `speechSynthesis`. The Thai persona is male (ผม / ครับ) to match the Brian voice. |
| Execution and receipts | **Mock** (`POST /api/agent/execute`, `mode: 'mock'`, sandbox ref). No wallet, no payment. The cost meter and the receipt arithmetic are real. |
| Web ↔ API | The web app feature-detects `/api/health`. With the Worker it calls the API; on plain Vite or offline it runs the same engine in the browser. |
| Persistence | `localStorage` only (rules, activity, language, theme). |

## Stack

- React 19 + TypeScript + Vite + Tailwind v4 (`apps/web`), Inter + IBM Plex Sans Thai, lucide icons
  - Design tokens are the Tailwind v4 `@theme` config in `apps/web/src/index.css`: 1 brand colour + the wave gradient, 3 grays, 3 status colours, 2 radii, 1 shadow. Default palette, radii and shadows are cleared so nothing else can be used; dark mode swaps token values.
- Cloudflare Worker with static assets and `/api/*`, keys kept server-side (`workers/api`)
- Pure TS rules engine with Vitest (`packages/guard-engine`)
- Shared contracts, TH/EN templates and the mock catalogs (`packages/shared`)

```
apps/web/              chat UI, guard card, re-check, activity + receipts, onboarding (runs fully in-browser)
workers/api/           Cloudflare Worker: serves apps/web/dist + /api/* (guard check, LLM chat, TTS, mock execute)
scripts/               demo-curl.sh + guard/check payloads for the 3 stage scenes
packages/guard-engine/ deterministic rules + a_max + number lock (+ tests)
packages/shared/       types (ARCHITECTURE §5), TH/EN templates, scene catalogs, scripted U-Bot
demo/voice/            voice lines (display / spoken / tagged) for the 3 scenes
apps/web/public/audio/ pre-generated web-64k ElevenLabs clips + manifest.json
docs/                  architecture, Thai summary, research, diagrams
```

## Run locally

Requirements: Node ≥ 22 (`.nvmrc`; wrangler 4 needs it) and pnpm 10 (`corepack enable`).

```bash
pnpm install
pnpm dev            # web app on http://localhost:5173 (no keys or Worker needed)
```

The web app is self-contained: it calls `guard-engine` directly and uses the scripted U-Bot, so the demo works offline.

To run the Worker (SPA + API on one URL):

```bash
pnpm build                                   # builds apps/web/dist
cp workers/api/.dev.vars.example workers/api/.dev.vars   # optional, all keys may stay empty
pnpm dev:worker                              # wrangler dev on http://localhost:8787
curl -s localhost:8787/api/health
./scripts/demo-curl.sh                       # 4 scenes, then 400 / 409 / 403
```

To keep Vite hot reload but use the Worker API: `TOPIAPAUSE_API=http://127.0.0.1:8787 pnpm dev`.

## Voice clips (optional, recommended for the stage)

The voice lines for the 3 scenes are in [`demo/voice/voice-lines.md`](demo/voice/voice-lines.md) (and `.json`). `display` is the on-screen text, `spoken` has numbers written out for natural Thai, and `tagged` adds optional Eleven v3 audio tags.

```bash
export ELEVENLABS_API_KEY=...  ELEVENLABS_VOICE_ID=...   # or put them in workers/api/.dev.vars
pnpm voice:pregen --dry-run      # list the 30 clips and character count (no key needed)
pnpm voice:pregen                # writes apps/web/public/audio/*.mp3 + manifest.json (script default eleven_v3; live Worker TTS uses eleven_v4)
pnpm voice:pregen --tagged       # use the tagged text instead
pnpm voice:pregen --only=crypto-th --force   # regenerate a subset
```

- Options: `ELEVENLABS_VOICE_ID_TH` / `ELEVENLABS_VOICE_ID_EN` override the voice per language, and `ELEVENLABS_MODEL_ID` overrides the model.
- Existing clips are skipped unless the voice, model or text field changed, or you pass `--force`.
- Without a key the script prints a note and exits 0.

The stage clips (64 kbps) and `manifest.json` are already in `apps/web/public/audio/`. The app plays `warning` then `counter` when that manifest `text` equals the engine `voiceText`, otherwise the combined `pause` clip, otherwise live TTS, otherwise browser speech. Subscription and stay match and play. Crypto recordings still say "$200" and the English injection recording says "told U-Bot". The engine says "200 USDT" and "A web page told your AI to pick the yearly plan, but you only asked to try it", so those clips do not match and the player falls back to live TTS of the engine line, then browser speech. The mp3s are left as recorded. `pnpm voice:pregen` can regenerate clips when you have an ElevenLabs key. A Vitest test checks that `voice-lines.json` pause text still matches the engine, and that the injection warning/counter keys exist in the manifest.

## Test and typecheck

```bash
pnpm test           # Vitest: shared 16, guard-engine 61, web 46, worker API 63
pnpm typecheck      # tsc across all workspaces
pnpm --filter @topiapause/guard-engine test   # engine only
```

Key `a_max` cases (V = $2,000, H = $400, B = 500 USDT, cap 30%):

| Case | a_max |
|---|---|
| base (fee 0, gas 0) | 200.000000 USDT |
| fee 0.3% | 200.420883 USDT (floored to the micro-unit; half-up would be 200.420884 and would edge past the cap) |
| gas 2 USDT | 199.400000 USDT |

## Deploy (one Cloudflare Worker: SPA + API)

`wrangler.jsonc` at the repo root deploys a single Worker named `topiapause`. It serves `apps/web/dist` as static assets (SPA fallback) and runs `workers/api/src/index.ts` only for `/api/*`. `workers/api/wrangler.jsonc` is the same Worker with paths relative to that directory, used by `pnpm dev:worker`. Rate limiting uses Workers Rate Limiting bindings, so no KV or D1 has to be created.

Cloudflare Workers Builds, from `main`:

```bash
pnpm install && pnpm build
wrangler deploy
```

`wrangler deploy` with no `-c` reads the root `wrangler.jsonc`, so the static assets are `apps/web/dist`. From this repo without a global wrangler binary, the same deploy is `pnpm --filter @topiapause/api exec wrangler deploy -c ../../wrangler.jsonc`. `pnpm run deploy` builds the web app and deploys with `workers/api/wrangler.jsonc`. Use `pnpm run deploy`, not `pnpm deploy`: `pnpm deploy` is a built-in pnpm command with a different meaning.

### Automatic (GitHub Actions, push to `main`)

1. **Cloudflare API token:** Cloudflare dashboard → My Profile → API Tokens → Create Token → template **"Edit Cloudflare Workers"** → your account → Create. Copy the token.
2. **Account ID:** Cloudflare dashboard → Workers & Pages → copy the Account ID from the right sidebar.
3. **GitHub secrets:** repo → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN` (required)
   - `CLOUDFLARE_ACCOUNT_ID` (required)
   - `LLM_API_KEY` (optional, enables the LLM agent)
   - `ELEVENLABS_API_KEY` (optional, enables ElevenLabs voice)
4. **Non-secret config** is already in the `vars` block of `wrangler.jsonc` and `workers/api/wrangler.jsonc`: `LLM_BASE_URL=https://openrouter.ai/api/v1`, `LLM_MODEL=openai/gpt-4o-mini`, `ELEVENLABS_VOICE_ID=nPczCjzI2devNBz1zQrb`, `ELEVENLABS_MODEL_ID=eleven_v4`. A deploy replaces the live Worker's vars with this block, so leave the values filled in. API keys and `POLICY_SIGNING_KEY` are secrets only — they are not in `vars`.
5. Push or merge to `main`. `.github/workflows/deploy.yml` runs typecheck + tests, then `pnpm run deploy`, then syncs the optional secrets with `wrangler secret put`. If the two Cloudflare secrets are missing, the job logs a notice and skips; it doesn't fail.
6. **Optional smoke test:** add the repository *variable* `TOPIAPAUSE_URL` (e.g. `https://topiapause.<subdomain>.workers.dev`). After each deploy the workflow curls `/api/health` and runs `scripts/demo-curl.sh` against it.

You can also run it by hand from Actions → Deploy → Run workflow.

### Manual (from your machine)

GitHub Actions deploys are blocked while the repository's GitHub billing lock is in place, so this is the path that actually publishes:

```bash
# Node >= 22 (see .nvmrc). wrangler 4 does not run on 20.
pnpm install
npx wrangler login                 # or export CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
pnpm install && pnpm build && wrangler deploy   # Workers Builds shape, from the repo root

cd workers/api
npx wrangler secret put POLICY_SIGNING_KEY   # required: openssl rand -base64 32
npx wrangler secret put LLM_API_KEY          # optional, LLM agent
npx wrangler secret put ELEVENLABS_API_KEY   # optional, live TTS
npx wrangler secret put TOKENOMIST_API_KEY   # optional, live unlock data
cd ../..
./scripts/demo-curl.sh https://topiapause.<subdomain>.workers.dev
```

Use `pnpm run deploy`, not `pnpm deploy`: `pnpm deploy` is a built-in pnpm command with a different meaning.

The `vars` block already points chat at OpenRouter `openai/gpt-4o-mini` and TTS at ElevenLabs voice `nPczCjzI2devNBz1zQrb` with model `eleven_v4`. Do not clear those vars: an empty value overwrites the live Worker on the next deploy. Chat still stays scripted until `LLM_API_KEY` is set as a secret, and live TTS stays off until `ELEVENLABS_API_KEY` is set the same way. `POLICY_SIGNING_KEY` is a secret too.

Two limits of a `*.workers.dev` deploy:

- **Cache API is a no-op** on `workers.dev`. Tokenomist and TTS are still cached in memory inside each isolate for their TTL, but nothing is shared across isolates until the Worker is on a custom domain.
- **Verdict tickets are single-use per isolate.** A second isolate can still accept a ticket until it expires (10 minutes). Making that global needs a Durable Object; it is intentionally not in this build.

### Keys

- Secrets (`POLICY_SIGNING_KEY`, `LLM_API_KEY`, `ELEVENLABS_API_KEY`, `TOKENOMIST_API_KEY`) live only in Worker secrets (production) or `workers/api/.dev.vars` (local, gitignored; start from `.dev.vars.example`). They are never in `wrangler.jsonc` `vars`, never bundled into the web app, never put in `VITE_*`, and never returned by any endpoint. `/api/health` only reports `llm: "llm" | "scripted"` and `tts: "elevenlabs" | "unavailable"`.
- Without any key, every route still works: scripted U-Bot, browser speech, real guard engine.
- If the web app is served from another origin, set `ALLOWED_ORIGIN`. Chat, TTS, policy, confirm, and session return 403 `forbidden_origin` when `Origin` is missing or is some other site, or when `Sec-Fetch-Site` is `cross-site`. Those routes (except session) need a session: `POST /api/session` sets `tp_session` (`HttpOnly; Secure; SameSite=Strict; Path=/api; Max-Age=600`) and returns the same token for `X-TopiaPause-Session`. The cookie is accepted first; the header still works. The token lasts 10 minutes and is bound to a hash of the User-Agent, not the IP, so Private Relay, WARP, and mobile networks can change the address without `invalid_session`. A different User-Agent is 403 `invalid_session`. No session is 403 `session_required`. Rate limits stay per IP. `guard/check` and `health` are open to any origin. `guard/check` does not call the LLM.
- Chat and TTS have separate 20/minute budgets per IP. A per-isolate daily cap (`PAID_DAILY_MAX`, default 300) stops further upstream LLM and TTS calls. After deploy, the 21st paid call in a minute from one IP should be 429. Set spend limits on the OpenRouter and ElevenLabs accounts as well. Do not deploy this branch until `POLICY_SIGNING_KEY` is set with `openssl rand -base64 32 | wrangler secret put POLICY_SIGNING_KEY`.
- `prefers-reduced-motion` keeps the top glow static.
- After editing bindings, run `pnpm --filter @topiapause/api types`.

## Open questions (need a mentor or account check)

- **Real U-Bot API**: does U-topia expose one (API, webhook, sandbox)? If yes, add a `RealUBotAdapter` that implements `UBotAdapter` in `packages/shared/src/types.ts`; the guard check must still run before `execute()`.
- **Eleven model id**: live TTS uses `eleven_v4` (`ELEVENLABS_MODEL_ID` in `wrangler.jsonc`). Confirm Thai latency on the account. Flash v2.5 (`eleven_flash_v2_5`) is English only.
- Submission deadline (Fri 16 Oct 14:00 Bangkok) is unconfirmed.

## Limitations

- Sandbox only: mock catalogs, mock execution, fixed prices; USDT = $1, zero slippage.
- U-Bot is mocked. Integration goes through the `UBotAdapter` interface.
- Explanations are informational. This is not financial advice.

## Credits

Built at U-Hackathon 2026 @ FLOW Summit Bangkok. Voice by ElevenLabs (planned). Unlock data (optional) by Tokenomist.
