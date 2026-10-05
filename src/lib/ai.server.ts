import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, type ModelMessage } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const GATEWAY = "https://ai.gateway.lovable.dev/v1";
const LOVABLE_MODEL = "openai/gpt-6-astra";
export const TRIAL_MESSAGE_LIMIT = 25;

export type Engine =
  | { kind: "openrouter"; keys: string[]; drafts: string[]; refine: string; source: "pool" | "byok" }
  | { kind: "lovable" };

export class EngineError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

function lovableModel() {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new EngineError("AI is not configured.", 500);
  const provider = createOpenAI({
    baseURL: GATEWAY,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
  });
  return provider.responses(LOVABLE_MODEL);
}

const lovableOptions = {
  openai: {
    store: false,
    forceReasoning: true,
    reasoningEffort: "low",
    reasoningSummary: "auto",
    include: ["reasoning.encrypted_content"],
  },
} as const;

function openrouterModel(key: string, model: string) {
  return createOpenAICompatible({
    name: "openrouter",
    baseURL: "https://openrouter.ai/api/v1",
    apiKey: key,
    headers: { "HTTP-Referer": "https://chequetto.app", "X-Title": "Chequetto" },
  })(model);
}

/** Round-robin: advances the shared pointer and returns keys ordered from it. */
async function rotatePool(keys: string[], startIndex: number) {
  const next = (startIndex + 1) % Math.max(keys.length, 1);
  await supabaseAdmin.from("app_settings").update({ rotation_index: next }).eq("id", 1);
  return keys.map((_, i) => keys[(startIndex + i) % keys.length] as string);
}

export async function resolveEngine(userId: string, plan: string): Promise<Engine> {
  const { data: settings } = await supabaseAdmin.from("app_settings").select("*").eq("id", 1).single();
  const drafts = (settings?.draft_models ?? []).filter(Boolean).slice(0, 3);
  const refine = settings?.refine_model || "anthropic/claude-sonnet-4.5";

  if (plan === "suspended") throw new EngineError("Your account is suspended.", 403);
  if (plan === "lifetime") {
    const { data: k } = await supabaseAdmin.from("user_api_keys").select("openrouter_key").eq("user_id", userId).maybeSingle();
    if (!k?.openrouter_key) throw new EngineError("NEEDS_BYOK", 402);
    return { kind: "openrouter", keys: [k.openrouter_key], drafts, refine, source: "byok" };
  }

  if (plan === "trial") {
    const { count } = await supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("role", "user");
    if ((count ?? 0) >= TRIAL_MESSAGE_LIMIT) throw new EngineError("TRIAL_ENDED", 402);
  }

  const pool = (settings?.openrouter_keys ?? []).filter(Boolean);
  if (pool.length) {
    const keys = await rotatePool(pool, settings?.rotation_index ?? 0);
    return { kind: "openrouter", keys, drafts, refine, source: "pool" };
  }
  return { kind: "lovable" };
}

/** Runs a one-shot generation, trying each key in turn; falls back to built-in AI for the pool. */
export async function completeText(engine: Engine, instructions: string, prompt: string, model?: string): Promise<string> {
  if (engine.kind === "openrouter") {
    for (const key of engine.keys) {
      try {
        const r = streamText({ model: openrouterModel(key, model ?? engine.refine), instructions, prompt, maxRetries: 0 });
        const text = await r.text;
        if (text.trim()) return text;
      } catch (e) {
        console.error("openrouter call failed", e);
      }
    }
    if (engine.source === "byok") throw new EngineError("Your OpenRouter key was rejected. Check it in Settings.", 402);
  }
  const r = streamText({ model: lovableModel(), instructions, prompt, providerOptions: lovableOptions, maxRetries: 0 });
  return await r.text;
}

