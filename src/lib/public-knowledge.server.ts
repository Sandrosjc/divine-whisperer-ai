/** Free public sources first (no key): Wikipedia summary for the topic of a question. */
const WIKI = { en: "en", pt: "pt", es: "es" } as const;

export async function publicContext(text: string, lang: keyof typeof WIKI): Promise<string> {
  const q = text.replace(/[?!.¿¡]/g, "").trim();
  if (q.length < 8 || q.split(" ").length > 14) return "";
  try {
    const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2500);
    const s = await fetch(`https://${WIKI[lang]}.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&origin=*&srsearch=${encodeURIComponent(q)}`, { signal: ctrl.signal });
    const sj = (await s.json()) as { query?: { search?: { title: string }[] } };
    const title = sj.query?.search?.[0]?.title;
    if (!title) { clearTimeout(t); return ""; }
    const r = await fetch(`https://${WIKI[lang]}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`, { signal: ctrl.signal });
    clearTimeout(t);
    const j = (await r.json()) as { extract?: string };
    return j.extract ? `Public reference (Wikipedia, "${title}"): ${j.extract.slice(0, 700)}` : "";
  } catch { return ""; }
}
