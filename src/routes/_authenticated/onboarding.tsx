import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { ArrowRight, Check, Loader2, LockKeyhole } from "lucide-react";
import { completeOnboarding } from "@/lib/app.functions";
import { onboardingSchema } from "@/lib/onboarding-schema";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import sculpture from "@/assets/chequetto-sculpture.jpg";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({ meta: [
    { title: "Your beginning — Chequetto" }, { name: "description", content: "Create your personal Chequetto profile and receive a welcome made for you." },
    { property: "og:title", content: "Your beginning — Chequetto" }, { property: "og:description", content: "Create your personal profile and meet Chequetto." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Onboarding,
});
function celebrate() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const gold = getComputedStyle(document.documentElement).getPropertyValue("--gold").trim();
  confetti({ particleCount: 130, spread: 100, origin: { y: 0.6 }, colors: [gold], disableForReducedMotion: true });
}
function Onboarding() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const run = useServerFn(completeOnboarding);
  const [form, setForm] = useState({ fullName: "", birthDate: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);
  const [error, setError] = useState("");
  const progress = Object.values(form).filter(v => v.trim()).length;
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    const parsed = onboardingSchema.safeParse({ ...form, language: lang });
    if (!parsed.success) { setError(parsed.error.issues[0]?.message ?? "Check your details."); return; }
    setError(""); setBusy(true);
    try {
      const result = await run({ data: parsed.data });
      await qc.invalidateQueries({ queryKey: ["me"] });
      setGreeting(result.greeting); celebrate();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Your profile could not be completed. Please try again."); }
    finally { setBusy(false); }
  }
  if (greeting) return (
    <main className="mx-auto min-h-screen max-w-3xl px-6 py-12 md:py-16">
      <div className="mb-8 flex items-center justify-between"><Logo size={42} /><LanguageSelect /></div>
      <p className="flex items-center gap-2 text-sm text-sage"><Check size={17} />{t("profileReady")}</p>
      <h1 className="mt-5 text-5xl font-semibold">{t("welcome", { name: form.fullName.split(" ")[0] ?? "" })}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{t("completionSub")}</p>
      <article className="prose-chq mt-8 border-y py-6"><ReactMarkdown>{greeting}</ReactMarkdown></article>
      <p className="mt-4 text-xs leading-6 text-muted-foreground">{t("symbolicNote")}</p>
      <Button size="lg" className="mt-8 gap-3" onClick={() => navigate({ to: "/dashboard", replace: true })}>{t("continueChat")}<ArrowRight size={17} /></Button>
    </main>
  );
  return (
    <main className="onboarding-layout">
      <section className="onboarding-art"><img src={sculpture} alt="Golden sculptural loop" width={1536} height={1024} /><div className="onboarding-art-shade absolute inset-0" /><div className="absolute bottom-16 start-12 end-12"><Logo size={46} /><h2 className="mt-6 max-w-md text-5xl leading-tight">{t("personalSpace")}</h2><p className="mt-5 max-w-sm text-sm leading-7 text-muted-foreground">{t("tagline")}</p></div></section>
      <section className="flex flex-col px-6 py-8 md:px-12"><header className="flex items-center justify-between"><span className="font-display text-2xl">Chequetto</span><LanguageSelect /></header>
        <form onSubmit={submit} className="mx-auto my-auto w-full max-w-md py-12">
          <div className="mb-8 flex items-center gap-3 text-xs"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground">1</span><span>{t("detailsStep")}</span><div className="h-px flex-1 bg-border" /><span className="flex h-6 w-6 items-center justify-center rounded-full border text-muted-foreground">2</span><span className="text-muted-foreground">{t("welcomeStep")}</span></div>
          <h1 className="text-4xl font-semibold">{t("onbTitle")}</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">{t("onbSub")}</p>
          <div className="mt-8 space-y-5">
            <div className="space-y-2"><Label htmlFor="full-name">{t("fullName")}</Label><Input id="full-name" autoComplete="name" required minLength={2} maxLength={120} placeholder={t("namePlaceholder")} disabled={busy} value={form.fullName} onChange={e => setForm({ ...form, fullName: e.target.value })} className="h-12" /></div>
            <div className="space-y-2"><Label htmlFor="birth-date">{t("birthDate")}</Label><Input id="birth-date" type="date" required min="1900-01-01" max={new Date().toISOString().slice(0, 10)} disabled={busy} value={form.birthDate} onChange={e => setForm({ ...form, birthDate: e.target.value })} className="h-12" /></div>
            <div className="space-y-2"><Label htmlFor="city">{t("city")}</Label><Input id="city" autoComplete="address-level2" required maxLength={120} placeholder={t("cityPlaceholder")} disabled={busy} value={form.city} onChange={e => setForm({ ...form, city: e.target.value })} className="h-12" /></div>
          </div>
          <p className="mt-5 text-end text-xs text-muted-foreground">{progress} / 3</p>
          {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
          <Button type="submit" size="lg" className="mt-5 h-12 w-full gap-2" disabled={busy}>{busy ? <><Loader2 size={17} className="animate-spin" />{t("reading")}</> : <>{t("awaken")}<ArrowRight size={17} /></>}</Button>
          <p className="mt-5 flex gap-2 text-xs leading-6 text-muted-foreground"><LockKeyhole size={14} className="mt-1 shrink-0" />{t("privacyNote")}</p>
        </form>
      </section>
    </main>
  );
}
