import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { Mic, MicOff, Send, Settings, Volume2, VolumeX, LayoutDashboard } from "lucide-react";
import { toast } from "sonner";
import { getHistory, getMe } from "@/lib/app.functions";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/lib/i18n";
import { Logo } from "@/components/Logo";
import { ShareActions } from "@/components/ShareActions";
import { LanguageSelect } from "@/components/LanguageSelect";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/_authenticated/chat")({
  head: () => ({
    meta: [
      { title: "Chat — Chequetto" },
      { name: "description", content: "Talk with Chequetto, your AI partner for life." },
      { property: "og:title", content: "Chat — Chequetto" },
      { property: "og:description", content: "Talk with Chequetto." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Chat,
});

type Msg = { id: string; role: string; content: string };

function speak(text: string, lang: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const clean = text.replace(/[#*_`>\[\]()]/g, "");
  const u = new SpeechSynthesisUtterance(clean);
  u.lang = lang;
  const v = window.speechSynthesis.getVoices().find((x) => x.lang.toLowerCase().startsWith(lang));
  if (v) u.voice = v;
  window.speechSynthesis.speak(u);
}

function Chat() {
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const history = useQuery({ queryKey: ["history"], queryFn: useServerFn(getHistory) });
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [voice, setVoice] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<any>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (me.data && !me.data.profile?.onboarded) navigate({ to: "/onboarding" });
  }, [me.data, navigate]);
  useEffect(() => {
    if (history.data) setMsgs(history.data as Msg[]);
  }, [history.data]);
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);
  useEffect(() => {
    const draft = sessionStorage.getItem("chq-prompt");
    if (draft) { setInput(draft); sessionStorage.removeItem("chq-prompt"); }
  }, []);
  useEffect(() => {
    taRef.current?.focus();
  }, [busy]);

  async function send(text: string) {
    const message = text.trim();
    if (!message || busy) return;
    setInput("");
    setBusy(true);
    const aid = crypto.randomUUID();
    setMsgs((m) => [...m, { id: crypto.randomUUID(), role: "user", content: message }, { id: aid, role: "assistant", content: "" }]);
    try {
      const { data } = await supabase.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session?.access_token}` },
        body: JSON.stringify({ message, language: lang }),
      });
      if (!res.ok || !res.body) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        const msg = err.error === "TRIAL_ENDED" ? t("trialEnded") : err.error === "NEEDS_BYOK" ? t("needsKey") : err.error ?? "Error";
        setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: `> ${msg}` } : x)));
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let full = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        full += dec.decode(value, { stream: true });
        setMsgs((m) => m.map((x) => (x.id === aid ? { ...x, content: full } : x)));
      }
      if (voice && full) speak(full, lang);
      qc.invalidateQueries({ queryKey: ["me"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Network error");
    } finally {
      setBusy(false);
    }
  }

  function toggleMic() {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error("Voice input isn't supported in this browser.");
    if (listening) return recRef.current?.stop();
    const rec = new SR();
    rec.lang = lang;
    rec.interimResults = true;
    rec.onresult = (e: any) => setInput(Array.from(e.results).map((r: any) => r[0].transcript).join(""));
    rec.onend = () => setListening(false);
    rec.start();
    recRef.current = rec;
    setListening(true);
  }

  const p = me.data;
  const left = p && p.profile?.plan === "trial" ? Math.max(0, p.trialLimit - p.used) : null;

  return (
    <div className="flex h-screen flex-col">
      <header className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <Logo size={30} />
          <span className="font-display text-xl font-semibold">Chequetto</span>
          {left !== null && <span className="ms-3 hidden rounded-full border px-2 py-0.5 text-xs text-muted-foreground sm:inline">{t("messagesLeft", { n: left })}</span>}
        </div>
        <div className="flex items-center gap-2">
          <LanguageSelect />
          <Button variant="ghost" size="icon" aria-label={voice ? t("voiceOn") : t("voiceOff")} onClick={() => { setVoice(!voice); window.speechSynthesis?.cancel(); }}>
            {voice ? <Volume2 className="h-4 w-4 text-gold" /> : <VolumeX className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="icon" asChild aria-label={t("dashboard")}><Link to="/dashboard"><LayoutDashboard className="h-4 w-4" /></Link></Button>
          <Button variant="ghost" size="icon" asChild aria-label={t("settings")}><Link to="/settings"><Settings className="h-4 w-4" /></Link></Button>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-3xl space-y-6 px-4 py-8">
          {msgs.map((m) =>
            m.role === "user" ? (
              <div key={m.id} className="flex justify-end">
                <div className="max-w-[80%] whitespace-pre-wrap rounded-2xl rounded-ee-sm bg-primary px-4 py-2.5 text-primary-foreground">{m.content}</div>
              </div>
            ) : (
              <div key={m.id} className="flex gap-3">
                <div className="mt-1 shrink-0"><Logo size={26} /></div>
                <div className="prose-chq min-w-0 flex-1">
                  {m.content ? <><ReactMarkdown>{m.content}</ReactMarkdown>{!busy && <ShareActions text={m.content} />}</> : <p className="animate-pulse text-muted-foreground">{t("thinking")}</p>}
                </div>
              </div>
            ),
          )}
          <div ref={endRef} />
        </div>
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(input); }} className="border-t p-3">
        <div className="mx-auto flex max-w-3xl items-end gap-2 rounded-2xl border bg-card p-2 focus-within:ring-1 focus-within:ring-ring">
          <Textarea
            ref={taRef}
            autoFocus
            rows={1}
            value={input}
            placeholder={t("placeholder")}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            className="max-h-40 min-h-10 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0"
          />
          <Button type="button" variant={listening ? "default" : "ghost"} size="icon" onClick={toggleMic} aria-label={t("listen")}>
            {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          <Button type="submit" size="icon" disabled={busy || !input.trim()} aria-label={t("send")}><Send className="h-4 w-4" /></Button>
        </div>
      </form>
    </div>
  );
}
