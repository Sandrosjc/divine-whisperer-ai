/** Free public sources first (no key, zero tokens): facts injected before the AI writes the answer. */
type Lang = "en" | "pt" | "es";

async function get<T>(url: string, ms = 2500): Promise<T | null> {
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { "User-Agent": "Chequetto/1.0" } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; } finally { clearTimeout(t); }
}

async function wikipedia(q: string, lang: Lang) {
  if (q.length < 8 || q.split(" ").length > 14) return "";
  const s = await get<{ query?: { search?: { title: string }[] } }>(`https://${lang}.wikipedia.org/w/api.php?action=query&list=search&format=json&srlimit=1&origin=*&srsearch=${encodeURIComponent(q)}`);
  const title = s?.query?.search?.[0]?.title; if (!title) return "";
  const j = await get<{ extract?: string }>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`);
  return j?.extract ? `Wikipedia "${title}": ${j.extract.slice(0, 700)}` : "";
}

const FX: Record<string, string> = { "dólar|dolar|dollar|usd": "USD-BRL", "euro|eur": "EUR-BRL", "libra|pound|gbp": "GBP-BRL", "bitcoin|btc": "BTC-BRL", "ethereum|eth": "ETH-BRL" };
async function currency(q: string) {
  const pairs = Object.entries(FX).filter(([k]) => new RegExp(`(^|[^\\p{L}])(${k})(?![\\p{L}])`, "iu").test(q)).map(([, v]) => v);
  if (!pairs.length) return "";
  const j = await get<Record<string, { name: string; bid: string; create_date: string }>>(`https://economia.awesomeapi.com.br/json/last/${pairs.join(",")}`);
  if (j && !("status" in j)) return "Live rates (AwesomeAPI): " + Object.values(j).map((x) => `${x.name} = ${x.bid} (${x.create_date})`).join("; ");
  const fiat = pairs.map((p) => p.split("-")[0]).filter((c) => c && ["USD", "EUR", "GBP"].includes(c));
  const out: string[] = [];
  for (const c of fiat) {
    const f = await get<{ date: string; rates: Record<string, number> }>(`https://api.frankfurter.app/latest?from=${c}&to=BRL`);
    if (f?.rates["BRL"]) out.push(`1 ${c} = ${f.rates["BRL"]} BRL (${f.date})`);
  }
  return out.length ? "Exchange rates (European Central Bank via Frankfurter): " + out.join("; ") : "";
}

async function cep(q: string) {
  const m = q.match(/\b(\d{5})-?(\d{3})\b/); if (!m) return "";
  const j = await get<Record<string, string>>(`https://brasilapi.com.br/api/cep/v2/${m[1]}${m[2]}`);
  return j?.["city"] ? `CEP ${m[1]}-${m[2]} (BrasilAPI): ${j["street"] ?? ""}, ${j["neighborhood"] ?? ""}, ${j["city"]}-${j["state"]}` : "";
}

async function cnpj(q: string) {
  const d = q.replace(/[.\-/]/g, "").match(/\b\d{14}\b/); if (!d) return "";
  const j = await get<Record<string, unknown>>(`https://brasilapi.com.br/api/cnpj/v1/${d[0]}`);
  return j?.["razao_social"] ? `CNPJ ${d[0]} (BrasilAPI): ${j["razao_social"]}, situação ${j["descricao_situacao_cadastral"]}, ${j["municipio"]}-${j["uf"]}, atividade: ${j["cnae_fiscal_descricao"]}` : "";
}

