import { createFileRoute, Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { claimOwner, generateLicenses, getAdminData, saveKeyPool, saveSettings, setUserPlan } from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/_authenticated/sanctum")({
  head: () => ({
    meta: [
      { title: "Chequetto" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Chequetto" },
      { property: "og:title", content: "Chequetto" },
      { property: "og:description", content: "Chequetto" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Sanctum,
});

function Sanctum() {
  const claim = useServerFn(claimOwner);
  const [state, setState] = useState<"loading" | "denied" | "ok">("loading");
  useEffect(() => {
    claim().then((r) => setState(r.admin ? "ok" : "denied")).catch(() => setState("denied"));
  }, [claim]);
  if (state === "loading") return <div className="p-10 text-muted-foreground">…</div>;
  if (state === "denied")
    return (
      <div className="flex min-h-screen items-center justify-center text-muted-foreground">
        404 · <Link to="/" className="ms-2 underline">Home</Link>
      </div>
    );
  return <Panel />;
}

function Panel() {
  const data = useQuery({ queryKey: ["admin"], queryFn: useServerFn(getAdminData) });
  const save = useServerFn(saveSettings);
  const savePool = useServerFn(saveKeyPool);
  const gen = useServerFn(generateLicenses);
  const setPlan = useServerFn(setUserPlan);
  const s = data.data?.settings;

  const [email, setEmail] = useState("");
  const [drafts, setDrafts] = useState("");
  const [refine, setRefine] = useState("");
  const [pool, setPool] = useState<{ value: string; keep: boolean }[]>([]);
  const [count, setCount] = useState(10);
  const [newCodes, setNewCodes] = useState<string[]>([]);

  useEffect(() => {
    if (!s) return;
    setEmail(s.admin_email ?? "");
    setDrafts(s.draft_models.join("\n"));
    setRefine(s.refine_model);
    setPool(Array.from({ length: 30 }, (_, i) => ({ value: "", keep: !!s.openrouter_keys[i] })));
  }, [s]);

  async function run(fn: () => Promise<unknown>, msg = "Saved") {
    try {
      await fn();
      toast.success(msg);
      data.refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Error");
    }
  }

  if (!data.data) return <div className="p-10 text-muted-foreground">Loading…</div>;
  const { users, licenses } = data.data;
  const redeemed = licenses.filter((l) => l.redeemed_by).length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.3em] text-muted-foreground">Master control</p>
          <h1 className="text-gold-gradient text-5xl font-semibold">Chequetto Sanctum</h1>
        </div>
        <Link to="/chat" className="text-sm text-muted-foreground hover:text-gold">Back to chat</Link>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-4">
        {[
          ["Users", users.length],
          ["Lifetime", users.filter((u) => u.plan === "lifetime").length],
          ["Licenses redeemed", `${redeemed} / ${licenses.length}`],
          ["Pool keys", `${s?.key_count ?? 0} / 30`],
        ].map(([k, v]) => (
          <div key={k as string} className="rounded-xl border bg-card p-5">
            <p className="text-xs text-muted-foreground">{k}</p>
            <p className="mt-1 font-display text-3xl text-gold">{v}</p>
          </div>
        ))}
      </div>

      <Tabs defaultValue="licenses">
        <TabsList>
          <TabsTrigger value="licenses">Lifetime licenses</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="keys">Key pool</TabsTrigger>
          <TabsTrigger value="system">System</TabsTrigger>
        </TabsList>

        <TabsContent value="licenses" className="space-y-4 pt-4">
          <div className="flex items-end gap-2 rounded-xl border bg-card p-5">
            <div className="space-y-1.5">
              <Label htmlFor="cnt">How many codes</Label>
              <Input id="cnt" type="number" min={1} max={1000} value={count} onChange={(e) => setCount(Number(e.target.value))} className="w-32" />
            </div>
            <Button onClick={() => run(async () => setNewCodes((await gen({ data: { count } })).codes), "Codes generated")}>Generate codes</Button>
            {licenses.length > 0 && (
              <Button variant="outline" onClick={() => {
                const csv = "code,redeemed,redeemed_at\n" + licenses.map((l) => `${l.code},${l.redeemed_by ? "yes" : "no"},${l.redeemed_at ?? ""}`).join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
                a.download = "chequetto-licenses.csv";
                a.click();
              }}>Export CSV</Button>
            )}
          </div>
          {newCodes.length > 0 && (
            <textarea readOnly className="h-40 w-full rounded-xl border bg-card p-3 font-mono text-sm" value={newCodes.join("\n")} />
          )}
          <div className="max-h-[480px] overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground"><tr><th className="p-3">Code</th><th className="p-3">Status</th><th className="p-3">Redeemed by</th><th className="p-3">Date</th></tr></thead>
              <tbody>
                {licenses.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="p-3 font-mono">{l.code}</td>
                    <td className="p-3">{l.redeemed_by ? <span className="text-gold">Redeemed</span> : "Available"}</td>
                    <td className="p-3">{users.find((u) => u.id === l.redeemed_by)?.email ?? "—"}</td>
                    <td className="p-3">{l.redeemed_at ? new Date(l.redeemed_at).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="users" className="pt-4">
          <div className="max-h-[560px] overflow-auto rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted text-left text-muted-foreground"><tr><th className="p-3">Name</th><th className="p-3">Email</th><th className="p-3">City</th><th className="p-3">Lang</th><th className="p-3">Plan</th></tr></thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">{u.full_name ?? "—"}</td>
                    <td className="p-3">{u.email}</td>
                    <td className="p-3">{u.city ?? "—"}</td>
                    <td className="p-3">{u.language}</td>
                    <td className="p-3">
                      <select value={u.plan} className="rounded border bg-card px-2 py-1"
                        onChange={(e) => run(() => setPlan({ data: { userId: u.id, plan: e.target.value as "trial" | "lifetime" | "suspended" } }))}>
                        <option value="trial">trial</option><option value="lifetime">lifetime</option><option value="suspended">suspended</option>
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="keys" className="space-y-4 pt-4">
          <p className="text-sm text-muted-foreground">Up to 30 OpenRouter keys, rotated round-robin for trial users. If none are set or all fail, Chequetto uses the built-in AI. Saved keys are never shown again — leave a slot empty to keep it.</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {pool.map((k, i) => (
              <div key={i} className="flex items-center gap-2">
                <span className="w-6 text-right text-xs text-muted-foreground">{i + 1}</span>
                <Input type="password" placeholder={k.keep ? s?.openrouter_keys[i] : "sk-or-…"} value={k.value}
                  onChange={(e) => setPool(pool.map((p, j) => (j === i ? { value: e.target.value, keep: e.target.value ? false : p.keep } : p)))} />
                {k.keep && <Button size="sm" variant="ghost" onClick={() => setPool(pool.map((p, j) => (j === i ? { value: "", keep: false } : p)))}>Clear</Button>}
              </div>
            ))}
          </div>
          <Button onClick={() => run(() => savePool({ data: { keys: pool } }), "Key pool updated")}>Save key pool</Button>
        </TabsContent>

        <TabsContent value="system" className="space-y-4 pt-4">
          <div className="space-y-4 rounded-xl border bg-card p-5">
            <div className="space-y-1.5"><Label htmlFor="ae">Owner contact email (access is controlled by administrator roles)</Label><Input id="ae" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="dm">Draft models (OpenRouter IDs, one per line, max 3)</Label>
              <textarea id="dm" className="h-24 w-full rounded-md border bg-background p-2 font-mono text-sm" value={drafts} onChange={(e) => setDrafts(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="rm">Refinement model</Label><Input id="rm" value={refine} onChange={(e) => setRefine(e.target.value)} /></div>
            <Button onClick={() => run(() => save({ data: { admin_email: email, draft_models: drafts.split("\n").map((d) => d.trim()).filter(Boolean).slice(0, 3), refine_model: refine } }))}>Save system settings</Button>
          </div>
        </TabsContent>
      </Tabs>
    </main>
  );
}
