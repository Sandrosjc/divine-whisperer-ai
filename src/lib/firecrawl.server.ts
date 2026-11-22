/** Optional server-side Firecrawl search. Requires FIRECRAWL_API_KEY in the hosting environment. */
const FIRECRAWL_URL = "https://api.firecrawl.dev/v2/search";

const RESEARCH_INTENT =
  /\b(pesquise|pesquisar|pesquisa|procure na internet|busque na internet|na internet|fontes atuais|not[ií]cias|hoje|atualizado|research|search the web|look up|latest|current news|current information)\b/i;

type SearchResult = { title?: string; url?: string; description?: string };

export async function firecrawlContext(question: string): Promise<string> {
  const apiKey = process.env["FIRECRAWL_API_KEY"];
  if (!apiKey || !RESEARCH_INTENT.test(question)) return "";

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const response = await fetch(FIRECRAWL_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ query: question.slice(0, 500), limit: 4 }),
      signal: controller.signal,
    });
    if (!response.ok) {
      console.error("Firecrawl search failed:", response.status);
      return "";
    }
    const payload = (await response.json()) as { success?: boolean; data?: SearchResult[] };
    const results = (payload.data ?? [])
      .filter((item) => item.title && item.url)
      .slice(0, 4)
      .map((item) => `- ${item.title}: ${(item.description ?? "").slice(0, 350)} (Source: ${item.url})`);
    return results.length
      ? `Firecrawl web search results:\n${results.join("\n")}\nUse these as source leads and never invent details beyond them.`
      : "";
  } catch (error) {
    console.error("Firecrawl search unavailable:", error);
    return "";
  } finally {
    clearTimeout(timeout);
  }
}
