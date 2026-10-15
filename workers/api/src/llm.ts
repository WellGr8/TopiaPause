import { allowedNumbers } from '@topiapause/guard-engine';
import { SCENES, parseMoney, scriptedChat, type AgentProposal, type GuardVerdict, type Lang, type SceneId } from '@topiapause/shared';
import { chargePaid, log, type AppEnv } from './http';
import { ExplainDraft, IntentDraft } from './schemas';

// The model only classifies the message. Prices and proposals come from the sandbox catalog.
// The guard engine still decides. A failure here returns null so chat stays scripted.

export interface LlmResult {
  reply: string;
  scene?: SceneId;
  proposal?: AgentProposal;
  chip?: SceneId;
}

const DEFAULT_BASE_URL = 'https://openrouter.ai/api/v1';
const TIMEOUT_MS = 12_000;
const EXPLAIN_TIMEOUT_MS = 8_000;
/** Spendable USDT in the catalog. Above this the swap rule blocks instead of pausing. */
const SPENDABLE_USDT = 500_000_000;

export function llmConfigured(env: AppEnv): boolean {
  return Boolean(env.LLM_API_KEY && env.LLM_MODEL);
}

function chatSystemPrompt(): string {
  return [
    'You are "U-Bot (mock)", an eager shopping, booking and crypto agent in a sandbox. No real money moves.',
    'Classify the message. Do not output a price, a proposal, or any digit.',
    'kind is subscription, stay, crypto, question, smalltalk, or out_of_scope.',
    'slots may include trial_only, interval (month or year), budget_thb, area, flexible, amount_usdt, one_time. Amounts are decimal strings.',
    'reply_th and reply_en are at most two short sentences with no digits.',
    'When the reply language is Thai, speak as a man: use ผม for yourself and end each sentence with ครับ. Never use ฉัน, ค่ะ or คะ.',
    'question is for why or whether something is too expensive. crypto is a coin exchange. out_of_scope is anything else.',
    'Return ONLY JSON: {"kind":"...","slots":{},"reply_th":"...","reply_en":"..."}.',
  ].join('\n');
}

function usdtMinor(raw: string | undefined): number | undefined {
  if (!raw) return undefined;
  try {
    const minor = parseMoney(raw, 'USDT').minor;
    return minor > 0 ? minor : undefined;
  } catch {
    return undefined;
  }
}

function messageUsdt(message: string): number | undefined {
  const m = message.replace(/,/g, '').match(/(\d+(?:\.\d{1,6})?)/);
  return m ? usdtMinor(m[1]) : undefined;
}

/** A transfer or an all-in swap. Capped at the spendable balance so the guard pauses it. */
function risky(message: string): boolean {
  const transfer = /โอน|เพื่อน|transfer|send to/i.test(message) && !/แลก|swap/i.test(message);
  const allIn = /แลก|swap|usdt|eth|btc|บิตคอย|bitcoin/i.test(message) && /\ball\b|ทั้งหมด|ทั้งก้อน|หมด/i.test(message);
  return transfer || allIn;
}

function whyQuestion(message: string): boolean {
  return /ทำไม|why|แพง/i.test(message);
}

function whyReply(lang: Lang, summary?: string): string {
  const line = summary?.trim();
  if (line) return lang === 'th' && !line.endsWith('ครับ') ? `${line} ครับ` : line;
  return lang === 'th' ? 'ยังไม่มีรายการที่ตรวจไว้ครับ' : 'Nothing has been checked yet.';
}

function chipReply(lang: Lang): LlmResult {
  const chip = SCENES.crypto.chip[lang];
  const reply =
    lang === 'th'
      ? `เดโมนี้ตรวจได้แค่สมัครแอป จองโรงแรม และแลกเหรียญครั้งเดียว ใกล้สุดคือ ${chip} ครับ`
      : `This demo only checks an app plan, a hotel, or a one-time coin swap. Closest step: ${chip}.`;
  return { reply, chip: 'crypto' };
}

/** Catalog proposal and a reply whose numbers come from that catalog, not the model. */
function catalogTurn(kind: 'subscription' | 'stay' | 'crypto', message: string, lang: Lang, amount?: number): LlmResult {
  const scene = kind;
  const proposal = scene === 'crypto' ? SCENES.crypto.buildProposal({ amountMinor: amount }) : SCENES[scene].buildProposal({});
  const reply =
    scene === 'crypto' && amount !== undefined && amount !== SPENDABLE_USDT
      ? scriptedChat({ message, scene, lang }).reply
      : SCENES[scene].reply[lang];
  return { reply, scene, proposal };
}

function fromIntent(draft: { kind: string; slots: { amount_usdt?: string } }, message: string, lang: Lang, summary?: string): LlmResult {
  if (whyQuestion(message) || draft.kind === 'question') return { reply: whyReply(lang, summary) };
  if (risky(message) || draft.kind === 'crypto') {
    const asked = usdtMinor(draft.slots.amount_usdt) ?? messageUsdt(message);
    const amount = risky(message) || asked === undefined || asked > SPENDABLE_USDT ? SPENDABLE_USDT : asked;
    return catalogTurn('crypto', message, lang, amount);
  }
  if (draft.kind === 'subscription' || draft.kind === 'stay') return catalogTurn(draft.kind, message, lang);
  return chipReply(lang);
}

/** Returns null on any failure so the caller can fall back to the scripted mock. */
export async function llmChat(
  env: AppEnv,
  input: { message: string; lang: Lang; scene?: SceneId; history?: { role: 'user' | 'assistant'; text: string }[]; verdictSummary?: string },
): Promise<LlmResult | null> {
  if (!llmConfigured(env)) return null;
  if (!chargePaid(env)) {
    log({ message: 'paid daily cap', kind: 'llm' });
    return null;
  }
  const base = (env.LLM_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, '');
  const started = Date.now();
  const history = (input.history ?? []).slice(-4).map((turn) => ({ role: turn.role, content: turn.text }));
  try {
    const res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: env.LLM_MODEL,
        temperature: 0.2,
        max_tokens: 160,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: chatSystemPrompt() },
          ...(input.verdictSummary ? [{ role: 'system', content: `Last guard result: ${input.verdictSummary}` }] : []),
          ...history,
          { role: 'user', content: input.message },
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
    const parsed = IntentDraft.safeParse(JSON.parse(content.replace(/^```(?:json)?\s*|\s*```$/g, '')));
    if (!parsed.success) {
      log({ message: 'llm output rejected', ms: Date.now() - started, issues: parsed.error.issues.slice(0, 3).map((i) => i.path.join('.')) });
      return null;
    }
    log({ message: 'llm ok', kind: parsed.data.kind, ms: Date.now() - started });
    return fromIntent(parsed.data, input.message, input.lang, input.verdictSummary);
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
