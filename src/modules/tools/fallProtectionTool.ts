import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Absturzsicherungs-Tools ("kind": "fallProtection"): Arbeitsplatz wählen (z. B. Flachdach, Gerüst, Leiter), Absturz- bzw.
// Standhöhe eingeben. Das Tool zeigt, welcher Bereich der Quelle zutrifft (z. B. „Absturzsicherung erforderlich“), und die
// Schutzmaßnahmen in der Rangfolge der Quelle (Absturzsicherung vor Auffangeinrichtung vor PSA gegen Absturz), jeweils mit
// Maßen und Vorgaben zum richtigen Aufbau. Grenzen, Bereiche, Maße und Texte stehen im Inhalt, nicht im Code; das Tool
// vergleicht nur die Höhe mit den Bereichsgrenzen.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)

/** Fundstelle: Quelle (key) und Stelle darin, z. B. „§ 9 Abs. 2 Nr. 3, S. 12“ */
const refSchema = z.strictObject({
  source: key,
  where: text,
})

/** Verbindlichkeit einer Vorgabe; Reihenfolge = Sortierung in der Anzeige */
export const FALL_RULE_LEVELS = {
  forbidden: { label: 'Nicht zulässig' },
  required: { label: 'Pflicht' },
  exception: { label: 'Ausnahme' },
  note: { label: 'Hinweis' },
} as const

export type FallRuleLevel = keyof typeof FALL_RULE_LEVELS
const FALL_RULE_LEVEL_KEYS = Object.keys(FALL_RULE_LEVELS) as [FallRuleLevel, ...FallRuleLevel[]]

/** Ergebnis eines Höhenbereichs; steuert nur die Farbe der Anzeige */
export const FALL_BAND_TONES = ['required', 'limited', 'forbidden', 'ok'] as const
export type FallBandTone = (typeof FALL_BAND_TONES)[number]

const ruleSchema = z.strictObject({
  level: z.enum(FALL_RULE_LEVEL_KEYS),
  /** Eigene Kurzfassung, kein Text aus der Quelle */
  text,
  ref: refSchema,
})

/** Maß oder Kennwert zum Aufbau, z. B. „Abstand Belag – Bauwerk“ → „≤ 0,30 m“ */
const specSchema = z.strictObject({
  label: text,
  /** Wert wie in der Quelle */
  value: text,
  note: z.string().trim().default(''),
  ref: refSchema,
})

/**
 * Höhenbereich eines Arbeitsplatzes: gilt für Höhen über above (ausschließlich) bis upTo (einschließlich).
 * Fehlt above, beginnt der Bereich bei 0; fehlt upTo, ist er nach oben offen. Ein Bereich ohne beide Grenzen gilt immer,
 * dann fragt das Tool keine Höhe ab.
 */
const bandSchema = z.strictObject({
  above: z.number().min(0).optional(),
  upTo: z.number().positive().optional(),
  tone: z.enum(FALL_BAND_TONES),
  /** Ergebnis in einem Satz, z. B. „Absturzsicherung erforderlich“ */
  label: text,
  /** Erklärung darunter */
  text: z.string().trim().default(''),
  ref: refSchema,
})

const situationSchema = z.strictObject({
  key,
  label: text,
  note: z.string().trim().default(''),
  aliases: z.array(text).default([]),
  /** Beschriftung der Höheneingabe, z. B. „Standhöhe auf der Leiter“ */
  heightLabel: text.default('Absturzhöhe'),
  /** Erklärung unter der Eingabe, z. B. wie die Höhe gemessen wird */
  heightHint: z.string().trim().default(''),
  bands: z.array(bandSchema).min(1),
  /** Vorgaben zu diesem Arbeitsplatz, unabhängig von der Maßnahme */
  rules: z.array(ruleSchema).default([]),
  /** Schutzmaßnahmen (key), die hier angeboten werden; angezeigt in der Rangfolge */
  measures: z.array(key).default([]),
})

/** Stufe der Rangfolge, z. B. „Absturzsicherung“ vor „Auffangeinrichtung“ */
const rankSchema = z.strictObject({
  key,
  label: text,
  text,
  ref: refSchema,
})

const measureSchema = z.strictObject({
  key,
  /** key der Stufe in der Rangfolge */
  rank: key,
  label: text,
  /** Wann die Maßnahme passt, ein Satz */
  summary: text,
  aliases: z.array(text).default([]),
  specs: z.array(specSchema).default([]),
  rules: z.array(ruleSchema).default([]),
  /** Solange Angaben fehlen: beginnt mit „TODO: Inhalt fehlt“ */
  todo: z.string().trim().default(''),
})

