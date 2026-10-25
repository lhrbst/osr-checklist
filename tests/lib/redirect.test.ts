import { describe, expect, it } from "vitest";
import { redirectTarget } from "../../src/lib/redirect";

const editions = [
  { id: "2026-v1", effectiveFrom: "2026-01-01", effectiveTo: "2026-12-31" },
  { id: "2027-v2", effectiveFrom: "2027-01-01", effectiveTo: "2027-12-31" },
];

describe("redirectTarget", () => {
  it("uses the browser language and the edition in force", () => {
    expect(redirectTarget({ editions, today: new Date("2026-10-25"), base: "/b/", navigatorLanguage: "de-AT" })).toBe(
      "/b/de/2026-v1/osr3/",
    );
  });

  it("uses a fixed language when given", () => {
    expect(redirectTarget({ editions, today: new Date("2027-02-01"), base: "/", navigatorLanguage: "de", lang: "en" })).toBe(
      "/en/2027-v2/osr3/",
    );
  });
});
