import { Link } from "@tanstack/react-router";
import { ArrowUp, Share2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { dailyPill, pickLang, soulReply, soulText, type Lang } from "@/lib/soul-engine";

type Msg = { role: "me" | "chq"; text: string };
const KEY = "chq-guest";

export function FirstContact() {
  const [lang, setLang] = useState<Lang>("en");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [ready, setReady] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const l = pickLang(); setLang(l);
    try { const s = JSON.parse(localStorage.getItem(KEY) ?? "null"); if (s?.name) { setName(s.name); setMsgs(s.msgs ?? []); } } catch { /* ignore */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready && name && msgs.length) localStorage.setItem(KEY, JSON.stringify({ name, msgs: msgs.slice(-40) })); end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, name, ready]);

  const t = soulText(lang);
  const met = msgs.length > 0;

  function meet(e: React.FormEvent) {
    e.preventDefault();
    const n = draft.trim().slice(0, 40); if (n.length < 2) return;
    setName(n); setDraft(""); setMsgs([{ role: "chq", text: t.hello(n.split(" ")[0] as string) }]);
  }
  function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim().slice(0, 2000); if (!text) return;
    setDraft("");
    setMsgs(m => [...m, { role: "me", text }, { role: "chq", text: soulReply(text, name.split(" ")[0] as string, lang) }]);
  }
  async function share() {
    const data = { title: "Chequetto", text: t.shareText, url: window.location.origin };
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } }
    else await navigator.clipboard.writeText(`${data.text} ${data.url}`);
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center"><Logo size={48} /></div>;

  if (!met) return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo size={64} />
      <h1 className="mt-8 font-display text-4xl md:text-5xl">{t.ask}</h1>
      <p className="mt-3 text-sm text-muted-foreground">{t.askSub}</p>
      <form onSubmit={meet} className="mt-8 flex w-full max-w-sm gap-2">
        <Input autoFocus value={draft} maxLength={40} onChange={e => setDraft(e.target.value)} aria-label={t.ask} className="h-12 text-base" />
        <Button type="submit" size="lg" className="h-12" disabled={draft.trim().length < 2}>{t.start}</Button>
      </form>
      <Link to="/auth" className="mt-10 text-xs text-muted-foreground underline-offset-4 hover:underline">Sign in</Link>
    </main>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
      <header className="flex items-center justify-between py-4">
        <span className="flex items-center gap-2"><Logo size={30} /><span className="font-display text-2xl">Chequetto</span></span>
        <div className="flex gap-2"><Button variant="ghost" size="icon" aria-label={t.share} onClick={share}><Share2 size={18} /></Button><Button asChild size="sm"><Link to="/auth">{t.save}</Link></Button></div>
      </header>
      <div className="rounded-lg border border-gold/40 bg-card p-4"><p className="flex items-center gap-2 text-xs text-gold"><Sparkles size={14} />{t.pill}</p><p className="mt-2 text-sm">{dailyPill(lang)}</p></div>
      <div className="flex-1 space-y-4 py-6">
        {msgs.map((m, i) => <div key={i} className={m.role === "me" ? "ms-auto max-w-[85%] rounded-lg bg-secondary px-4 py-3 text-sm" : "max-w-[90%] text-sm leading-7"}>{m.text}</div>)}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="sticky bottom-0 bg-background pb-4">
        <div className="flex gap-2 rounded-lg border bg-card p-2"><Input value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} placeholder={t.say} className="border-0 bg-transparent shadow-none focus-visible:ring-0" /><Button size="icon" type="submit" aria-label="Send" disabled={!draft.trim()}><ArrowUp size={18} /></Button></div>
        <p className="mt-2 text-center text-xs text-muted-foreground">{t.note}</p>
      </form>
    </main>
  );
}
