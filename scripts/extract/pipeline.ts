import { CATEGORIES, type Category, type Localized } from "../../src/lib/categories";
import { ID_PATTERN, type Edition, type Item } from "../../src/lib/schemas";
import { MISSING_EXPLANATION, validateContent } from "../../src/lib/validate";
import { cardHash, textHash } from "./hash";
import { crossCheck, locatePages } from "./pages";
import { sanitizeSvg } from "./svg";
import type { Attention, ExtractedItem, Extraction } from "./types";

export const PLACEHOLDER_DRAWING = "placeholder";
const CONCURRENCY = 4;

/** The llm.ts calls with the client already bound, plus what is already on disk. */
export interface Deps {
  extractStructure: (pdfs: Record<Category, Buffer>, previous: { id: string; rules: string[]; name: Localized }[]) => Promise<Extraction>;
  generateExplanations: (item: ExtractedItem, ruleTextByCat: Partial<Record<Category, string>>) => Promise<Partial<Record<Category, Localized>>>;
  generateDrawing: (item: ExtractedItem) => Promise<string>;
  existingDrawings: Set<string>;
}

export interface PipelineInput {
  edition: Pick<Edition, "id" | "label" | "effectiveFrom" | "effectiveTo" | "pdfs">;
  pdfs: Record<Category, Buffer>;
  pagesByCat: Record<Category, string[]>;
  previousItems: Item[];
}

export interface PipelineResult {
  edition: Edition;
  items: Item[];
  /** New drawings only, by id. */
  drawings: Record<string, string>;
  attention: Attention[];
  uncertain: { itemId: string; reason: string }[];
  diff: { added: string[]; removed: string[]; changed: string[]; carried: string[] };
}

async function mapLimit<T, R>(values: T[], limit: number, fn: (value: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(values.length);
  let next = 0;
  const worker = async () => {
    while (next < values.length) {
      const index = next++;
      results[index] = await fn(values[index]);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, worker));
  return results;
}

/** Ids become file names and URL parts and must be unique; anything else aborts before files are written. */
function assertSafeIds(extraction: Extraction): void {
  const seen = new Set<string>();
  for (const item of extraction.items) {
    if (!ID_PATTERN.test(item.id)) throw new Error(`invalid item id "${item.id}"`);
    if (seen.has(item.id)) throw new Error(`duplicate item id "${item.id}"`);
    seen.add(item.id);
  }
  for (const section of extraction.sections) {
    if (!ID_PATTERN.test(section.id)) throw new Error(`invalid section id "${section.id}"`);
  }
}

const categoriesOf = (applies: object) => CATEGORIES.filter((c) => c in applies && (applies as Record<string, unknown>)[c]);

export async function runPipeline(input: PipelineInput, deps: Deps): Promise<PipelineResult> {
  const { pagesByCat, previousItems } = input;
  const previousById = new Map(previousItems.map((i) => [i.id, i]));
  const extraction = await deps.extractStructure(
    input.pdfs,
    previousItems.map((i) => ({ id: i.id, rules: i.rules, name: i.name })),
  );

  assertSafeIds(extraction);
  const attention: Attention[] = crossCheck(extraction.items, pagesByCat);
  const drawings: Record<string, string> = {};
  const changed: string[] = [];
  const carried: string[] = [];

  const items = await mapLimit(extraction.items, CONCURRENCY, async (extracted): Promise<Item> => {
    const previous = previousById.get(extracted.id);
    const categories = categoriesOf(extracted.perCategory);
    const applies: Item["applies"] = {};
    const toGenerate: Partial<Record<Category, string>> = {};

    for (const category of categories) {
      const placement = extracted.perCategory[category]!;
      const pages = [...new Set(extracted.rules.flatMap((r) => locatePages(r, pagesByCat[category])))].sort((a, b) => a - b);
      if (pages.length === 0) {
        attention.push({ itemId: extracted.id, category, message: `no page found for OSR ${extracted.rules.join(", ")}; add pages by hand` });
      }
      const hash = cardHash(placement.cardLine);
      const ruleText = pages.map((p) => pagesByCat[category][p - 1] ?? "").join("\n");
      const sourceHash = textHash(ruleText);
      const before = previous?.applies[category];
      const keep = before !== undefined && before.cardHash === hash && before.sourceHash === sourceHash;
      applies[category] = {
        section: placement.section,
        order: placement.order,
        pages,
        cardHash: hash,
        sourceHash,
        explanation: keep ? before.explanation : MISSING_EXPLANATION,
      };
      if (!keep) toGenerate[category] = ruleText;
    }

    if (Object.keys(toGenerate).length > 0) {
      const generated = await deps.generateExplanations(extracted, toGenerate);
      for (const category of Object.keys(toGenerate) as Category[]) {
        const text = generated[category];
        if (text?.en.trim() && text.de.trim()) applies[category]!.explanation = text;
        else attention.push({ itemId: extracted.id, category, message: "explanation missing from model output" });
      }
    }

    let drawing = extracted.id;
    if (!deps.existingDrawings.has(extracted.id)) {
      try {
        drawings[extracted.id] = sanitizeSvg(await deps.generateDrawing(extracted));
      } catch (error) {
        drawing = PLACEHOLDER_DRAWING;
        attention.push({ itemId: extracted.id, message: `drawing rejected: ${(error as Error).message}` });
      }
    }

    if (previous) {
      const sameCategories = categoriesOf(previous.applies).join() === categories.join();
      const sameRules = previous.rules.join() === extracted.rules.join();
      if (sameCategories && sameRules && Object.keys(toGenerate).length === 0) carried.push(extracted.id);
      else changed.push(extracted.id);
    }

    return { id: extracted.id, drawing, rules: extracted.rules, name: extracted.name, applies };
  });

  const edition: Edition = { ...input.edition, sections: extraction.sections };
  const drawingIds = new Set([...deps.existingDrawings, ...Object.keys(drawings), PLACEHOLDER_DRAWING]);
  for (const message of validateContent({ editions: [edition], items: items.map((item) => ({ edition: edition.id, item })), drawingIds })) {
    attention.push({ message: `build validation: ${message}` });
  }

  const ids = new Set(items.map((i) => i.id));
  return {
    edition,
    items,
    drawings,
    attention,
    uncertain: extraction.items.flatMap((i) => (i.uncertain ? [{ itemId: i.id, reason: i.uncertain }] : [])),
    diff: {
      added: items.filter((i) => !previousById.has(i.id)).map((i) => i.id),
      removed: previousItems.filter((i) => !ids.has(i.id)).map((i) => i.id),
      changed: changed.sort(),
      carried: carried.sort(),
    },
  };
}
