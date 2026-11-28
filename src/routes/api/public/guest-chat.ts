import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { rpc } from "@/server/supabase-rest";

const GUEST_LIMIT = 5;

const Body = z.object({
  name: z.string().trim().max(40).optional().default(""),
  age: z.number().int().min(0).max(120).optional(),
  lang: z.enum(["en", "pt", "es"]),
  messages: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(6000) }))
    .max(200)
    .transform((a) => a.slice(-12)),
});

const LANG = { en: "English", pt: "Brazilian Portuguese", es: "Spanish" } as const;

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function readCookie(request: Request, name: string): string | undefined {
  const raw = request.headers.get("cookie");
  if (!raw) return undefined;
  for (const chunk of raw.split(";")) {
    const separator = chunk.indexOf("=");
    if (separator < 0) continue;
    if (chunk.slice(0, separator).trim() !== name) continue;
    const value = chunk.slice(separator + 1).trim();
    return value || undefined;
  }
  return undefined;
}

/** Hash do visitante: cookie anônimo quando existe, senão IP + user-agent. Sem PII. */
async function fingerprint(request: Request): Promise<string> {
  const visitor = readCookie(request, "chq_vid") ?? "";
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "";
  const agent = request.headers.get("user-agent") ?? "";
  const seed = visitor ? `vid:${visitor}` : `ip:${ip}|ua:${agent}`;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(seed));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

type Quota = { allowed: boolean; used: number };

/** Consome uma mensagem da cota diária; se o banco ainda não tem a função, não bloqueia. */
async function consumeQuota(fp: string): Promise<Quota> {
  try {
    // RPC `security definer` liberada para `anon`: não precisa de service role.
    const data = await rpc<number>("consume_guest_message", {
      _fp: fp,
      _limit: GUEST_LIMIT,
    });
    const used = Number(data ?? -1);
    if (!Number.isFinite(used) || used < 0) return { allowed: false, used: GUEST_LIMIT };
    return { allowed: true, used };
  } catch (e) {
    // Migration ainda não aplicada: a conversa continua em vez de quebrar.
    console.error("[guest-chat] cota indisponível:", e instanceof Error ? e.message : e);
    return { allowed: true, used: 0 };
  }
}

export const Route = createFileRoute("/api/public/guest-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json(400, { error: "invalid" });
        const { name, lang, messages } = parsed.data;
        const age = parsed.data.age && parsed.data.age >= 5 ? parsed.data.age : undefined; // 0 = idade não informada

        // Funil de degustação: exatamente 5 mensagens por visitante ao dia.
        const quota = await consumeQuota(await fingerprint(request));
        if (!quota.allowed) {
          return json(402, { error: "limit", limit: GUEST_LIMIT, used: GUEST_LIMIT });
        }
        const remaining = Math.max(0, GUEST_LIMIT - quota.used);

        const { CHEQUETTO_IDENTITY } = await import("@/lib/chequetto-persona");
        const first = messages.filter((m) => m.role === "user").length <= 1;
        const system = `${CHEQUETTO_IDENTITY}\nSpeak in ${LANG[lang]} unless the user writes in another language. ${name ? `The person is ${name}${age ? `, ${age} years old` : ""}.` : "You do not know the person's name yet."} Be concise (max 120 words).${first ? " First moment: introduce yourself as Chequetto with a short, warm, funny welcome (max 60 words), react to what they wrote and gently ask their name if unknown." : ""}`;
        const history = messages.length
          ? messages
          : [{ role: "user" as const, content: name ? `Hi, I'm ${name}.` : "Hi." }];

        const { poolComplete } = await import("@/lib/provider-pool.server");
        const { publicContext } = await import("@/lib/public-knowledge.server");
        const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
        const ref = await publicContext(lastUser, lang);
        const sys = ref
          ? `${system}\nUse this free public reference only if relevant: ${ref}`
          : system;
        const r = await poolComplete([{ role: "system", content: sys }, ...history]);
        const meta = {
          used: quota.used,
          limit: GUEST_LIMIT,
          remaining,
          limitReached: remaining === 0,
        };
        if (r) return json(200, { text: r.text, engine: r.provider, ...meta });

        // No pool keys here (e.g. Lovable preview) → built-in AI
        try {
          const { completeText } = await import("@/lib/ai.server");
          const last = history.map((m) => `${m.role}: ${m.content}`).join("\n");
          const text = await completeText({ kind: "lovable" }, sys, last);
          return json(200, { text, engine: "builtin", ...meta });
        } catch (e) {
          console.error("guest fallback failed", e);
          const { providerReport } = await import("@/lib/provider-pool.server");
          const falhas = providerReport()
            .filter((p) => p.keys > 0)
            .map(
              (p) =>
                `${p.provider}: ${p.ultimo_erro ? `erro ${p.ultimo_erro.status}` : "sem resposta"}`,
            )
            .join("; ");
          return json(503, {
            error: "unavailable",
            hint: falhas
              ? `Chaves encontradas, mas nenhuma IA respondeu (${falhas}). Abra /api/public/health?testar=1 para ver o motivo exato.`
              : "Nenhuma chave de IA encontrada. Cadastre GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY ou OPENROUTER_API_KEY no Environment e faça redeploy. Veja /api/public/health.",
          });
        }
      },
    },
  },
});
