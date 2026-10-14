import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset password — Chequetto" },
      { name: "description", content: "Create a new password for your Chequetto account." },
      { property: "og:title", content: "Reset password — Chequetto" },
      { property: "og:description", content: "Create a new password for your Chequetto account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().min(6).max(128).safeParse(password);
    if (!parsed.success) { toast.error(t("wrongPassword")); return; }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password: parsed.data });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success(t("passwordUpdated"));
    navigate({ to: "/admin-access", replace: true });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6 py-12">
      <Logo size={46} />
      <h1 className="mt-6 text-4xl">{t("newPassword")}</h1>
      <form onSubmit={submit} className="mt-8 space-y-5">
        <div className="space-y-2">
          <Label htmlFor="new-password">{t("newPassword")}</Label>
          <Input id="new-password" type="password" autoComplete="new-password" minLength={6} maxLength={128} required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button className="w-full" disabled={busy}>{t("updatePassword")}</Button>
      </form>
    </main>
  );
}
