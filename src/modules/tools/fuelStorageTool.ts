import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Brennstofflagerung ("kind": "fuelStorage"): Regelwerk (z. B. Muster-Feuerungsverordnung oder ein Bundesland),
// Brennstoff und Lagermenge wählen. Das Tool sagt, ob ein eigener Brennstofflagerraum nötig ist, und zeigt die
// Vorschriften und Empfehlungen nach Thema (Brandschutz, Lüftung, Strom, Beschilderung …).
// Grenzen, Regelwerke und Texte stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Grundeinheit einer Menge im Inhalt */
export const FUEL_UNITS = ['kg', 'l'] as const
export type FuelUnit = (typeof FUEL_UNITS)[number]

/** Eingabeeinheiten je Grundeinheit; reine Einheitenumrechnung, keine Stoffwerte */
export const INPUT_UNITS: Record<FuelUnit, { label: string; factor: number }[]> = {
  kg: [
    { label: 'kg', factor: 1 },
    { label: 't', factor: 1000 },
  ],
  l: [
    { label: 'l', factor: 1 },
    { label: 'm³', factor: 1000 },
  ],
}

const limitSchema = z.strictObject({
  /** key des Brennstoffs */
  fuel: key,
  /** Einheit, in der das Regelwerk diesen Brennstoff zählt; alle Mengen der Vorschriften stehen in dieser Einheit */
  unit: z.enum(FUEL_UNITS),
  /** Ab mehr als dieser Menge je Gebäude oder Brandabschnitt ist ein Brennstofflagerraum nötig */
  storageRoomAbove: z.number().positive(),
  /** Höchstes Fassungsvermögen je Brennstofflagerraum, falls das Regelwerk eines nennt */
  maxPerRoom: z.number().positive().optional(),
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
  /** true: nur wenn ein Brennstofflagerraum nötig ist; false: nur wenn nicht */
  storageRoom: z.boolean().optional(),
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
  storageRoom: z.boolean(),
  /** Diese Vorschriften müssen erscheinen */
  rules: z.array(key).default([]),
  /** Diese Vorschriften dürfen nicht erscheinen */
  notRules: z.array(key).default([]),
  source: z.string().trim().min(1),
})

