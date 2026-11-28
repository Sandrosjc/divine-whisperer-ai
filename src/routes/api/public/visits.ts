import { createFileRoute } from "@tanstack/react-router";
import { authUser, isForbidden, rpc } from "@/server/supabase-rest";

const VISITOR_COOKIE = "chq_vid";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 365;

type StatsRow = { total: number | string | null; unicos: number | string | null };

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers },
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
    if (!value) continue;
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return undefined;
}

/** O cookie guarda um id aleatório; o banco guarda apenas o hash (sem PII). */
async function hashVisitor(id: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function toCount(value: number | string | null | undefined): number {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const Route = createFileRoute("/api/public/visits")({
  server: {
    handlers: {
      /**
       * Registra uma visita pela RPC `track_visit` (security definer, liberada
       * para `anon`). Nunca devolve números: contagem é só para admin.
       */
      POST: async ({ request }: { request: Request }) => {
        try {
          const url = new URL(request.url);
          const existing = readCookie(request, VISITOR_COOKIE);
          const visitorId = existing ?? crypto.randomUUID();
          const visitorHash = await hashVisitor(visitorId);
          const path = url.searchParams.get("path")?.slice(0, 200) || "/";

          await rpc("track_visit", { _hash: visitorHash, _path: path });

          const secure = url.protocol === "https:" ? "; Secure" : "";
          const headers = existing
            ? {}
            : {
                "Set-Cookie": `${VISITOR_COOKIE}=${encodeURIComponent(visitorId)}; Path=/; Max-Age=${VISITOR_MAX_AGE}; HttpOnly; SameSite=Lax${secure}`,
              };
          return json(200, { ok: true }, headers);
        } catch (e) {
          // Função ainda não criada ou banco indisponível: a home continua funcionando.
          console.error("[visits] falha ao registrar visita:", e instanceof Error ? e.message : e);
          return json(200, { ok: false });
        }
      },

      /**
       * Total e visitantes únicos. Exige sessão válida e papel de admin — checado
       * dentro da RPC (`has_role(auth.uid(),'admin')`), que recebe o JWT do usuário.
       * `?admin=1` na URL nunca é autorização.
       */
      GET: async ({ request }: { request: Request }) => {
        try {
          const token = (request.headers.get("authorization") ?? "")
            .replace(/^Bearer\s+/i, "")
            .trim();
          if (!token) return json(401, { error: "unauthorized" });

          const user = await authUser(token);
          if (!user) return json(401, { error: "unauthorized" });

          const data = await rpc<StatsRow[] | StatsRow | null>("page_visits_stats", {}, token);
          const row = (Array.isArray(data) ? data[0] : data) ?? undefined;
          return json(200, {
            total: toCount(row?.total),
            unique: toCount(row?.unicos),
            admin: true,
          });
        } catch (e) {
          if (isForbidden(e)) return json(403, { error: "forbidden" });
          console.error("[visits] falha ao ler contagem:", e instanceof Error ? e.message : e);
          return json(200, { total: 0, unique: 0 });
        }
      },
    },
  },
});
