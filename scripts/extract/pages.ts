import { CATEGORIES, type Category } from "../../src/lib/categories";
import type { Attention, ExtractedItem } from "./types";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const ruleRegex = (rule: string) => new RegExp(`(?<![\\d.])${escape(rule)}(?!\\d|\\.\\d)`);

/**
 * Index of the first Appendix F page. The contents pages also mention Appendix F, so pages with a
 * standalone "Contents" heading are skipped (every page's footer says "Go to Contents", which is not standalone).
 */
function appendixFIndex(pages: string[]): number {
  const index = pages.findIndex((p) => /^\s*APPENDIX F\b/m.test(p) && !/^\s*Contents\s*$/m.test(p));
  return index === -1 ? pages.length : index;
}

/** 1-based pages in the regulation text (before Appendix F) where the rule appears as a whole number. */
export function locatePages(rule: string, pages: string[]): number[] {
  const re = ruleRegex(rule);
  const result: number[] = [];
  pages.slice(0, appendixFIndex(pages)).forEach((text, i) => {
    if (re.test(text)) result.push(i + 1);
  });
  return result;
}

export function crossCheck(items: ExtractedItem[], pagesByCat: Record<Category, string[]>): Attention[] {
  const attention: Attention[] = [];
  for (const category of CATEGORIES) {
    const pages = pagesByCat[category];
    const onCard = new Set<string>();
    for (const item of items) {
      if (!item.perCategory[category]) continue;
      for (const rule of item.rules) {
        onCard.add(rule);
        if (locatePages(rule, pages).length === 0) {
          attention.push({ itemId: item.id, category, rule, message: `rule ${rule} on card but not found in extract text` });
        }
      }
    }
    const equipmentPages = pages.slice(0, appendixFIndex(pages)).filter((p) => /SECTION [45]\b/.test(p));
    const inText = new Set(equipmentPages.flatMap((p) => p.match(/(?<![\d.])[45]\.\d\d\.\d+(?!\d)/g) ?? []));
    for (const rule of [...inText].sort()) {
      if (!onCard.has(rule)) attention.push({ category, rule, message: `rule ${rule} in extract but on no card line` });
    }
  }
  return attention;
}
