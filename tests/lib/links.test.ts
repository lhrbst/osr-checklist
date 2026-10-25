import { describe, expect, it } from "vitest";
import { pageUrl, pdfLink, pickLang } from "../../src/lib/links";

describe("pdfLink", () => {
  it("appends the page fragment", () => {
    expect(pdfLink("https://x/a.pdf", 15)).toBe("https://x/a.pdf#page=15");
  });
});

describe("pageUrl", () => {
  it("builds lang/edition/category under the base", () => {
    expect(pageUrl("/osr-checklist/", "de", "2027-v2", "osr3")).toBe("/osr-checklist/de/2027-v2/osr3/");
    expect(pageUrl("/", "en", "2026-v1", "osr3-liferaft")).toBe("/en/2026-v1/osr3-liferaft/");
  });
});

describe("pickLang", () => {
  it.each(["de", "de-AT", "de-CH", "de-DE"])("maps %s to German", (l) => {
    expect(pickLang(l)).toBe("de");
  });

  it.each(["en-GB", "fr", "", undefined])("maps %s to English", (l) => {
    expect(pickLang(l)).toBe("en");
  });
});
