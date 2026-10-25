import type { Category } from "./categories";
import type { Edition, Item } from "./schemas";

export interface ChecklistSection {
  section: Edition["sections"][number];
  items: Item[];
}

/** Items for one category, grouped by the edition's sections in card order. Empty sections are dropped. */
export function buildChecklist(edition: Edition, items: Item[], category: Category): ChecklistSection[] {
  return edition.sections
    .map((section) => ({
      section,
      items: items
        .filter((item) => item.applies[category]?.section === section.id)
        .sort((a, b) => a.applies[category]!.order - b.applies[category]!.order),
    }))
    .filter((s) => s.items.length > 0);
}
