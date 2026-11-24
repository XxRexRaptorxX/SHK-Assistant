import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Ladungssicherungs-Tools ("kind": "loadSecuring"): Ladegut wählen (z. B. Kisten, Gasflaschen, Minibagger). Das Tool zeigt
// die Vorgaben für dieses Ladegut, die Umsetzung Schritt für Schritt sowie Sicherungsarten, Zurr- und Hilfsmittel mit
// Kennwerten. Optional rechnet es aus Gewicht und Fahrzeugklasse die Kräfte, die die Sicherung aufnehmen muss
// (Beiwert × Gewichtskraft), und prüft, ob die Ladung kippgefährdet ist. Beiwerte, Texte und Grenzen stehen im Inhalt,
// nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)

/** Fundstelle: Quelle (key) und Stelle darin, z. B. „Abschn. 8.1, S. 36“ */
const refSchema = z.strictObject({
  source: key,
  where: text,
})

/** Verbindlichkeit einer Vorgabe; Reihenfolge = Sortierung in der Anzeige */
export const LOAD_RULE_LEVELS = {
  forbidden: { label: 'Nicht zulässig' },
  required: { label: 'Pflicht' },
  note: { label: 'Hinweis' },
} as const

export type LoadRuleLevel = keyof typeof LOAD_RULE_LEVELS
const LOAD_RULE_LEVEL_KEYS = Object.keys(LOAD_RULE_LEVELS) as [LoadRuleLevel, ...LoadRuleLevel[]]

const ruleSchema = z.strictObject({
  level: z.enum(LOAD_RULE_LEVEL_KEYS),
  /** Eigene Kurzfassung, kein Text aus der Quelle */
  text,
  ref: refSchema,
})

/** Kennwert, z. B. „Überstand nach hinten“ → „≤ 1,50 m“ */
const specSchema = z.strictObject({
  label: text,
  /** Wert wie in der Quelle */
  value: text,
  note: z.string().trim().default(''),
  ref: refSchema,
})

/** Arbeitsschritt der Umsetzung, eigene Kurzfassung */
const stepSchema = z.strictObject({
  text,
  ref: refSchema,
})

const factor = z.number().positive().max(2)

/** Beiwerte (Vielfaches der Gewichtskraft) je Richtung; *Tipping nur, wenn die Quelle für kippgefährdete Ladung abweicht */
const forcesSchema = z.strictObject({
  forward: factor,
  backward: factor,
  side: factor,
  backwardTipping: factor.optional(),
  sideTipping: factor.optional(),
})

/** Fahrzeugklasse nach zulässiger Gesamtmasse, z. B. „über 2,0 t bis 3,5 t“ */
const vehicleClassSchema = z.strictObject({
  key,
  label: text,
  note: z.string().trim().default(''),
  forces: forcesSchema,
  ref: refSchema,
})

/** Rechenbeispiel aus der Quelle zur Kippprüfung; der Build prüft, dass das Tool dasselbe Ergebnis liefert */
const tippingExampleSchema = z.strictObject({
  label: text,
  /** Schwerpunkthöhe d in m */
  height: z.number().positive(),
  /** Abstand Schwerpunkt – Kippkante b in m */
  distance: z.number().positive(),
  stable: z.boolean(),
  ref: refSchema,
})

const tippingSchema = z.strictObject({
  /** Beschleunigungsbeiwert quer zur Fahrtrichtung für die Kippprüfung */
  factor,
  /** Erklärung unter den Eingaben */
  text,
  ref: refSchema,
  examples: z.array(tippingExampleSchema).min(1),
})

/** Gruppe der Maßnahmen, z. B. „Sicherungsart“ oder „Zurr- und Hilfsmittel“; Reihenfolge = Anzeige */
const groupSchema = z.strictObject({
  key,
  label: text,
})

const measureSchema = z.strictObject({
  key,
  /** key der Gruppe */
  group: key,
  label: text,
  /** Wofür, ein Satz */
  summary: text,
  aliases: z.array(text).default([]),
  specs: z.array(specSchema).default([]),
  rules: z.array(ruleSchema).default([]),
  /** Solange Angaben fehlen: beginnt mit „TODO: Inhalt fehlt“ */
  todo: z.string().trim().default(''),
})

const cargoSchema = z.strictObject({
  key,
  label: text,
  note: z.string().trim().default(''),
  aliases: z.array(text).default([]),
  /** Vorgaben für dieses Ladegut */
  rules: z.array(ruleSchema).default([]),
  /** Kennwerte für dieses Ladegut, z. B. zulässiger Überstand */
  specs: z.array(specSchema).default([]),
  /** Umsetzung in dieser Reihenfolge */
  steps: z.array(stepSchema).default([]),
  /** Passende Maßnahmen (keys); angezeigt nach Gruppe, innerhalb der Gruppe in dieser Reihenfolge */
  measures: z.array(key).default([]),
  /** Solange Angaben fehlen: beginnt mit „TODO: Inhalt fehlt“ */
  todo: z.string().trim().default(''),
})

