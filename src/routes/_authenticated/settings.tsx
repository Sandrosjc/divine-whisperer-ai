import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { getMe, redeemLicense, saveByokKey, setLanguage } from "@/lib/app.functions";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Chequetto" },
      { name: "description", content: "Manage your Chequetto license, OpenRouter key and language." },
      { property: "og:title", content: "Settings — Chequetto" },
      { property: "og:description", content: "Manage your Chequetto account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border bg-card p-6">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {sub && <p className="mt-1 text-sm text-muted-foreground">{sub}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function SettingsPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const redeem = useServerFn(redeemLicense);
  const saveKey = useServerFn(saveByokKey);
  const saveLang = useServerFn(setLanguage);
  const [code, setCode] = useState("");
  const [key, setKey] = useState("");
  const [busy, setBusy] = useState(false);

  async function wrap(fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      toast.success(t("saved"));
      me.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    } finally {
      setBusy(false);
    }
  }

  const plan = me.data?.profile?.plan;

  return (
    <main className="mx-auto max-w-2xl space-y-6 px-4 py-10">
      <Link to="/chat" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-gold"><ArrowLeft className="h-4 w-4" />{t("back")}</Link>
      <h1 className="text-gold-gradient text-5xl font-semibold">{t("settings")}</h1>

      <Section title={t("plan")}>
        <p className="text-lg">{plan === "lifetime" ? t("lifetime") : plan === "trial" ? t("trial") : plan}</p>
        {plan === "trial" && me.data && <p className="text-sm text-muted-foreground">{t("messagesLeft", { n: Math.max(0, me.data.trialLimit - me.data.used) })}</p>}
      </Section>

      {plan !== "lifetime" && (
        <Section title={t("redeemTitle")} sub={t("redeemSub")}>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); wrap(() => redeem({ data: { code } })).then(() => setCode("")); }}>
            <Input placeholder="CHQ-XXXX-XXXX-XXXX" value={code} onChange={(e) => setCode(e.target.value)} />
            <Button disabled={busy || code.length < 6}>{t("redeem")}</Button>
          </form>
        </Section>
      )}

      <Section title={t("byokTitle")} sub={t("byokSub")}>
        {me.data?.hasKey && <p className="mb-3 text-sm">✓ {me.data.keyPreview}</p>}
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); wrap(() => saveKey({ data: { key } })).then(() => setKey("")); }}>
          <Input type="password" placeholder="sk-or-…" value={key} onChange={(e) => setKey(e.target.value)} />
          <Button disabled={busy || !key}>{t("save")}</Button>
          {me.data?.hasKey && <Button type="button" variant="outline" disabled={busy} onClick={() => wrap(() => saveKey({ data: { key: "" } }))}>{t("remove")}</Button>}
        </form>
      </Section>

      <Section title={t("language")}>
        <LanguageSelect onChange={(l) => saveLang({ data: { language: l } })} />
      </Section>

      <Button variant="outline" onClick={async () => { await supabase.auth.signOut(); navigate({ to: "/" }); }}>{t("signOut")}</Button>
    </main>
  );
}
