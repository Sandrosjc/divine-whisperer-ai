import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { Workspace } from "@/components/Workspace";
import { getMe, getHistory } from "@/lib/app.functions";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [
    { title: "My workspace — Chequetto" },
    { name: "description", content: "Your personal Chequetto workspace for ideas, conversations and clarity." },
    { property: "og:title", content: "My workspace — Chequetto" },
    { property: "og:description", content: "Your personal workspace for ideas, conversations and clarity." },
    { property: "og:type", content: "website" }, { name: "twitter:card", content: "summary" },
  ] }), component: Dashboard,
});
function Dashboard() {
  const navigate = useNavigate();
  const me = useQuery({ queryKey: ["me"], queryFn: useServerFn(getMe) });
  const history = useQuery({ queryKey: ["history"], queryFn: useServerFn(getHistory) });
  useEffect(() => { if (me.data && !me.data.profile?.onboarded) navigate({ to: "/onboarding" }); }, [me.data, navigate]);
  if (me.isError) return <main className="flex min-h-screen flex-col items-center justify-center gap-4"><p>Your workspace could not be loaded.</p><Button onClick={() => me.refetch()}>Try again</Button></main>;
  if (!me.data?.profile?.onboarded) return <div className="flex min-h-screen items-center justify-center"><span className="animate-pulse text-muted-foreground">Chequetto…</span></div>;
  return <Workspace signedIn profile={me.data.profile} history={history.data ?? []} used={me.data.used} trialLimit={me.data.trialLimit} />;
}