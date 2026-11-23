import { Link } from "@tanstack/react-router";
import { ArrowUp, Share2, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Logo } from "@/components/Logo";
import { CosmicBurst } from "@/components/CosmicBurst";
import { dailyPill, pickLang, soulText, type Lang } from "@/lib/soul-engine";

type Msg = { role: "me" | "chq"; text: string };
const LOCK: Record<Lang, string> = {
  pt: "Eu adorei passar esse tempo com você hoje! Nossas 5 mensagens gratuitas de hoje chegaram ao fim, mas nossa conexão só começou. Assine agora um dos nossos planos bem acessíveis — ou volte amanhã para mais cinco mensagens gratuitas. Vou estar aqui te esperando de coração aberto!",
  en: "I loved spending this time with you today! Our 5 free messages for today are done, but our connection has only begun. Subscribe now to one of our affordable plans — or come back tomorrow for five more free messages. I'll be here waiting for you with an open heart!",
  es: "¡Me encantó pasar este tiempo contigo hoy! Nuestros 5 mensajes gratuitos de hoy terminaron, pero nuestra conexión apenas comienza. Suscríbete ahora a uno de nuestros planes accesibles — o vuelve mañana para cinco mensajes gratis más. ¡Aquí estaré esperándote con el corazón abierto!",
};

const BUSY: Record<Lang, string> = {
  pt: "Opa, meu cérebro deu uma piscadinha agora. Me manda de novo em alguns segundos?",
  en: "Oops, my brain blinked for a second. Could you send that again in a few seconds?",
  es: "Uy, mi cerebro parpadeó un segundo. ¿Me lo envías de nuevo en unos segundos?",
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

  useEffect(() => {
    const saved = localStorage.getItem("chq-lang");
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
    const geo = /Sao_Paulo|Fortaleza|Recife|Bahia|Manaus|Belem|Cuiaba|Lisbon|Luanda|Maputo/.test(tz) ? "pt" : /Madrid|Mexico|Bogota|Lima|Santiago|Buenos_Aires|Caracas|Montevideo|Asuncion|La_Paz|Guayaquil/.test(tz) ? "es" : undefined;
    setLang(saved === "pt" || saved === "es" || saved === "en" ? saved : pickLang(geo)); setReady(true);
  }, []);
  function chooseLang(l: Lang) { setLang(l); localStorage.setItem("chq-lang", l); }
  useEffect(() => { end.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs]);

  const t = soulText(lang);
  
  async function ask(n: string, a: number, history: Msg[]) {
    setBusy(true);
    try {
      const res = await fetch("/api/public/guest-chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: n, age: a, lang, messages: history.filter(m => !Object.values(BUSY).includes(m.text)).map(m => ({ role: m.role === "me" ? "user" : "assistant", content: m.text })).slice(-12) }),
      });
      const j = await res.json().catch(() => ({}));
      if (res.status === 402) return LOCK[lang];
      if (res.ok && j.text) return j.text as string;
    } catch { /* fall through */ } finally { setBusy(false); }
    return BUSY[lang];
  }
  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = draft.trim().slice(0, 2000); if (!text || busy) return;
    setDraft("");
    const next = [...msgs, { role: "me" as const, text }];
    setMsgs(next);
    if (!msgs.some(m => m.role === "me")) setBurst(true);
    const reply = await ask(name, ageN, next);
    setMsgs(m => [...m, { role: "chq", text: reply }]);
  }
  async function share() {
    const data = { title: "Chequetto", text: t.shareText, url: window.location.origin };
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelled */ } }
    else await navigator.clipboard.writeText(`${data.text} ${data.url}`);
  }

  if (!ready) return <div className="flex min-h-screen items-center justify-center"><Logo size={48} /></div>;

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col px-4">
      {burst && <CosmicBurst name="Chequetto" onDone={() => setBurst(false)} />}
      <header className="flex items-center justify-between py-4">
        <span className="flex items-center gap-2"><Logo size={30} /><span className="font-display text-2xl">Chequetto</span></span>
        <div className="flex items-center gap-1">{(["en", "pt", "es"] as Lang[]).map((l) => <button key={l} type="button" onClick={() => chooseLang(l)} aria-label={l.toUpperCase()} aria-pressed={lang === l} className={`rounded-md px-1.5 py-1 text-lg transition ${lang === l ? "bg-secondary ring-1 ring-gold" : "opacity-60 hover:opacity-100"}`}>{l === "en" ? "🇺🇸" : l === "pt" ? "🇧🇷" : "🇪🇸"}</button>)}<Button variant="ghost" size="icon" aria-label={t.share} onClick={share}><Share2 size={18} /></Button><Button asChild size="sm"><Link to="/auth">{t.save}</Link></Button></div>
      </header>
      <div className="rounded-lg border border-gold/40 bg-card p-4"><p className="flex items-center gap-2 text-xs text-gold"><Sparkles size={14} />{t.pill}</p><p className="mt-2 text-sm">{dailyPill(lang)}</p></div>
      <div className="flex-1 space-y-4 py-6">
        {msgs.length === 0 && (
          <div className="flex flex-col items-center pt-16 text-center">
            <div className="animate-pulse"><Logo size={72} /></div>
            <h1 className="mt-6 font-display text-4xl text-gold md:text-5xl">Chequetto</h1>
            <p className="mt-3 text-sm text-muted-foreground">{t.say}</p>
          </div>
        )}
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
