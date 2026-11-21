import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  name: z.string().trim().max(40).optional().default(""),
  age: z.number().int().min(5).max(120).optional(),
  lang: z.enum(["en", "pt", "es"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).max(12),
});

const LANG = { en: "English", pt: "Brazilian Portuguese", es: "Spanish" } as const;

/** Server-side daily limit: 5 free messages per visitor, stored in the database. */
async function consume(request: Request): Promise<number> {
  const url = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"] || process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) return 0;
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const raw = new TextEncoder().encode(`chq:${ip}:${request.headers.get("user-agent") ?? ""}`);
  const fp = [...new Uint8Array(await crypto.subtle.digest("SHA-256", raw))].map((b) => b.toString(16).padStart(2, "0")).join("");
  try {
    const r = await fetch(`${url}/rest/v1/rpc/consume_guest_message`, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify({ _fp: fp, _limit: 5 }) });
    if (!r.ok) { console.error("guest limit check failed", r.status); return 0; }
    return Number(await r.json());
  } catch { return 0; }
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
}

export const Route = createFileRoute("/api/public/guest-chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json(400, { error: "invalid" });
        const { name, age, lang, messages } = parsed.data;
        if (messages.filter((m) => m.role === "user").length > 5) return json(402, { error: "LIMIT" });
        const used = await consume(request);
        if (used === -1) return json(402, { error: "LIMIT" });

        const system = `You are Chequetto — a wise, warm, elegant companion. Speak in ${LANG[lang]} unless the user writes in another language. ${name ? `The person is ${name}${age ? `, ${age} years old; adapt vocabulary to that age with respect` : ""}.` : "You do not know the person's name yet."} Be concise (max 120 words), accurate, practical and kind. You are an AI, not a therapist; if someone mentions self-harm, gently urge them to contact local emergency services or a crisis line.${messages.filter((m) => m.role === "user").length > 1 ? "" : " This is the very first moment: write a short, moving, cinematic welcome (max 60 words) introducing yourself as Chequetto, respond warmly to what they wrote, and gently ask their name if unknown."}`;
        const history = messages.length ? messages : [{ role: "user" as const, content: name ? `Hi, I'm ${name}.` : "Hi." }];

        const { poolComplete } = await import("@/lib/provider-pool.server");
        const { publicContext } = await import("@/lib/public-knowledge.server");
        const lastUser = [...history].reverse().find((m) => m.role === "user")?.content ?? "";
        const ref = await publicContext(lastUser, lang);
        const sys = ref ? `${system}\nUse this free public reference only if relevant: ${ref}` : system;
        const r = await poolComplete([{ role: "system", content: sys }, ...history]);
        if (r) return json(200, { text: r.text, engine: r.provider });

        // No pool keys here (e.g. Lovable preview) → built-in AI
        try {
          const { completeText } = await import("@/lib/ai.server");
          const last = history.map((m) => `${m.role}: ${m.content}`).join("\n");
          const text = await completeText({ kind: "lovable" }, system, last);
          return json(200, { text, engine: "builtin" });
        } catch (e) {
          console.error("guest fallback failed", e);
          return json(503, { error: "unavailable" });
        }
      },
    },
  },
});
