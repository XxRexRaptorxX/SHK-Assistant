import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { toolTagsSchema } from './toolTags.ts'

// Normen-Tools ("kind": "normFinder"): Man wählt einen oder mehrere Themenbereiche im Menü, z. B. Heizöl und Gewerblich,
// und bekommt die dafür zuständigen Normen und Regelwerke mit eigener Kurzbeschreibung und Link.
// Nur Nummern, eigene Kurzbeschreibungen und Links, keine Normtexte (siehe CLAUDE.md, Urheberrecht).

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Art des Regelwerks: label für die Marke auf der Karte, filter für den Schalter; in der Reihenfolge der Schalter */
export const NORM_TYPES = {
  standard: { label: 'Norm', filter: 'Normen' },
  rule: { label: 'Technische Regel', filter: 'Technische Regeln' },
  law: { label: 'Gesetz/Verordnung', filter: 'Gesetze und Verordnungen' },
  accident: { label: 'Unfallverhütung', filter: 'Unfallverhütung' },
  guide: { label: 'Fachbuch/Muster', filter: 'Fachbücher und Muster' },
} as const

export type NormType = keyof typeof NORM_TYPES

export const NORM_TYPE_KEYS = Object.keys(NORM_TYPES) as [NormType, ...NormType[]]

/** Rechtlicher Rang; die Reihenfolge in levels ist die Rangfolge, das Verbindlichste zuerst */
const levelSchema = z.strictObject({
  key,
  /** Rang, wie er auf der Karte steht, z. B. „Bundesverordnung“ */
  label: z.string().trim().min(1),
  /** Gilt das Dokument selbst als bindendes Recht? */
  binding: z.boolean(),
  /** Was der Rang bedeutet */
  description: z.string().trim().min(1),
})

const topicSchema = z.strictObject({
  key,
  /** Eintrag im Menü, z. B. „Heizöl“ */
  label: z.string().trim().min(1),
  /** Zusatz in Klammern im Menü, z. B. was mit „Gewerblich“ gemeint ist */
  note: z.string().trim().default(''),
  /** Weitere Suchbegriffe, z. B. „Ölheizung“ */
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Was bei diesem Thema in der Praxis am meisten hilft; fehlt, wenn das Thema für eine einzelne Empfehlung zu breit ist */
  practical: z
    .strictObject({
      /** key des Regelwerks */
      norm: key,
      /** Warum es hilft */
      reason: z.string().trim().min(1),
    })
    .optional(),
})

const normSchema = z.strictObject({
  key,
  /** Kurzzeichen, wie es auf der Baustelle genannt wird, z. B. „DVGW G 600 (TRGI)“ */
  name: z.string().trim().min(1),
  /** Worum es geht, in wenigen Worten */
  title: z.string().trim().min(1),
  type: z.enum(NORM_TYPE_KEYS),
  /** key des rechtlichen Rangs aus levels */
  level: key,
  /** Weitere Suchbegriffe, z. B. „TRGI“ */
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Eigene Kurzbeschreibung, kein Normtext */
  description: z.string().trim().min(1),
  /** Ausgabe laut Herausgeber oder Katalog, z. B. „2018-09“; leer bei Gesetzen, deren Link die geltende Fassung zeigt */
  edition: z.string().trim().default(''),
  /** Wichtiger Zusatz, z. B. dass ein Muster erst über Landesrecht gilt */
  note: z.string().trim().default(''),
  /** Warum das Regelwerk in der Praxis wenig bringt, z. B. weil es sich an Hersteller richtet; leer, wenn es Praktiker betrifft */
  lowPractice: z.string().trim().default(''),
  /** Link zum Herausgeber oder Katalogeintrag */
  url: z.string().regex(/^https:\/\/[^\s]+$/, 'url: https-Adresse erwartet'),
  /** Themenbereiche (key), für die das Regelwerk angezeigt wird */
  topics: z.array(key).min(1),
})

