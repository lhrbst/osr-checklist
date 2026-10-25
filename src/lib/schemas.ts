import { z } from "astro/zod";
import { CATEGORIES } from "./categories";

export const RULE_PATTERN = /^\d+\.\d+(\.\d+)?$/;

export const localizedSchema = z.object({
  en: z.string().min(1),
  de: z.string().min(1),
});

const categoryEntrySchema = z.object({
  section: z.string().min(1),
  order: z.number().int(),
  pages: z.array(z.number().int().positive()).min(1),
  cardHash: z.string().regex(/^sha256:[0-9a-f]{64}$/),
  explanation: localizedSchema,
});

export const itemSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  drawing: z.string().min(1),
  rules: z.array(z.string().regex(RULE_PATTERN)).min(1),
  name: localizedSchema,
  applies: z
    .object(Object.fromEntries(CATEGORIES.map((c) => [c, categoryEntrySchema.optional()])) as Record<
      (typeof CATEGORIES)[number],
      z.ZodOptional<typeof categoryEntrySchema>
    >)
    .strict()
    .refine((a) => Object.values(a).some(Boolean), "item must apply to at least one category"),
});

export const editionSchema = z.object({
  id: z.string().regex(/^\d{4}-v\d+$/),
  label: localizedSchema,
  effectiveFrom: z.coerce.date(),
  effectiveTo: z.coerce.date(),
  pdfs: z.object(
    Object.fromEntries(CATEGORIES.map((c) => [c, z.string().url()])) as Record<
      (typeof CATEGORIES)[number],
      z.ZodString
    >,
  ),
  sections: z
    .array(
      z.object({
        id: z.string().min(1),
        title: localizedSchema,
        officialTitle: z.string().min(1),
      }),
    )
    .min(1),
});

export type Item = z.infer<typeof itemSchema>;
export type Edition = z.infer<typeof editionSchema>;
