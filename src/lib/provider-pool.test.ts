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
