import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { CATEGORIES, CATEGORY_LABEL } from "../../src/lib/categories";
import { editionSchema, itemSchema } from "../../src/lib/schemas";

const readYaml = (path: string) => parse(readFileSync(path, "utf8"));
const seedItem = () => readYaml("tests/fixtures/content/jackstays.yaml");

describe("categories", () => {
  it("lists the four monohull categories in order", () => {
    expect(CATEGORIES).toEqual(["osr2", "osr3", "osr3-liferaft", "osr4"]);
  });

  it("has an English and German label for every category", () => {
    for (const cat of CATEGORIES) {
      expect(CATEGORY_LABEL[cat].en).not.toBe("");
      expect(CATEGORY_LABEL[cat].de).not.toBe("");
    }
  });
});

describe("itemSchema", () => {
  it("accepts the seed jackstays item", () => {
    expect(itemSchema.safeParse(seedItem()).success).toBe(true);
  });

  it("rejects a malformed rule number", () => {
    expect(itemSchema.safeParse({ ...seedItem(), rules: ["4-04"] }).success).toBe(false);
  });

  it("rejects a category entry without pages", () => {
    const item = seedItem();
    item.applies.osr3.pages = [];
    expect(itemSchema.safeParse(item).success).toBe(false);
  });

  it("rejects an item that applies to no category", () => {
    expect(itemSchema.safeParse({ ...seedItem(), applies: {} }).success).toBe(false);
  });
});

describe("editionSchema", () => {
  it("accepts the seed 2027-v2 manifest", () => {
    expect(editionSchema.safeParse(readYaml("tests/fixtures/content/edition-2027-v2.yaml")).success).toBe(true);
  });
});
