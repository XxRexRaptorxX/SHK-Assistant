import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { checkFormulaRequirements, formulaCollection, formulaShape, type FormulaEntry } from '../formulas/schema.ts'
import { TOOL_ID_PREFIX } from './constants.ts'
import { checkFactorTool, factorToolSchema, type FactorTool } from './factorTool.ts'

// Tools sind Rechenhelfer für die Praxis. Zwei Arten:
// - Formel-Tools (ohne "kind"): Aufbau und Prüfung wie bei den Formeln.
// - Tabellen-Tools ("kind": "table"): schlagen zu einer Eingabe (z. B. Baujahr) die passenden
//   Zeilen einer Tabelle nach, ohne zu rechnen.
// - Auswahl-Tools ("kind": "choice"): ein oder mehrere Abschnitte, in denen man eine Option antippt
//   (z. B. Thermostatstufe oder Raumart) und deren Werte angezeigt bekommt.
// - Faktor-Tools ("kind": "factor"): Zahl eingeben, Varianten wählen, Ergebnisse = Faktor × Bezugsgröße
//   (siehe factorTool.ts).

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

const choiceOptionSchema = z.strictObject({
  /** Beschriftung der Schaltfläche, z. B. "3" oder "Bad" */
  label: z.string().trim().min(1),
  /** Zusatz, z. B. „Frostschutz“ */
  note: z.string().trim().default(''),
  /** Werte je Spalte als Text, z. B. "ca. 20" */
  values: z.record(z.string(), z.string().trim().min(1)),
})

const choiceSectionSchema = z.strictObject({
  title: z.string().trim().min(1),
  /** Was ausgewählt wird, z. B. „Einstellung“ */
  inputName: z.string().trim().min(1),
  /** "scale": Stufen nebeneinander in einer Leiste (kurze Beschriftungen); "dropdown": Auswahlliste */
  display: z.enum(['scale', 'dropdown']).default('dropdown'),
  columns: z.array(tableColumnSchema).min(1),
  options: z.array(choiceOptionSchema).min(1),
})

const choiceToolSchema = defineEntrySchema({
  kind: z.literal('choice'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  sections: z.array(choiceSectionSchema).min(1),
})

export const toolEntrySchema = z.discriminatedUnion('kind', [
  formulaToolSchema,
  tableToolSchema,
  choiceToolSchema,
  factorToolSchema,
])

export type FormulaTool = z.output<typeof formulaToolSchema>
export type TableTool = z.output<typeof tableToolSchema>
export type TableRow = z.output<typeof tableRowSchema>
export type ChoiceTool = z.output<typeof choiceToolSchema>
export type ChoiceSection = z.output<typeof choiceSectionSchema>
export type ToolEntry = FormulaTool | TableTool | ChoiceTool | FactorTool
export type { FactorTool }

export const isTableTool = (entry: ToolEntry): entry is TableTool => entry.kind === 'table'
export const isChoiceTool = (entry: ToolEntry): entry is ChoiceTool => entry.kind === 'choice'
export const isFactorTool = (entry: ToolEntry): entry is FactorTool => entry.kind === 'factor'
export const isFormulaTool = (entry: ToolEntry): entry is FormulaTool => entry.kind === undefined

/** Fehlende oder unbekannte Spalten in den Werten einer Zeile bzw. Option */
function checkValues(where: string, keys: string[], values: Record<string, string>): string[] {
  const missing = keys.filter((key) => !(key in values))
  const unknown = Object.keys(values).filter((key) => !keys.includes(key))
  return [
    ...(missing.length > 0 ? [`${where}: Wert fehlt für ${missing.join(', ')}`] : []),
    ...(unknown.length > 0 ? [`${where}: unbekannte Spalte ${unknown.join(', ')}`] : []),
  ]
}

export function checkTableTool(entry: TableTool): string[] {
  const issues: string[] = []
  const keys = entry.columns.map((column) => column.key)
  if (new Set(keys).size !== keys.length) issues.push('columns: key doppelt vergeben')
  entry.rows.forEach((row, index) => {
    const where = `rows[${index}] (${row.label})`
    if (row.from === undefined && row.to === undefined) issues.push(`${where}: from oder to fehlt`)
    if (row.from !== undefined && row.to !== undefined && row.from > row.to) issues.push(`${where}: from ist größer als to`)
    issues.push(...checkValues(where, keys, row.values))
  })
  return issues
}

export function checkChoiceTool(entry: ChoiceTool): string[] {
  const issues: string[] = []
  entry.sections.forEach((section, sectionIndex) => {
    const where = `sections[${sectionIndex}] (${section.title})`
    const keys = section.columns.map((column) => column.key)
    if (new Set(keys).size !== keys.length) issues.push(`${where}: columns: key doppelt vergeben`)
    const labels = section.options.map((option) => option.label)
    if (new Set(labels).size !== labels.length) issues.push(`${where}: label doppelt vergeben`)
    section.options.forEach((option, index) => {
      issues.push(...checkValues(`${where}, options[${index}] (${option.label})`, keys, option.values))
    })
  })
  return issues
}

export const toolCollection = defineCollection({
  dir: 'tools',
  idPrefix: TOOL_ID_PREFIX,
  schema: toolEntrySchema,
  check: (entry) =>
    isTableTool(entry)
      ? checkTableTool(entry)
      : isChoiceTool(entry)
        ? checkChoiceTool(entry)
        : isFactorTool(entry)
          ? checkFactorTool(entry)
          : formulaCollection.check!(entry as FormulaEntry),
  references: (entry) => (isFormulaTool(entry) ? formulaCollection.references!(entry as FormulaEntry) : []),
})
