import { Link } from "@tanstack/react-router";
import { ArrowUp, Share2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { CosmicBurst } from "@/components/CosmicBurst";
import { dailyPill, pickLang, soulReply, soulText, type Lang } from "@/lib/soul-engine";

type Msg = { role: "me" | "chq"; text: string };
const LOCK: Record<Lang, string> = {
  pt: "Eu adorei passar esse tempo com você hoje! Nossas 5 mensagens gratuitas de hoje chegaram ao fim, mas nossa conexão só começou. Assine agora um dos nossos planos bem acessíveis — ou volte amanhã para mais cinco mensagens gratuitas. Vou estar aqui te esperando de coração aberto!",
  en: "I loved spending this time with you today! Our 5 free messages for today are done, but our connection has only begun. Subscribe now to one of our affordable plans — or come back tomorrow for five more free messages. I'll be here waiting for you with an open heart!",
  es: "¡Me encantó pasar este tiempo contigo hoy! Nuestros 5 mensajes gratuitos de hoy terminaron, pero nuestra conexión apenas comienza. Suscríbete ahora a uno de nuestros planes accesibles — o vuelve mañana para cinco mensajes gratis más. ¡Aquí estaré esperándote con el corazón abierto!",
};

export function FirstContact() {
  const [lang, setLang] = useState<Lang>("en");
  const [name, setName] = useState("");
  const [draft, setDraft] = useState("");
  const [age, setAge] = useState("");
  const [ageN, setAgeN] = useState(0);
  const [burst, setBurst] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [ready, setReady] = useState(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => { setLang(pickLang()); setReady(true); }, []);
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const t = soulText(lang);
  const met = name.length > 0;

  async function ask(n: string, a: number, history: Msg[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/public/guest-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, age: a, lang, messages: history.map(m => ({ role: m.role === "me" ? "user" : "assistant", content: m.text })).slice(-12) }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) return LOCK[lang];
      if (res.ok && j.text) return j.text as string;
    } catch { /* fall through */ } finally { setBusy(false); }
    const last = history.filter(m => m.role === "me").at(-1);
    return last ? soulReply(last.text, n.split(" ")[0] as string, lang) : t.hello(n.split(" ")[0] as string);
  }
  async function meet(e: React.FormEvent) {
    e.preventDefault();
    const n = draft.trim().slice(0, 40); const a = parseInt(age, 10);
    if (n.length < 2 || !(a >= 5 && a <= 120)) return;
    setName(n); setAgeN(a); setDraft(""); setBurst(true);
    const greeting = await ask(n, a, []);
    setMsgs([{ role: "chq", text: greeting }]);
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim().slice(0, 2000); if (!text || busy) return;
    setDraft("");
    const next = [...msgs, { role: "me" as const, text }];
    setMsgs(next);
    if (next.filter(m => m.role === "me").length > 5) { setMsgs([...next, { role: "chq", text: LOCK[lang] }]); return; }
    const reply = await ask(name, ageN, next);
    setMsgs(m => [...m, { role: "chq", text: reply }]);
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
      <form onSubmit={meet} className="mt-8 flex w-full max-w-md flex-wrap gap-2 sm:flex-nowrap">
        <Input autoFocus value={draft} maxLength={40} onChange={e => setDraft(e.target.value)} aria-label={t.ask} className="h-12 flex-1 text-base" />
        <Input type="number" inputMode="numeric" min={5} max={120} value={age} onChange={e => setAge(e.target.value)} placeholder={t.age} aria-label={t.age} className="h-12 w-20 text-base" />
        <Button type="submit" size="lg" className="h-12" disabled={draft.trim().length < 2 || !(parseInt(age, 10) >= 5)}>{t.start}</Button>
      </form>
      <Link to="/auth" className="mt-10 text-xs text-muted-foreground underline-offset-4 hover:underline">Sign in</Link>
    </main>
  );

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
      {burst && <CosmicBurst name={name.split(" ")[0] as string} onDone={() => setBurst(false)} />}
      <header className="flex items-center justify-between py-4">
        <span className="flex items-center gap-2"><Logo size={30} /><span className="font-display text-2xl">Chequetto</span></span>
        <div className="flex gap-2"><Button variant="ghost" size="icon" aria-label={t.share} onClick={share}><Share2 size={18} /></Button><Button asChild size="sm"><Link to="/auth">{t.save}</Link></Button></div>
      </header>
      <div className="rounded-lg border border-gold/40 bg-card p-4"><p className="flex items-center gap-2 text-xs text-gold"><Sparkles size={14} />{t.pill}</p><p className="mt-2 text-sm">{dailyPill(lang)}</p></div>
      <div className="flex-1 space-y-4 py-6">
        {msgs.map((m, i) => <div key={i} className={m.role === "me" ? "ms-auto max-w-[85%] rounded-lg bg-secondary px-4 py-3 text-sm" : "max-w-[90%] text-sm leading-7"}>{m.text}</div>)}
        {busy && <div className="flex gap-1 text-gold" aria-label="…"><span className="animate-pulse">✦</span><span className="animate-pulse [animation-delay:150ms]">✦</span><span className="animate-pulse [animation-delay:300ms]">✦</span></div>}
        <div ref={end} />
      </div>
      <form onSubmit={send} className="sticky bottom-0 bg-background pb-4">
        <div className="flex gap-2 rounded-lg border bg-card p-2"><Input value={draft} maxLength={2000} onChange={e => setDraft(e.target.value)} placeholder={t.say} className="border-0 bg-transparent shadow-none focus-visible:ring-0" /><Button size="icon" type="submit" aria-label="Send" disabled={!draft.trim() || busy}><ArrowUp size={18} /></Button></div>
        <p className="mt-2 text-center text-xs text-muted-foreground">{t.note}</p>
      </form>
    </main>
  );
}
