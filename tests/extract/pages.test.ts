import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { crossCheck, locatePages } from "../../scripts/extract/pages";
import type { ExtractedItem } from "../../scripts/extract/types";

const pages: string[] = JSON.parse(readFileSync("tests/fixtures/pages-mo3.json", "utf8"));
const text = { en: "x", de: "x" };
const onCard = (id: string, rules: string[]): ExtractedItem => ({
  id,
  rules,
  name: text,
  perCategory: { osr3: { section: "rigged", order: 10, cardLine: id } },
});
const pagesByCat = { osr2: [], osr3: pages, "osr3-liferaft": [], osr4: [] };

describe("locatePages", () => {
  it("finds the rule's page before Appendix F", () => {
    expect(locatePages("4.04.2", pages)).toEqual([3]);
  });

  it("does not match a longer rule number", () => {
    expect(locatePages("4.04.20", pages)).toEqual([3]);
    expect(locatePages("4.04", pages)).toEqual([]);
  });

  it("returns nothing for an absent rule", () => {
    expect(locatePages("9.99.9", pages)).toEqual([]);
  });
});

describe("crossCheck", () => {
  it("flags a card rule missing from the extract text", () => {
    const attention = crossCheck([onCard("ghost", ["9.99.9"])], pagesByCat);
    expect(attention).toContainEqual(
      expect.objectContaining({ itemId: "ghost", category: "osr3", rule: "9.99.9", message: expect.stringContaining("not found") }),
    );
  });

  it("flags a Section 4/5 rule that is on no card line", () => {
    const items = [onCard("jackstays", ["4.04.2"]), onCard("foghorn", ["4.09"])];
    const attention = crossCheck(items, pagesByCat);
    expect(attention).toContainEqual(expect.objectContaining({ category: "osr3", rule: "4.11.1", message: expect.stringContaining("no card line") }));
    expect(attention.some((a) => a.rule === "4.04.2")).toBe(false);
  });
});
