import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Einstufungs-Tools ("kind": "classification"): Regelwerk (z. B. Muster-Feuerungsverordnung oder ein Bundesland),
// Brennstoff und eine Menge wählen, z. B. die Lagermenge (Brennstofflagerung) oder die Nennleistung (Heizraum).
// Das Tool sagt, ob die Menge über der Grenze des Regelwerks liegt (z. B. „Brennstofflagerraum erforderlich“), und
// zeigt die Vorschriften und Empfehlungen nach Thema, auf Wunsch mit errechneten Mindestwerten.
// Grenzen, Regelwerke, Beschriftungen und Texte stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Grundeinheit einer Menge im Inhalt */
export const CLASSIFICATION_UNITS = ['kg', 'l', 'kW'] as const
export type ClassificationUnit = (typeof CLASSIFICATION_UNITS)[number]

/** Eingabeeinheiten je Grundeinheit; reine Einheitenumrechnung, keine Stoffwerte */
export const INPUT_UNITS: Record<ClassificationUnit, { label: string; factor: number }[]> = {
  kg: [
    { label: 'kg', factor: 1 },
    { label: 't', factor: 1000 },
  ],
  l: [
    { label: 'l', factor: 1 },
    { label: 'm³', factor: 1000 },
  ],
  kW: [{ label: 'kW', factor: 1 }],
}

const limitSchema = z.strictObject({
  /** key des Brennstoffs */
  fuel: key,
  /** Einheit, in der das Regelwerk zählt; alle Mengen der Vorschriften stehen in dieser Einheit */
  unit: z.enum(CLASSIFICATION_UNITS),
  /** Grenze: Erst bei mehr als dieser Menge gilt die Einstufung „über der Grenze“ */
  above: z.number().positive(),
  /** Ergebnis über der Grenze, z. B. „Brennstofflagerraum erforderlich“ */
  aboveLabel: z.string().trim().min(1),
  /** Ergebnis bis zur Grenze, z. B. „Noch kein Brennstofflagerraum nötig“ */
  belowLabel: z.string().trim().min(1),
  /** Wofür die Grenze gilt, steht hinter der Zahl, z. B. „je Gebäude oder Brandabschnitt“ */
  scope: z.string().trim().default(''),
  /** Höchstmenge, die das Regelwerk überhaupt zulässt, mit Hinweis, z. B. Fassungsvermögen je Lagerraum */
  max: z.strictObject({ value: z.number().positive(), text: z.string().trim().min(1) }).optional(),
  /** Hinweis unter der Eingabe, z. B. wie gezählt wird */
  hint: z.string().trim().default(''),
  /** Fundstelle der Grenze, z. B. „MFeuV § 11 Abs. 1 Nr. 1“ */
  source: z.string().trim().min(1),
})

const regulationSchema = z.strictObject({
  key,
  /** Beschriftung in der Leiste, z. B. „Muster (MFeuV)“ */
  label: z.string().trim().min(1),
  /** Hinweis unter der Leiste, z. B. Stand und Abweichungen */
  note: z.string().trim().default(''),
  limits: z.array(limitSchema).min(1),
})

const fuelSchema = z.strictObject({
  key,
  name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Zusatz unter dem Namen, z. B. Beispiele */
  note: z.string().trim().default(''),
})

const topicSchema = z.strictObject({
  key,
  label: z.string().trim().min(1),
})

/** pflicht: steht in einer Vorschrift; empfehlung: Fachverband, Merkblatt, Norm ohne Rechtspflicht */
export const RULE_BINDINGS = ['pflicht', 'empfehlung'] as const

const appliesSchema = z.strictObject({
  /** keys der Regelwerke; leer = alle */
  regulations: z.array(key).default([]),
  /** keys der Brennstoffe */
  fuels: z.array(key).min(1),
  /** Nur bei mehr als dieser Menge (in der Einheit des Regelwerks) */
  above: z.number().min(0).optional(),
  /** Nur bis einschließlich dieser Menge */
  upTo: z.number().positive().optional(),
  /** true: nur über der Grenze des Regelwerks; false: nur bis zur Grenze */
  overLimit: z.boolean().optional(),
})

