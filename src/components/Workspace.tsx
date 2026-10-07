import { Link, useNavigate } from "@tanstack/react-router";
import { ArrowUpRight, ArrowUp, MessageSquare, LayoutDashboard, Settings, PenLine, Compass, Lightbulb, BookOpen, Check, Menu, X, AudioLines, KeyRound } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Logo } from "@/components/Logo";
import { LanguageSelect } from "@/components/LanguageSelect";
import { useI18n } from "@/lib/i18n";
import sculpture from "@/assets/chequetto-sculpture.jpg";

type Profile = { full_name: string | null; plan: string; onboarded: boolean };
type History = { id: string; role: string; content: string; created_at: string };

export function Workspace({ profile, history = [], used = 0, trialLimit = 25, signedIn = false }: { profile?: Profile | null; history?: History[]; used?: number; trialLimit?: number; signedIn?: boolean }) {
  const { t } = useI18n();
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [menu, setMenu] = useState(false);
  const name = profile?.full_name?.split(" ")[0] ?? "";
  const prompts = [
    { icon: PenLine, title: t("writeTitle"), sub: t("writeSub"), prompt: t("writePrompt"), tone: "text-gold" },
    { icon: Compass, title: t("planTitle"), sub: t("planSub"), prompt: t("planPrompt"), tone: "text-sage" },
    { icon: BookOpen, title: t("learnTitle"), sub: t("learnSub"), prompt: t("learnPrompt"), tone: "text-lilac" },
    { icon: Lightbulb, title: t("clarityTitle"), sub: t("claritySub"), prompt: t("clarityPrompt"), tone: "text-rose" },
  ];
  function begin(prompt: string) {
    if (signedIn) {
      sessionStorage.setItem("chq-prompt", prompt.slice(0, 12000));
      navigate({ to: "/chat" });
    } else navigate({ to: "/auth" });
  }
  return (
    <div className="workspace-shell">
      {menu && <div className="fixed inset-0 z-30 bg-background/80 md:hidden" onClick={() => setMenu(false)} />}
      <aside className={`workspace-sidebar ${menu ? "is-open" : ""}`}>
        <Link to="/" className="flex items-center gap-3 px-2"><Logo size={34} /><span className="font-display text-3xl font-semibold">Chequetto</span></Link>
        <Button variant="ghost" size="icon" className="absolute end-3 top-4 md:hidden" aria-label="Close menu" onClick={() => setMenu(false)}><X size={18} /></Button>
        <Button className="mt-10 w-full justify-between" onClick={() => begin("")}>{t("newConversation")}<MessageSquare size={16} /></Button>
        <nav className="mt-8 space-y-2">
          <Button variant="secondary" asChild className="w-full justify-start gap-3"><Link to={signedIn ? "/dashboard" : "/"}><LayoutDashboard size={17} />{t("dashboard")}</Link></Button>
          <Button variant="ghost" asChild className="w-full justify-start gap-3 text-muted-foreground"><Link to={signedIn ? "/chat" : "/auth"}><MessageSquare size={17} />{t("conversations")}</Link></Button>
          <Button variant="ghost" asChild className="w-full justify-start gap-3 text-muted-foreground"><Link to={signedIn ? "/settings" : "/auth"}><Settings size={17} />{t("account")}</Link></Button>
        </nav>
        <div className="mt-10 border-t pt-6">
          <p className="px-3 text-xs text-muted-foreground">{t("recent")}</p>
          {history.filter(m => m.role === "user").slice(-3).reverse().map(m => <Button key={m.id} variant="ghost" asChild className="mt-2 w-full justify-start text-xs text-muted-foreground"><Link to="/chat" className="truncate"><MessageSquare size={13} className="me-2 shrink-0" /><span className="truncate">{m.content}</span></Link></Button>)}
          {!history.some(m => m.role === "user") && <p className="px-3 pt-4 text-xs leading-6 text-muted-foreground">{t("emptyHistory")}</p>}
        </div>
        <div className="mt-auto border-t pt-5">
          {signedIn && profile?.plan === "trial" && <div className="mb-5 px-2"><div className="flex justify-between text-xs"><span className="text-muted-foreground">{t("trial")}</span><span>{Math.max(0, trialLimit - used)} / {trialLimit}</span></div><progress className="usage-progress mt-3 w-full" max={trialLimit} value={Math.max(0, trialLimit - used)} /><Button asChild variant="link" className="mt-1 h-8 px-0 text-xs"><Link to="/settings">{t("activate")}<ArrowUpRight size={12} /></Link></Button></div>}
          <div className="flex items-center gap-3 px-2"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm text-gold">{name ? name[0]?.toUpperCase() : <Logo size={24} />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm">{name || "Chequetto"}</p><p className="text-xs text-muted-foreground">{signedIn ? t("member") : t("tagline").split(".")[0]}</p></div><Button asChild variant="ghost" size="icon" title={t("adminAccess")} aria-label={t("adminAccess")} className="h-8 w-8 font-display text-lg"><Link to="/admin-access">A</Link></Button></div>
        </div>
      </aside>
      <main className="workspace-main">
        <header className="flex h-20 items-center justify-between border-b px-5 md:px-10"><div className="flex items-center gap-3"><Button variant="ghost" size="icon" className="md:hidden" aria-label="Open menu" onClick={() => setMenu(true)}><Menu size={20} /></Button><span className="text-sm text-muted-foreground">{t("dashboard")}</span></div><div className="flex items-center gap-3"><LanguageSelect />{!signedIn && <Button asChild size="sm" variant="outline"><Link to="/auth">{t("signIn")}</Link></Button>}</div></header>
        <div className="mx-auto max-w-6xl px-5 pb-12 pt-8 md:px-10 md:pt-10">
          <section className="workspace-welcome relative isolate overflow-hidden">
            <img src={sculpture} width={1536} height={1024} alt="A sculpted golden loop" className="absolute inset-0 -z-10 h-full w-full object-cover object-right" />
            <div className="welcome-shade absolute inset-0 -z-10" />
            <div className="max-w-lg py-9 md:py-12"><p className="mb-4 flex items-center gap-2 text-xs text-gold"><span className="h-1.5 w-1.5 rounded-full bg-gold" />Chequetto · {t("ready")}</p><h1 className="font-display text-4xl leading-tight md:text-5xl">{name ? t("greeting", { name }) : t("guestGreeting")}</h1><p className="mt-4 text-sm text-muted-foreground">{t("workspaceSub")}</p></div>
          </section>
          <form onSubmit={e => { e.preventDefault(); if (input.trim()) begin(input); }} className="mt-6 rounded-lg border bg-card p-4 focus-within:ring-1 focus-within:ring-ring">
            <Textarea value={input} maxLength={12000} onChange={e => setInput(e.target.value)} placeholder={t("placeholder")} className="min-h-16 resize-none border-0 bg-transparent px-0 text-base shadow-none focus-visible:ring-0" />
            <div className="flex items-center justify-between"><Button type="button" variant="ghost" size="sm" onClick={() => begin("")} className="gap-2 px-0 text-muted-foreground"><AudioLines size={17} />{t("listen")}</Button><Button size="icon" type="submit" aria-label={t("send")} disabled={!input.trim()}><ArrowUp size={19} /></Button></div>
          </form>
          <section className="mt-10"><h2 className="mb-5 font-sans text-sm font-medium">{t("quickStart")}</h2><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{prompts.map(p => <Button key={p.title} variant="outline" onClick={() => begin(p.prompt)} className="h-auto min-h-36 items-start justify-start whitespace-normal rounded-lg bg-card p-5 text-start"><div className="w-full"><div className="mb-5 flex justify-between"><p.icon size={21} className={p.tone} /><ArrowUpRight size={15} className="text-muted-foreground" /></div><p className="text-sm font-medium">{p.title}</p><p className="mt-2 text-xs font-normal text-muted-foreground">{p.sub}</p></div></Button>)}</div></section>
          <section className="mt-10"><div className="mb-4 flex items-center justify-between"><h2 className="font-sans text-sm font-medium">{t("recent")}</h2>{history.some(m => m.role === "user") && <Button asChild variant="link" size="sm"><Link to="/chat">{t("viewAll")}<ArrowUpRight size={14} /></Link></Button>}</div>{history.filter(m => m.role === "user").slice(-3).reverse().map(m => <Link to="/chat" key={m.id} className="flex items-center gap-4 border-t py-4"><MessageSquare size={17} className="shrink-0 text-muted-foreground" /><span className="flex-1 truncate text-sm">{m.content}</span><span className="hidden text-xs text-muted-foreground sm:block">{new Date(m.created_at).toLocaleDateString()}</span><ArrowUpRight size={15} className="text-muted-foreground" /></Link>)}{!history.some(m => m.role === "user") && <div className="flex items-center gap-3 border-y py-6 text-sm text-muted-foreground"><MessageSquare size={18} />{t("emptyHistory")}</div>}</section>
          <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 text-xs text-muted-foreground"><span className="flex items-center gap-2"><Check size={14} className="text-sage" />{signedIn ? t("profileReady") : "Chequetto"}</span><Button asChild variant="ghost" size="sm" className="gap-2 text-xs text-muted-foreground"><Link to={signedIn ? "/settings" : "/auth"}><KeyRound size={13} />{t("activate")}</Link></Button></footer>
        </div>
      </main>
    </div>
  );
}