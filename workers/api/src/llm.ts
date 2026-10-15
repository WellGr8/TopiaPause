import { allowedNumbers } from '@topiapause/guard-engine';
import { SCENES, newId, type AgentProposal, type GuardVerdict, type Lang, type SceneId } from '@topiapause/shared';
import { chargePaid, log, type AppEnv } from './http';
import { ExplainDraft, LlmTurn } from './schemas';

// LLM-powered mock U-Bot. Provider-agnostic: any OpenAI-compatible
// /chat/completions endpoint with JSON output (OpenAI, OpenRouter, Groq, Together,
// Workers AI's OpenAI endpoint, a local vLLM, ...).
//
// The LLM plays the *agent*, not the guard: it may propose anything, and the guard
// engine decides. World facts the agent cannot know better than the app (the user's
// portfolio, the merchant catalog) are restored from the sandbox catalog after parsing.

export interface LlmResult {
  reply: string;
  scene?: SceneId;
  proposal?: AgentProposal;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS = 12_000;
const EXPLAIN_TIMEOUT_MS = 8_000;

export function llmConfigured(env: AppEnv): boolean {
  return Boolean(env.LLM_API_KEY && env.LLM_MODEL);
}

function systemPrompt(lang: Lang): string {
  const catalog = Object.fromEntries(
    (Object.keys(SCENES) as SceneId[]).map((id) => [id, { userAsks: SCENES[id].userText.en, defaultProposal: SCENES[id].buildProposal({}) }]),
  );
  return [
    'You are "U-Bot (mock)", an eager shopping, booking and crypto agent in a sandbox. No real money moves.',
    'Turn the user message into ONE proposal you are about to execute, or none if the request is out of scope.',
    'You can only act on the sandbox catalog below (one entry per scene). Copy the matching defaultProposal and adjust only',
    'what the user explicitly asked for (for token_swap: amountIn.minor and approval.amount.minor, integer micro-USDT: 1 USDT = 1000000). Keep every other field as in the catalog.',
    'Like a real over-eager agent, keep the catalog defaults (annual plan, cheapest room, unlimited approval) even if they do not fit.',
    'The guard layer (TopiaPause) checks your proposal afterwards, so do not second-guess it.',
    `Reply language: ${lang === 'th' ? 'Thai' : 'English'}. "reply" is one or two short sentences that state what you are about to do, with the price.`,
    'When the reply language is Thai, speak as a man: use ผม for yourself and end each sentence with ครับ. Never use ฉัน, ค่ะ or คะ.',
    'Return ONLY a JSON object: {"reply": string, "scene": "subscription" | "stay" | "crypto" | null, "proposal": <AgentProposal> | null}.',
    `Catalog: ${JSON.stringify(catalog)}`,
  ].join('\n');
}

/** Restores catalog facts so the agent can't invent a portfolio or alternatives. */
function harden(scene: SceneId, p: AgentProposal): AgentProposal | undefined {
  const base = SCENES[scene].buildProposal({});
  if (p.kind !== base.kind) return undefined;
  const common = { proposalId: newId('prop'), agent: base.agent };
  if (p.kind === 'token_swap' && base.kind === 'token_swap') {
    return { ...p, ...common, portfolio: base.portfolio, fromAsset: base.fromAsset, toAsset: base.toAsset, feePpm: base.feePpm, gas: base.gas };
  }
  if (p.kind === 'subscription' && base.kind === 'subscription') return { ...p, ...common, catalogAlternatives: base.catalogAlternatives };
  if (p.kind === 'stay' && base.kind === 'stay') return { ...p, ...common, catalogAlternatives: base.catalogAlternatives };
  return undefined;
}

/** Returns null on any failure so the caller can fall back to the scripted mock. */
export async function llmChat(env: AppEnv, input: { message: string; lang: Lang; scene?: SceneId }): Promise<LlmResult | null> {
  if (!llmConfigured(env)) return null;
  if (!chargePaid(env)) {
    log({ message: 'paid daily cap', kind: 'llm' });
    return null;
  }
  const base = (env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const started = Date.now();
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt(input.lang) },
          { role: 'user', content: input.scene ? `[scene hint: ${input.scene}] ${input.message}` : input.message },
        ],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      log({ message: 'llm http error', status: res.status, ms: Date.now() - started });
      return null;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = LlmTurn.safeParse(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '')));
    if (!parsed.success) {
      log({ message: 'llm output rejected', ms: Date.now() - started, issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join('.')) });
      return null;
    }
    const { reply, scene, proposal } = parsed.data;
    log({ message: 'llm ok', scene, ms: Date.now() - started });
    if (!scene || !proposal) return { reply };
    const hardened = harden(scene, proposal as AgentProposal);
    return hardened ? { reply, scene, proposal: hardened } : null;
  } catch (e) {
    log({ message: 'llm failed', error: e instanceof Error ? e.name : String(e), ms: Date.now() - started });
    return null;
  }
}

/**
 * Optional paraphrase of the engine explanation. Returns undefined when no key is
 * set or the call fails; the caller runs the result through the number lock.
 */
export async function llmExplain(env: AppEnv, verdict: GuardVerdict): Promise<{ th: string; en: string } | undefined> {
  if (!llmConfigured(env)) return undefined;
  const numbers = [...new Set(allowedNumbers(verdict).map((n) => String(n)))].slice(0, 40);
  const base = (env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0,
        max_tokens: 400,
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: [
              'Paraphrase a guard decision in Thai (th) and English (en).',
              `The decision is ${verdict.decision}. Do not change it.`,
              verdict.decision === 'pause' ? 'Start the Thai line with เดี๋ยวก่อน and the English line with "Hold on".' : '',
              verdict.decision === 'block' ? 'Say the action is blocked (หยุดรายการนี้ / blocked).' : '',
              verdict.decision === 'allow' ? 'Say it matches what the user meant (ตรงกับที่คุณตั้งใจ / Good to go).' : '',
              'Do not call a paused or blocked action safe, and do not say good to go unless the decision is allow.',
              'Do not include hotel, plan, merchant, or asset names.',
              `Use only numbers from this list. Any other number is rejected: ${numbers.join(', ') || '(none)'}`,
              'Return only JSON {"th":"...","en":"..."}.',
            ]
              .filter(Boolean)
              .join('\n'),
          },
          { role: 'user', content: `Rules: ${verdict.findings.map((f) => f.ruleId).join(', ') || 'none'}` },
        ],
      }),
      signal: AbortSignal.timeout(EXPLAIN_TIMEOUT_MS),
    });
    if (!res.ok) {
      log({ message: 'llm explain http error', status: res.status });
      return undefined;
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const content = data.choices?.[0]?.message?.content ?? '';
    const parsed = ExplainDraft.safeParse(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '')));
    return parsed.success ? { th: parsed.data.th, en: parsed.data.en } : undefined;
  } catch (e) {
    log({ message: 'llm explain failed', error: e instanceof Error ? e.name : String(e) });
    return undefined;
  }
}
