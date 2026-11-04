import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { FORMULA_ID_PREFIX } from '../formulas/constants.ts'
import { TOOL_ID_PREFIX } from '../tools/constants.ts'
import { LEXICON_CATEGORIES, LEXICON_ID_PREFIX, type LexiconCategory } from './constants.ts'

export const lexiconEntrySchema = defineEntrySchema({
  /** Begriff, wie er in der Liste erscheint */
  term: z.string().trim().min(1),
  /** Andere Bezeichnungen und Abkürzungen (werden mit durchsucht) */
  synonyms: z.array(z.string().trim().min(1)).default([]),
  /** Kategorien (mindestens eine), siehe LEXICON_CATEGORIES */
  categories: z
    .array(z.enum(LEXICON_CATEGORIES.map((category) => category.key) as [LexiconCategory, ...LexiconCategory[]]))
    .min(1),
  /** Erklärung als Text; Leerzeilen trennen Absätze */
  definition: z.string().trim().min(1),
  /** Verwandte Lexikon-Einträge ("Siehe auch") */
  related: z.array(z.string().startsWith(`${LEXICON_ID_PREFIX}.`)).default([]),
  /** Formeln, die mit dem Begriff zu tun haben */
  formulas: z.array(z.string().startsWith(`${FORMULA_ID_PREFIX}.`)).default([]),
  /** Tools, die mit dem Begriff zu tun haben */
  tools: z.array(z.string().startsWith(`${TOOL_ID_PREFIX}.`)).default([]),
})

export type LexiconEntry = z.output<typeof lexiconEntrySchema>

export const lexiconCollection = defineCollection({
  dir: 'lexicon',
  idPrefix: LEXICON_ID_PREFIX,
  schema: lexiconEntrySchema,
  references: (entry) => [...entry.related, ...entry.formulas, ...entry.tools],
})
