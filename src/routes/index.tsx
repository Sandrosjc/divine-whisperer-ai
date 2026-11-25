import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { FirstContact } from "@/components/FirstContact";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Chequetto — Inteligência Artificial Brasileira com Personalidade" },
      { name: "description", content: "Converse com a Chequetto, a inteligência artificial brasileira criada por Sandro Chequetto para raciocínio, aprendizado e conversas com humor e personalidade." },
      { name: "keywords", content: "Chequetto, IA Chequetto, Chequetto IA, Chequetto online, Chequeto, Cheketo, inteligência artificial brasileira" },
      { property: "og:title", content: "Chequetto — Inteligência Artificial Brasileira" },
      { property: "og:description", content: "A IA brasileira com personalidade, criada por Sandro Chequetto. Converse agora em chequetto.online." },
      { property: "og:type", content: "website" },
      { property: "og:url", content: "https://www.chequetto.online/" },
      { property: "og:site_name", content: "Chequetto" },
      { property: "og:locale", content: "pt_BR" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Chequetto — Inteligência Artificial Brasileira" },
      { name: "twitter:description", content: "A IA brasileira com personalidade, criada por Sandro Chequetto." },
    ],
    links: [{ rel: "canonical", href: "https://www.chequetto.online/" }],
    scripts: [{
      type: "application/ld+json",
      children: JSON.stringify({
        "@context": "https://schema.org",
        "@graph": [
          { "@type": "WebSite", "@id": "https://www.chequetto.online/#website", url: "https://www.chequetto.online/", name: "Chequetto", alternateName: ["IA Chequetto", "Chequetto Online", "Chequeto", "Cheketo"], inLanguage: ["pt-BR", "en", "es"] },
          { "@type": "Person", "@id": "https://www.chequetto.online/#sandro", name: "Sandro Chequetto", jobTitle: "Escritor e criador da Chequetto", sameAs: ["https://clubedeautores.com.br/livros/autores/59684229000135"] },
          { "@type": "SoftwareApplication", "@id": "https://www.chequetto.online/#app", name: "Chequetto", alternateName: ["IA Chequetto", "Chequetto AI", "Chequeto", "Cheketo"], applicationCategory: "LifestyleApplication", operatingSystem: "Web", url: "https://www.chequetto.online/", description: "Inteligência artificial brasileira com personalidade, para conversas, raciocínio e aprendizado.", creator: { "@id": "https://www.chequetto.online/#sandro" }, offers: { "@type": "Offer", price: "0", priceCurrency: "BRL" } },
        ],
      }),
    }],
  }),
  component: Index,
});
function Index() {
  const navigate = useNavigate();
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard", replace: true }); }); }, [navigate]);
  return <FirstContact />;
}
