import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'

// Metall-Tools ("kind": "metals"): Liste der Metalle, eingeteilt in edel und unedel, mit Spannungsreihe.
// Man wählt Metalle aus und bekommt zu jedem Paar Bewertung, Fließrichtung und Ionenaustausch,
// wie sie miteinander reagieren (z. B. Kontaktkorrosion). Reaktionen stehen ausschließlich im Inhalt
// (pairs) mit Quelle; das Tool leitet keine Bewertung aus den Potentialen ab.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Kennzeichen eines Eintrags, zu dem noch kein belegter Inhalt vorliegt */
export const CONTENT_MISSING = 'TODO: Inhalt fehlt'

const statementSchema = z.strictObject({
  text: z.string().trim().min(1),
  source: z.string().trim().min(1),
})

const metalSchema = z.strictObject({
  key,
  /** Name, z. B. „Kupfer“ */
  name: z.string().trim().min(1),
  /** Chemisches Zeichen oder Kurzzeichen, z. B. „Cu“ */
  symbol: z.string().trim().default(''),
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** noble: edel, base: unedel; fehlt = noch nicht belegt */
  group: z.enum(['noble', 'base']).optional(),
  /** Potential in der Spannungsreihe in Volt, wie in der Quelle angegeben */
  potential: z.number().optional(),
  /** Bezug des Potentials, z. B. „Standardpotential gegen Wasserstoffelektrode“ */
  potentialNote: z.string().trim().default(''),
  /** Kurze eigene Beschreibung; ohne belegte Daten beginnt sie mit „TODO: Inhalt fehlt“ */
  note: z.string().trim().default(''),
  /** Kurze Quelle zu Gruppe und Potential */
  source: z.string().trim().default(''),
  /**
   * Keine Ableitung aus dem Potential, mit Grund und Quelle: das Metall verhält sich in der Praxis anders,
   * als das Standardpotential vermuten lässt (z. B. passive Werkstoffe)
   */
  noDerivation: statementSchema.optional(),
  /**
   * Praktisches Korrosionspotential im Einsatzmedium (z. B. belüftetes Trinkwasser), Volt als Bereich (min = max
   * bei einem Wert), mit Bezugselektrode in note. Geht bei der Ableitung dem Standardpotential vor.
   */
  practical: z
    .strictObject({
      min: z.number(),
      max: z.number(),
      note: z.string().trim().min(1),
      source: z.string().trim().min(1),
    })
    .optional(),
})

const RATINGS = ['ok', 'limited', 'avoid'] as const

const pairSchema = z.strictObject({
  /** Genau zwei Metall-keys */
  metals: z.tuple([key, key]),
  /** ok: unbedenklich, limited: nur unter Bedingungen, avoid: vermeiden */
  rating: z.enum(RATINGS),
  /** key des Metalls, das laut Quelle angegriffen wird (optional) */
  corrodes: key.optional(),
  text: z.string().trim().min(1),
  source: z.string().trim().min(1),
  /** Fließrichtung laut Quelle: first = key des Metalls, das das Wasser zuerst durchströmen muss */
  flow: z.strictObject({ first: key.optional(), text: z.string().trim().min(1), source: z.string().trim().min(1) }).optional(),
  /** Was zwischen den Metallen an Ionen ausgetauscht bzw. gelöst wird, laut Quelle */
  ions: statementSchema.optional(),
})

