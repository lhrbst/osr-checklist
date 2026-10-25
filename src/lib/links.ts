import type { Category, Lang } from "./categories";

export const pdfLink = (pdfUrl: string, page: number): string => `${pdfUrl}#page=${page}`;

/** `base` always ends with "/". */
export const pageUrl = (base: string, lang: Lang, edition: string, category: Category): string =>
  `${base}${lang}/${edition}/${category}/`;

export const pickLang = (navigatorLanguage: string | undefined): Lang =>
  navigatorLanguage?.toLowerCase().startsWith("de") ? "de" : "en";
