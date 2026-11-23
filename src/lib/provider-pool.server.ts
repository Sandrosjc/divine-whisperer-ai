/**
 * Unlimited, interleaved multi-provider key pool.
 * Keys come from any env var matching a provider pattern: plural lists
 * (comma/newline separated) and numbered vars (GEMINI_API_1, MISTRAL_API_KEY_31...).
 * Order: Gemini#1 → Mistral#1 → Groq#1 → Grok#1 → OpenRouter#1 → Gemini#2 ...
 * 429 → cooldown honoring Retry-After; other failures → short cooldown; next slot immediately.
 */
type Provider = { id: string; match: RegExp; url: string; model: string; headers?: Record<string, string> };

const PROVIDERS: Provider[] = [
  { id: "gemini", match: /^GEMINI_API(_KEYS?)?(_\d+)?$/, url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.0-flash" },
  { id: "mistral", match: /^MISTRAL_API(_KEYS?)?(_\d+)?$/, url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest" },
  { id: "groq", match: /^GROQ_API(_KEYS?)?(_\d+)?$/, url: "https://api.groq.com/openai/v1/chat/completions", model: "llama-3.3-70b-versatile" },
  { id: "grok", match: /^(GROK|XAI)_API(_KEYS?)?(_\d+)?$/, url: "https://api.x.ai/v1/chat/completions", model: "grok-3-mini" },
  { id: "openrouter", match: /^OPENROUTER(_API)?(_KEYS?)?(_\d*)?$/, url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free", headers: { "HTTP-Referer": "https://chequetto.online", "X-Title": "Chequetto" } },
];

export function parseKeys(raw: string | undefined): string[] {
  return (raw ?? "").split(/[\s,;]+/).map((k) => k.trim()).filter((k) => k.length > 10);
}

function num(name: string) { const m = name.match(/(\d+)$/); return m ? Number(m[1]) : 0; }

export function keysFor(p: Provider, env: Record<string, string | undefined>): string[] {
  const names = Object.keys(env).filter((n) => p.match.test(n)).sort((a, b) => num(a) - num(b));
  return [...new Set(names.flatMap((n) => parseKeys(env[n])))];
}

export type Slot = { provider: Provider; key: string };

export function interleave(pools: { provider: Provider; keys: string[] }[]): Slot[] {
  const max = Math.max(0, ...pools.map((p) => p.keys.length));
  const out: Slot[] = [];
  for (let i = 0; i < max; i++) for (const p of pools) { const k = p.keys[i]; if (k) out.push({ provider: p.provider, key: k }); }
  return out;
}

function loadSlots(): Slot[] {
  return interleave(PROVIDERS.map((provider) => ({ provider, keys: keysFor(provider, process.env) })));
}

let cursor = 0;
const cooldown = new Map<string, number>();
const strikes = new Map<string, number>();

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

export function poolSize() { return loadSlots().length; }

/** Diagnóstico seguro: só contagens e nomes, nunca o valor das chaves. */
export function providerReport() {
  return PROVIDERS.map((p) => ({ provider: p.id, keys: keysFor(p, process.env).length, model: process.env[`${p.id.toUpperCase()}_MODEL`] || p.model }));
}

/** Token economy: keep system + last turns; older turns become one short digest. */
export function compress(messages: ChatMsg[], keep = 6, maxChars = 1200): ChatMsg[] {
  const sys = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const recent = rest.slice(-keep).map((m) => ({ ...m, content: m.content.replace(/\s+/g, " ").slice(0, maxChars) }));
  const old = rest.slice(0, -keep);
  if (!old.length) return [...sys, ...recent];
  const digest = old.map((m) => `${m.role === "user" ? "U" : "A"}: ${m.content.replace(/\s+/g, " ").slice(0, 80)}`).join(" | ").slice(0, 600);
  return [...sys, { role: "system", content: `Earlier conversation (summary): ${digest}` }, ...recent];
}

export async function poolComplete(messages: ChatMsg[], maxTokens = 400): Promise<{ text: string; provider: string } | null> {
  const slots = loadSlots();
  if (!slots.length) return null;
  const body = compress(messages);
  const start = cursor++ % slots.length;
  for (let i = 0; i < Math.min(slots.length, 12); i++) {
    const s = slots[(start + i) % slots.length] as Slot;
    const id = `${s.provider.id}:${s.key.slice(-6)}`;
    const now = Date.now();
    if ((cooldown.get(id) ?? 0) > now) continue;
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 15000);
      const res = await fetch(s.provider.url, {
        method: "POST", signal: ctrl.signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.key}`, ...s.provider.headers },
        body: JSON.stringify({ model: process.env[`${s.provider.id.toUpperCase()}_MODEL`] || s.provider.model, messages: body, max_tokens: maxTokens, temperature: 0.7 }),
      });
      clearTimeout(timer);
      if (!res.ok) {
        const n = (strikes.get(id) ?? 0) + 1; strikes.set(id, n);
        const retry = Number(res.headers.get("retry-after")) * 1000;
        const wait = res.status === 429 ? (retry > 0 ? retry : Math.min(60000 * 2 ** (n - 1), 600000)) : res.status === 401 || res.status === 403 ? 3600000 : 15000;
        cooldown.set(id, now + wait + Math.random() * 2000);
        console.error("pool slot failed", s.provider.id, res.status);
        continue;
      }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = j.choices?.[0]?.message?.content?.trim();
      if (text) { strikes.delete(id); return { text, provider: s.provider.id }; }
    } catch (e) {
      cooldown.set(id, now + 15000);
      console.error("pool slot error", s.provider.id, e instanceof Error ? e.message : "error");
    }
  }
  return null;
}
