import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

// MODO ABERTO (teste): sem cadastro e sem e-mail. Sem sessão, entra como visitante anônimo.
// Para voltar ao login obrigatório, defina VITE_OPEN_MODE=false.
const OPEN_MODE = import.meta.env["VITE_OPEN_MODE"] !== "false";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    let user = data?.user ?? null;
    if (!user && OPEN_MODE) {
      const { data: anon, error: anonErr } = await supabase.auth.signInAnonymously();
      if (!anonErr && anon?.user) {
        user = anon.user;
        // Pula o onboarding para entrar direto.
        await supabase.from("profiles").update({ onboarded: true, full_name: "Visitante" }).eq("id", user.id);
      }
    }
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
