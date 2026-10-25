import type { Edition } from "./schemas";

type EditionRange = Pick<Edition, "id" | "effectiveFrom" | "effectiveTo">;

const DAY_MS = 24 * 60 * 60 * 1000;

const byStart = (editions: EditionRange[]) =>
  [...editions].sort((a, b) => a.effectiveFrom.getTime() - b.effectiveFrom.getTime());

/**
 * The edition in force on `today` (effectiveTo counts as a whole day). Outside every range:
 * the latest edition that has started, else the earliest one.
 */
export function inForceEdition(editions: EditionRange[], today: Date): string {
  const sorted = byStart(editions);
  const now = today.getTime();
  const current = sorted.find((e) => e.effectiveFrom.getTime() <= now && now < e.effectiveTo.getTime() + DAY_MS);
  if (current) return current.id;
  const started = sorted.filter((e) => e.effectiveFrom.getTime() <= now);
  return (started.at(-1) ?? sorted[0]).id;
}

/** The edition that started most recently before the given one. */
export function previousEdition(editions: EditionRange[], id: string): string | undefined {
  const sorted = byStart(editions);
  const index = sorted.findIndex((e) => e.id === id);
  return index > 0 ? sorted[index - 1].id : undefined;
}