async function weather(q: string, lang: Lang) {
  const m = q.match(/(?:tempo|clima|previs[aã]o|weather|temperatura|chuva|forecast)\b.*?\b(?:em|de|in|en|para|for)\s+([A-Za-zÀ-ÿ' ]{3,40})/i);
  if (!m?.[1]) return "";
  const place = m[1].trim();
  const g = await get<{ results?: { name: string; country: string; latitude: number; longitude: number }[] }>(`https://geocoding-api.open-meteo.com/v1/search?count=1&language=${lang}&name=${encodeURIComponent(place)}`);
  const p = g?.results?.[0]; if (!p) return "";
  const w = await get<{ current?: Record<string, number>; daily?: Record<string, number[]> }>(`https://api.open-meteo.com/v1/forecast?latitude=${p.latitude}&longitude=${p.longitude}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max&forecast_days=3&timezone=auto`);
  if (!w?.current) return "";
  return `Weather now in ${p.name}, ${p.country} (Open-Meteo): ${w.current["temperature_2m"]}°C, humidity ${w.current["relative_humidity_2m"]}%, wind ${w.current["wind_speed_10m"]} km/h. Next 3 days max/min °C: ${w.daily?.["temperature_2m_max"]?.join("/")} / ${w.daily?.["temperature_2m_min"]?.join("/")}, rain chance %: ${w.daily?.["precipitation_probability_max"]?.join("/")}`;
}

async function books(q: string) {
  // Só quando pedem livros "de/sobre" algo ou um autor; "meu livro" numa conversa comum não dispara busca.
  const m = q.match(/(?:livros?|books?|libros?)\s+(?:de|do|da|sobre|about|by|of)\s+(.{3,60})/i) ?? q.match(/(?:autor|author|escritor)\s+(?:de|do|da|of)?\s*(.{3,60})/i); if (!m?.[1]) return "";
  const j = await get<{ docs?: { title: string; author_name?: string[]; first_publish_year?: number }[] }>(`https://openlibrary.org/search.json?limit=3&fields=title,author_name,first_publish_year&q=${encodeURIComponent(m[1])}`);
  const d = j?.docs ?? []; if (!d.length) return "";
  return "Open Library: " + d.map((b) => `"${b.title}" by ${b.author_name?.[0] ?? "?"} (${b.first_publish_year ?? "?"})`).join("; ");
}

async function country(q: string) {
  const m = q.match(/(?:pa[ií]s|country|capital|moeda|currency)\s+(?:do|da|de|of|the)?\s*([A-Za-zÀ-ÿ ]{3,30})/i); if (!m?.[1]) return "";
  const j = await get<{ name: { common: string }; capital?: string[]; population: number; region: string; languages?: Record<string, string>; currencies?: Record<string, { name: string }> }[]>(`https://restcountries.com/v3.1/name/${encodeURIComponent(m[1].trim())}?fields=name,capital,population,region,languages,currencies`);
  const c = j?.[0]; if (!c) return "";
  return `REST Countries: ${c.name.common} — capital ${c.capital?.[0]}, population ${c.population}, region ${c.region}, languages ${Object.values(c.languages ?? {}).join(", ")}, currency ${Object.values(c.currencies ?? {}).map((x) => x.name).join(", ")}`;
}

async function holidays(q: string) {
  if (!/feriado|holiday/i.test(q)) return "";
  const y = new Date().getFullYear();
  const j = await get<{ date: string; name: string }[]>(`https://brasilapi.com.br/api/feriados/v1/${y}`);
  return j ? `Brazil national holidays ${y} (BrasilAPI): ` + j.map((h) => `${h.date} ${h.name}`).join("; ") : "";
}

async function dictionary(q: string) {
  const m = q.match(/(?:what does|meaning of|define|definition of)\s+([a-z-]{2,30})/i); if (!m?.[1]) return "";
  const j = await get<{ meanings?: { partOfSpeech: string; definitions: { definition: string }[] }[] }[]>(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(m[1])}`);
  const mm = j?.[0]?.meanings?.slice(0, 2) ?? []; if (!mm.length) return "";
  return `Dictionary "${m[1]}": ` + mm.map((x) => `(${x.partOfSpeech}) ${x.definitions[0]?.definition}`).join(" ");
}

async function arxiv(q: string) {
  const m = q.match(/(?:paper|artigo cient[ií]fico|pesquisa cient[ií]fica|arxiv|estudo sobre|research on)\s+(.{3,60})/i); if (!m?.[1]) return "";
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 2500);
  try {
    const r = await fetch(`https://export.arxiv.org/api/query?max_results=3&search_query=all:${encodeURIComponent(m[1])}`, { signal: ctrl.signal });
    const xml = await r.text();
    const titles = [...xml.matchAll(/<entry>[\s\S]*?<title>([\s\S]*?)<\/title>/g)].map((x) => x[1]?.replace(/\s+/g, " ").trim()).filter(Boolean);
    return titles.length ? "ArXiv papers: " + titles.join("; ") : "";
  } catch { return ""; } finally { clearTimeout(t); }
}

/** Runs every relevant free source in parallel; returns compact facts (or "" when nothing applies). */
export async function publicContext(text: string, lang: Lang): Promise<string> {
  const q = text.replace(/[?!¿¡]/g, " ").trim();
  const parts = await Promise.all([currency(q), cep(q), cnpj(q), weather(q, lang), books(q), country(q), holidays(q), dictionary(q), arxiv(q)].map((p) => p.catch(() => "")));
  const facts = parts.filter(Boolean);
  // Wikipédia só para perguntas de fato ("quem foi", "o que é"...), não para toda conversa: poupa tempo e tokens.
  const FACT_Q = /\b(quem (é|foi|era|são)|o que (é|são|foi)|what (is|are|was)|who (is|was)|qu[eé] (es|son)|qui[eé]n (es|fue)|quando (foi|nasceu|morreu)|onde (fica|nasceu)|capital d|hist[oó]ria d|significado d|meaning of)\b/i;
  if (!facts.length && FACT_Q.test(q)) { const w = await wikipedia(q.replace(/\./g, ""), lang); if (w) facts.push(w); }
  return facts.join("\n").slice(0, 1800);
}