/** Errechneter Mindestwert: base + perUnit × (Menge − over), Menge unter over zählt als over */
const computedSchema = z.strictObject({
  /** z. B. „Mindestquerschnitt der Öffnung ins Freie“ */
  label: z.string().trim().min(1),
  base: z.number().min(0),
  perUnit: z.number().positive(),
  over: z.number().min(0).default(0),
  /** Einheit des Ergebnisses, z. B. „cm²“ */
  unit: z.string().trim().min(1),
})

const ruleSchema = z.strictObject({
  key,
  /** key des Themas */
  topic: key,
  binding: z.enum(RULE_BINDINGS),
  title: z.string().trim().min(1),
  /** Bedingung, die das Tool nicht abfragt, z. B. „Bei Kesseln über 50 kW“; steht über dem Text */
  condition: z.string().trim().default(''),
  /** Eigene Kurzfassung, kein Normtext */
  text: z.string().trim().min(1),
  /** Mindestwert, den das Tool für die eingegebene Menge ausrechnet und unter dem Text zeigt */
  computed: computedSchema.optional(),
  source: z.string().trim().min(1),
  /** Wann die Vorschrift erscheint; eine passende Zeile genügt */
  applies: z.array(appliesSchema).min(1),
})

const exampleSchema = z.strictObject({
  label: z.string().trim().min(1),
  regulation: key,
  fuel: key,
  /** Menge in der Einheit des Regelwerks */
  quantity: z.number().positive(),
  overLimit: z.boolean(),
  /** Diese Vorschriften müssen erscheinen */
  rules: z.array(key).default([]),
  /** Diese Vorschriften dürfen nicht erscheinen */
  notRules: z.array(key).default([]),
  /** Errechnete Mindestwerte, nachgerechnet aus der Vorschrift */
  values: z.array(z.strictObject({ rule: key, value: z.number() })).default([]),
  source: z.string().trim().min(1),
})

