import { z } from "zod/v4";
import type { Category } from "../../src/lib/categories";

const localized = z.object({ en: z.string(), de: z.string() });

const cardPlacement = z.object({
  section: z.string(),
  order: z.number(),
  cardLine: z.string(),
});

/** What the LLM returns for one edition: the merged Appendix F card structure. */
export const ExtractionSchema = z.object({
  sections: z.array(z.object({ id: z.string(), officialTitle: z.string(), title: localized })),
  items: z.array(
    z.object({
      id: z.string(),
      rules: z.array(z.string()),
      name: localized,
      perCategory: z.object({
        osr2: cardPlacement.optional(),
        osr3: cardPlacement.optional(),
        "osr3-liferaft": cardPlacement.optional(),
        osr4: cardPlacement.optional(),
      }),
      uncertain: z.string().optional(),
    }),
  ),
});

export type Extraction = z.infer<typeof ExtractionSchema>;
export type ExtractedItem = Extraction["items"][number];
export type ExtractedSection = Extraction["sections"][number];

export interface Attention {
  itemId?: string;
  category?: Category;
  rule?: string;
  message: string;
}
