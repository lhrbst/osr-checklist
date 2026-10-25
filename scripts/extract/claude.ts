import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod/v4";
import { CATEGORIES, CATEGORY_LABEL, type Category, type Localized } from "../../src/lib/categories";
import { ExtractionSchema, type ExtractedItem, type Extraction } from "./types";

const model = () => process.env.OSR_MODEL ?? "claude-opus-5-5";

function parsedOrThrow<T>(message: { stop_reason: string | null; parsed_output: T | null }, what: string): T {
  if (message.stop_reason !== "end_turn" || message.parsed_output === null) {
    throw new Error(`${what}: no usable output (stop_reason ${message.stop_reason})`);
  }
  return message.parsed_output;
}

const EXTRACTION_PROMPT = `The four PDFs above are World Sailing Offshore Special Regulations extracts for monohulls, one per category: ${CATEGORIES.map((c) => `"${c}" = ${CATEGORY_LABEL[c].en}`).join(", ")}. Each ends with "Appendix F – Inspection Card".

Build one merged list of inspection-card items across the four categories:
- Use only the lines of each category's Appendix F inspection card. Ignore regulation text that has no card line.
- One item per distinct card-line concept. When the same concept appears on several categories' cards (possibly with stricter wording or numbers), it is one item with an entry per category.
- Keep lines separate when they are different requirements, even if they cite the same rule numbers (e.g. two separate jackstay lines both citing 4.04.2 stay two items).
- "rules": the OSR rule numbers the card line cites, like "4.04.2" or "4.09".
- "id": a short kebab-case English slug. Reuse an id from the PREVIOUS ITEMS list below when the item is the same concept.
- "perCategory.<category>": present only if that category's card has the line. "section" is a kebab-case id of the card heading the line sits under; "order" is the line's position within that section on that category's card, counting 10, 20, 30, …; "cardLine" is the card wording of the line.
- "sections": every card heading used, in card order (union over categories), with "officialTitle" as printed, and "title" as a short, natural English and German rendering.
- "name": short item name. German uses common German sailing terminology with the official English term in brackets, e.g. "Strecktaue (Jackstays)".
- "uncertain": set it with a one-sentence reason whenever you are unsure about a line's category, merge or rule numbers. Leave it out otherwise.

PREVIOUS ITEMS (id, rules, English name):
`;

export async function extractStructure(
  client: Anthropic,
  pdfs: Record<Category, Buffer>,
  previous: { id: string; rules: string[]; name: Localized }[],
): Promise<Extraction> {
  const message = await client.messages
    .stream({
      model: model(),
      max_tokens: 32000,
      output_config: { effort: "high", format: zodOutputFormat(ExtractionSchema) },
      messages: [
        {
          role: "user",
          content: [
            ...CATEGORIES.map((category) => ({
              type: "document" as const,
              title: category,
              source: {
                type: "base64" as const,
                media_type: "application/pdf" as const,
                data: pdfs[category].toString("base64"),
              },
            })),
            {
              type: "text" as const,
              text:
                EXTRACTION_PROMPT +
                (previous.map((p) => `${p.id} | ${p.rules.join(", ")} | ${p.name.en}`).join("\n") || "(none)"),
            },
          ],
        },
      ],
    })
    .finalMessage();
  return parsedOrThrow(message, "extractStructure");
}

const ExplanationSchema = z.object({
  osr2: z.object({ en: z.string(), de: z.string() }).optional(),
  osr3: z.object({ en: z.string(), de: z.string() }).optional(),
  "osr3-liferaft": z.object({ en: z.string(), de: z.string() }).optional(),
  osr4: z.object({ en: z.string(), de: z.string() }).optional(),
});

export async function generateExplanations(
  client: Anthropic,
  item: ExtractedItem,
  ruleTextByCat: Partial<Record<Category, string>>,
): Promise<Partial<Record<Category, Localized>>> {
  const categories = Object.keys(ruleTextByCat) as Category[];
  const sources = categories
    .map(
      (c) =>
        `<regulation_text category="${c}" label="${CATEGORY_LABEL[c].en}">\n${ruleTextByCat[c]}\n</regulation_text>`,
    )
    .join("\n\n");
  const message = await client.messages
    .stream({
      model: model(),
      max_tokens: 8000,
      output_config: { effort: "high", format: zodOutputFormat(ExplanationSchema) },
      messages: [
        {
          role: "user",
          content: `${sources}

Item: "${item.name.en}" (OSR ${item.rules.join(", ")}).

For each of these categories: ${categories.join(", ")} — write a plain-language explanation for sailors, in English ("en") and German ("de"), based only on the regulation text for that category above (the text is extracted from a PDF; columns may be jumbled):
- 2–3 sentences: what the item is, and exactly what that category requires (quantities, sizes, ratings).
- Do not invent requirements and do not copy the regulation wording; short technical terms are fine.
- German uses common German sailing terminology.
Return only the categories listed.`,
        },
      ],
    })
    .finalMessage();
  return parsedOrThrow(message, `generateExplanations(${item.id})`);
}

export async function generateDrawing(client: Anthropic, item: ExtractedItem): Promise<string> {
  const message = await client.messages
    .stream({
      model: model(),
      max_tokens: 8000,
      output_config: { effort: "high" },
      messages: [
        {
          role: "user",
          content: `Draw a simple, recognisable line drawing of this piece of sailing safety equipment: "${item.name.en}" (OSR ${item.rules.join(", ")}).

Rules: one <svg> element with xmlns="http://www.w3.org/2000/svg" and viewBox="0 0 200 200"; stroke-only line art (fill="none"), stroke="currentColor", stroke-width 3–5, round caps and joins; no text or letters, no <text>, <style>, <script>, <image> or external references; under 8 KB. Reply with the SVG only.`,
        },
      ],
    })
    .finalMessage();
  if (message.stop_reason !== "end_turn")
    throw new Error(`generateDrawing(${item.id}): stop_reason ${message.stop_reason}`);
  const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("");
  const svg = text.match(/<svg[\s\S]*<\/svg>/)?.[0];
  if (!svg) throw new Error(`generateDrawing(${item.id}): no <svg> in reply`);
  return svg;
}
