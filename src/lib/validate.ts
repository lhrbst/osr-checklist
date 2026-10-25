import { CATEGORIES, LANGS } from "./categories";
import type { Edition, Item } from "./schemas";

export interface ContentInput {
  editions: Edition[];
  items: { edition: string; item: Item }[];
  drawingIds: Set<string>;
}

/** Cross-file checks the per-file Zod schemas cannot express. Returns one message per problem. */
export function validateContent({ editions, items, drawingIds }: ContentInput): string[] {
  const errors: string[] = [];
  const editionsById = new Map(editions.map((e) => [e.id, e]));
  const orders = new Map<string, string>();

  for (const { edition: editionId, item } of items) {
    const where = `${editionId}/${item.id}`;
    const edition = editionsById.get(editionId);
    if (!edition) {
      errors.push(`${where}: edition ${editionId} has no manifest`);
      continue;
    }
    if (!drawingIds.has(item.drawing)) {
      errors.push(`${where}: drawing "${item.drawing}" not found`);
    }
    const sectionIds = new Set(edition.sections.map((s) => s.id));

    for (const category of CATEGORIES) {
      const entry = item.applies[category];
      if (!entry) continue;
      if (!sectionIds.has(entry.section)) {
        errors.push(`${where} [${category}]: unknown section "${entry.section}"`);
      }
      for (const lang of LANGS) {
        if (!entry.explanation[lang]?.trim()) {
          errors.push(`${where} [${category}]: explanation.${lang} is empty`);
        }
      }
      if (entry.pages.length === 0) {
        errors.push(`${where} [${category}]: no page`);
      }
      const key = `${editionId}|${category}|${entry.section}|${entry.order}`;
      const other = orders.get(key);
      if (other) {
        errors.push(`${where} [${category}]: order ${entry.order} in section "${entry.section}" also used by ${other}`);
      } else {
        orders.set(key, item.id);
      }
    }
  }
  return errors;
}
