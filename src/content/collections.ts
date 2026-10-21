import type { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe hier mit Dateiendung .ts.
import { checklistCollection } from '../modules/checklists/schema.ts'
import { converterCollection } from '../modules/converter/schema.ts'
import { formulaCollection } from '../modules/formulas/schema.ts'
import { lexiconCollection } from '../modules/lexicon/schema.ts'
import { unitCollection } from '../modules/units/schema.ts'
import type { CollectionDefinition } from './schema/base.ts'

// Register aller Inhaltstypen. Jedes Modul trägt hier seine Sammlung ein.
// Ordner in content/, die hier nicht stehen, lassen den Build fehlschlagen.
// Reihenfolge zählt: "units" zuerst, damit Formeln und Umrechner die Zusatzeinheiten kennen.
export const collections = {
  units: unitCollection,
  converter: converterCollection,
  formulas: formulaCollection,
  checklists: checklistCollection,
  lexicon: lexiconCollection,
} satisfies Record<string, CollectionDefinition>

export type CollectionName = keyof typeof collections

export type ContentData = {
  [K in CollectionName]: z.output<(typeof collections)[K]['schema']>[]
}
