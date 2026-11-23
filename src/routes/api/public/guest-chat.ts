import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  name: z.string().trim().max(40).optional().default(""),
  age: z.number().int().min(5).max(120).optional(),
  lang: z.enum(["en", "pt", "es"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).max(200).transform((a) => a.slice(-12)),
});

const LANG = { en: "English", pt: "Brazilian Portuguese", es: "Spanish" } as const;

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
        // Testing phase: no message limits.

        const { CHEQUETTO_IDENTITY } = await import("@/lib/chequetto-persona");
        const first = messages.filter((m) => m.role === "user").length <= 1;
        const system = `${CHEQUETTO_IDENTITY}\nSpeak in ${LANG[lang]} unless the user writes in another language. ${name ? `The person is ${name}${age ? `, ${age} years old` : ""}.` : "You do not know the person's name yet."} Be concise (max 120 words).${first ? " First moment: introduce yourself as Chequetto with a short, warm, funny welcome (max 60 words), react to what they wrote and gently ask their name if unknown." : ""}`;
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
          const text = await completeText({ kind: "lovable" }, sys, last);
          return json(200, { text, engine: "builtin" });
        } catch (e) {
          console.error("guest fallback failed", e);
          return json(503, { error: "unavailable", hint: "Nenhuma IA respondeu. Confira /api/public/health: cadastre GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY ou OPENROUTER_API_KEY no Environment e faça redeploy." });
        }
      },
    },
  },
});