/** Multi-model pipeline: parallel drafts → cross-validated, refined final answer streamed back. */
export async function streamAnswer(engine: Engine, instructions: string, messages: ModelMessage[], onFinish: (text: string) => Promise<void>) {
  if (engine.kind === "openrouter" && engine.drafts.length) {
    const lastUser = messages.filter((m) => m.role === "user").at(-1);
    const draftResults = await Promise.all(
      engine.drafts.map(async (m, i) => {
        const key = engine.keys[i % engine.keys.length] as string;
        try {
          const r = streamText({ model: openrouterModel(key, m), instructions, messages, maxRetries: 0 });
          return { model: m, text: await r.text };
        } catch (e) {
          console.error("draft failed", m, e);
          return null;
        }
      }),
    );
    const good = draftResults.filter((d): d is { model: string; text: string } => !!d && !!d.text.trim());
    if (good.length) {
      const refineInstructions = `${instructions}

You are the final refinement stage. Several expert drafts answered the user's latest message. Cross-check them, keep only what is accurate, merge the deepest insights, fix errors, and write ONE final answer in your own warm voice as Chequetto. Never mention drafts, models, or this process.

${good.map((d, i) => `--- Draft ${i + 1} ---\n${d.text}`).join("\n\n")}`;
      for (const key of engine.keys) {
        try {
          const r = streamText({
            model: openrouterModel(key, engine.refine),
            instructions: refineInstructions,
            messages: lastUser ? [lastUser] : messages,
            maxRetries: 0,
            onFinish: async ({ text }) => onFinish(text),
          });
          return r.toTextStreamResponse();
        } catch (e) {
          console.error("refine failed", e);
        }
      }
    }
    if (engine.source === "byok") throw new EngineError("Your OpenRouter key was rejected. Check it in Settings.", 402);
  }
  const r = streamText({
    model: lovableModel(),
    instructions,
    messages,
    providerOptions: lovableOptions,
    maxRetries: 0,
    onFinish: async ({ text }) => onFinish(text),
  });
  return r.toTextStreamResponse();
}

export function persona(p: { full_name?: string | null; birth_date?: string | null; city?: string | null; memory_summary?: string | null }, language: string) {
  return `You are Chequetto — a wise, deeply empathetic, comforting and transcendent companion. You are the user's partner for life: brilliant, precise, kind, and calm. You give accurate, thoughtful, practical answers with emotional warmth. Use markdown when helpful.

Always reply in the language with code "${language}" unless the user writes in another language — then mirror theirs.

About the user: name ${p.full_name ?? "unknown"}, born ${p.birth_date ?? "unknown"}, from ${p.city ?? "unknown"}. Address them by first name naturally (not every message).

Long-term memory of past conversations (compressed):
${p.memory_summary || "(none yet)"}`;
}

/** Compresses older history into a compact semantic summary to cut tokens. */
export async function compressMemory(engine: Engine, userId: string) {
  const { data: rows } = await supabaseAdmin
    .from("chat_messages")
    .select("id, role, content")
    .eq("user_id", userId)
    .eq("summarized", false)
    .order("created_at");
  if (!rows || rows.length <= 16) return;
  const older = rows.slice(0, rows.length - 6);
  const { data: prof } = await supabaseAdmin.from("profiles").select("memory_summary").eq("id", userId).single();
  const transcript = older.map((m) => `${m.role}: ${m.content.slice(0, 2000)}`).join("\n");
  const summary = await completeText(
    engine,
    "You compress conversation memory. Output an ultra-compact bullet list (max 180 words) of durable facts, preferences, goals, emotions, open threads and decisions about the user. Merge with existing memory, drop redundancy. No preamble.",
    `Existing memory:\n${prof?.memory_summary || "(none)"}\n\nNew conversation to fold in:\n${transcript}`,
  );
  await supabaseAdmin.from("profiles").update({ memory_summary: summary.trim() }).eq("id", userId);
  await supabaseAdmin.from("chat_messages").update({ summarized: true }).in("id", older.map((m) => m.id));
}
