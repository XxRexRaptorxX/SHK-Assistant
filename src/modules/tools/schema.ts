import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { checkFormulaRequirements, formulaCollection, formulaShape, type FormulaEntry } from '../formulas/schema.ts'
import { TOOL_ID_PREFIX } from './constants.ts'
import { checkFactorTool, factorToolSchema, type FactorTool } from './factorTool.ts'
import { checkVariantTool, variantReferences, variantToolSchema, type VariantTool } from './variantTool.ts'

// Tools sind Rechenhelfer für die Praxis. Zwei Arten:
// - Formel-Tools (ohne "kind"): Aufbau und Prüfung wie bei den Formeln.
// - Tabellen-Tools ("kind": "table"): schlagen zu einer Eingabe (z. B. Baujahr) die passenden
//   Zeilen einer Tabelle nach, ohne zu rechnen.
// - Auswahl-Tools ("kind": "choice"): ein oder mehrere Abschnitte, in denen man eine Option antippt
//   (z. B. Thermostatstufe oder Raumart) und deren Werte angezeigt bekommt.
// - Faktor-Tools ("kind": "factor"): Zahl eingeben, Varianten wählen, Ergebnisse = Faktor × Bezugsgröße
//   (siehe factorTool.ts).
// - Varianten-Tools ("kind": "variants"): mehrere Formeln zu einer Aufgabe mit Umschalter (siehe variantTool.ts).

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
  /** Nur Auswahl-Tools: Zwischenüberschrift, unter der die Spalte im Ergebnis steht, z. B. „Bewegungsfläche“ */
  group: z.string().trim().min(1).optional(),
  /** Nur Auswahl-Tools: Bezeichnung nur für Screenreader, der Wert steht dann links (z. B. allein im Block) */
  hideName: z.boolean().optional(),
  /** Nur Auswahl-Tools: Wert links, die Bezeichnung dahinter (z. B. „90 × 75 cm davor“) */
  valueFirst: z.boolean().optional(),
  /** Nur Auswahl-Tools: Höhe über Fertigfußboden; mit Fußbodenaufbau zusätzlich über Rohfußboden angezeigt */
  floorHeight: z.boolean().optional(),
  /** Nur Auswahl-Tools: Zwischenüberschrift innerhalb des Blocks, ab dieser Spalte, z. B. „Anforderungen Elektroinstallation“ */
  subheading: z.string().trim().min(1).optional(),
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
  /** Werte je Spalte als Text, z. B. "ca. 20"; fehlt eine Spalte, wird sie bei dieser Option nicht angezeigt */
  values: z.record(z.string(), z.string().trim().min(1)),
})

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Auswahlleiste über allen Abschnitten, z. B. Standard / barrierefrei; sie blendet Abschnitte ein und aus */
const choiceBarSchema = z.strictObject({
  key,
  /** Was gewählt wird, z. B. „Ausführung“ */
  name: z.string().trim().min(1),
  options: z
    .array(
      z.strictObject({
        key,
        label: z.string().trim().min(1),
        /** Zweite, kleine Zeile in der Leiste, z. B. „DIN 18040-2 (R)“ */
        note: z.string().trim().default(''),
      }),
    )
    .min(2),
})

const choiceSectionSchema = z.strictObject({
  title: z.string().trim().min(1),
  /** Nur anzeigen, wenn die Leisten so stehen: Leisten-key → Options-key; fehlt eine Leiste, gilt jede Option */
  when: z.record(z.string(), z.string()).default({}),
  /** Was ausgewählt wird, z. B. „Einstellung“ */
  inputName: z.string().trim().min(1),
  /** "scale": Stufen nebeneinander in einer Leiste (kurze Beschriftungen); "dropdown": Auswahlliste */
  display: z.enum(['scale', 'dropdown']).default('dropdown'),
  columns: z.array(tableColumnSchema).min(1),
  /** Legende je Gruppe, grau rechts neben der Überschrift des Blocks, z. B. „(Breite × Tiefe)“ */
  groupNotes: z.record(z.string(), z.string().trim().min(1)).default({}),
  options: z.array(choiceOptionSchema).min(1),
})

