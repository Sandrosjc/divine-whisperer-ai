import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  name: z.string().trim().min(2).max(40),
  age: z.number().int().min(5).max(120),
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

        const system = `You are Chequetto — a wise, warm, elegant companion. Speak in ${LANG[lang]} unless the user writes in another language. The person is ${name}, ${age} years old; adapt vocabulary and references to that age with respect. Be concise (max 120 words), accurate, practical and kind. You are an AI, not a therapist; if someone mentions self-harm, gently urge them to contact local emergency services or a crisis line.${messages.length ? "" : " This is the very first moment: write a short, moving, cinematic welcome (max 60 words) using their name, then ask one gentle question about what brings them here."}`;
        const history = messages.length ? messages : [{ role: "user" as const, content: `Hi, I'm ${name}.` }];

        const { poolComplete } = await import("@/lib/provider-pool.server");
        const r = await poolComplete([{ role: "system", content: system }, ...history]);
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
