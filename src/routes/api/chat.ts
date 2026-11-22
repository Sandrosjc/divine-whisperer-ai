import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const Body = z.object({ message: z.string().min(1).max(8000), language: z.string().max(20) });

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return json(401, "Unauthorized");
        const anon = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        const { data: u } = await anon.auth.getUser(token);
        if (!u.user) return json(401, "Unauthorized");
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json(400, "Invalid message");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const ai = await import("@/lib/ai.server");
        const userId = u.user.id;
        const { data: profile } = await supabaseAdmin.from("profiles").select("*").eq("id", userId).single();
        if (!profile) return json(404, "Profile missing");

        let engine;
        try {
          engine = await ai.resolveEngine(userId, profile.plan);
        } catch (e) {
          if (e instanceof ai.EngineError) return json(e.status, e.message);
          throw e;
        }

        const { error: insErr } = await supabaseAdmin
          .from("chat_messages")
          .insert({ user_id: userId, role: "user", content: parsed.data.message });
        if (insErr) return json(500, "Could not save message");

        const { data: recent } = await supabaseAdmin
          .from("chat_messages")
          .select("role, content")
          .eq("user_id", userId)
          .eq("summarized", false)
          .order("created_at", { ascending: false })
          .limit(16);
        const messages = (recent ?? []).reverse().map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        }));

        try {
          const { publicContext } = await import("@/lib/public-knowledge.server");
          const lg = parsed.data.language.slice(0, 2);
          const ref = await publicContext(parsed.data.message, lg === "pt" || lg === "es" ? lg : "en");
          const base = ai.persona(profile, parsed.data.language);
          const instructions = ref ? `${base}\n\nFree public facts (use only if relevant, cite the source briefly):\n${ref}` : base;
          return await ai.streamAnswer(engine, instructions, messages, async (text) => {
            const { error } = await supabaseAdmin.from("chat_messages").insert({ user_id: userId, role: "assistant", content: text });
            if (error) console.error("save assistant failed", error);
            await ai.compressMemory(engine, userId).catch((e) => console.error("compress failed", e));
          });
        } catch (e) {
          if (e instanceof ai.EngineError) return json(e.status, e.message);
          console.error(e);
          return json(500, "Chequetto could not answer right now.");
        }
      },
    },
  },
});
