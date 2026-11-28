import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { authUser, insertRow, rpc, selectRows, upsertRow } from "@/server/supabase-rest";

const Body = z.object({ message: z.string().min(1).max(8000), language: z.string().max(20) });

type Profile = Database["public"]["Tables"]["profiles"]["Row"];

/** Plano gratuito: 10 mensagens por dia, renovadas à meia-noite UTC. */
const DAY_LIMIT = 10;

function json(status: number, error: string) {
  return new Response(JSON.stringify({ error }), { status, headers: { "Content-Type": "application/json" } });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = request.headers.get("authorization")?.replace("Bearer ", "");
        if (!token) return json(401, "Unauthorized");
        const u = await authUser(token);
        if (!u) return json(401, "Unauthorized");
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return json(400, "Invalid message");

        const ai = await import("@/lib/ai.server");
        const userId = u.id;

        const readProfile = async () => {
          const rows = await selectRows<Profile[]>(`profiles?id=eq.${userId}&select=*`, token);
          return rows?.[0] ?? null;
        };
        let profile = await readProfile();
        if (!profile) {
          // Modo aberto: cria o perfil na hora se o gatilho do banco não rodou.
          await upsertRow("profiles", { id: userId, email: u.email ?? null, onboarded: true }, token);
          profile = await readProfile();
        }
        if (!profile) return json(404, "Profile missing");

        // Cota diária atômica no banco: a RPC conta o dia (UTC), grava a mensagem
        // do usuário e devolve o plano. Sem service role e imune a apagar histórico.
        const quota = await rpc<Array<{ allowed: boolean; used: number; plan: string }>>(
          "consume_chat_message",
          { _content: parsed.data.message, _limit: DAY_LIMIT },
          token,
        );
        const result = quota?.[0];
        if (result?.plan === "suspended") return json(403, "Your account is suspended.");
        if (!result?.allowed) return json(402, "DAILY_LIMIT");
        const freePlan = result.plan !== "lifetime";
        const remaining = freePlan ? Math.max(0, DAY_LIMIT - result.used) : -1;

        let engine: Awaited<ReturnType<typeof ai.resolveEngine>>;
        try {
          engine = await ai.resolveEngine(userId, profile.plan);
        } catch (e) {
          if (e instanceof ai.EngineError) return json(e.status, e.message);
          // Rotação de chaves/BYOK dependem da service role; sem ela seguimos no pool.
          console.error("resolveEngine indisponível, usando IA padrão:", e);
          engine = { kind: "lovable" };
        }

        // A mensagem do usuário já foi gravada pela RPC da cota.
        const recent = await selectRows<Array<{ role: string; content: string }> | null>(
          `chat_messages?user_id=eq.${userId}&summarized=eq.false&select=role,content&order=created_at.desc&limit=16`,
          token,
        );
        const messages = (recent ?? []).reverse().map((m) => ({
          role: m.role === "assistant" ? ("assistant" as const) : ("user" as const),
          content: m.content,
        }));
        while (messages[0]?.role === "assistant") messages.shift(); // a janela de 16 pode começar por "assistant"; muitos provedores recusam

        try {
          const [{ publicContext }, { firecrawlContext }] = await Promise.all([
            import("@/lib/public-knowledge.server"),
            import("@/lib/firecrawl.server"),
          ]);
          const lg = parsed.data.language.slice(0, 2);
          const [ref, webRef] = await Promise.all([
            publicContext(parsed.data.message, lg === "pt" || lg === "es" ? lg : "en"),
            firecrawlContext(parsed.data.message),
          ]);
          const base = ai.persona(profile, parsed.data.language);
          const context = [ref, webRef].filter(Boolean).join("\n\n");
          const instructions = context
            ? `${base}\n\nPublic facts and web search results (use only if relevant; cite source URLs briefly):\n${context}`
            : base;
          const answer = await ai.streamAnswer(engine, instructions, messages, async (text) => {
            try {
              await insertRow("chat_messages", { user_id: userId, role: "assistant", content: text }, token);
            } catch (error) {
              console.error("save assistant failed", error);
            }
            await ai.compressMemory(engine, userId).catch((e) => console.error("compress failed", e));
          });
          if (remaining < 0) return answer;
          // Avisa a cota restante do dia sem alterar o corpo da resposta.
          const headers = new Headers(answer.headers);
          headers.set("X-Chequetto-Remaining", String(remaining));
          headers.set("X-Chequetto-Daily-Limit", String(DAY_LIMIT));
          return new Response(answer.body, { status: answer.status, headers });
        } catch (e) {
          if (e instanceof ai.EngineError) return json(e.status, e.message);
          console.error(e);
          return json(500, "Chequetto could not answer right now.");
        }
      },
    },
  },
});
