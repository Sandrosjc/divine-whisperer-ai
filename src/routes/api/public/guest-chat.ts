import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  name: z.string().trim().max(40).optional().default(""),
  age: z.number().int().min(5).max(120).optional(),
  lang: z.enum(["en", "pt", "es"]),
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().min(1).max(2000) })).max(12),
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
        if (messages.filter((m) => m.role === "user").length > 5) return json(402, { error: "LIMIT" });

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
