import { createFileRoute } from "@tanstack/react-router";

let lastTest = 0;

// Diagnóstico seguro: mostra o que está configurado, nunca o valor das chaves.
export const Route = createFileRoute("/api/public/health")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        const { providerReport, testProviders } = await import("@/lib/provider-pool.server");
        // ?testar=1 faz uma chamada minúscula a cada provedor (no máximo 1 vez por minuto) e mostra o motivo exato da falha.
        let teste: Awaited<ReturnType<typeof testProviders>> | { aviso: string } | undefined;
        if (new URL(request.url).searchParams.get("testar") === "1") {
          const agora = Date.now();
          if (agora - lastTest < 60000) teste = { aviso: "Teste feito há menos de 1 minuto; aguarde e tente de novo." };
          else { lastTest = agora; teste = await testProviders(); }
        }
        const providers = providerReport();
        const env = process.env;
        const body = {
          ok: true,
          ia_gratis: providers.filter((p) => p.keys > 0).map((p) => `${p.provider}:${p.keys}`),
          providers,
          ...(teste ? { teste } : {}),
          lovable_gateway: Boolean(env["LOVABLE_API_KEY"]),
          supabase: {
            url: Boolean(env["SUPABASE_URL"]),
            publishable: Boolean(env["SUPABASE_PUBLISHABLE_KEY"]),
            service_role: Boolean(env["SUPABASE_SERVICE_ROLE_KEY"]),
          },
          firecrawl: Boolean(env["FIRECRAWL_API_KEY"]),
          dica: providers.some((p) => p.keys > 0)
            ? providers.some((p) => p.ultimo_erro)
              ? "Chaves encontradas, mas algum provedor está dando erro. Abra /api/public/health?testar=1 para ver o motivo."
              : "Chaves encontradas. Abra /api/public/health?testar=1 para testar de verdade."
            : "Nenhuma chave de IA encontrada: cadastre GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY ou OPENROUTER_API_KEY e faça redeploy.",
        };
        return new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });
      },
    },
  },
});
