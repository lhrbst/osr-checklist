import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { editionSchema, itemSchema } from "../../src/lib/schemas";
import { validateContent } from "../../src/lib/validate";
import { cardHash } from "../../scripts/extract/hash";
import type { PipelineResult } from "../../scripts/extract/pipeline";
import { prSummary, writeEdition } from "../../scripts/extract/write";

const text = { en: "x", de: "y" };
const result: PipelineResult = {
  edition: {
    id: "2027-v2",
    label: text,
    effectiveFrom: new Date("2027-01-01"),
    effectiveTo: new Date("2027-12-31"),
    pdfs: { osr2: "https://x/2.pdf", osr3: "https://x/3.pdf", "osr3-liferaft": "https://x/3l.pdf", osr4: "https://x/4.pdf" },
    sections: [{ id: "rigged", officialTitle: "Rigged", title: text }],
  },
  items: [
    {
      id: "foghorn",
      drawing: "foghorn",
      rules: ["4.09"],
      name: text,
      applies: { osr4: { section: "rigged", order: 10, pages: [13], cardHash: cardHash("Foghorn"), explanation: text } },
    },
  ],
  drawings: { foghorn: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"/>' },
  attention: [{ itemId: "ghost", category: "osr3", rule: "9.99.9", message: "rule 9.99.9 on card but not found in extract text" }],
  uncertain: [{ itemId: "foghorn", reason: "unsure whether OSR 4 card lists it" }],
  diff: { added: ["foghorn"], removed: ["jackstays"], changed: [], carried: [] },
};

describe("writeEdition", () => {
  it("writes files that pass the schemas and the content validation", async () => {
    const root = mkdtempSync(join(tmpdir(), "osr-write-"));
    const stale = join(root, "src/content/items/2027-v2");
    mkdirSync(stale, { recursive: true });
    writeFileSync(join(stale, "jackstays.yaml"), "stale");

    await writeEdition(root, result);

    const read = (p: string) => parse(readFileSync(join(root, p), "utf8"));
    const edition = editionSchema.parse(read("src/content/editions/2027-v2.yaml"));
    expect(readdirSync(stale)).toEqual(["foghorn.yaml"]);
    const item = itemSchema.parse(read("src/content/items/2027-v2/foghorn.yaml"));
    expect(readFileSync(join(root, "src/content/editions/2027-v2.yaml"), "utf8")).toContain("effectiveFrom: 2027-01-01\n");
    expect(
      validateContent({ editions: [edition], items: [{ edition: "2027-v2", item }], drawingIds: new Set(["foghorn"]) }),
    ).toEqual([]);
    expect(readFileSync(join(root, "src/content/drawings/foghorn.svg"), "utf8")).toContain("<svg");
  });
});

describe("prSummary", () => {
  it("puts items needing attention first, then the diff and the review guide", () => {
    const md = prSummary(result, "2027-v2");
    expect(md.indexOf("Needs attention")).toBeGreaterThan(-1);
    expect(md.indexOf("Needs attention")).toBeLessThan(md.indexOf("Added"));
    expect(md).toContain("9.99.9");
    expect(md).toContain("unsure whether OSR 4 card lists it");
    expect(md).toContain("REVIEW.md");
  });
});
