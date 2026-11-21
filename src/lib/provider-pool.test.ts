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
