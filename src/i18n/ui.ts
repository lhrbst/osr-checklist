import type { Lang } from "../lib/categories";

const strings = {
  title: { en: "OSR Checklist", de: "OSR-Checkliste" },
  edition: { en: "Edition", de: "Ausgabe" },
  category: { en: "Category", de: "Kategorie" },
  inForceFrom: { en: "In force from", de: "Gültig ab" },
  officialPdf: { en: "Official OSR extract (PDF)", de: "Offizieller OSR-Auszug (PDF)" },
  page: { en: "p.", de: "S." },
  chooseChecklist: { en: "Choose a checklist", de: "Checkliste wählen" },
  disclaimer: {
    en: "Unofficial guide. The official Offshore Special Regulations take precedence, and the person in charge remains fully responsible for boat and crew (OSR 1.02).",
    de: "Inoffizieller Leitfaden. Maßgeblich sind die offiziellen Offshore Special Regulations; die verantwortliche Person bleibt voll verantwortlich für Boot und Crew (OSR 1.02).",
  },
  otherLanguage: { en: "Deutsch", de: "English" },
} satisfies Record<string, Record<Lang, string>>;

export type UiKey = keyof typeof strings;

export const t = (lang: Lang, key: UiKey): string => strings[key][lang];

export const formatDate = (lang: Lang, date: Date): string =>
  date.toLocaleDateString(lang === "de" ? "de-DE" : "en-GB", { timeZone: "UTC", day: "numeric", month: "long", year: "numeric" });
