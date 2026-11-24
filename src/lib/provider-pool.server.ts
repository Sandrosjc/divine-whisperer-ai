/**
 * Unlimited, interleaved multi-provider key pool.
 * Keys come from any env var matching a provider pattern: plural lists
 * (comma/newline separated) and numbered vars (GEMINI_API_1, MISTRAL_API_KEY_31...).
 * Order: Gemini#1 → Mistral#1 → Groq#1 → Grok#1 → OpenRouter#1 → Gemini#2 ...
 * 429 → cooldown honoring Retry-After; other failures → short cooldown; next slot immediately.
 */
type Provider = { id: string; match: RegExp; url: string; model: string; alt?: string[]; headers?: Record<string, string> };

const PROVIDERS: Provider[] = [
  { id: "gemini", match: /^(GEMINI|GOOGLE_AI|GOOGLE_GENERATIVE_AI|GOOGLE)(_API)?(_KEYS?)?(_\d+)?$/, url: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", model: "gemini-2.5-flash", alt: ["gemini-3.5-flash", "gemini-2.5-flash-lite"] },
  { id: "mistral", match: /^MISTRAL(_API)?(_KEYS?)?(_\d+)?$/, url: "https://api.mistral.ai/v1/chat/completions", model: "mistral-small-latest", alt: ["open-mistral-nemo"] },
  { id: "groq", match: /^GROQ(_API)?(_KEYS?)?(_\d+)?$/, url: "https://api.groq.com/openai/v1/chat/completions", model: "openai/gpt-oss-120b", alt: ["openai/gpt-oss-20b", "qwen/qwen3.6-27b", "llama-3.3-70b-versatile"] },
  { id: "grok", match: /^(GROK|XAI)(_API)?(_KEYS?)?(_\d+)?$/, url: "https://api.x.ai/v1/chat/completions", model: "grok-3-mini" },
  { id: "openrouter", match: /^OPENROUTER(_API)?(_KEYS?)?(_\d*)?$/, url: "https://openrouter.ai/api/v1/chat/completions", model: "meta-llama/llama-3.3-70b-instruct:free", alt: ["openai/gpt-oss-20b:free", "google/gemma-3-27b-it:free"], headers: { "HTTP-Referer": "https://chequetto.online", "X-Title": "Chequetto" } },
];

/** Limpa erros comuns ao colar a chave no painel: aspas, "Bearer " e "NOME_DA_VARIAVEL=" no começo. */
export function cleanKey(raw: string): string {
  const q = /^["'`“”‘’]+|["'`“”‘’]+$/g;
  let s = raw.trim().replace(q, "");
  s = s.replace(/^bearer\s+/i, "");
  const eq = s.indexOf("=");
  // só remove o prefixo se parecer nome de variável (MAIÚSCULAS_COM_SUBLINHADO) e sobrar uma chave de verdade
  if (eq > 3 && /^[A-Z][A-Z0-9_]{3,}$/.test(s.slice(0, eq)) && s.length - eq - 1 > 10) s = s.slice(eq + 1);
  return s.replace(q, "").trim();
}

export function parseKeys(raw: string | undefined): string[] {
  return (raw ?? "").split(/[\s,;]+/).map(cleanKey).filter((k) => k.length > 10);
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
  return PROVIDERS.map((p) => ({ provider: p.id, keys: keysFor(p, process.env).length, model: currentModel(p), ultimo_erro: lastErrors.get(p.id) ?? null }));
}

/** Teste ao vivo: uma chamada minúscula por provedor com chave. Mostra só status e motivo, nunca a chave. */
export async function testProviders() {
  const out: { provider: string; model: string; ok: boolean; status: number | string; detail: string; modelos_testados?: string[] }[] = [];
  for (const p of PROVIDERS) {
    const key = keysFor(p, process.env)[0];
    if (!key) continue;
    const override = process.env[`CHEQUETTO_${p.id.toUpperCase()}_MODEL`];
    const candidates = override ? [override] : modelsOf(p);
    const tried: string[] = [];
    let last = { provider: p.id, model: candidates[0] ?? p.model, ok: false, status: "?" as number | string, detail: "" };
    for (const model of candidates) {
      tried.push(model);
      try {
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 12000);
        const res = await fetch(p.url, {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}`, ...p.headers },
          body: JSON.stringify({ model, messages: [{ role: "user", content: "Diga apenas: ok" }], max_tokens: 8 }),
        });
        clearTimeout(timer);
        const raw = res.ok ? "" : await res.text().catch(() => "");
        const detail = res.ok ? "funcionando" : raw.replace(/[A-Za-z0-9_\-.]{20,}/g, "…").replace(/\s+/g, " ").slice(0, 160);
        last = { provider: p.id, model, ok: res.ok, status: res.status, detail };
        if (res.ok) { modelIdx.set(p.id, candidates.indexOf(model)); break; }
        if (!modelGone(res.status, raw)) break;
      } catch (e) {
        last = { provider: p.id, model, ok: false, status: "rede", detail: e instanceof Error ? e.message.slice(0, 120) : "erro" };
        break;
      }
    }
    out.push({ ...last, modelos_testados: tried });
  }
  return out;
}

/** Token economy: keep system + last turns; older turns become one short digest. */
export function compress(messages: ChatMsg[], keep = 6, maxChars = 1200): ChatMsg[] {
  const sys = messages.filter((m) => m.role === "system");
  const rest = messages.filter((m) => m.role !== "system");
  const recent = rest.slice(-keep).map((m) => ({ ...m, content: m.content.replace(/\s+/g, " ").slice(0, maxChars) }));
  // Vários provedores recusam (400) quando a conversa começa por "assistant": começa sempre por "user".
  while (recent.length && recent[0]?.role !== "user") recent.shift();
  const old = rest.slice(0, -keep);
  if (!old.length) return [...sys, ...recent];
  const digest = old.map((m) => `${m.role === "user" ? "U" : "A"}: ${m.content.replace(/\s+/g, " ").slice(0, 80)}`).join(" | ").slice(0, 600);
  const note = `Earlier conversation (summary): ${digest}`;
  // Uma única mensagem de sistema (alguns provedores recusam duas).
  if (sys.length) return [{ role: "system" as const, content: `${sys.map((s) => s.content).join("\n")}\n${note}` }, ...recent];
  return [{ role: "system" as const, content: note }, ...recent];
}

const modelIdx = new Map<string, number>();
const modelsOf = (p: Provider) => [p.model, ...(p.alt ?? [])];
const currentModel = (p: Provider) => process.env[`CHEQUETTO_${p.id.toUpperCase()}_MODEL`] || modelsOf(p)[Math.min(modelIdx.get(p.id) ?? 0, modelsOf(p).length - 1)] || p.model;
/** O provedor desligou o modelo (404, ou 400 falando de "model")? */
const modelGone = (status: number, text: string) => status === 404 || (status === 400 && /model/i.test(text));

const lastErrors = new Map<string, { status: number | string; detail: string; at: string }>();
function remember(provider: string, status: number | string, detail: string) {
  // Tira qualquer coisa parecida com chave antes de guardar.
  lastErrors.set(provider, { status, detail: detail.replace(/[A-Za-z0-9_\-.]{20,}/g, "…").replace(/\s+/g, " ").slice(0, 160), at: new Date().toISOString() });
}

/** maxChars: limite por mensagem do histórico; use um valor alto em chamadas únicas (resumo de memória, tradução) para não cortar o pedido. */
export async function poolComplete(messages: ChatMsg[], maxTokens = 400, maxChars = 1200): Promise<{ text: string; provider: string } | null> {
  const slots = loadSlots();
  if (!slots.length) return null;
  const body = compress(messages, 6, maxChars);
  const start = cursor++ % slots.length;
  for (let i = 0; i < Math.min(slots.length, 12); i++) {
    const s = slots[(start + i) % slots.length] as Slot;
    const id = `${s.provider.id}:${s.key.slice(-6)}`;
    const now = Date.now();
    if ((cooldown.get(id) ?? 0) > now) continue;
    try {
      let res: Response | null = null;
      let errText = "";
      // Se o provedor disser que o modelo não existe mais, passa sozinho para o próximo modelo da lista (e lembra).
      for (let attempt = 0; attempt < modelsOf(s.provider).length; attempt++) {
        const override = process.env[`CHEQUETTO_${s.provider.id.toUpperCase()}_MODEL`];
        const idx = modelIdx.get(s.provider.id) ?? 0;
        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 15000);
        res = await fetch(s.provider.url, {
          method: "POST", signal: ctrl.signal,
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${s.key}`, ...s.provider.headers },
          body: JSON.stringify({ model: currentModel(s.provider), messages: body, max_tokens: maxTokens, temperature: 0.7 }),
        });
        clearTimeout(timer);
        if (res.ok) break;
        errText = await res.text().catch(() => "");
        if (!override && modelGone(res.status, errText) && idx + 1 < modelsOf(s.provider).length) {
          modelIdx.set(s.provider.id, idx + 1);
          console.error("pool model gone, switching", s.provider.id, modelsOf(s.provider)[idx], "->", modelsOf(s.provider)[idx + 1]);
          continue;
        }
        break;
      }
      if (!res) continue;
      if (!res.ok) {
        const n = (strikes.get(id) ?? 0) + 1; strikes.set(id, n);
        const retry = Number(res.headers.get("retry-after")) * 1000;
        const wait = res.status === 429 ? (retry > 0 ? retry : Math.min(60000 * 2 ** (n - 1), 600000)) : res.status === 401 || res.status === 403 ? 3600000 : res.status === 400 || res.status === 404 ? 300000 : 15000;
        cooldown.set(id, now + wait + Math.random() * 2000);
        remember(s.provider.id, res.status, errText);
        console.error("pool slot failed", s.provider.id, res.status);
        continue;
      }
      const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const text = j.choices?.[0]?.message?.content?.trim();
      if (text) { strikes.delete(id); lastErrors.delete(s.provider.id); return { text, provider: s.provider.id }; }
    } catch (e) {
      cooldown.set(id, now + 15000);
      remember(s.provider.id, "rede", e instanceof Error ? e.message : "error");
      console.error("pool slot error", s.provider.id, e instanceof Error ? e.message : "error");
    }
  }
  return null;
}
