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
| "Swap 500 USDT into TOKEN-X, just once" | request **unlimited approval** and push TOKEN-X to 45% (your cap is 30%) | Pauses and offers the max allowed swap (**$200**) with a one-time exact approval that expires in 15 minutes |

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
| Guard engine (`packages/guard-engine`): all rules, precedence, `a_max`, counter-offer, re-check, number lock | **Real.** Pure TS with 31 Vitest tests. The web app and the Worker run the same code. |
| Numbers on screen (prices, %, `a_max`, money protected) | **Real engine output.** Nothing is hard-coded in the UI. |
| Worker API (`workers/api`) | **Real.** `POST /api/guard/check` runs the engine server-side with zod validation, CORS, per-IP rate limits and a 32 KB body cap. 24 Vitest handler tests. See [docs/API.md](docs/API.md). |
| U-Bot | **Mock agent.** `POST /api/agent/chat` asks an OpenAI-compatible LLM to play the over-eager agent (JSON output) when `LLM_API_KEY` + `LLM_MODEL` are set; prices and portfolio are always restored from the fixed scene catalogs. Without a key: scripted replies. Intent extraction is a deterministic keyword heuristic either way. |
| Explanations | Number-locked TH/EN templates. The LLM never writes a number the user sees. |
| Voice | `POST /api/voice/tts` streams ElevenLabs mp3 (edge-cached) when `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` are set; otherwise it returns 503 and the browser uses `speechSynthesis`. |
| Execution and receipts | **Mock** (`POST /api/agent/execute`, `mode: 'mock'`, sandbox ref). No wallet, no payment. |
| Web ↔ API | The web app feature-detects `/api/health`. With the Worker it calls the API (Rules → "Backend" shows which path is live); on plain Vite or offline it runs the same engine in the browser. |
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
demo/audio/            pre-generated voice clips + manifest.json (placeholder)
docs/                  architecture, Thai summary, research, diagrams
```

## Run locally

Requirements: Node ≥ 20 and pnpm 10 (`corepack enable`).

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
./scripts/demo-curl.sh                       # the 3 scenes through POST /api/guard/check
```

To keep Vite hot reload but use the Worker API: `TOPIAPAUSE_API=http://127.0.0.1:8787 pnpm dev`.

## Test and typecheck

```bash
pnpm test           # Vitest: guard-engine (T1–T13 from ARCHITECTURE §10), shared, Worker API handlers
pnpm typecheck      # tsc across all workspaces
pnpm --filter @topiapause/guard-engine test   # engine only
```

Key `a_max` cases (V = $2,000, H = $400, B = 500 USDT, cap 30%):

| Case | a_max |
|---|---|
| base (fee 0, gas 0) | $200.000000 |
| fee 0.3% | $200.420883 (≈ $200.42; floored to 6 decimals per §5.2, the spec's 200.420884 is the rounded value) |
| gas $2 | $199.40 |

## Deploy (one Cloudflare Worker: SPA + API)

`workers/api/wrangler.jsonc` deploys a single Worker named `topiapause` that serves `apps/web/dist` as static assets (SPA fallback) and runs the Worker only for `/api/*`. Rate limiting uses Workers Rate Limiting bindings, so no KV or D1 has to be created.

### Automatic (GitHub Actions, push to `main`)

1. **Cloudflare API token:** Cloudflare dashboard → My Profile → API Tokens → Create Token → template **"Edit Cloudflare Workers"** → your account → Create. Copy the token.
2. **Account ID:** Cloudflare dashboard → Workers & Pages → copy the Account ID from the right sidebar.
3. **GitHub secrets:** repo → Settings → Secrets and variables → Actions → New repository secret:
   - `CLOUDFLARE_API_TOKEN` (required)
   - `CLOUDFLARE_ACCOUNT_ID` (required)
   - `LLM_API_KEY` (optional, enables the LLM agent)
   - `ELEVENLABS_API_KEY` (optional, enables ElevenLabs voice)
4. **Non-secret config:** set `LLM_MODEL` (e.g. `gpt-4o-mini`), `LLM_BASE_URL` (only if not OpenAI) and `ELEVENLABS_VOICE_ID` in the `vars` block of `workers/api/wrangler.jsonc`. `ELEVENLABS_MODEL_ID` defaults to `eleven_v3`.
5. Push or merge to `main`. `.github/workflows/deploy.yml` runs typecheck + tests, then `pnpm run deploy`, then syncs the optional secrets with `wrangler secret put`. If the two Cloudflare secrets are missing, the job logs a notice and skips; it doesn't fail.
6. **Optional smoke test:** add the repository *variable* `TOPIAPAUSE_URL` (e.g. `https://topiapause.<subdomain>.workers.dev`). After each deploy the workflow curls `/api/health` and runs `scripts/demo-curl.sh` against it.

You can also run it by hand from Actions → Deploy → Run workflow.

### Manual (from your machine)

```bash
pnpm install
npx wrangler login                 # or export CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID
pnpm run deploy                    # = pnpm build && wrangler deploy (in workers/api)
cd workers/api
npx wrangler secret put LLM_API_KEY          # optional
npx wrangler secret put ELEVENLABS_API_KEY   # optional
cd ../.. && ./scripts/demo-curl.sh https://topiapause.<subdomain>.workers.dev
```

Use `pnpm run deploy`, not `pnpm deploy`: `pnpm deploy` is a built-in pnpm command with a different meaning.

### Keys

- Secrets live only in Worker secrets (production) or `workers/api/.dev.vars` (local, gitignored; start from `.dev.vars.example`). They are never bundled into the web app, never put in `VITE_*`, and never returned by any endpoint. `/api/health` only reports `llm: "llm" | "scripted"` and `tts: "elevenlabs" | "unavailable"`.
- Without any key, every route still works: scripted U-Bot, browser speech, real guard engine.
- If the web app is served from another origin, set `ALLOWED_ORIGIN` for chat, TTS and execute. `guard/check` and `health` are open to any origin.
- After editing bindings, run `pnpm --filter @topiapause/api types`.

## Open questions (need a mentor or account check)

- **Real U-Bot API**: does U-topia expose one (API, webhook, sandbox)? If yes, add a `RealUBotAdapter` that implements `UBotAdapter` in `packages/shared/src/types.ts`; the guard check must still run before `execute()`.
- **Eleven v3 model id**: Thai needs Eleven v3. `ELEVENLABS_MODEL_ID` defaults to `eleven_v3`, which still has to be verified (along with latency) on our account. Flash v2.5 (`eleven_flash_v2_5`) is English only.
- Submission deadline (Fri 16 Oct 14:00 Bangkok) is unconfirmed.

## Limitations

- Sandbox only: mock catalogs, mock execution, fixed prices; USDT = $1, zero slippage.
- U-Bot is mocked. Integration goes through the `UBotAdapter` interface.
- Explanations are informational. This is not financial advice.

## Credits

Built at U-Hackathon 2026 @ FLOW Summit Bangkok. Voice by ElevenLabs (planned). Unlock data (optional) by Tokenomist.
