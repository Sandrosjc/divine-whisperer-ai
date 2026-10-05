import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import confetti from "canvas-confetti";
import ReactMarkdown from "react-markdown";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { completeOnboarding } from "@/lib/app.functions";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/_authenticated/onboarding")({
  head: () => ({
    meta: [
      { title: "Welcome — Chequetto" },
      { name: "description", content: "Introduce yourself to Chequetto, your AI partner for life." },
      { property: "og:title", content: "Welcome — Chequetto" },
      { property: "og:description", content: "Introduce yourself to Chequetto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Onboarding,
});

const GOLD = ["#D4AF37", "#F5E6A8", "#FFF8DC", "#B8860B"];

function celebrate() {
  const end = Date.now() + 3500;
  confetti({ particleCount: 160, spread: 110, origin: { y: 0.6 }, colors: GOLD });
  confetti({ particleCount: 60, spread: 360, shapes: ["star"], scalar: 1.4, colors: GOLD, startVelocity: 35 });
  (function frame() {
    confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors: GOLD });
    confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors: GOLD });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

function Onboarding() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const run = useServerFn(completeOnboarding);
  const [form, setForm] = useState({ fullName: "", birthDate: "", city: "" });
  const [busy, setBusy] = useState(false);
  const [greeting, setGreeting] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await run({ data: { ...form, language: lang } });
      setGreeting(r.greeting);
      celebrate();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  if (greeting) {
    return (
      <main className="relative min-h-screen overflow-hidden px-4 py-16">
        <div className="pointer-events-none absolute inset-0 animate-pulse bg-[radial-gradient(circle_at_50%_20%,var(--gold)_0%,transparent_45%)] opacity-20" />
        <article className="relative mx-auto max-w-2xl rounded-2xl border bg-card/90 p-8 shadow-glow backdrop-blur animate-in fade-in zoom-in-95 duration-700 md:p-12">
          <div className="mb-6 flex justify-center"><Logo size={56} /></div>
          <div className="prose-chq text-[1.05rem]"><ReactMarkdown>{greeting}</ReactMarkdown></div>
          <Button size="lg" className="mt-8 w-full shadow-glow" onClick={() => navigate({ to: "/chat" })}>{t("continueChat")}</Button>
        </article>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form onSubmit={submit} className="w-full max-w-md rounded-2xl border bg-card p-8 shadow-glow">
        <div className="mb-4 flex justify-between"><Logo size={44} /><LanguageSelect /></div>
        <h1 className="text-gold-gradient text-4xl font-semibold">{t("onbTitle")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("onbSub")}</p>
        <div className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="n">{t("fullName")}</Label>
            <Input id="n" required minLength={2} value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="b">{t("birthDate")}</Label>
            <Input id="b" type="date" required value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="c">{t("city")}</Label>
            <Input id="c" required value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
        </div>
        <Button type="submit" size="lg" className="mt-8 w-full" disabled={busy}>
          {busy ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t("reading")}</>) : t("awaken")}
        </Button>
      </form>
    </main>
  );
}