const sourceSchema = z.strictObject({
  key,
  /** Kurzname für die Fundstellen, z. B. „DGUV Vorschrift 38“ */
  name: text,
  /** Dokument mit Ausgabe und Link */
  source: text,
})

/** Fall aus der Quelle; der Build prüft, dass das Tool dafür den erwarteten Bereich findet */
const exampleSchema = z.strictObject({
  label: text,
  situation: key,
  /** Höhe in m; fehlt bei Arbeitsplätzen ohne Höhenabfrage */
  height: z.number().min(0).optional(),
  tone: z.enum(FALL_BAND_TONES),
  ref: refSchema,
})

export const fallProtectionToolSchema = defineEntrySchema({
  kind: z.literal('fallProtection'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: text,
  sources: z.array(sourceSchema).min(1),
  situations: z.array(situationSchema).min(1),
  /** Reihenfolge = Rangfolge der Schutzmaßnahmen */
  ranks: z.array(rankSchema).min(1),
  measures: z.array(measureSchema).min(1),
  examples: z.array(exampleSchema).min(1),
})

export type FallProtectionTool = z.output<typeof fallProtectionToolSchema>
export type FallSituation = FallProtectionTool['situations'][number]
export type FallBand = FallSituation['bands'][number]
export type FallMeasure = FallProtectionTool['measures'][number]
export type FallRule = FallMeasure['rules'][number]
export type FallSpec = FallMeasure['specs'][number]
export type FallRef = FallRule['ref']
export type FallRank = FallProtectionTool['ranks'][number]

/** Der Arbeitsplatz fragt eine Höhe ab, weil seine Bereiche Grenzen haben */
export const needsHeight = (situation: FallSituation): boolean =>
  situation.bands.some((band) => band.above !== undefined || band.upTo !== undefined)

/** Bereich für die Höhe (m); bei Arbeitsplätzen ohne Höhenabfrage der einzige Bereich */
export function bandFor(situation: FallSituation, height: number | undefined): FallBand | undefined {
  if (!needsHeight(situation)) return situation.bands[0]
  if (height === undefined) return undefined
  return situation.bands.find(
    (band) => (band.above === undefined || height > band.above) && (band.upTo === undefined || height <= band.upTo),
  )
}

/** Maßnahmen des Arbeitsplatzes nach Stufe der Rangfolge; Stufen ohne Maßnahme entfallen */
export function measuresByRank(tool: FallProtectionTool, situation: FallSituation): { rank: FallRank; measures: FallMeasure[] }[] {
  const offered = situation.measures.flatMap((measureKey) => tool.measures.filter((measure) => measure.key === measureKey))
  return tool.ranks
    .map((rank) => ({ rank, measures: offered.filter((measure) => measure.rank === rank.key) }))
    .filter((group) => group.measures.length > 0)
}

const byLevel = (a: FallRule, b: FallRule) => FALL_RULE_LEVEL_KEYS.indexOf(a.level) - FALL_RULE_LEVEL_KEYS.indexOf(b.level)

/** Vorgaben nach Verbindlichkeit sortiert, sonst in der Reihenfolge des Inhalts */
export const sortRules = (rules: readonly FallRule[]): FallRule[] => [...rules].sort(byLevel)

/** Fundstelle als Text, z. B. „DGUV Vorschrift 38, § 9 Abs. 2“ */
export function refText(tool: FallProtectionTool, ref: FallRef): string {
  const source = tool.sources.find((candidate) => candidate.key === ref.source)
  return `${source?.name ?? ref.source}, ${ref.where}`
}

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkFallProtectionTool(tool: FallProtectionTool): string[] {
  const issues: string[] = []
  const sourceKeys = tool.sources.map((source) => source.key)
  const rankKeys = tool.ranks.map((rank) => rank.key)
  const measureKeys = tool.measures.map((measure) => measure.key)
  const situationKeys = tool.situations.map((situation) => situation.key)
  for (const value of duplicates(sourceKeys)) issues.push(`sources: key "${value}" doppelt vergeben`)
  for (const value of duplicates(rankKeys)) issues.push(`ranks: key "${value}" doppelt vergeben`)
  for (const value of duplicates(measureKeys)) issues.push(`measures: key "${value}" doppelt vergeben`)
  for (const value of duplicates(situationKeys)) issues.push(`situations: key "${value}" doppelt vergeben`)

  const usedSources = new Set<string>()
  const checkRef = (ref: FallRef, where: string) => {
    usedSources.add(ref.source)
    if (!sourceKeys.includes(ref.source)) issues.push(`${where}: unbekannte Quelle "${ref.source}"`)
  }
  tool.ranks.forEach((rank) => checkRef(rank.ref, `ranks (${rank.key})`))

  for (const situation of tool.situations) {
    const where = `situations (${situation.key})`
    situation.rules.forEach((rule, index) => checkRef(rule.ref, `${where}, rules[${index}]`))
    for (const value of duplicates(situation.measures)) issues.push(`${where}: Maßnahme "${value}" doppelt`)
    for (const measureKey of situation.measures) {
      if (!measureKeys.includes(measureKey)) issues.push(`${where}: unbekannte Maßnahme "${measureKey}"`)
    }
    // Bereiche lückenlos von 0 bis offen, aufsteigend: jede Höhe trifft genau einen
    situation.bands.forEach((band, index) => {
      const bandWhere = `${where}, bands[${index}]`
      checkRef(band.ref, bandWhere)
      const previous = situation.bands[index - 1]
      if (index === 0 && band.above !== undefined) issues.push(`${bandWhere}: erster Bereich muss bei 0 beginnen (ohne above)`)
      if (previous && band.above !== previous.upTo) issues.push(`${bandWhere}: above muss upTo des Bereichs davor sein`)
      if (index === situation.bands.length - 1 && band.upTo !== undefined) issues.push(`${bandWhere}: letzter Bereich muss nach oben offen sein (ohne upTo)`)
      if (index < situation.bands.length - 1 && band.upTo === undefined) issues.push(`${bandWhere}: upTo fehlt`)
      if (band.above !== undefined && band.upTo !== undefined && band.above >= band.upTo) {
        issues.push(`${bandWhere}: above muss kleiner als upTo sein`)
      }
    })
  }

  for (const measure of tool.measures) {
    const where = `measures (${measure.key})`
    if (!rankKeys.includes(measure.rank)) issues.push(`${where}: unbekannte Stufe "${measure.rank}"`)
    measure.specs.forEach((spec, index) => checkRef(spec.ref, `${where}, specs[${index}]`))
    measure.rules.forEach((rule, index) => checkRef(rule.ref, `${where}, rules[${index}]`))
    if (measure.todo && !measure.todo.startsWith('TODO: Inhalt fehlt')) issues.push(`${where}: todo muss mit „TODO: Inhalt fehlt“ beginnen`)
    if (measure.todo && tool.status === 'verified') issues.push(`${where}: todo bei verified nicht erlaubt`)
    if (!measure.todo && measure.specs.length === 0 && measure.rules.length === 0) issues.push(`${where}: keine Maße und keine Vorgaben`)
    if (!tool.situations.some((situation) => situation.measures.includes(measure.key))) {
      issues.push(`${where}: wird bei keinem Arbeitsplatz angeboten`)
    }
  }

  tool.examples.forEach((example, index) => {
    const where = `examples[${index}] (${example.label})`
    checkRef(example.ref, where)
    const situation = tool.situations.find((candidate) => candidate.key === example.situation)
    if (!situation) {
      issues.push(`${where}: unbekannter Arbeitsplatz "${example.situation}"`)
      return
    }
    if (needsHeight(situation) && example.height === undefined) issues.push(`${where}: Höhe fehlt`)
    const band = bandFor(situation, example.height)
    if (!band) issues.push(`${where}: kein Bereich gefunden`)
    else if (band.tone !== example.tone) issues.push(`${where}: ergibt "${band.tone}" statt "${example.tone}"`)
  })

  for (const source of sourceKeys) {
    if (!usedSources.has(source)) issues.push(`sources (${source}): wird nirgends zitiert`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function fallProtectionKeywords(tool: FallProtectionTool): string[] {
  return [
    ...tool.keywords,
    ...tool.situations.flatMap((situation) => [situation.label, ...situation.aliases]),
    ...tool.ranks.map((rank) => rank.label),
    ...tool.measures.flatMap((measure) => [measure.label, ...measure.aliases]),
    ...tool.sources.map((source) => source.name),
  ]
}