export const normFinderToolSchema = defineEntrySchema({
  kind: z.literal('normFinder'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: toolTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Einschränkungen der Liste; stehen am Seitenende, damit das Menü oben schnell erreichbar bleibt */
  closingNote: z.string().trim().min(1),
  levels: z.array(levelSchema).min(1),
  /** Einordnung der Rangfolge, steht unter ihrer Erklärung */
  levelNote: z.string().trim().min(1),
  topics: z.array(topicSchema).min(1),
  norms: z.array(normSchema).min(1),
})

export type NormFinderTool = z.output<typeof normFinderToolSchema>
export type NormTopic = NormFinderTool['topics'][number]
export type NormEntry = NormFinderTool['norms'][number]
export type NormLevel = NormFinderTool['levels'][number]

export interface NormMatch {
  norm: NormEntry
  /** Gewählte Themenbereiche, zu denen das Regelwerk gehört */
  topics: NormTopic[]
  level: NormLevel
  /** Platz des Rangs in levels, 0 ist der höchste */
  rank: number
  /** Begründungen der gewählten Themen, für die dieses Regelwerk der Praxistipp ist; leer, wenn es keiner ist */
  practicalReasons: string[]
}

/**
 * Regelwerke zu den gewählten Themenbereichen, jedes nur einmal, nach rechtlichem Rang sortiert. Innerhalb eines
 * Rangs steht vorn, was zu mehreren gewählten Themen gehört; sonst bleibt die Reihenfolge des Inhalts.
 * Arten in hiddenTypes werden ausgeblendet, mit hideLowPractice auch alles mit wenig Praxisbezug.
 */
export function normsForTopics(
  tool: NormFinderTool,
  selected: readonly string[],
  hiddenTypes: readonly NormType[] = [],
  hideLowPractice = false,
): NormMatch[] {
  return tool.norms
    .filter((norm) => !hiddenTypes.includes(norm.type) && !(hideLowPractice && norm.lowPractice))
    .map((norm) => {
      const topics = tool.topics.filter((topic) => selected.includes(topic.key) && norm.topics.includes(topic.key))
      const rank = tool.levels.findIndex((level) => level.key === norm.level)
      return {
        norm,
        topics,
        rank,
        level: tool.levels[rank]!,
        practicalReasons: topics.flatMap((topic) => (topic.practical?.norm === norm.key ? [topic.practical.reason] : [])),
      }
    })
    .filter((match) => match.topics.length > 0)
    .sort((a, b) => a.rank - b.rank || b.topics.length - a.topics.length)
}

/** Adresse für die Beschriftung des Links, z. B. „dinmedia.de“ */
export function linkHost(url: string): string {
  return new URL(url).hostname.replace(/^www\./, '')
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkNormFinderTool(tool: NormFinderTool): string[] {
  const issues: string[] = []
  const topicKeys = tool.topics.map((topic) => topic.key)
  for (const value of duplicates(topicKeys)) issues.push(`topics: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.norms.map((norm) => norm.key))) issues.push(`norms: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.norms.map((norm) => norm.name))) issues.push(`norms: name "${value}" doppelt vergeben`)
  const levelKeys = tool.levels.map((level) => level.key)
  for (const value of duplicates(levelKeys)) issues.push(`levels: key "${value}" doppelt vergeben`)
  // Sonst stünde Unverbindliches über Bindendem
  const firstOpen = tool.levels.findIndex((level) => !level.binding)
  if (firstOpen !== -1 && tool.levels.slice(firstOpen).some((level) => level.binding)) {
    issues.push('levels: bindende Ränge müssen vor den nicht bindenden stehen')
  }
  for (const level of tool.levels) {
    if (!tool.norms.some((norm) => norm.level === level.key)) issues.push(`levels (${level.label}): kein Regelwerk zugeordnet`)
  }
  for (const topic of tool.topics) {
    if (!topic.practical) continue
    const norm = tool.norms.find((candidate) => candidate.key === topic.practical!.norm)
    if (!norm) issues.push(`topics (${topic.label}): Praxistipp "${topic.practical.norm}" unbekannt`)
    else if (!norm.topics.includes(topic.key)) issues.push(`topics (${topic.label}): Praxistipp ${norm.name} gehört nicht zu diesem Thema`)
    else if (norm.lowPractice) issues.push(`topics (${topic.label}): Praxistipp ${norm.name} ist als wenig praxisrelevant markiert`)
  }
  for (const norm of tool.norms) {
    if (!levelKeys.includes(norm.level)) issues.push(`norms (${norm.name}): unbekannter Rang "${norm.level}"`)
    for (const topic of norm.topics) {
      if (!topicKeys.includes(topic)) issues.push(`norms (${norm.name}): unbekannter Themenbereich "${topic}"`)
    }
    for (const value of duplicates(norm.topics)) issues.push(`norms (${norm.name}): Themenbereich "${value}" doppelt`)
  }
  for (const topic of tool.topics) {
    if (!tool.norms.some((norm) => norm.topics.includes(topic.key))) issues.push(`topics (${topic.label}): kein Regelwerk zugeordnet`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function normFinderKeywords(tool: NormFinderTool): string[] {
  return [
    ...tool.topics.flatMap((topic) => [topic.label, ...topic.aliases]),
    ...tool.norms.flatMap((norm) => [norm.name, norm.title, ...norm.aliases]),
  ]
}