export const fuelStorageToolSchema = defineEntrySchema({
  kind: z.literal('fuelStorage'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  related: z.array(z.string().startsWith('tool.')).default([]),
  /** Erstes Regelwerk ist vorausgewählt */
  regulations: z.array(regulationSchema).min(1),
  fuels: z.array(fuelSchema).min(1),
  /** Reihenfolge der Themen im Ergebnis */
  topics: z.array(topicSchema).min(1),
  rules: z.array(ruleSchema).min(1),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: z.string().trim().min(1),
  /** Fälle aus den Quellen; der Build prüft Einstufung und Vorschriften */
  examples: z.array(exampleSchema).min(1),
})

export type FuelStorageTool = z.output<typeof fuelStorageToolSchema>
export type FuelStorageRegulation = FuelStorageTool['regulations'][number]
export type FuelStorageLimit = FuelStorageRegulation['limits'][number]
export type FuelStorageFuel = FuelStorageTool['fuels'][number]
export type FuelStorageRule = FuelStorageTool['rules'][number]

export interface FuelStorageClassification {
  limit: FuelStorageLimit
  /** Mehr als die Grenze: eigener Brennstofflagerraum nötig */
  storageRoom: boolean
  /** Mehr als das zulässige Fassungsvermögen je Brennstofflagerraum */
  overMax: boolean
}

export function findRegulation(tool: FuelStorageTool, regulationKey: string): FuelStorageRegulation | undefined {
  return tool.regulations.find((regulation) => regulation.key === regulationKey)
}

export function findFuel(tool: FuelStorageTool, fuelKey: string): FuelStorageFuel | undefined {
  return tool.fuels.find((fuel) => fuel.key === fuelKey)
}

export function limitFor(tool: FuelStorageTool, regulationKey: string, fuelKey: string): FuelStorageLimit | undefined {
  return findRegulation(tool, regulationKey)?.limits.find((limit) => limit.fuel === fuelKey)
}

/** Einstufung einer Menge (in der Einheit des Regelwerks); undefined, wenn das Regelwerk den Brennstoff nicht kennt */
export function classifyStorage(
  tool: FuelStorageTool,
  regulationKey: string,
  fuelKey: string,
  quantity: number,
): FuelStorageClassification | undefined {
  const limit = limitFor(tool, regulationKey, fuelKey)
  if (!limit) return undefined
  return {
    limit,
    storageRoom: quantity > limit.storageRoomAbove,
    overMax: limit.maxPerRoom !== undefined && quantity > limit.maxPerRoom,
  }
}

/** Vorschriften für Regelwerk, Brennstoff und Menge, nach Thema sortiert, Pflichten vor Empfehlungen */
export function rulesForStorage(tool: FuelStorageTool, regulationKey: string, fuelKey: string, quantity: number): FuelStorageRule[] {
  const classification = classifyStorage(tool, regulationKey, fuelKey, quantity)
  if (!classification) return []
  const matches = (rule: FuelStorageRule) =>
    rule.applies.some(
      (applies) =>
        (applies.regulations.length === 0 || applies.regulations.includes(regulationKey)) &&
        applies.fuels.includes(fuelKey) &&
        (applies.above === undefined || quantity > applies.above) &&
        (applies.upTo === undefined || quantity <= applies.upTo) &&
        (applies.storageRoom === undefined || applies.storageRoom === classification.storageRoom),
    )
  const topicRank = (rule: FuelStorageRule) => tool.topics.findIndex((topic) => topic.key === rule.topic)
  const bindingRank = (rule: FuelStorageRule) => RULE_BINDINGS.indexOf(rule.binding)
  return tool.rules
    .filter(matches)
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => topicRank(a.rule) - topicRank(b.rule) || bindingRank(a.rule) - bindingRank(b.rule) || a.index - b.index)
    .map(({ rule }) => rule)
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkFuelStorageTool(tool: FuelStorageTool): string[] {
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
      if (limit.maxPerRoom !== undefined && limit.maxPerRoom <= limit.storageRoomAbove) {
        issues.push(`${where} (${limit.fuel}): maxPerRoom muss größer als storageRoomAbove sein`)
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
      if (applies.above !== undefined || applies.upTo !== undefined) {
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
    const classification = classifyStorage(tool, example.regulation, example.fuel, example.quantity)
    if (!classification) {
      issues.push(`${where}: keine Grenze für "${example.fuel}" in "${example.regulation}"`)
      return
    }
    if (classification.storageRoom !== example.storageRoom) {
      issues.push(`${where}: Brennstofflagerraum ${classification.storageRoom ? 'nötig' : 'nicht nötig'}, erwartet das Gegenteil`)
    }
    const shown = rulesForStorage(tool, example.regulation, example.fuel, example.quantity).map((rule) => rule.key)
    for (const ruleKey of [...example.rules, ...example.notRules]) {
      if (!ruleKeys.includes(ruleKey)) issues.push(`${where}: unbekannte Vorschrift "${ruleKey}"`)
    }
    for (const ruleKey of example.rules) {
      if (ruleKeys.includes(ruleKey) && !shown.includes(ruleKey)) issues.push(`${where}: Vorschrift "${ruleKey}" fehlt`)
    }
    for (const ruleKey of example.notRules) {
      if (shown.includes(ruleKey)) issues.push(`${where}: Vorschrift "${ruleKey}" erscheint, sollte aber nicht`)
    }
  })
  return issues
}

/** Suchbegriffe für die globale Suche */
export function fuelStorageKeywords(tool: FuelStorageTool): string[] {
  return [
    ...tool.regulations.map((regulation) => regulation.label),
    ...tool.fuels.flatMap((fuel) => [fuel.name, ...fuel.aliases]),
    ...tool.topics.map((topic) => topic.label),
    ...tool.rules.map((rule) => rule.title),
  ]
}
