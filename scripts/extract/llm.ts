import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";
import { z } from "zod/v4";
import { CATEGORIES, CATEGORY_LABEL, type Category, type Localized } from "../../src/lib/categories";
import type { ExtractedItem, Extraction } from "./types";

const model = () => process.env.OSR_MODEL ?? "gpt-5.5";
const LONG_REQUEST = { timeout: 30 * 60 * 1000 };

// OpenAI strict structured outputs require every field; optional ones are expressed as nullable.
const localized = z.object({ en: z.string(), de: z.string() });
const placement = z.object({ section: z.string(), order: z.number(), cardLine: z.string() }).nullable();
const WireExtraction = z.object({
  sections: z.array(z.object({ id: z.string(), officialTitle: z.string(), title: localized })),
  items: z.array(
    z.object({
      id: z.string(),
      rules: z.array(z.string()),
      name: localized,
      perCategory: z.object({ osr2: placement, osr3: placement, "osr3-liferaft": placement, osr4: placement }),
      uncertain: z.string().nullable(),
    }),
  ),
});
const WireExplanations = z.object({
  osr2: localized.nullable(),
  osr3: localized.nullable(),
  "osr3-liferaft": localized.nullable(),
  osr4: localized.nullable(),
});

/** Drops null entries so the result matches the pipeline's optional-field types. */
const withoutNulls = <T extends object>(record: T) =>
  Object.fromEntries(Object.entries(record).filter(([, v]) => v !== null)) as { [K in keyof T]?: NonNullable<T[K]> };

function parsedOrThrow<T>(response: { status?: string | null; output_parsed: T | null }, what: string): T {
  if (response.status !== "completed" || response.output_parsed === null) {
    throw new Error(`${what}: no usable output (status ${response.status})`);
  }
  return response.output_parsed;
}

const EXTRACTION_PROMPT = `The four PDFs above are World Sailing Offshore Special Regulations extracts for monohulls, one per category (the file name is the category): ${CATEGORIES.map((c) => `"${c}" = ${CATEGORY_LABEL[c].en}`).join(", ")}. Each ends with "Appendix F – Inspection Card".

Build one merged list of inspection-card items across the four categories:
- Use only the lines of each category's Appendix F inspection card. Ignore regulation text that has no card line.
- One item per distinct card-line concept. When the same concept appears on several categories' cards (possibly with stricter wording or numbers), it is one item with an entry per category.
- Keep lines separate when they are different requirements, even if they cite the same rule numbers (e.g. two separate jackstay lines both citing 4.04.2 stay two items).
- "rules": the OSR rule numbers the card line cites, like "4.04.2" or "4.09".
- "id": a short kebab-case English slug (lower-case letters, digits, hyphens). Reuse an id from the PREVIOUS ITEMS list below when the item is the same concept.
- "perCategory.<category>": the placement if that category's card has the line, otherwise null. "section" is a kebab-case id of the card heading the line sits under; "order" is the line's position within that section on that category's card, counting 10, 20, 30, …; "cardLine" is the card wording of the line.
- "sections": every card heading used, in card order (union over categories), with "officialTitle" as printed, and "title" as a short, natural English and German rendering.
- "name": short item name. German uses common German sailing terminology with the official English term in brackets, e.g. "Strecktaue (Jackstays)".
- "uncertain": a one-sentence reason whenever you are unsure about a line's category, merge or rule numbers; otherwise null.

PREVIOUS ITEMS (id, rules, English name):
`;

export async function extractStructure(
  client: OpenAI,
  pdfs: Record<Category, Buffer>,
  previous: { id: string; rules: string[]; name: Localized }[],
): Promise<Extraction> {
  const response = await client.responses.parse(
    {
      model: model(),
      reasoning: { effort: "high" },
      input: [
        {
          role: "user",
          content: [
            ...CATEGORIES.map((category) => ({
              type: "input_file" as const,
              filename: `${category}.pdf`,
              file_data: `data:application/pdf;base64,${pdfs[category].toString("base64")}`,
            })),
            {
              type: "input_text" as const,
              text:
                EXTRACTION_PROMPT +
                (previous.map((p) => `${p.id} | ${p.rules.join(", ")} | ${p.name.en}`).join("\n") || "(none)"),
            },
          ],
        },
      ],
      text: { format: zodTextFormat(WireExtraction, "osr_card_extraction") },
    },
    LONG_REQUEST,
  );
  const wire = parsedOrThrow(response, "extractStructure");
  return {
    sections: wire.sections,
    items: wire.items.map(({ uncertain, perCategory, ...item }): ExtractedItem => ({
      ...item,
      perCategory: withoutNulls(perCategory),
      ...(uncertain ? { uncertain } : {}),
    })),
  };
}

export async function generateExplanations(
  client: OpenAI,
  item: ExtractedItem,
  ruleTextByCat: Partial<Record<Category, string>>,
): Promise<Partial<Record<Category, Localized>>> {
  const categories = Object.keys(ruleTextByCat) as Category[];
  const sources = categories
    .map((c) => `<regulation_text category="${c}" label="${CATEGORY_LABEL[c].en}">\n${ruleTextByCat[c]}\n</regulation_text>`)
    .join("\n\n");
  const response = await client.responses.parse(
    {
      model: model(),
      reasoning: { effort: "high" },
      input: `${sources}

Item: "${item.name.en}" (OSR ${item.rules.join(", ")}).

For each of these categories: ${categories.join(", ")}: write a plain-language explanation for sailors, in English ("en") and German ("de"), based only on the regulation text for that category above (the text is extracted from a PDF; columns may be jumbled):
- 2–3 sentences: what the item is, and exactly what that category requires (quantities, sizes, ratings).
- Do not invent requirements and do not copy the regulation wording; short technical terms are fine.
- German uses common German sailing terminology.
Set every category not listed to null.`,
      text: { format: zodTextFormat(WireExplanations, "osr_explanations") },
    },
    LONG_REQUEST,
  );
  const wire = parsedOrThrow(response, `generateExplanations(${item.id})`);
  return withoutNulls(wire);
}

export async function generateDrawing(client: OpenAI, item: ExtractedItem): Promise<string> {
  const response = await client.responses.create(
    {
      model: model(),
      reasoning: { effort: "high" },
      input: `Draw a simple, recognisable line drawing of this piece of sailing safety equipment: "${item.name.en}" (OSR ${item.rules.join(", ")}).

Rules: one <svg> element with xmlns="http://www.w3.org/2000/svg" and viewBox="0 0 200 200"; stroke-only line art (fill="none"), stroke="currentColor", stroke-width 3–5, round caps and joins; no text or letters, no <text>, <style>, <script>, <image> or external references; under 8 KB. Reply with the SVG only.`,
    },
    LONG_REQUEST,
  );
  if (response.status !== "completed") throw new Error(`generateDrawing(${item.id}): status ${response.status}`);
  const svg = response.output_text.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg) throw new Error(`generateDrawing(${item.id}): no <svg> in reply`);
  return svg;
}
