import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { LEXICON_ID_PREFIX } from './constants.ts'

export const lexiconEntrySchema = defineEntrySchema({
  /** Begriff, wie er in der Liste erscheint */
  term: z.string().trim().min(1),
  /** Andere Bezeichnungen und Abkürzungen (werden mit durchsucht) */
  synonyms: z.array(z.string().trim().min(1)).default([]),
  /** Erklärung als Text; Leerzeilen trennen Absätze */
  definition: z.string().trim().min(1),
  /** Verwandte Lexikon-Einträge ("Siehe auch") */
  related: z.array(z.string().startsWith(`${LEXICON_ID_PREFIX}.`)).default([]),
})

export type LexiconEntry = z.output<typeof lexiconEntrySchema>

export const lexiconCollection = defineCollection({
  dir: 'lexicon',
  idPrefix: LEXICON_ID_PREFIX,
  schema: lexiconEntrySchema,
  references: (entry) => entry.related,
})
