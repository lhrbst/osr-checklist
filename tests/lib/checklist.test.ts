import { describe, expect, it } from "vitest";
import { buildChecklist } from "../../src/lib/checklist";
import type { Edition, Item } from "../../src/lib/schemas";

const text = { en: "x", de: "x" };
const hash = "sha256:" + "0".repeat(64);
const entry = (section: string, order: number) => ({ section, order, pages: [1], cardHash: hash, explanation: text });

const edition: Edition = {
  id: "2027-v2",
  label: text,
  effectiveFrom: new Date("2027-01-01"),
  effectiveTo: new Date("2027-12-31"),
  pdfs: { osr2: "https://x/2.pdf", osr3: "https://x/3.pdf", "osr3-liferaft": "https://x/3l.pdf", osr4: "https://x/4.pdf" },
  sections: [
    { id: "grab-bag", title: text, officialTitle: "Grab Bag" },
    { id: "deck", title: text, officialTitle: "On Deck" },
  ],
};

const item = (id: string, applies: Item["applies"]): Item => ({ id, drawing: id, rules: ["4.01"], name: text, applies });

const items = [
  item("knife", { osr2: entry("grab-bag", 10) }),
  item("anchor", { osr2: entry("deck", 20), osr4: entry("deck", 10) }),
  item("radar", { osr2: entry("deck", 10), osr4: entry("deck", 20) }),
];

describe("buildChecklist", () => {
  it("keeps manifest section order and sorts items by order", () => {
    const result = buildChecklist(edition, items, "osr2");
    expect(result.map((s) => s.section.id)).toEqual(["grab-bag", "deck"]);
    expect(result[1].items.map((i) => i.id)).toEqual(["radar", "anchor"]);
  });

  it("uses the order of the requested category", () => {
    const result = buildChecklist(edition, items, "osr4");
    expect(result[0].items.map((i) => i.id)).toEqual(["anchor", "radar"]);
  });

  it("omits sections without items for the category", () => {
    expect(buildChecklist(edition, items, "osr4").map((s) => s.section.id)).toEqual(["deck"]);
  });

  it("excludes items that do not apply to the category", () => {
    expect(buildChecklist(edition, items, "osr3")).toEqual([]);
  });
});
