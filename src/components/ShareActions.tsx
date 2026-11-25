import { Copy, Facebook, Mail, MessageCircle, Send, Share2 } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://www.chequetto.online";

export function shareText(text: string) {
  return `${text.trim()}\n\n— Feito com a Chequetto, a IA brasileira: ${SITE}`;
}

export function ShareActions({ text }: { text: string }) {
  if (!text?.trim()) return null;
  const body = shareText(text);
  const subject = text.trim().split("\n")[0]?.replace(/^(assunto|subject)\s*:\s*/i, "").slice(0, 80) ?? "";
  const b = encodeURIComponent(body), s = encodeURIComponent(subject), u = encodeURIComponent(SITE);
  const links = [
    { label: "WhatsApp", icon: MessageCircle, href: `https://wa.me/?text=${b}` },
    { label: "Gmail", icon: Mail, href: `https://mail.google.com/mail/?view=cm&fs=1&su=${s}&body=${b}` },
    { label: "Outlook", icon: Mail, href: `https://outlook.live.com/mail/0/deeplink/compose?subject=${s}&body=${b}` },
    { label: "Telegram", icon: Send, href: `https://t.me/share/url?url=${u}&text=${encodeURIComponent(text.trim())}` },
    { label: "Facebook", icon: Facebook, href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
  ];
  const cls = "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-gold hover:text-gold";
  async function more() {
    if (navigator.share) { try { await navigator.share({ title: "Chequetto", text: body }); } catch { /* cancelado */ } }
    else { await navigator.clipboard.writeText(body); toast.success("Copiado!"); }
  }
  return (
    <div className="mt-2">
      <p className="mb-1.5 text-xs text-gold">Compartilhe essa resposta com sua família e amigos:</p>
      <div className="flex flex-wrap gap-2">
        {links.map(({ label, icon: Icon, href }) => (
          <a key={label} className={cls} href={href} target="_blank" rel="noopener noreferrer"><Icon className="h-3.5 w-3.5" />{label}</a>
        ))}
        <button type="button" className={cls} onClick={more}><Share2 className="h-3.5 w-3.5" />Mais (Instagram, SMS…)</button>
        <button type="button" className={cls} onClick={() => navigator.clipboard.writeText(body).then(() => toast.success("Copiado!"))}><Copy className="h-3.5 w-3.5" />Copiar</button>
      </div>
    </div>
  );
}
