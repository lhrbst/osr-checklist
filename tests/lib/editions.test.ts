import { describe, expect, it } from "vitest";
import { inForceEdition, previousEdition } from "../../src/lib/editions";

const editions = [
  { id: "2027-v2", effectiveFrom: new Date("2027-01-01"), effectiveTo: new Date("2027-12-31") },
  { id: "2026-v1", effectiveFrom: new Date("2026-01-01"), effectiveTo: new Date("2026-12-31") },
];

describe("inForceEdition", () => {
  it("picks the edition whose range contains today", () => {
    expect(inForceEdition(editions, new Date("2026-10-25"))).toBe("2026-v1");
    expect(inForceEdition(editions, new Date("2027-01-01"))).toBe("2027-v2");
  });

  it("includes the last day of a range", () => {
    expect(inForceEdition(editions, new Date("2026-12-31T23:00:00"))).toBe("2026-v1");
  });

  it("falls back to the latest started edition after all ranges end", () => {
    expect(inForceEdition(editions, new Date("2028-03-01"))).toBe("2027-v2");
  });

  it("falls back to the earliest edition before any has started", () => {
    expect(inForceEdition(editions, new Date("2025-06-01"))).toBe("2026-v1");
  });
});

describe("previousEdition", () => {
  it("returns the edition that started just before", () => {
    expect(previousEdition(editions, "2027-v2")).toBe("2026-v1");
  });

  it("returns undefined for the first edition", () => {
    expect(previousEdition(editions, "2026-v1")).toBeUndefined();
  });
});
