import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { loadEditionSource, loadEditionSources } from "../../scripts/extract/sources";

describe("loadEditionSource", () => {
  it("returns the edition's labels, dates and PDFs", () => {
    const source = loadEditionSource("editions.sources.yaml", "2027-v2");
    expect(source.label.en).toBe("2027 (Version 2)");
    expect(source.effectiveFrom).toEqual(new Date("2027-01-01"));
    expect(source.pdfs.osr3).toMatch(/Extract-Mo3_.*\.pdf$/);
  });

  it("names the known editions when the id is unknown", () => {
    expect(() => loadEditionSource("editions.sources.yaml", "2031-v1")).toThrow(/2031-v1.*2027-v2/);
  });
});

describe("extract workflow", () => {
  it("offers exactly the editions listed in editions.sources.yaml", () => {
    const workflow = parse(readFileSync(".github/workflows/extract-edition.yml", "utf8"));
    const options = workflow.on.workflow_dispatch.inputs.edition.options;
    expect(options).toEqual(loadEditionSources("editions.sources.yaml").map((s) => s.id));
  });
});
