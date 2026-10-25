import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { editionSchema, itemSchema } from "./lib/schemas";

const editions = defineCollection({
  loader: glob({ pattern: "*.yaml", base: "./src/content/editions" }),
  schema: editionSchema,
});

const items = defineCollection({
  loader: glob({ pattern: "**/*.yaml", base: "./src/content/items" }),
  schema: itemSchema,
});

export const collections = { editions, items };
