// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection } from '../../content/schema/base.ts'
import { formulaCollection, formulaEntrySchema, type FormulaEntry } from '../formulas/schema.ts'
import { TOOL_ID_PREFIX } from './constants.ts'

// Tools sind Rechenhelfer für die Praxis. Sie haben denselben Aufbau wie Formeln
// (Variablen, Ergebnis, Ausdruck, Testbeispiel) und werden genauso geprüft.
export type ToolEntry = FormulaEntry

export const toolCollection = defineCollection({
  dir: 'tools',
  idPrefix: TOOL_ID_PREFIX,
  schema: formulaEntrySchema,
  check: formulaCollection.check,
  references: formulaCollection.references,
})
