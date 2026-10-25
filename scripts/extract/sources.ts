import { readFileSync } from "node:fs";
import { parse } from "yaml";
import { editionSchema, type Edition } from "../../src/lib/schemas";

export type EditionSource = Omit<Edition, "sections">;

const sourceSchema = editionSchema.omit({ sections: true });

/** All editions in the sources file (see editions.sources.yaml). */
export function loadEditionSources(path: string): EditionSource[] {
  const raw: unknown = parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) throw new Error(`${path}: expected a list of editions`);
  return raw.map((entry) => sourceSchema.parse(entry));
}

export function loadEditionSource(path: string, id: string): EditionSource {
  const sources = loadEditionSources(path);
  const source = sources.find((s) => s.id === id);
  if (!source) throw new Error(`edition ${id} not in ${path}; known: ${sources.map((s) => s.id).join(", ")}`);
  return source;
}
