import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { Category, Localized } from "../../src/lib/categories";
import type { Item } from "../../src/lib/schemas";
import { cardHash } from "../../scripts/extract/hash";
import { runPipeline, type Deps } from "../../scripts/extract/pipeline";
import type { ExtractedItem, Extraction } from "../../scripts/extract/types";

const pages: string[] = JSON.parse(readFileSync("tests/fixtures/pages-mo3.json", "utf8"));
const pagesByCat: Record<Category, string[]> = { osr2: pages, osr3: pages, "osr3-liferaft": pages, osr4: pages };
const pdf = Buffer.from("");
const pdfs = { osr2: pdf, osr3: pdf, "osr3-liferaft": pdf, osr4: pdf };
const edition = {
  id: "2027-v2",
  label: { en: "2027", de: "2027" },
  effectiveFrom: new Date("2027-01-01"),
  effectiveTo: new Date("2027-12-31"),
  pdfs: { osr2: "https://x/2.pdf", osr3: "https://x/3.pdf", "osr3-liferaft": "https://x/3l.pdf", osr4: "https://x/4.pdf" },
};
const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><path d="M0 0L9 9" stroke="currentColor"/></svg>';
const text = (s: string): Localized => ({ en: `${s} en`, de: `${s} de` });

const extracted = (id: string, rules: string[], lines: Partial<Record<Category, string>>, order = 10): ExtractedItem => ({
  id,
  rules,
  name: text(id),
  perCategory: Object.fromEntries(
    Object.entries(lines).map(([cat, cardLine]) => [cat, { section: "rigged", order, cardLine }]),
  ),
});

const extraction = (items: ExtractedItem[]): Extraction => ({
  sections: [{ id: "rigged", officialTitle: "Rigged/Fitted to Demonstrate Use", title: text("rigged") }],
  items,
});

const previousJackstays: Item = {
  id: "jackstays",
  drawing: "jackstays",
  rules: ["4.04.2"],
  name: text("jackstays"),
  applies: {
    osr2: { section: "rigged", order: 10, pages: [3], cardHash: cardHash("Jack stays each side"), explanation: text("old osr2") },
    osr3: { section: "rigged", order: 10, pages: [3], cardHash: cardHash("Jack stays each side"), explanation: text("old osr3") },
  },
};

function fakeDeps(result: Extraction, overrides: Partial<Deps> = {}) {
  const calls = { explanations: [] as { id: string; categories: string[] }[], drawings: [] as string[] };
  const deps: Deps = {
    extractStructure: async () => result,
    generateExplanations: async (item, ruleTextByCat) => {
      const categories = Object.keys(ruleTextByCat);
      calls.explanations.push({ id: item.id, categories });
      return Object.fromEntries(categories.map((c) => [c, text(`new ${c}`)]));
    },
    generateDrawing: async (item) => {
      calls.drawings.push(item.id);
      return SVG;
    },
    existingDrawings: new Set(["jackstays"]),
    ...overrides,
  };
  return { deps, calls };
}

const run = (deps: Deps, previousItems: Item[] = [previousJackstays]) =>
  runPipeline({ edition, pdfs, pagesByCat, previousItems }, deps);

describe("runPipeline", () => {
  it("carries over unchanged explanations and regenerates only changed categories", async () => {
    const { deps, calls } = fakeDeps(
      extraction([extracted("jackstays", ["4.04.2"], { osr2: "Jack stays each side, stricter", osr3: "Jack stays each side" })]),
    );
    const result = await run(deps);
    const item = result.items.find((i) => i.id === "jackstays")!;
    expect(item.applies.osr3!.explanation).toEqual(text("old osr3"));
    expect(item.applies.osr2!.explanation).toEqual(text("new osr2"));
    expect(calls.explanations).toEqual([{ id: "jackstays", categories: ["osr2"] }]);
    expect(result.diff.changed).toEqual(["jackstays"]);
  });

  it("lists a fully unchanged item as carried over", async () => {
    const { deps, calls } = fakeDeps(
      extraction([extracted("jackstays", ["4.04.2"], { osr2: "Jack stays each side", osr3: "Jack stays each side" })]),
    );
    const result = await run(deps);
    expect(calls.explanations).toEqual([]);
    expect(result.diff.carried).toEqual(["jackstays"]);
  });

  it("generates drawings only for new ids", async () => {
    const { deps, calls } = fakeDeps(
      extraction([extracted("jackstays", ["4.04.2"], { osr3: "a" }), extracted("foghorn", ["4.09"], { osr3: "Foghorn" }, 20)]),
    );
    const result = await run(deps);
    expect(calls.drawings).toEqual(["foghorn"]);
    expect(result.drawings.foghorn).toContain("<svg");
    expect(result.items.find((i) => i.id === "foghorn")!.drawing).toBe("foghorn");
  });

  it("falls back to the placeholder and flags an unsafe drawing", async () => {
    const { deps } = fakeDeps(extraction([extracted("foghorn", ["4.09"], { osr3: "Foghorn" })]), {
      generateDrawing: async () => '<svg xmlns="http://www.w3.org/2000/svg"><script>x</script></svg>',
    });
    const result = await run(deps, []);
    expect(result.items[0].drawing).toBe("placeholder");
    expect(result.drawings.foghorn).toBeUndefined();
    expect(result.attention.some((a) => a.itemId === "foghorn" && a.message.startsWith("drawing rejected"))).toBe(true);
  });

  it("takes pages from the extract text, and flags a rule it cannot find", async () => {
    const { deps } = fakeDeps(
      extraction([extracted("jackstays", ["4.04.2", "4.09"], { osr3: "a" }), extracted("ghost", ["9.99.9"], { osr3: "b" }, 20)]),
    );
    const result = await run(deps, []);
    expect(result.items.find((i) => i.id === "jackstays")!.applies.osr3!.pages).toEqual([3]);
    expect(result.items.find((i) => i.id === "ghost")!.applies.osr3!.pages).toEqual([1]);
    expect(result.attention.some((a) => a.itemId === "ghost" && a.message.includes("no page"))).toBe(true);
  });

  it("keeps two items with the same rule numbers apart", async () => {
    const { deps } = fakeDeps(
      extraction([
        extracted("jackstays-each-side", ["4.04.2"], { osr3: "independent each side" }),
        extracted("jackstays-move-clipped", ["4.04.2"], { osr3: "move while clipped" }, 20),
      ]),
    );
    const result = await run(deps, []);
    expect(result.items.map((i) => i.id)).toEqual(["jackstays-each-side", "jackstays-move-clipped"]);
  });

  it("computes added and removed ids against the previous edition", async () => {
    const { deps } = fakeDeps(extraction([extracted("foghorn", ["4.09"], { osr3: "Foghorn" })]));
    const result = await run(deps);
    expect(result.diff.added).toEqual(["foghorn"]);
    expect(result.diff.removed).toEqual(["jackstays"]);
  });

  it("never stores the card wording", async () => {
    const { deps } = fakeDeps(extraction([extracted("foghorn", ["4.09"], { osr3: "Secret card wording" })]));
    const result = await run(deps, []);
    expect(JSON.stringify(result.items)).not.toContain("Secret card wording");
  });

  it("turns content validation errors into attention lines", async () => {
    const { deps } = fakeDeps(
      extraction([extracted("a-one", ["4.09"], { osr3: "x" }), extracted("a-two", ["4.04.2"], { osr3: "y" })]),
    );
    const result = await run(deps, []);
    expect(result.attention.some((a) => a.message.includes("order 10"))).toBe(true);
  });
});
