import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Globe2, Mic, Brain, ShieldCheck } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chequetto — Your AI partner for life" },
      { name: "description", content: "A wise, empathetic AI companion that remembers you, speaks every language, and listens with your voice." },
      { property: "og:title", content: "Chequetto — Your AI partner for life" },
      { property: "og:description", content: "A wise, empathetic AI companion that remembers you and speaks your language." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Index,
});

function Index() {
  const { t } = useI18n();
  const [signedIn, setSignedIn] = useState(false);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSignedIn(!!data.session));
  }, []);

  const features = [
    { icon: Brain, title: "Multi-model wisdom", body: "Several leading AI minds draft, cross-check and refine every answer." },
    { icon: Globe2, title: "Every language", body: "Chequetto detects your language and speaks it naturally." },
    { icon: Mic, title: "Talk out loud", body: "Speak to Chequetto and hear it answer — right in your browser." },
    { icon: ShieldCheck, title: "Remembers you", body: "Compact long-term memory keeps every chat personal." },
  ];

  return (
    <main className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="font-display text-2xl font-semibold tracking-wide">Chequetto</span>
        </div>
        <Button asChild variant="outline">
          <Link to={signedIn ? "/chat" : "/auth"}>{signedIn ? t("openChat") : t("signIn")}</Link>
        </Button>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <p className="mb-6 text-sm uppercase tracking-[0.35em] text-muted-foreground">AppSumo Lifetime Edition</p>
        <h1 className="text-gold-gradient text-6xl font-semibold leading-[1.05] md:text-8xl">Chequetto</h1>
        <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground md:text-xl">{t("tagline")}</p>
        <Button asChild size="lg" className="mt-10 h-12 px-8 text-base shadow-glow">
          <Link to={signedIn ? "/chat" : "/auth"}>{t("start")}</Link>
        </Button>
      </section>

      <section className="mx-auto grid max-w-6xl gap-px overflow-hidden rounded-2xl border bg-border px-0 md:grid-cols-4">
        {features.map((f) => (
          <div key={f.title} className="bg-card p-8">
            <f.icon className="mb-4 h-6 w-6 text-gold" />
            <h3 className="text-xl font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.body}</p>
          </div>
        ))}
      </section>
      <footer className="py-12 text-center text-xs text-muted-foreground">© Chequetto</footer>
    </main>
  );
}
