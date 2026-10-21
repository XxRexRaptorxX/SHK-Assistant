import type { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe hier mit Dateiendung .ts.
import { formulaCollection } from '../modules/formulas/schema.ts'
import { lexiconCollection } from '../modules/lexicon/schema.ts'
import type { CollectionDefinition } from './schema/base.ts'

// Register aller Inhaltstypen. Jedes Modul trägt hier seine Sammlung ein.
// Ordner in content/, die hier nicht stehen, lassen den Build fehlschlagen.
export const collections = {
  formulas: formulaCollection,
  lexicon: lexiconCollection,
} satisfies Record<string, CollectionDefinition>

export type CollectionName = keyof typeof collections

export type ContentData = {
  [K in CollectionName]: z.output<(typeof collections)[K]['schema']>[]
}
