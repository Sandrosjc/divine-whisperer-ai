import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";
import { LockKeyhole, ArrowLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { claimOwner } from "@/lib/admin.functions";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/admin-access")({
  head: () => ({ meta: [
    { title: "Administrator access — Chequetto" }, { name: "description", content: "Authorized administrator sign-in for Chequetto." },
    { property: "og:title", content: "Administrator access — Chequetto" }, { property: "og:description", content: "Authorized administrator sign-in." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" }, { name: "robots", content: "noindex, nofollow" },
  ] }), component: AdminAccess,
});
function AdminAccess() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const check = useServerFn(claimOwner);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function verify(signIn: boolean) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      if (signIn) {
        const values = z.object({ email: z.string().trim().email().max(255), password: z.string().min(6).max(128) }).parse({ email, password });
        const { error: signInError } = await supabase.auth.signInWithPassword(values);
        if (signInError) throw new Error(signInError.message);
      }
      const result = await check();
      if (!result.admin) { setError(t("adminDenied")); return; }
      navigate({ to: "/sanctum", replace: true });
    } catch { setError(t("adminDenied")); }
    finally { setBusy(false); setPassword(""); }
  }
  return <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12"><Logo size={46} /><div className="mt-8 flex items-center gap-2 text-gold"><LockKeyhole size={18} /><span className="text-xs">Chequetto · A</span></div><h1 className="mt-4 text-4xl">{t("adminAccess")}</h1><p className="mt-4 text-sm leading-6 text-muted-foreground">{t("adminSignIn")}</p><form onSubmit={e => { e.preventDefault(); verify(true); }} className="mt-8 space-y-5"><div className="space-y-2"><Label htmlFor="admin-email">{t("email")}</Label><Input id="admin-email" type="email" autoComplete="username" maxLength={255} required value={email} onChange={e => setEmail(e.target.value)} /></div><div className="space-y-2"><Label htmlFor="admin-password">{t("password")}</Label><Input id="admin-password" type="password" autoComplete="current-password" minLength={6} maxLength={128} required value={password} onChange={e => setPassword(e.target.value)} /></div>{error && <p role="alert" className="text-sm text-destructive">{error}</p>}<Button className="w-full" disabled={busy}>{t("signIn")}</Button></form><Button variant="outline" className="mt-3" disabled={busy} onClick={() => verify(false)}>{t("openChat")} · A</Button><Button asChild variant="ghost" className="mt-6 justify-start px-0"><Link to="/"><ArrowLeft size={16} />{t("dashboard")}</Link></Button></main>;
}
