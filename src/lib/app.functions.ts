import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { onboardingSchema } from "@/lib/onboarding-schema";

export const getMe = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { TRIAL_MESSAGE_LIMIT } = await import("@/lib/ai.server");
    const { data: profile } = await context.supabase.from("profiles").select("*").eq("id", context.userId).single();
    const { data: key } = await supabaseAdmin.from("user_api_keys").select("openrouter_key").eq("user_id", context.userId).maybeSingle();
    const { count } = await supabaseAdmin
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("user_id", context.userId)
      .eq("role", "user");
    const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
    return {
      profile,
      hasKey: !!key?.openrouter_key,
      keyPreview: key?.openrouter_key ? `…${key.openrouter_key.slice(-4)}` : null,
      used: count ?? 0,
      trialLimit: TRIAL_MESSAGE_LIMIT,
      isAdmin: !!isAdmin,
    };
  });

export const getHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data } = await context.supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(60);
    return (data ?? []).reverse();
  });

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => onboardingSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const ai = await import("@/lib/ai.server");
    const { data: existing, error: existingError } = await context.supabase.from("profiles").select("onboarded, welcome_message").eq("id", context.userId).single();
    if (existingError) throw new Error("Your profile could not be loaded. Please try again.");
    if (existing.onboarded) return { greeting: existing.welcome_message ?? `Welcome back, ${data.fullName}.` };
    const { data: profile } = await supabaseAdmin.from("profiles").select("plan").eq("id", context.userId).single();
    let engine: Awaited<ReturnType<typeof ai.resolveEngine>>;
    try {
      engine = await ai.resolveEngine(context.userId, profile?.plan ?? "trial");
    } catch {
      engine = { kind: "lovable" };
    }
    const first = data.fullName.split(" ")[0];
    const fallback = `# Bem-vindo, ${first}! ✨\n\nEu sou a Chequetto, criada pelo Sandro, um escritor de Cachoeiro de Itapemirim que aprendeu a programar depois dos 60. Prometo boas respostas e piadas razoáveis. Vamos começar?`;
    let greeting = fallback;
    try {
      const { CHEQUETTO_IDENTITY } = await import("@/lib/chequetto-persona");
      const out = await Promise.race([
        ai.completeText(
      engine,
      `${CHEQUETTO_IDENTITY}
You are meeting this person for the very first time. Write in the language with code "${data.language}". Use markdown with a few short headings. About 250-350 words.`,
      `Create an unforgettable, deeply personal first greeting for:
Full name: ${data.fullName}
Birth date: ${data.birthDate}
City: ${data.city}

Include:
1. A celebratory welcome using their first name.
2. "The meaning of your name": the etymology/origin and meaning of their first name (and surname if notable) — be accurate; if uncertain, say what it evokes.
3. "Your archetype": a poetic personality reading from their birth date (zodiac sign, life-path number computed from the date, season of birth) — present it as symbolic, not scientific.
4. An honoring line about ${data.city} — something genuine about its spirit or history.
5. A surprising, magical insight that feels made only for them.
6. Close by declaring: you are Chequetto, their partner for life, ready to solve any challenge with them.`,
    ),
        new Promise<string>((r) => setTimeout(() => r(""), 12000)),
      ]);
      if (out && out.trim()) greeting = out;
    } catch (e) {
      console.error("greeting failed, using fallback", e);
    }
    const { error: saveError } = await supabaseAdmin.from("profiles").update({ full_name: data.fullName, birth_date: data.birthDate, city: data.city, language: data.language, welcome_message: greeting, onboarded: true }).eq("id", context.userId);
    if (saveError) throw new Error("Your profile could not be saved. Please try again.");
    const { error: messageError } = await supabaseAdmin.from("chat_messages").insert({ user_id: context.userId, role: "assistant", content: greeting });
    if (messageError) console.error("Welcome message could not be added to history");
    return { greeting };
  });

export const setLanguage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ language: z.string().max(20) }).parse(d))
  .handler(async ({ data, context }) => {
    await context.supabase.from("profiles").update({ language: data.language }).eq("id", context.userId);
    return { ok: true };
  });

export const saveByokKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ key: z.string().trim().max(300) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    if (!data.key) {
      await supabaseAdmin.from("user_api_keys").delete().eq("user_id", context.userId);
      return { ok: true };
    }
    const check = await fetch("https://openrouter.ai/api/v1/key", { headers: { Authorization: `Bearer ${data.key}` } });
    if (!check.ok) throw new Error("OpenRouter rejected this key. Please double-check it.");
    await supabaseAdmin.from("user_api_keys").upsert({ user_id: context.userId, openrouter_key: data.key, updated_at: new Date().toISOString() });
    return { ok: true };
  });

export const redeemLicense = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ code: z.string().trim().toUpperCase().min(6).max(64) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: lic } = await supabaseAdmin
      .from("licenses")
      .update({ redeemed_by: context.userId, redeemed_at: new Date().toISOString() })
      .eq("code", data.code)
      .is("redeemed_by", null)
      .select()
      .maybeSingle();
    if (!lic) throw new Error("This code is invalid or has already been redeemed.");
    await supabaseAdmin.from("profiles").update({ plan: "lifetime" }).eq("id", context.userId);
    return { ok: true };
  });

export const translateUi = createServerFn({ method: "POST" })
  .inputValidator((d) => z.object({ language: z.string().max(20), strings: z.record(z.string(), z.string()) }).parse(d))
  .handler(async ({ data }) => {
    const ai = await import("@/lib/ai.server");
    const out = await ai.completeText(
      { kind: "lovable" },
      "You translate app interface strings. Return ONLY a JSON object with the same keys and translated values. Keep the brand name Chequetto unchanged. Keep {placeholders} unchanged.",
      `Translate to the language with code "${data.language}". Return JSON:\n${JSON.stringify(data.strings)}`,
    );
    const match = out.match(/\{[\s\S]*\}/);
    try {
      const parsed = JSON.parse(match?.[0] ?? "{}") as Record<string, unknown>;
      const clean: Record<string, string> = {};
      for (const k of Object.keys(data.strings)) clean[k] = typeof parsed[k] === "string" ? (parsed[k] as string) : (data.strings[k] ?? "");
      return clean;
    } catch {
      return data.strings;
    }
  });
