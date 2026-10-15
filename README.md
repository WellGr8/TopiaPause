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
| U-Bot | **Mock.** Scripted replies and fixed scene catalogs (`packages/shared/src/scenes.ts`). Intent extraction is a keyword heuristic. |
| LLM (planner, intent extraction, explainer) | **Not wired.** TODO stubs in `workers/api`. Explanations come from number-locked TH/EN templates. |
| Voice | Plays a pre-generated clip from `demo/audio` if one exists (none committed yet), otherwise the browser's `speechSynthesis`. The ElevenLabs proxy `/api/voice/tts` is a TODO stub (returns 501). |
| Execution and receipts | **Mock** (`mode: 'mock'`, sandbox ref). No wallet, no payment. |
| Persistence | `localStorage` only (rules, activity, language, theme). |

## Stack

- React 19 + TypeScript + Vite + Tailwind v4 (`apps/web`), Inter + IBM Plex Sans Thai, lucide icons
  - Design tokens are the Tailwind v4 `@theme` config in `apps/web/src/index.css`: 1 brand colour + the wave gradient, 3 grays, 3 status colours, 2 radii, 1 shadow. Default palette, radii and shadows are cleared so nothing else can be used; dark mode swaps token values.
- Cloudflare Worker with static assets and `/api/*`, keys kept server-side (`workers/api`)
- Pure TS rules engine with Vitest (`packages/guard-engine`)
- Shared contracts, TH/EN templates and the mock catalogs (`packages/shared`)

```
apps/web/              chat UI, guard card, re-check, activity + receipts, onboarding (runs fully in-browser)
workers/api/           Cloudflare Worker: serves apps/web/dist + /api/* (thin stubs, real guard check)
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
```

## Test and typecheck

```bash
pnpm test           # Vitest: guard-engine (T1–T13 from ARCHITECTURE §10) + shared
pnpm typecheck      # tsc across all workspaces
pnpm --filter @topiapause/guard-engine test   # engine only
```

Key `a_max` cases (V = $2,000, H = $400, B = 500 USDT, cap 30%):

| Case | a_max |
|---|---|
| base (fee 0, gas 0) | $200.000000 |
| fee 0.3% | $200.420883 (≈ $200.42; floored to 6 decimals per §5.2, the spec's 200.420884 is the rounded value) |
| gas $2 | $199.40 |

## Deploy (Cloudflare Workers, Option A)

```bash
pnpm deploy                      # = pnpm build && wrangler deploy (from workers/api)
```

Optional secrets, set once per Worker. Without them, every route answers in scripted mock mode:

```bash
cd workers/api
npx wrangler secret put LLM_API_KEY
npx wrangler secret put ELEVENLABS_API_KEY
npx wrangler secret put TOKENOMIST_API_KEY   # optional
```

Non-secret vars (`LLM_MODEL`, `ELEVENLABS_VOICE_TH/EN`, `ELEVENLABS_MODEL_TH/EN`, `ALLOWED_ORIGIN`) live in `workers/api/wrangler.jsonc`. Never commit `.dev.vars` and never put secrets in `VITE_*`. After editing bindings, run `pnpm --filter @topiapause/api types`.

## Open questions (need a mentor or account check)

- **Real U-Bot API**: does U-topia expose one (API, webhook, sandbox)? If yes, add a `RealUBotAdapter` that implements `UBotAdapter` in `packages/shared/src/types.ts`; the guard check must still run before `execute()`.
- **Eleven v3 model id**: Thai needs Eleven v3. `ELEVENLABS_MODEL_TH` defaults to `eleven_v3`, which still has to be verified (along with latency) on our account. Flash v2.5 (`eleven_flash_v2_5`) is English only.
- Submission deadline (Fri 16 Oct 14:00 Bangkok) is unconfirmed.

## Limitations

- Sandbox only: mock catalogs, mock execution, fixed prices; USDT = $1, zero slippage.
- U-Bot is mocked. Integration goes through the `UBotAdapter` interface.
- Explanations are informational. This is not financial advice.

## Credits

Built at U-Hackathon 2026 @ FLOW Summit Bangkok. Voice by ElevenLabs (planned). Unlock data (optional) by Tokenomist.
