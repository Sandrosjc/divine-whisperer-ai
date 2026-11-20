/**
 * Unlimited, interleaved multi-provider key pool.
 * Each env var holds any number of keys (comma or newline separated).
 * Order: Gemini#1 → Mistral#1 → Grok#1 → OpenRouter#1 → Gemini#2 ...
 * Any failure (429, 5xx, timeout) silently moves to the next slot.
 */
type Provider = { id: string; env: string[]; url: string; model: string; headers?: Record<string, string> };

const PROVIDERS: Provider[] = [
  { id: "gemini", env: ["GEMINI_API_KEYS", "GEMINI_API_KEY"], url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.0-flash" },
  { id: "mistral", env: ["MISTRAL_API_KEYS", "MISTRAL_API_KEY"], url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
  { id: "grok", env: ["GROK_API_KEYS", "GROK_API_KEY", "XAI_API_KEYS"], url: "https://api.x.ai/v1/chat/completions", model: "grok-3-mini" },
  { id: "groq", env: ["GROQ_API_KEYS", "GROQ_API_KEY"], url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
  { id: "openrouter", env: ["OPENROUTER_KEYS", "OPENROUTER_API_KEYS", "OPENROUTER_API_KEY"], url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free", headers: { "HTTP-Referer": "https://chequetto.online", "X-Title": "Chequetto" } },
];

export function parseKeys(raw: string | undefined): string[] {
  return (raw ?? "").split(/[\s,;]+/).map((k) => k.trim()).filter(Boolean);
}

export type Slot = { provider: Provider; key: string };

/** Interleaves providers by key index; shorter lists simply run out. */
export function interleave(pools: { provider: Provider; keys: string[] }[]): Slot[] {
  const max = Math.max(0, ...pools.map((p) => p.keys.length));
  const out: Slot[] = [];
  for (let i = 0; i < max; i++) for (const p of pools) { const k = p.keys[i]; if (k) out.push({ provider: p.provider, key: k }); }
  return out;
}

function loadSlots(): Slot[] {
  return interleave(PROVIDERS.map((provider) => ({
    provider,
    keys: [...new Set(provider.env.flatMap((e) => parseKeys(process.env[e])))],
  })));
}

let cursor = 0;
const cooldown = new Map<string, number>();

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export function poolSize() { return loadSlots().length; }

export async function poolComplete(messages: ChatMsg[]): Promise<{ text: string; provider: string } | null> {
  const slots = loadSlots();
  if (!slots.length) return null;
  const start = cursor++ % slots.length;
  const now = Date.now();
  for (let i = 0; i < slots.length; i++) {
    const s = slots[(start + i) % slots.length] as Slot;
    const id = `${s.provider.id}:${s.key.slice(-6)}`;
    if ((cooldown.get(id) ?? 0) > now) continue;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 20000);
      const res = await fetch(s.provider.url, {
        method: "POST",
        signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.key}`, ...s.provider.headers },
        body: JSON.stringify({ model: s.provider.model, messages, max_tokens: 500, temperature: 0.8 }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        cooldown.set(id, now + (res.status === 429 ? 60000 : 15000));
        console.error("pool slot failed", s.provider.id, res.status);
        continue;
      }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = j.choices?.[0]?.message?.content?.trim();
      if (text) return { text, provider: s.provider.id };
    } catch (e) {
      cooldown.set(id, now + 15000);
      console.error("pool slot error", s.provider.id, e);
    }
  }
  return null;
}
