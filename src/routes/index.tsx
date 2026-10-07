import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Workspace } from "@/components/Workspace";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "Chequetto — Your personal AI workspace" },
    { name: "description", content: "A personal AI workspace for clearer thinking, better writing and meaningful conversations." },
    { property: "og:title", content: "Chequetto — Your personal AI workspace" },
    { property: "og:description", content: "Bring your ideas, questions and plans to life with Chequetto." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary_large_image" },
  ] }), component: Index,
});
function Index() {
  const navigate = useNavigate();
  useEffect(() => { supabase.auth.getSession().then(({ data }) => { if (data.session) navigate({ to: "/dashboard", replace: true }); }); }, [navigate]);
  return <Workspace />;
}
