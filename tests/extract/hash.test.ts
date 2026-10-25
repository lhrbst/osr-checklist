import { describe, expect, it } from "vitest";
import { cardHash } from "../../scripts/extract/hash";

describe("cardHash", () => {
  it("ignores case, rule numbers and whitespace", () => {
    expect(cardHash("Jackstays 4.04.2  per side")).toBe(cardHash("jackstays per side"));
  });

  it("has the sha256 prefix and a 64-character hex digest", () => {
    expect(cardHash("Foghorn")).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(cardHash("Foghorn")).toHaveLength(71);
  });

  it("changes when the wording changes", () => {
    expect(cardHash("Foghorn")).not.toBe(cardHash("Fog horn, electric"));
  });
});
