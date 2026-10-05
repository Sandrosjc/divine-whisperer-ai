import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Chequetto" },
      { name: "description", content: "Sign in or create your Chequetto account." },
      { property: "og:title", content: "Sign in — Chequetto" },
      { property: "og:description", content: "Sign in or create your Chequetto account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [mode, setMode] = useState<"in" | "up">("up");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => data.session && navigate({ to: "/chat" }));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => {
      if (s) navigate({ to: "/chat" });
    });
    return () => data.subscription.unsubscribe();
  }, [navigate]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const res =
      mode === "up"
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin + "/chat" } })
        : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (res.error) {
      toast.error(res.error.message);
      return;
    }
    if (mode === "up" && !res.data.session) toast.success(t("checkEmail"));
  }

  async function google() {
    const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/auth" });
    if (r.error) toast.error(String(r.error.message ?? r.error));
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 shadow-glow">
        <Link to="/" className="mb-6 flex flex-col items-center gap-2">
          <Logo size={48} />
          <span className="font-display text-3xl font-semibold">Chequetto</span>
        </Link>
        <Button variant="outline" className="w-full" onClick={google}>{t("google")}</Button>
        <div className="my-5 h-px bg-border" />
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="email">{t("email")}</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pw">{t("password")}</Label>
            <Input id="pw" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
          </div>
          <Button type="submit" className="w-full" disabled={busy}>{mode === "up" ? t("signUp") : t("signIn")}</Button>
        </form>
        <button className="mt-4 w-full text-center text-sm text-muted-foreground hover:text-gold" onClick={() => setMode(mode === "up" ? "in" : "up")}>
          {mode === "up" ? t("haveAccount") : t("noAccount")}
        </button>
      </div>
    </main>
  );
}