const choiceToolSchema = defineEntrySchema({
  kind: z.literal('choice'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /**
   * Optionales Eingabefeld ganz oben, z. B. Fußbodenaufbau: Ist es ausgefüllt, zeigen Spalten mit
   * floorHeight beide Höhen nebeneinander (Bezug ohne und mit Aufbau)
   */
  floorBuildUp: z
    .strictObject({
      name: z.string().trim().min(1),
      unit: z.string().trim().min(1),
      hint: z.string().trim().default(''),
      /** Spaltenkopf der eingetragenen Höhen, z. B. „OKFF“ */
      baseLabel: z.string().trim().min(1),
      /** Spaltenkopf der Höhen einschließlich Aufbau, z. B. „OKRFB“ */
      raisedLabel: z.string().trim().min(1),
    })
    .optional(),
  /** Optionale Auswahlleisten ganz oben, untereinander; jeweils die erste Option ist vorausgewählt */
  bars: z.array(choiceBarSchema).default([]),
  sections: z.array(choiceSectionSchema).min(1),
})

export const toolEntrySchema = z.discriminatedUnion('kind', [
  formulaToolSchema,
  tableToolSchema,
  choiceToolSchema,
  factorToolSchema,
  variantToolSchema,
])

export type FormulaTool = z.output<typeof formulaToolSchema>
export type TableTool = z.output<typeof tableToolSchema>
export type TableRow = z.output<typeof tableRowSchema>
export type ChoiceTool = z.output<typeof choiceToolSchema>
export type ChoiceSection = z.output<typeof choiceSectionSchema>
export type ToolEntry = FormulaTool | TableTool | ChoiceTool | FactorTool | VariantTool
export type { FactorTool, VariantTool }

export const isTableTool = (entry: ToolEntry): entry is TableTool => entry.kind === 'table'
export const isChoiceTool = (entry: ToolEntry): entry is ChoiceTool => entry.kind === 'choice'
export const isFactorTool = (entry: ToolEntry): entry is FactorTool => entry.kind === 'factor'
export const isVariantTool = (entry: ToolEntry): entry is VariantTool => entry.kind === 'variants'
export const isFormulaTool = (entry: ToolEntry): entry is FormulaTool => entry.kind === undefined

/** Fehlende oder unbekannte Spalten in den Werten einer Zeile bzw. Option */
function checkValues(where: string, keys: string[], values: Record<string, string>, allowMissing = false): string[] {
  const missing = allowMissing ? [] : keys.filter((key) => !(key in values))
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

/** Abschnitt passt zur Stellung der Leisten */
export function sectionVisible(section: ChoiceSection, selection: Record<string, string>): boolean {
  return Object.entries(section.when).every(([bar, option]) => selection[bar] === option)
}

/** Vorauswahl der Leisten: jeweils die erste Option */
export function defaultBarSelection(entry: ChoiceTool): Record<string, string> {
  return Object.fromEntries(entry.bars.map((bar) => [bar.key, bar.options[0]!.key]))
}

/** Jede mögliche Stellung der Leisten */
function allBarSelections(entry: ChoiceTool): Record<string, string>[] {
  return entry.bars.reduce<Record<string, string>[]>(
    (combinations, bar) =>
      combinations.flatMap((combination) => bar.options.map((option) => ({ ...combination, [bar.key]: option.key }))),
    [{}],
  )
}

export function checkChoiceTool(entry: ChoiceTool): string[] {
  const issues: string[] = []
  const barKeys = entry.bars.map((bar) => bar.key)
  if (new Set(barKeys).size !== barKeys.length) issues.push('bars: key doppelt vergeben')
  for (const bar of entry.bars) {
    const optionKeys = bar.options.map((option) => option.key)
    if (new Set(optionKeys).size !== optionKeys.length) issues.push(`bars (${bar.key}): Options-key doppelt vergeben`)
  }
  for (const selection of allBarSelections(entry)) {
    if (!entry.sections.some((section) => sectionVisible(section, selection))) {
      issues.push(`bars: kein Abschnitt für ${Object.values(selection).join(' + ')}`)
    }
  }
  entry.sections.forEach((section, sectionIndex) => {
    const where = `sections[${sectionIndex}] (${section.title})`
    for (const [barKey, optionKey] of Object.entries(section.when)) {
      const bar = entry.bars.find((candidate) => candidate.key === barKey)
      if (!bar) issues.push(`${where}: unbekannte Leiste "${barKey}"`)
      else if (!bar.options.some((option) => option.key === optionKey)) {
        issues.push(`${where}: unbekannte Option "${optionKey}" bei "${barKey}"`)
      }
    }
    const keys = section.columns.map((column) => column.key)
    if (new Set(keys).size !== keys.length) issues.push(`${where}: columns: key doppelt vergeben`)
    const labels = section.options.map((option) => option.label)
    if (new Set(labels).size !== labels.length) issues.push(`${where}: label doppelt vergeben`)
    const groups = new Set(section.columns.map((column) => column.group))
    for (const group of Object.keys(section.groupNotes)) {
      if (!groups.has(group)) issues.push(`${where}: groupNotes: unbekannte Gruppe "${group}"`)
    }
    section.options.forEach((option, index) => {
      // Fehlt eine Spalte, gibt es den Wert bei dieser Option nicht (Zeile wird nicht angezeigt)
      issues.push(...checkValues(`${where}, options[${index}] (${option.label})`, keys, option.values, true))
      if (Object.keys(option.values).length === 0) issues.push(`${where}, options[${index}] (${option.label}): keine Werte`)
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
          : isVariantTool(entry)
            ? checkVariantTool(entry)
            : formulaCollection.check!(entry as FormulaEntry),
  references: (entry) =>
    isFormulaTool(entry)
      ? formulaCollection.references!(entry as FormulaEntry)
      : isVariantTool(entry)
        ? variantReferences(entry)
        : [],
})
