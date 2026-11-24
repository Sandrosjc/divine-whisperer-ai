import { expect, test } from "vitest";
import { compress, interleave, keysFor } from "./provider-pool.server";
test("numbered keys detected in order", () => {
  const env = { MISTRAL_API_KEY_2: "bbbbbbbbbbbbbb", MISTRAL_API_KEY_1: "aaaaaaaaaaaaaa", GEMINI_API_1: "gggggggggggggg" };
  const p = { id: "m", match: /^MISTRAL_API(_KEYS?)?(_\d+)?$/, url: "", model: "" };
  expect(keysFor(p, env)).toEqual(["aaaaaaaaaaaaaa", "bbbbbbbbbbbbbb"]);
});
test("compress keeps last 6", () => {
  const m = Array.from({ length: 10 }, (_, i) => ({ role: "user" as const, content: "x" + i }));
  expect(compress(m).length).toBe(7);
});

test("compress starts with a user message and merges system notes", () => {
  const m = [
    { role: "system" as const, content: "sys" },
    ...Array.from({ length: 12 }, (_, i) => ({ role: i % 2 === 0 ? ("assistant" as const) : ("user" as const), content: "m" + i })),
  ];
  const out = compress(m);
  expect(out.filter((x) => x.role === "system").length).toBe(1);
  expect(out.find((x) => x.role !== "system")?.role).toBe("user");
});

test("poolComplete sends a valid conversation to the provider (mocked)", async () => {
  const { poolComplete } = await import("./provider-pool.server");
  process.env["GROQ_API_KEY"] = "gsk_testtesttesttest";
  let sent: { messages: { role: string }[] } | null = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: unknown, init?: { body?: string }) => {
    sent = JSON.parse(init?.body ?? "{}");
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const msgs = [
      { role: "system" as const, content: "sys" },
      ...Array.from({ length: 14 }, (_, i) => ({ role: i % 2 === 0 ? ("assistant" as const) : ("user" as const), content: "m" + i })),
    ];
    const r = await poolComplete(msgs);
    expect(r?.text).toBe("ok");
    const roles = (sent as unknown as { messages: { role: string }[] }).messages.map((m) => m.role);
    expect(roles[0]).toBe("system");
    expect(roles[1]).toBe("user");
    expect(roles.filter((x) => x === "system").length).toBe(1);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env["GROQ_API_KEY"];
  }
});

test("poolComplete does not cut a long single request when maxChars is raised", async () => {
  const { poolComplete } = await import("./provider-pool.server");
  process.env["MISTRAL_API_KEY"] = "mistraltesttesttest";
  let sent: { messages: { role: string; content: string }[] } | null = null;
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: unknown, init?: { body?: string }) => {
    sent = JSON.parse(init?.body ?? "{}");
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok" } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const long = "x".repeat(5000);
    await poolComplete([{ role: "system", content: "s" }, { role: "user", content: long }], 900, 12000);
    const user = (sent as unknown as { messages: { role: string; content: string }[] }).messages.find((m) => m.role === "user");
    expect(user?.content.length).toBe(5000);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env["MISTRAL_API_KEY"];
  }
});

test("cleanKey and parseKeys handle pasted formats", async () => {
  const { cleanKey, parseKeys, keysFor } = await import("./provider-pool.server");
  expect(cleanKey('"AIzaSyABCDEFGHIJKL"')).toBe("AIzaSyABCDEFGHIJKL");
  expect(cleanKey("GEMINI_API_KEY=AIzaSyABCDEFGHIJKL")).toBe("AIzaSyABCDEFGHIJKL");
  expect(cleanKey("Bearer gsk_abcdefghijklmnop")).toBe("gsk_abcdefghijklmnop");
  expect(cleanKey("abcdefghijklmnopqrstuvwx==")).toBe("abcdefghijklmnopqrstuvwx==");
  expect(parseKeys("k1_aaaaaaaaaaaa, 'k2_bbbbbbbbbbbb'")).toEqual(["k1_aaaaaaaaaaaa", "k2_bbbbbbbbbbbb"]);
  const names = {
    GEMINI_API_KEY: "g1_aaaaaaaaaaaa", GOOGLE_API_KEY: "g2_aaaaaaaaaaaa", GEMINI_KEY_2: "g3_aaaaaaaaaaaa",
    GROQ_KEY: "q1_aaaaaaaaaaaa", MISTRAL_KEY: "m1_aaaaaaaaaaaa", OPENROUTER_KEY: "o1_aaaaaaaaaaaa", GOOGLE_DRIVE_CLIENT_ID: "nao_entra_aaaaaaaa",
  };
  const providersMod = await import("./provider-pool.server");
  const rep = providersMod.providerReport; void rep;
  const env = names as Record<string, string>;
  // usa o relatório com um env simulado
  const saved = { ...process.env };
  Object.assign(process.env, env);
  try {
    const r = providersMod.providerReport();
    const by = Object.fromEntries(r.map((x) => [x.provider, x.keys]));
    expect(by["gemini"]).toBe(3);
    expect(by["groq"]).toBe(1);
    expect(by["mistral"]).toBe(1);
    expect(by["openrouter"]).toBe(1);
  } finally {
    for (const k of Object.keys(env)) delete process.env[k];
    Object.assign(process.env, saved);
  }
  void keysFor;
});

test("pool switches to the next model when the provider says the model is gone, and remembers it", async () => {
  const { poolComplete } = await import("./provider-pool.server");
  process.env["GROQ_API_KEY"] = "gsk_modeltesttesttest";
  const seen: string[] = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = (async (_u: unknown, init?: { body?: string }) => {
    const model = JSON.parse(init?.body ?? "{}").model as string;
    seen.push(model);
    if (model === "openai/gpt-oss-120b") return new Response('{"error":{"message":"The model does not exist"}}', { status: 404 });
    return new Response(JSON.stringify({ choices: [{ message: { content: "ok:" + model } }] }), { status: 200 });
  }) as typeof fetch;
  try {
    const r1 = await poolComplete([{ role: "system", content: "s" }, { role: "user", content: "oi" }]);
    expect(r1?.text).toBe("ok:openai/gpt-oss-20b");
    expect(seen).toEqual(["openai/gpt-oss-120b", "openai/gpt-oss-20b"]);
    seen.length = 0;
    const r2 = await poolComplete([{ role: "system", content: "s" }, { role: "user", content: "oi de novo" }]);
    expect(r2?.text).toBe("ok:openai/gpt-oss-20b");
    expect(seen).toEqual(["openai/gpt-oss-20b"]);
  } finally {
    globalThis.fetch = realFetch;
    delete process.env["GROQ_API_KEY"];
  }
});