export const metalToolSchema = defineEntrySchema({
  kind: z.literal('metals'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  related: relatedToolsSchema,
  metals: z.array(metalSchema).min(2),
  pairs: z.array(pairSchema).default([]),
  /** Allgemeine Erklärung zu Elektronen- und Ionenaustausch, steht über den Paaren */
  ionExchange: statementSchema.optional(),
  /**
   * Grundsätze, nach denen das Tool für Paare ohne belegte Angabe aus den Potentialen ableitet, welches Metall
   * Anode ist (anode) und welches das Wasser zuerst durchströmen soll (flow); caveat: Grenzen der Ableitung.
   * Fehlt derivation, wird nichts abgeleitet. Eine Bewertung (ok/vermeiden) wird nie abgeleitet.
   */
  derivation: z
    .strictObject({ anode: statementSchema, flow: statementSchema, caveat: statementSchema })
    .optional(),
})

export type MetalTool = z.output<typeof metalToolSchema>
export type Metal = MetalTool['metals'][number]
export type MetalPair = MetalTool['pairs'][number]
export type MetalRating = MetalPair['rating']
export type MetalGroup = 'noble' | 'base' | 'unknown'

const pairKey = (a: string, b: string) => [a, b].sort().join('|')

/** Metalle nach Gruppe; innerhalb der Gruppe nach Potential absteigend (edelstes zuerst), ohne Potential zuletzt */
export function metalsByGroup(tool: MetalTool): Record<MetalGroup, Metal[]> {
  const sorted = [...tool.metals].sort(
    (a, b) => (b.potential ?? Number.NEGATIVE_INFINITY) - (a.potential ?? Number.NEGATIVE_INFINITY),
  )
  return {
    noble: sorted.filter((metal) => metal.group === 'noble'),
    base: sorted.filter((metal) => metal.group === 'base'),
    unknown: sorted.filter((metal) => metal.group === undefined),
  }
}

export interface PairResult {
  a: Metal
  b: Metal
  /** Eintrag aus dem Inhalt; fehlt = noch keine belegte Angabe */
  pair: MetalPair | undefined
  /** Aus den Potentialen nach derivation abgeleitet: das unedlere Metall; fehlt, wenn nicht ableitbar */
  derivedLessNoble: Metal | undefined
  /** Grund, warum nicht abgeleitet wird (Metall mit noDerivation) */
  derivationBlocked: { metal: Metal; reason: MetalTool['metals'][number]['noDerivation'] } | undefined
}

/** Unedleres Metall nach Potential, wenn beide eines haben, keines gesperrt ist und sie sich unterscheiden */
function deriveLessNoble(tool: MetalTool, a: Metal, b: Metal): Pick<PairResult, 'derivedLessNoble' | 'derivationBlocked'> {
  if (!tool.derivation) return { derivedLessNoble: undefined, derivationBlocked: undefined }
  const blocked = [a, b].find((metal) => metal.noDerivation)
  if (blocked) return { derivedLessNoble: undefined, derivationBlocked: { metal: blocked, reason: blocked.noDerivation } }
  // Praktisches Potential im Einsatzmedium zuerst; Bereiche, die sich überlappen, gelten als gleich
  if (a.practical && b.practical) {
    if (a.practical.max < b.practical.min) return { derivedLessNoble: a, derivationBlocked: undefined }
    if (b.practical.max < a.practical.min) return { derivedLessNoble: b, derivationBlocked: undefined }
    return { derivedLessNoble: undefined, derivationBlocked: undefined }
  }
  if (a.potential !== undefined && b.potential !== undefined && a.potential !== b.potential) {
    return { derivedLessNoble: a.potential < b.potential ? a : b, derivationBlocked: undefined }
  }
  // Ohne zwei Potentiale: belegte Einteilung edel/unedel, wenn sie sich unterscheidet
  if (a.group && b.group && a.group !== b.group) {
    return { derivedLessNoble: a.group === 'base' ? a : b, derivationBlocked: undefined }
  }
  return { derivedLessNoble: undefined, derivationBlocked: undefined }
}

/** Alle Paare der gewählten Metalle in Auswahlreihenfolge */
export function selectedPairs(tool: MetalTool, selected: string[]): PairResult[] {
  const byKey = new Map(tool.metals.map((metal) => [metal.key, metal]))
  const pairs = new Map(tool.pairs.map((pair) => [pairKey(...pair.metals), pair]))
  const metals = selected.map((k) => byKey.get(k)).filter((metal): metal is Metal => metal !== undefined)
  const results: PairResult[] = []
  metals.forEach((a, index) => {
    for (const b of metals.slice(index + 1)) {
      results.push({ a, b, pair: pairs.get(pairKey(a.key, b.key)), ...deriveLessNoble(tool, a, b) })
    }
  })
  return results
}

const duplicates = (values: string[]) => [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]

export function checkMetalTool(tool: MetalTool): string[] {
  const issues: string[] = []
  const keys = tool.metals.map((metal) => metal.key)
  for (const value of duplicates(keys)) issues.push(`metals: key "${value}" doppelt vergeben`)
  for (const metal of tool.metals) {
    const where = `metals (${metal.name})`
    const missing = metal.note.startsWith(CONTENT_MISSING)
    if ((metal.group !== undefined || metal.potential !== undefined) && !metal.source) issues.push(`${where}: source fehlt`)
    if (metal.potential !== undefined && !metal.potentialNote) issues.push(`${where}: potentialNote fehlt`)
    if (metal.practical && metal.practical.min > metal.practical.max) issues.push(`${where}: practical min größer als max`)
    if (!missing && metal.group === undefined) issues.push(`${where}: group fehlt oder note beginnt nicht mit "${CONTENT_MISSING}"`)
    if (missing && tool.status === 'verified') issues.push(`${where}: Inhalt fehlt, aber Eintrag ist verified`)
  }
  for (const value of duplicates(tool.pairs.map((pair) => pairKey(...pair.metals)))) {
    issues.push(`pairs: Paar "${value}" doppelt vergeben`)
  }
  for (const pair of tool.pairs) {
    const where = `pairs (${pair.metals.join(' + ')})`
    if (pair.metals[0] === pair.metals[1]) issues.push(`${where}: zweimal dasselbe Metall`)
    for (const metal of pair.metals) if (!keys.includes(metal)) issues.push(`${where}: unbekanntes Metall "${metal}"`)
    if (pair.corrodes && !pair.metals.includes(pair.corrodes)) issues.push(`${where}: corrodes gehört nicht zum Paar`)
    if (pair.flow?.first &&!pair.metals.includes(pair.flow.first)) issues.push(`${where}: flow.first gehört nicht zum Paar`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function metalKeywords(tool: MetalTool): string[] {
  return tool.metals.flatMap((metal) => [metal.name, ...(metal.symbol ? [metal.symbol] : []), ...metal.aliases])
}
