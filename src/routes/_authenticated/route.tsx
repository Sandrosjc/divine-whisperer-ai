import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

// MODO ABERTO (teste): sem cadastro e sem e-mail. Sem sessão, entra como visitante anônimo.
// Para voltar ao login obrigatório, defina VITE_OPEN_MODE=false.
const OPEN_MODE = import.meta.env["VITE_OPEN_MODE"] !== "false";

// A pré-carga de rotas e o modo estrito do React chamam beforeLoad várias vezes ao mesmo tempo:
// compartilhamos uma única entrada anônima para não criar vários visitantes.
let guestEntry: Promise<User | null> | null = null;

async function enterAsGuest(): Promise<User | null> {
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data?.user) return null;
  // Pula o onboarding. O nome fica vazio de propósito: a Chequetto pergunta como chamar a pessoa.
  await supabase.from("profiles").update({ onboarded: true }).eq("id", data.user.id);
  return data.user;
}

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    let user = data?.user ?? null;
    if (!user && OPEN_MODE) {
      guestEntry ??= enterAsGuest().finally(() => {
        guestEntry = null;
      });
      user = await guestEntry;
    }
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
