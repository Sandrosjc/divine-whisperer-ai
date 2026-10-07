import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function assertAdmin(context: { supabase: any; userId: string }) {
  const { data } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  if (!data) throw new Error("Forbidden");
}

/** Access is granted only through an existing server-verified administrator role. */
export const claimOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return { admin: !!isAdmin };
  });

export const getAdminData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const [{ data: settings }, { data: users }, { data: licenses }] = await Promise.all([
      supabaseAdmin.from("app_settings").select("*").eq("id", 1).single(),
      supabaseAdmin.from("profiles").select("id, email, full_name, city, plan, language, created_at").order("created_at", { ascending: false }).limit(500),
      supabaseAdmin.from("licenses").select("*").order("created_at", { ascending: false }).limit(1000),
    ]);
    return {
      settings: settings && {
        ...settings,
        openrouter_keys: settings.openrouter_keys.map((k: string) => (k ? `${k.slice(0, 8)}…${k.slice(-4)}` : "")),
        key_count: settings.openrouter_keys.filter(Boolean).length,
      },
      users: users ?? [],
      licenses: licenses ?? [],
    };
  });

export const saveSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      admin_email: z.string().email().max(255),
      draft_models: z.array(z.string().max(120)).max(3),
      refine_model: z.string().min(1).max(120),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("app_settings").update({ ...data, admin_email: data.admin_email.toLowerCase(), updated_at: new Date().toISOString() }).eq("id", 1);
    return { ok: true };
  });

/** Replaces the key pool. Blank entries are kept as "unchanged" when `keep` is true for that slot. */
export const saveKeyPool = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ keys: z.array(z.object({ value: z.string().trim().max(300), keep: z.boolean() })).max(30) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: s } = await supabaseAdmin.from("app_settings").select("openrouter_keys").eq("id", 1).single();
    const old = s?.openrouter_keys ?? [];
    const next = data.keys.map((k, i) => (k.keep ? old[i] ?? "" : k.value)).filter(Boolean).slice(0, 30);
    await supabaseAdmin.from("app_settings").update({ openrouter_keys: next, rotation_index: 0 }).eq("id", 1);
    return { count: next.length };
  });

export const generateLicenses = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ count: z.number().int().min(1).max(1000) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    const seg = () => Array.from(crypto.getRandomValues(new Uint8Array(4)), (b) => alphabet[b % alphabet.length]).join("");
    const codes = Array.from({ length: data.count }, () => `CHQ-${seg()}-${seg()}-${seg()}`);
    const { error } = await supabaseAdmin.from("licenses").insert(codes.map((code) => ({ code })));
    if (error) throw new Error(error.message);
    return { codes };
  });

export const setUserPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ userId: z.string().uuid(), plan: z.enum(["trial", "lifetime", "suspended"]) }).parse(d))
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("profiles").update({ plan: data.plan }).eq("id", data.userId);
    return { ok: true };
  });
