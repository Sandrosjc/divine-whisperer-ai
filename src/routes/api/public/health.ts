import { createFileRoute } from "@tanstack/react-router";

// Diagnóstico seguro: mostra o que está configurado, nunca o valor das chaves.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async () => {
        const { providerReport } = await import("@/lib/provider-pool.server");
        const providers = providerReport();
        const env = process.env;
        const body = {
          ok: true,
          ia_gratis: providers.filter((p) => p.keys > 0).map((p) => `${p.provider}:${p.keys}`),
          providers,
          lovable_gateway: Boolean(env["LOVABLE_API_KEY"]),
          supabase: {
            url: Boolean(env["SUPABASE_URL"]),
            publishable: Boolean(env["SUPABASE_PUBLISHABLE_KEY"]),
            service_role: Boolean(env["SUPABASE_SERVICE_ROLE_KEY"]),
          },
          firecrawl: Boolean(env["FIRECRAWL_API_KEY"]),
          dica: providers.some((p) => p.keys > 0)
            ? "IA configurada."
            : "Nenhuma chave de IA encontrada: cadastre GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY ou OPENROUTER_API_KEY e faça redeploy.",
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      },
    },
  },
});
