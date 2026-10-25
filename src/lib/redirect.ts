import type { Lang } from "./categories";
import { inForceEdition } from "./editions";
import { pageUrl, pickLang } from "./links";

export interface RedirectInput {
  /** Dates as ISO strings, as serialized into the page. */
  editions: { id: string; effectiveFrom: string; effectiveTo: string }[];
  today: Date;
  base: string;
  navigatorLanguage: string | undefined;
  /** Set on /{lang}/ pages; otherwise the browser language decides. */
  lang?: Lang;
}

export function redirectTarget({ editions, today, base, navigatorLanguage, lang }: RedirectInput): string {
  const edition = inForceEdition(
    editions.map((e) => ({ id: e.id, effectiveFrom: new Date(e.effectiveFrom), effectiveTo: new Date(e.effectiveTo) })),
    today,
  );
  return pageUrl(base, lang ?? pickLang(navigatorLanguage), edition, "osr3");
}
