import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { editionSchema, itemSchema, type Edition, type Item } from "../../src/lib/schemas";
import { validateContent } from "../../src/lib/validate";

const edition = (): Edition =>
  editionSchema.parse(parse(readFileSync("src/content/editions/2027-v2.yaml", "utf8")));
const item = (id: string): Item =>
  itemSchema.parse(parse(readFileSync(`src/content/items/2027-v2/${id}.yaml`, "utf8")));

const valid = () => ({
  editions: [edition()],
  items: [
    { edition: "2027-v2", item: item("jackstays") },
    { edition: "2027-v2", item: item("foghorn") },
  ],
  drawingIds: new Set(["jackstays", "foghorn"]),
});

describe("validateContent", () => {
  it("accepts the seed content", () => {
    expect(validateContent(valid())).toEqual([]);
  });

  it("reports an unknown section with item id and category", () => {
    const input = valid();
    input.items[0].item.applies.osr3!.section = "nowhere";
    const errors = validateContent(input);
    expect(errors.some((e) => e.includes("jackstays") && e.includes("osr3") && e.includes("nowhere"))).toBe(true);
  });

  it("reports an item whose edition has no manifest", () => {
    const input = valid();
    input.items[1].edition = "2030-v1";
    expect(validateContent(input).some((e) => e.includes("foghorn") && e.includes("2030-v1"))).toBe(true);
  });

  it("reports a missing drawing", () => {
    const input = valid();
    input.drawingIds.delete("foghorn");
    expect(validateContent(input).some((e) => e.includes("foghorn") && e.includes("drawing"))).toBe(true);
  });

  it("reports an empty German explanation", () => {
    const input = valid();
    input.items[0].item.applies.osr2!.explanation.de = "";
    expect(validateContent(input).some((e) => e.includes("jackstays") && e.includes("osr2") && e.includes("de"))).toBe(
      true,
    );
  });

  it("reports duplicate order within edition, category and section", () => {
    const input = valid();
    const fog = input.items[1].item.applies.osr3!;
    fog.section = "rigged";
    fog.order = 40;
    expect(validateContent(input).some((e) => e.includes("order 40") && e.includes("osr3"))).toBe(true);
  });
});

describe("validateContent placeholders", () => {
  it("rejects the pipeline's missing-explanation placeholder", async () => {
    const { MISSING_EXPLANATION } = await import("../../src/lib/validate");
    const input = valid();
    input.items[0].item.applies.osr3!.explanation = { ...MISSING_EXPLANATION };
    expect(validateContent(input).some((e) => e.includes("jackstays") && e.includes("placeholder"))).toBe(true);
  });
});