const checklistGroupSchema = z.strictObject({
  label: text,
  items: z.array(text).min(1),
  ref: refSchema,
})

const sourceSchema = z.strictObject({
  key,
  /** Kurzname für die Fundstellen, z. B. „BG BAU Ladungssicherung“ */
  name: text,
  /** Dokument mit Ausgabe und Link */
  source: text,
})

export const loadSecuringToolSchema = defineEntrySchema({
  kind: z.literal('loadSecuring'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: text,
  sources: z.array(sourceSchema).min(1),
  /** Vorgaben, die für jedes Ladegut gelten */
  generalRules: z.array(ruleSchema).min(1),
  /** Erklärung zur Kräfteberechnung, z. B. „1 kg entspricht etwa 1 daN“ */
  forcesText: text,
  forcesRef: refSchema,
  vehicleClasses: z.array(vehicleClassSchema).min(1),
  tipping: tippingSchema,
  groups: z.array(groupSchema).min(1),
  measures: z.array(measureSchema).min(1),
  cargos: z.array(cargoSchema).min(1),
  checklist: z.array(checklistGroupSchema).default([]),
})

export type LoadSecuringTool = z.output<typeof loadSecuringToolSchema>
export type LoadCargo = LoadSecuringTool['cargos'][number]
export type LoadMeasure = LoadSecuringTool['measures'][number]
export type LoadGroup = LoadSecuringTool['groups'][number]
export type LoadRule = LoadMeasure['rules'][number]
export type LoadSpec = LoadMeasure['specs'][number]
export type LoadRef = LoadRule['ref']
export type LoadVehicleClass = LoadSecuringTool['vehicleClasses'][number]

export type LoadDirection = 'forward' | 'backward' | 'side'

export interface LoadForce {
  direction: LoadDirection
  /** Beiwert, mit dem gerechnet wurde */
  factor: number
  /** Kraft in daN, gerundet auf ganze daN */
  force: number
}

/**
 * Kräfte, die die Sicherung je Richtung aufnehmen muss: Beiwert × Gewichtskraft. Gewicht in kg, Ergebnis in daN
 * (1 kg Masse ≙ 10 N = 1 daN, wie in der Quelle). Bei kippgefährdeter Ladung gelten die abweichenden Beiwerte der
 * Fahrzeugklasse, soweit vorhanden.
 */
export function forcesFor(vehicleClass: LoadVehicleClass, weightKg: number, tippingProne: boolean): LoadForce[] {
  const { forces } = vehicleClass
  const factors: Record<LoadDirection, number> = {
    forward: forces.forward,
    backward: tippingProne ? (forces.backwardTipping ?? forces.backward) : forces.backward,
    side: tippingProne ? (forces.sideTipping ?? forces.side) : forces.side,
  }
  return (['forward', 'backward', 'side'] as const).map((direction) => ({
    direction,
    factor: factors[direction],
    force: Math.round(factors[direction] * weightKg),
  }))
}

/** Hat die Fahrzeugklasse eigene Beiwerte für kippgefährdete Ladung? */
export const hasTippingForces = (vehicleClass: LoadVehicleClass): boolean =>
  vehicleClass.forces.backwardTipping !== undefined || vehicleClass.forces.sideTipping !== undefined

/**
 * Standsicher, wenn der Abstand Schwerpunkt – Kippkante größer ist als Beiwert × Schwerpunkthöhe. Bei Gleichstand gilt
 * die Ladung als kippgefährdet (sichere Seite); die Quelle nennt nur „kleiner“ und „größer“.
 */
export const isStable = (tipping: LoadSecuringTool['tipping'], height: number, distance: number): boolean =>
  distance > tipping.factor * height

/** Grenzwert für den Abstand zur Kippkante: Beiwert × Schwerpunkthöhe */
export const tippingLimit = (tipping: LoadSecuringTool['tipping'], height: number): number => tipping.factor * height

/** Maßnahmen des Ladeguts nach Gruppe; Gruppen ohne Maßnahme entfallen */
export function measuresByGroup(tool: LoadSecuringTool, cargo: LoadCargo): { group: LoadGroup; measures: LoadMeasure[] }[] {
  const offered = cargo.measures.flatMap((measureKey) => tool.measures.filter((measure) => measure.key === measureKey))
  return tool.groups
    .map((group) => ({ group, measures: offered.filter((measure) => measure.group === group.key) }))
    .filter((entry) => entry.measures.length > 0)
}

const byLevel = (a: LoadRule, b: LoadRule) => LOAD_RULE_LEVEL_KEYS.indexOf(a.level) - LOAD_RULE_LEVEL_KEYS.indexOf(b.level)

/** Vorgaben nach Verbindlichkeit sortiert, sonst in der Reihenfolge des Inhalts */
export const sortLoadRules = (rules: readonly LoadRule[]): LoadRule[] => [...rules].sort(byLevel)

/** Fundstelle als Text, z. B. „BG BAU Ladungssicherung, Abschn. 8.1, S. 36“ */
export function loadRefText(tool: LoadSecuringTool, ref: LoadRef): string {
  const source = tool.sources.find((candidate) => candidate.key === ref.source)
  return `${source?.name ?? ref.source}, ${ref.where}`
}

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkLoadSecuringTool(tool: LoadSecuringTool): string[] {
  const issues: string[] = []
  const sourceKeys = tool.sources.map((source) => source.key)
  const groupKeys = tool.groups.map((group) => group.key)
  const measureKeys = tool.measures.map((measure) => measure.key)
  for (const value of duplicates(sourceKeys)) issues.push(`sources: key "${value}" doppelt vergeben`)
  for (const value of duplicates(groupKeys)) issues.push(`groups: key "${value}" doppelt vergeben`)
  for (const value of duplicates(measureKeys)) issues.push(`measures: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.cargos.map((cargo) => cargo.key))) issues.push(`cargos: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.vehicleClasses.map((entry) => entry.key))) {
    issues.push(`vehicleClasses: key "${value}" doppelt vergeben`)
  }

  const usedSources = new Set<string>()
  const checkRef = (ref: LoadRef, where: string) => {
    usedSources.add(ref.source)
    if (!sourceKeys.includes(ref.source)) issues.push(`${where}: unbekannte Quelle "${ref.source}"`)
  }
  const checkTodo = (todo: string, where: string) => {
    if (todo && !todo.startsWith('TODO: Inhalt fehlt')) issues.push(`${where}: todo muss mit „TODO: Inhalt fehlt“ beginnen`)
    if (todo && tool.status === 'verified') issues.push(`${where}: todo bei verified nicht erlaubt`)
  }

  tool.generalRules.forEach((rule, index) => checkRef(rule.ref, `generalRules[${index}]`))
  checkRef(tool.forcesRef, 'forcesRef')
  tool.vehicleClasses.forEach((entry) => checkRef(entry.ref, `vehicleClasses (${entry.key})`))
  checkRef(tool.tipping.ref, 'tipping')
  tool.checklist.forEach((group) => checkRef(group.ref, `checklist (${group.label})`))

  tool.tipping.examples.forEach((example, index) => {
    const where = `tipping.examples[${index}] (${example.label})`
    checkRef(example.ref, where)
    const stable = isStable(tool.tipping, example.height, example.distance)
    if (stable !== example.stable) issues.push(`${where}: ergibt ${stable ? 'standsicher' : 'kippgefährdet'}`)
  })

  for (const measure of tool.measures) {
    const where = `measures (${measure.key})`
    if (!groupKeys.includes(measure.group)) issues.push(`${where}: unbekannte Gruppe "${measure.group}"`)
    measure.specs.forEach((spec, index) => checkRef(spec.ref, `${where}, specs[${index}]`))
    measure.rules.forEach((rule, index) => checkRef(rule.ref, `${where}, rules[${index}]`))
    checkTodo(measure.todo, where)
    if (!measure.todo && measure.specs.length === 0 && measure.rules.length === 0) issues.push(`${where}: keine Kennwerte und keine Vorgaben`)
    if (!tool.cargos.some((cargo) => cargo.measures.includes(measure.key))) issues.push(`${where}: wird bei keinem Ladegut angeboten`)
  }

  for (const cargo of tool.cargos) {
    const where = `cargos (${cargo.key})`
    cargo.rules.forEach((rule, index) => checkRef(rule.ref, `${where}, rules[${index}]`))
    cargo.specs.forEach((spec, index) => checkRef(spec.ref, `${where}, specs[${index}]`))
    cargo.steps.forEach((step, index) => checkRef(step.ref, `${where}, steps[${index}]`))
    checkTodo(cargo.todo, where)
    for (const value of duplicates(cargo.measures)) issues.push(`${where}: Maßnahme "${value}" doppelt`)
    for (const measureKey of cargo.measures) {
      if (!measureKeys.includes(measureKey)) issues.push(`${where}: unbekannte Maßnahme "${measureKey}"`)
    }
    if (!cargo.todo && cargo.rules.length === 0 && cargo.steps.length === 0) issues.push(`${where}: keine Vorgaben und keine Schritte`)
  }

  for (const source of sourceKeys) {
    if (!usedSources.has(source)) issues.push(`sources (${source}): wird nirgends zitiert`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function loadSecuringKeywords(tool: LoadSecuringTool): string[] {
  return [
    ...tool.keywords,
    ...tool.cargos.flatMap((cargo) => [cargo.label, ...cargo.aliases]),
    ...tool.measures.flatMap((measure) => [measure.label, ...measure.aliases]),
    ...tool.sources.map((source) => source.name),
  ]
}