export const classificationToolSchema = defineEntrySchema({
  kind: z.literal('classification'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  related: z.array(z.string().startsWith('tool.')).default([]),
  /** Überschrift der Brennstoff-Auswahl, z. B. „Brennstoff der Feuerstätten“ */
  fuelsLabel: z.string().trim().default('Brennstoff'),
  /** Beschriftung der Eingabe, z. B. „Lagermenge“ oder „Gesamtnennleistung“ */
  quantityLabel: z.string().trim().min(1),
  /** Erstes Regelwerk ist vorausgewählt */
  regulations: z.array(regulationSchema).min(1),
  fuels: z.array(fuelSchema).min(1),
  /** Reihenfolge der Themen im Ergebnis */
  topics: z.array(topicSchema).min(1),
  rules: z.array(ruleSchema).min(1),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: z.string().trim().min(1),
  /** Fälle aus den Quellen; der Build prüft Einstufung, Vorschriften und errechnete Werte */
  examples: z.array(exampleSchema).min(1),
})

export type ClassificationTool = z.output<typeof classificationToolSchema>
export type ClassificationRegulation = ClassificationTool['regulations'][number]
export type ClassificationLimit = ClassificationRegulation['limits'][number]
export type ClassificationFuel = ClassificationTool['fuels'][number]
export type ClassificationRule = ClassificationTool['rules'][number]
export type ClassificationComputed = NonNullable<ClassificationRule['computed']>

export interface ClassificationResult {
  limit: ClassificationLimit
  /** Mehr als die Grenze */
  overLimit: boolean
  /** Mehr als die Höchstmenge des Regelwerks */
  overMax: boolean
}

export function findRegulation(tool: ClassificationTool, regulationKey: string): ClassificationRegulation | undefined {
  return tool.regulations.find((regulation) => regulation.key === regulationKey)
}

export function findFuel(tool: ClassificationTool, fuelKey: string): ClassificationFuel | undefined {
  return tool.fuels.find((fuel) => fuel.key === fuelKey)
}

export function limitFor(tool: ClassificationTool, regulationKey: string, fuelKey: string): ClassificationLimit | undefined {
  return findRegulation(tool, regulationKey)?.limits.find((limit) => limit.fuel === fuelKey)
}

/** Einstufung einer Menge (in der Einheit des Regelwerks); undefined, wenn das Regelwerk den Brennstoff nicht kennt */
export function classify(
  tool: ClassificationTool,
  regulationKey: string,
  fuelKey: string,
  quantity: number,
): ClassificationResult | undefined {
  const limit = limitFor(tool, regulationKey, fuelKey)
  if (!limit) return undefined
  return {
    limit,
    overLimit: quantity > limit.above,
    overMax: limit.max !== undefined && quantity > limit.max.value,
  }
}

/** Errechneter Mindestwert einer Vorschrift für die Menge */
export function computeValue(computed: ClassificationComputed, quantity: number): number {
  return computed.base + computed.perUnit * Math.max(0, quantity - computed.over)
}

/** Vorschriften für Regelwerk, Brennstoff und Menge, nach Thema sortiert, Pflichten vor Empfehlungen */
export function rulesFor(tool: ClassificationTool, regulationKey: string, fuelKey: string, quantity: number): ClassificationRule[] {
  const result = classify(tool, regulationKey, fuelKey, quantity)
  if (!result) return []
  const matches = (rule: ClassificationRule) =>
    rule.applies.some(
      (applies) =>
        (applies.regulations.length === 0 || applies.regulations.includes(regulationKey)) &&
        applies.fuels.includes(fuelKey) &&
        (applies.above === undefined || quantity > applies.above) &&
        (applies.upTo === undefined || quantity <= applies.upTo) &&
        (applies.overLimit === undefined || applies.overLimit === result.overLimit),
    )
  const topicRank = (rule: ClassificationRule) => tool.topics.findIndex((topic) => topic.key === rule.topic)
  const bindingRank = (rule: ClassificationRule) => RULE_BINDINGS.indexOf(rule.binding)
  return tool.rules
    .filter(matches)
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => topicRank(a.rule) - topicRank(b.rule) || bindingRank(a.rule) - bindingRank(b.rule) || a.index - b.index)
    .map(({ rule }) => rule)
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

// Rundungsfehler beim Nachrechnen der Beispiele (z. B. 1,6 × 7) sollen nicht als Fehler gelten
const EPSILON = 1e-9

export function checkClassificationTool(tool: ClassificationTool): string[] {
  const issues: string[] = []
  const regulationKeys = tool.regulations.map((regulation) => regulation.key)
  const fuelKeys = tool.fuels.map((fuel) => fuel.key)
  const topicKeys = tool.topics.map((topic) => topic.key)
  for (const value of duplicates(regulationKeys)) issues.push(`regulations: key "${value}" doppelt vergeben`)
  for (const value of duplicates(fuelKeys)) issues.push(`fuels: key "${value}" doppelt vergeben`)
  for (const value of duplicates(topicKeys)) issues.push(`topics: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.rules.map((rule) => rule.key))) issues.push(`rules: key "${value}" doppelt vergeben`)

  for (const regulation of tool.regulations) {
    const where = `regulations (${regulation.label})`
    for (const value of duplicates(regulation.limits.map((limit) => limit.fuel))) issues.push(`${where}: Brennstoff "${value}" doppelt`)
    for (const limit of regulation.limits) {
      if (!fuelKeys.includes(limit.fuel)) issues.push(`${where}: unbekannter Brennstoff "${limit.fuel}"`)
      if (limit.max !== undefined && limit.max.value <= limit.above) {
        issues.push(`${where} (${limit.fuel}): max muss größer als above sein`)
      }
    }
  }
  for (const fuel of tool.fuels) {
    if (!tool.regulations.some((regulation) => regulation.limits.some((limit) => limit.fuel === fuel.key))) {
      issues.push(`fuels (${fuel.name}): in keinem Regelwerk eine Grenze`)
    }
  }

  for (const rule of tool.rules) {
    const where = `rules (${rule.title})`
    if (!topicKeys.includes(rule.topic)) issues.push(`${where}: unbekanntes Thema "${rule.topic}"`)
    for (const applies of rule.applies) {
      for (const regulationKey of applies.regulations) {
        if (!regulationKeys.includes(regulationKey)) issues.push(`${where}: unbekanntes Regelwerk "${regulationKey}"`)
      }
      for (const fuelKey of applies.fuels) {
        if (!fuelKeys.includes(fuelKey)) issues.push(`${where}: unbekannter Brennstoff "${fuelKey}"`)
      }
      if (applies.above !== undefined && applies.upTo !== undefined && applies.above >= applies.upTo) {
        issues.push(`${where}: above muss kleiner als upTo sein`)
      }
      // Mengen stehen in der Einheit des Regelwerks: Bei mehreren Regelwerken muss sie dieselbe sein
      if (applies.above !== undefined || applies.upTo !== undefined || rule.computed) {
        const regulations = applies.regulations.length === 0 ? regulationKeys : applies.regulations
        for (const fuelKey of applies.fuels) {
          const units = new Set(regulations.flatMap((regulationKey) => limitFor(tool, regulationKey, fuelKey)?.unit ?? []))
          if (units.size > 1) issues.push(`${where}: Mengen für "${fuelKey}" in verschiedenen Einheiten je Regelwerk`)
        }
      }
    }
  }
  for (const topic of tool.topics) {
    if (!tool.rules.some((rule) => rule.topic === topic.key)) issues.push(`topics (${topic.label}): keine Vorschrift`)
  }

  const ruleKeys = tool.rules.map((rule) => rule.key)
  tool.examples.forEach((example, index) => {
    const where = `examples[${index}] (${example.label})`
    const result = classify(tool, example.regulation, example.fuel, example.quantity)
    if (!result) {
      issues.push(`${where}: keine Grenze für "${example.fuel}" in "${example.regulation}"`)
      return
    }
    if (result.overLimit !== example.overLimit) {
      issues.push(`${where}: ergibt ${result.overLimit ? 'über' : 'bis zur'} Grenze, erwartet das Gegenteil`)
    }
    const shown = rulesFor(tool, example.regulation, example.fuel, example.quantity)
    const shownKeys = shown.map((rule) => rule.key)
    for (const ruleKey of [...example.rules, ...example.notRules, ...example.values.map((value) => value.rule)]) {
      if (!ruleKeys.includes(ruleKey)) issues.push(`${where}: unbekannte Vorschrift "${ruleKey}"`)
    }
    for (const ruleKey of example.rules) {
      if (ruleKeys.includes(ruleKey) && !shownKeys.includes(ruleKey)) issues.push(`${where}: Vorschrift "${ruleKey}" fehlt`)
    }
    for (const ruleKey of example.notRules) {
      if (shownKeys.includes(ruleKey)) issues.push(`${where}: Vorschrift "${ruleKey}" erscheint, sollte aber nicht`)
    }
    for (const expected of example.values) {
      const rule = shown.find((candidate) => candidate.key === expected.rule)
      if (!rule) {
        if (ruleKeys.includes(expected.rule)) issues.push(`${where}: Vorschrift "${expected.rule}" mit Wert fehlt`)
      } else if (!rule.computed) {
        issues.push(`${where}: Vorschrift "${expected.rule}" rechnet keinen Wert`)
      } else {
        const value = computeValue(rule.computed, example.quantity)
        if (Math.abs(value - expected.value) > EPSILON) issues.push(`${where}: "${expected.rule}" ergibt ${value} statt ${expected.value}`)
      }
    }
  })
  return issues
}

/** Suchbegriffe für die globale Suche */
export function classificationKeywords(tool: ClassificationTool): string[] {
  return [
    ...tool.regulations.map((regulation) => regulation.label),
    ...tool.fuels.flatMap((fuel) => [fuel.name, ...fuel.aliases]),
    ...tool.topics.map((topic) => topic.label),
    ...tool.rules.map((rule) => rule.title),
  ]
}
