import { Copy, Mail, MessageCircle } from "lucide-react";
import { toast } from "sonner";

const SITE = "https://www.chequetto.online";

export function shareText(text: string) {
  return `${text.trim()}\n\n— Feito com a Chequetto, a IA brasileira: ${SITE}`;
}

export function ShareActions({ text }: { text: string }) {
  if (!text?.trim()) return null;
  const body = shareText(text);
  const firstLine = text.trim().split("\n")[0]?.replace(/^(assunto|subject)\s*:\s*/i, "").slice(0, 80) ?? "";
  const wa = `https://wa.me/?text=${encodeURIComponent(body)}`;
  const gm = `https://mail.google.com/mail/?view=cm&fs=1&su=${encodeURIComponent(firstLine)}&body=${encodeURIComponent(body)}`;
  const cls = "inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs text-muted-foreground transition-colors hover:border-gold hover:text-gold";
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      <a className={cls} href={wa} target="_blank" rel="noopener noreferrer"><MessageCircle className="h-3.5 w-3.5" />Compartilhe com sua família no WhatsApp</a>
      <a className={cls} href={gm} target="_blank" rel="noopener noreferrer"><Mail className="h-3.5 w-3.5" />Enviar pelo Gmail</a>
      <button type="button" className={cls} onClick={() => navigator.clipboard.writeText(body).then(() => toast.success("Copiado!"))}><Copy className="h-3.5 w-3.5" />Copiar</button>
    </div>
  );
}
