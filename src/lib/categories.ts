export const CATEGORIES = ["osr2", "osr3", "osr3-liferaft", "osr4"] as const;
export type Category = (typeof CATEGORIES)[number];

export const LANGS = ["en", "de"] as const;
export type Lang = (typeof LANGS)[number];

export type Localized = Record<Lang, string>;

export const CATEGORY_LABEL: Record<Category, Localized> = {
  osr2: { en: "OSR 2", de: "OSR 2" },
  osr3: { en: "OSR 3", de: "OSR 3" },
  "osr3-liferaft": { en: "OSR 3 + liferaft", de: "OSR 3 + Rettungsinsel" },
  osr4: { en: "OSR 4", de: "OSR 4" },
};
