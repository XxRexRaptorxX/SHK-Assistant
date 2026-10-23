import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { checkFormulaRequirements, formulaCollection, formulaShape, type FormulaEntry } from '../formulas/schema.ts'
import { TOOL_ID_PREFIX } from './constants.ts'

// Tools sind Rechenhelfer für die Praxis. Zwei Arten:
// - Formel-Tools (ohne "kind"): Aufbau und Prüfung wie bei den Formeln.
// - Tabellen-Tools ("kind": "table"): schlagen zu einer Eingabe (z. B. Baujahr) die passenden
//   Zeilen einer Tabelle nach, ohne zu rechnen.

const formulaToolSchema = defineEntrySchema({
  ...formulaShape,
  kind: z.undefined().optional(),
}).superRefine(checkFormulaRequirements)

const tableColumnSchema = z.strictObject({
  /** Schlüssel der Spalte in rows[].values, z. B. "heizlast" */
  key: z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern'),
  name: z.string().trim().min(1),
  /** Formelzeichen, z. B. "q" */
  label: z.string().trim().min(1).optional(),
  /** Lexikon-Begriff für die Verlinkung */
  term: z.string().trim().min(1).optional(),
  /** Einheit zur Anzeige, z. B. "W/m²" */
  unit: z.string().trim().default(''),
})

const tableRowSchema = z.strictObject({
  /** Anzeige des Bereichs, z. B. "1920 – 1969" */
  label: z.string().trim().min(1),
  /** Bereich der Eingabe, Grenzen einschließlich; fehlt eine Grenze, ist der Bereich dort offen */
  from: z.number().optional(),
  to: z.number().optional(),
  /** Zusatz, z. B. „EnEV 2002“ */
  note: z.string().trim().default(''),
  /** Werte je Spalte als Text, z. B. "ca. 105" oder "43–45" */
  values: z.record(z.string(), z.string().trim().min(1)),
})

const tableToolSchema = defineEntrySchema({
  kind: z.literal('table'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Die eine Eingabe, nach der nachgeschlagen wird */
  input: z.strictObject({
    name: z.string().trim().min(1),
    unit: z.string().trim().default(''),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  columns: z.array(tableColumnSchema).min(1),
  rows: z.array(tableRowSchema).min(1),
})

export const toolEntrySchema = z.discriminatedUnion('kind', [formulaToolSchema, tableToolSchema])

export type FormulaTool = z.output<typeof formulaToolSchema>
export type TableTool = z.output<typeof tableToolSchema>
export type TableRow = z.output<typeof tableRowSchema>
export type ToolEntry = FormulaTool | TableTool

export const isTableTool = (entry: ToolEntry): entry is TableTool => entry.kind === 'table'

export function checkTableTool(entry: TableTool): string[] {
  const issues: string[] = []
  const keys = entry.columns.map((column) => column.key)
  if (new Set(keys).size !== keys.length) issues.push('columns: key doppelt vergeben')
  entry.rows.forEach((row, index) => {
    const where = `rows[${index}] (${row.label})`
    if (row.from === undefined && row.to === undefined) issues.push(`${where}: from oder to fehlt`)
    if (row.from !== undefined && row.to !== undefined && row.from > row.to) issues.push(`${where}: from ist größer als to`)
    const missing = keys.filter((key) => !(key in row.values))
    const unknown = Object.keys(row.values).filter((key) => !keys.includes(key))
    if (missing.length > 0) issues.push(`${where}: Wert fehlt für ${missing.join(', ')}`)
    if (unknown.length > 0) issues.push(`${where}: unbekannte Spalte ${unknown.join(', ')}`)
  })
  return issues
}

export const toolCollection = defineCollection({
  dir: 'tools',
  idPrefix: TOOL_ID_PREFIX,
  schema: toolEntrySchema,
  check: (entry) => (isTableTool(entry) ? checkTableTool(entry) : formulaCollection.check!(entry as FormulaEntry)),
  references: (entry) => (isTableTool(entry) ? [] : formulaCollection.references!(entry as FormulaEntry)),
})
