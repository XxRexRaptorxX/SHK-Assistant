import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'

// Wärmepumpen-Tools ("kind": "heatPumpBivalence"): Heizlastgerade des Gebäudes (Norm-Heizlast bei Norm-Außentemperatur,
// 0 kW an der Heizgrenze) und Heizleistung der Wärmepumpe aus Datenblattpunkten. Der Schnittpunkt ist der Bivalenzpunkt.
// Je Betriebsweise zeigt das Tool, wer wann heizt, die Leistung des zweiten Erzeugers und den Deckungsanteil aus der
// Tabelle im Inhalt (Auszug DIN 4701-10). Zahlen, Texte und Quellen stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)

const refSchema = z.strictObject({ source: key, where: text })
const sourceSchema = z.strictObject({ key, name: text, source: text })

const inputSchema = z.strictObject({
  label: text,
  unit: text,
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  default: z.number(),
  /** Was die Eingabe bewirkt, eigene Kurzfassung */
  text,
  ref: refSchema.optional(),
  /** Link zum Nachschlagen des Werts (online), z. B. Klimakarte nach Postleitzahl */
  lookup: z
    .strictObject({
      label: text,
      url: z.string().url().startsWith('https://'),
      text,
      ref: refSchema,
    })
    .optional(),
})

export const BIVALENCE_INPUT_KEYS = ['heatLoad', 'designOutdoor', 'heatingLimit', 'lowerLimit'] as const
export type BivalenceInputKey = (typeof BIVALENCE_INPUT_KEYS)[number]

/** Spalte der Deckungsanteil-Tabelle, die eine Betriebsweise verwendet */
const coverageColumn = z.enum(['parallel', 'alternative'])

const modeSchema = z.strictObject({
  key,
  label: text,
  /** Wer wann heizt, eigene Kurzfassung */
  text,
  ref: refSchema,
  /** Zweiter Erzeuger vorhanden? (monovalent: nein) */
  secondGenerator: z.boolean(),
  /** Läuft die Wärmepumpe unterhalb der unteren Einsatzgrenze bzw. des Abschaltpunkts weiter? */
  heatPumpOffBelow: z.enum(['never', 'bivalence', 'lowerLimit']),
  /** Spalte der Deckungsanteil-Tabelle; fehlt sie, zeigt das Tool keinen Deckungsanteil */
  coverage: coverageColumn.optional(),
  /** Hinweis zum Deckungsanteil, z. B. warum keine Zahl */
  coverageNote: z.string().trim().default(''),
})

const coverageRowSchema = z.strictObject({
  bivalence: z.number(),
  /** Leistungsanteil der Wärmepumpe */
  powerShare: z.number().min(0).max(1),
  parallel: z.number().min(0).max(1),
  alternative: z.number().min(0).max(1),
})

const typicalRangeSchema = z.strictObject({
  designOutdoor: z.number(),
  from: z.number(),
  to: z.number(),
})

const infoSchema = z.strictObject({ title: text, text, ref: refSchema })

export const heatPumpToolSchema = defineEntrySchema({
  kind: z.literal('heatPumpBivalence'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  related: relatedToolsSchema,
  closingNote: text,
  sources: z.array(sourceSchema).min(1),
  inputs: z.strictObject(
    Object.fromEntries(BIVALENCE_INPUT_KEYS.map((name) => [name, inputSchema])) as Record<BivalenceInputKey, typeof inputSchema>,
  ),
  /** Erklärung zur Heizlastgeraden und zum Schnittpunkt */
  methodText: text,
  methodRef: refSchema,
  /** Hinweis zu den Datenblattpunkten der Wärmepumpe */
  capacityText: text,
  capacityRef: refSchema,
  /** Vorbelegung der Datenblattpunkte, damit das Diagramm sofort etwas zeigt; Beispiel, keine Herstellerangabe */
  examplePoints: z.array(z.strictObject({ outdoor: z.number(), power: z.number().positive() })).min(2),
  /** Hinweis, solange die Beispielwerte stehen */
  examplePointsNote: text,
  modes: z.array(modeSchema).min(2),
  /** Vorausgewählte Betriebsweise (key) */
  defaultMode: key,
  coverage: z.strictObject({
    title: text,
    ref: refSchema,
    rows: z.array(coverageRowSchema).min(2),
  }),
  typicalRanges: z.strictObject({ text, ref: refSchema, rows: z.array(typicalRangeSchema).min(1) }),
  infos: z.array(infoSchema).default([]),
})

export type HeatPumpTool = z.output<typeof heatPumpToolSchema>
export type BivalenceMode = HeatPumpTool['modes'][number]
export type HeatPumpRef = z.output<typeof refSchema>

/** Datenblattpunkt: Heizleistung der Wärmepumpe bei einer Außentemperatur */
export interface CapacityPoint {
  outdoor: number
  power: number
}

export interface BivalenceInputs {
  heatLoad: number
  designOutdoor: number
  heatingLimit: number
  /** Untere Einsatzgrenze bzw. Abschaltpunkt der Wärmepumpe; null = keine */
  lowerLimit: number | null
}

/** Heizlast des Gebäudes bei dieser Außentemperatur: Gerade von Norm-Heizlast (Norm-AT) bis 0 kW (Heizgrenze) */
export function loadAt(inputs: BivalenceInputs, outdoor: number): number {
  const { heatLoad, designOutdoor, heatingLimit } = inputs
  if (outdoor >= heatingLimit) return 0
  return (heatLoad * (heatingLimit - outdoor)) / (heatingLimit - designOutdoor)
}

/** Datenblattpunkte sortiert, doppelte Außentemperaturen entfernt (letzter gewinnt) */
export function sortedPoints(points: readonly CapacityPoint[]): CapacityPoint[] {
  const byOutdoor = new Map<number, CapacityPoint>()
  for (const point of points) byOutdoor.set(point.outdoor, point)
  return [...byOutdoor.values()].sort((a, b) => a.outdoor - b.outdoor)
}

/**
 * Heizleistung der Wärmepumpe: zwischen den Datenblattpunkten linear, außerhalb linear verlängert (extrapolated = true).
 * Mindestens zwei Punkte nötig.
 */
export function capacityAt(points: readonly CapacityPoint[], outdoor: number): { power: number; extrapolated: boolean } | null {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return null
  const first = sorted[0]!
  const last = sorted[sorted.length - 1]!
  let index = sorted.findIndex((point) => point.outdoor >= outdoor)
  if (index <= 0) index = 1
  if (outdoor > last.outdoor) index = sorted.length - 1
  const a = sorted[index - 1]!
  const b = sorted[index]!
  const power = a.power + ((b.power - a.power) * (outdoor - a.outdoor)) / (b.outdoor - a.outdoor)
  return { power: Math.max(0, power), extrapolated: outdoor < first.outdoor || outdoor > last.outdoor }
}

/**
 * Bivalenzpunkt: Außentemperatur, bei der Heizlast und Heizleistung gleich sind (Schnittpunkt). Gesucht zwischen
 * Norm-Außentemperatur und Heizgrenze; liegt die Leistung dort überall über der Last, gibt es keinen (null).
 * Bei mehreren Schnittpunkten der wärmste, darunter reicht die Wärmepumpe nicht mehr.
 */
export function bivalencePoint(inputs: BivalenceInputs, points: readonly CapacityPoint[], step = 0.05): number | null {
  const gap = (outdoor: number) => capacityAt(points, outdoor)!.power - loadAt(inputs, outdoor)
  if (sortedPoints(points).length < 2) return null
  let upper = inputs.heatingLimit
  for (let outdoor = inputs.heatingLimit - step; outdoor >= inputs.designOutdoor - 1e-9; outdoor -= step) {
    if (gap(outdoor) < 0) {
      // Zwischen outdoor und upper genauer eingrenzen
      let low = outdoor
      let high = upper
      for (let index = 0; index < 40; index++) {
        const middle = (low + high) / 2
        if (gap(middle) < 0) low = middle
        else high = middle
      }
      return (low + high) / 2
    }
    upper = outdoor
  }
  return null
}

/** Deckungsanteil und Leistungsanteil aus der Tabelle, linear zwischen den Zeilen; null außerhalb der Tabelle */
export function coverageAt(
  tool: HeatPumpTool,
  bivalence: number,
): { powerShare: number; parallel: number; alternative: number } | null {
  const rows = [...tool.coverage.rows].sort((a, b) => a.bivalence - b.bivalence)
  if (bivalence < rows[0]!.bivalence - 1e-9 || bivalence > rows[rows.length - 1]!.bivalence + 1e-9) return null
  const upperIndex = Math.max(1, rows.findIndex((row) => row.bivalence >= bivalence - 1e-9))
  const a = rows[upperIndex - 1]!
  const b = rows[upperIndex]!
  const share = b.bivalence === a.bivalence ? 0 : (bivalence - a.bivalence) / (b.bivalence - a.bivalence)
  const mix = (left: number, right: number) => left + (right - left) * share
  return { powerShare: mix(a.powerShare, b.powerShare), parallel: mix(a.parallel, b.parallel), alternative: mix(a.alternative, b.alternative) }
}

/** Übliche Spanne für den Bivalenzpunkt bei dieser Norm-Außentemperatur (nächstgelegene Zeile) */
export function typicalRange(tool: HeatPumpTool, designOutdoor: number): HeatPumpTool['typicalRanges']['rows'][number] {
  return [...tool.typicalRanges.rows].sort(
    (a, b) => Math.abs(a.designOutdoor - designOutdoor) - Math.abs(b.designOutdoor - designOutdoor),
  )[0]!
}

export interface BivalenceResult {
  /** Bivalenzpunkt; null = die Wärmepumpe deckt die Heizlast bis zur Norm-Außentemperatur */
  bivalence: number | null
  /** Heizleistung der Wärmepumpe bei Norm-Außentemperatur (läuft sie dort noch) */
  heatPumpAtDesign: number | null
  /** Leistung, die der zweite Erzeuger bei Norm-Außentemperatur bringen muss */
  secondAtDesign: number
  /** Wärmepumpe bei Norm-Außentemperatur abgeschaltet (alternativ, unter der Einsatzgrenze) */
  heatPumpOffAtDesign: boolean
  /** Ab dieser Außentemperatur (abwärts) ist die Wärmepumpe aus; null = nie */
  heatPumpOffBelow: number | null
  /** Monovalent gewählt, aber die Wärmepumpe reicht nicht */
  monovalentGap: number | null
  /** Datenblatt wird außerhalb seiner Punkte verlängert (zwischen Norm-AT und Heizgrenze) */
  extrapolated: boolean
  coverage: number | null
}

export function evaluateBivalence(
  tool: HeatPumpTool,
  mode: BivalenceMode,
  inputs: BivalenceInputs,
  points: readonly CapacityPoint[],
): BivalenceResult | null {
  const sorted = sortedPoints(points)
  if (sorted.length < 2) return null
  const bivalence = bivalencePoint(inputs, sorted)
  const capacityDesign = capacityAt(sorted, inputs.designOutdoor)!
  const offBelow =
    mode.heatPumpOffBelow === 'bivalence' ? bivalence : mode.heatPumpOffBelow === 'lowerLimit' ? inputs.lowerLimit : null
  const heatPumpOffAtDesign = offBelow !== null && inputs.designOutdoor < offBelow
  const heatPumpAtDesign = heatPumpOffAtDesign ? null : Math.min(capacityDesign.power, inputs.heatLoad)
  const secondAtDesign = mode.secondGenerator ? Math.max(0, inputs.heatLoad - (heatPumpAtDesign ?? 0)) : 0
  const monovalentGap = !mode.secondGenerator && capacityDesign.power < inputs.heatLoad ? inputs.heatLoad - capacityDesign.power : null
  const extrapolated =
    inputs.designOutdoor < sorted[0]!.outdoor || (bivalence !== null && capacityAt(sorted, bivalence)!.extrapolated)
  const table = bivalence !== null && mode.coverage ? coverageAt(tool, bivalence) : null
  const coverage = bivalence === null ? (mode.coverage ? 1 : null) : table && mode.coverage ? table[mode.coverage] : null
  return { bivalence, heatPumpAtDesign, secondAtDesign, heatPumpOffAtDesign, heatPumpOffBelow: offBelow, monovalentGap, extrapolated, coverage }
}

export function heatPumpRefText(tool: HeatPumpTool, ref: HeatPumpRef): string {
  const source = tool.sources.find((candidate) => candidate.key === ref.source)
  return `${source?.name ?? ref.source}, ${ref.where}`
}

export function checkHeatPumpTool(tool: HeatPumpTool): string[] {
  const issues: string[] = []
  const sourceKeys = tool.sources.map((source) => source.key)
  const used = new Set<string>()
  const checkRef = (ref: HeatPumpRef | undefined, where: string) => {
    if (!ref) return
    used.add(ref.source)
    if (!sourceKeys.includes(ref.source)) issues.push(`${where}: unbekannte Quelle "${ref.source}"`)
  }
  for (const name of BIVALENCE_INPUT_KEYS) {
    const input = tool.inputs[name]
    checkRef(input.ref, `inputs.${name}`)
    checkRef(input.lookup?.ref, `inputs.${name}.lookup`)
    if (input.min >= input.max) issues.push(`inputs.${name}: min muss kleiner als max sein`)
    if (input.default < input.min || input.default > input.max) issues.push(`inputs.${name}: default außerhalb von min/max`)
  }
  if (tool.inputs.designOutdoor.max >= tool.inputs.heatingLimit.min) issues.push('inputs: Norm-Außentemperatur muss unter der Heizgrenze liegen')
  checkRef(tool.methodRef, 'methodRef')
  checkRef(tool.capacityRef, 'capacityRef')
  checkRef(tool.coverage.ref, 'coverage')
  checkRef(tool.typicalRanges.ref, 'typicalRanges')
  const modeKeys = tool.modes.map((mode) => mode.key)
  if (new Set(modeKeys).size !== modeKeys.length) issues.push('modes: key doppelt vergeben')
  if (!modeKeys.includes(tool.defaultMode)) issues.push(`defaultMode: unbekannte Betriebsweise "${tool.defaultMode}"`)
  const exampleOutdoors = tool.examplePoints.map((point) => point.outdoor)
  if (new Set(exampleOutdoors).size !== exampleOutdoors.length) issues.push('examplePoints: Außentemperatur doppelt')
  // Mit den Standardeingaben soll das Diagramm einen Bivalenzpunkt innerhalb der Datenblattpunkte zeigen
  const defaults: BivalenceInputs = {
    heatLoad: tool.inputs.heatLoad.default,
    designOutdoor: tool.inputs.designOutdoor.default,
    heatingLimit: tool.inputs.heatingLimit.default,
    lowerLimit: tool.inputs.lowerLimit.default,
  }
  const defaultMode = tool.modes.find((mode) => mode.key === tool.defaultMode)
  const example = defaultMode ? evaluateBivalence(tool, defaultMode, defaults, tool.examplePoints) : null
  if (example && (example.bivalence === null || example.extrapolated)) {
    issues.push('examplePoints: ergeben mit den Standardeingaben keinen Bivalenzpunkt innerhalb der Punkte')
  }
  tool.modes.forEach((mode) => checkRef(mode.ref, `modes (${mode.key})`))
  const bivalences = tool.coverage.rows.map((row) => row.bivalence)
  if (new Set(bivalences).size !== bivalences.length) issues.push('coverage.rows: Bivalenzpunkt doppelt')
  tool.typicalRanges.rows.forEach((row, index) => {
    if (row.from < row.to) issues.push(`typicalRanges.rows[${index}]: from ist der wärmere Wert und muss größer als to sein`)
  })
  tool.infos.forEach((info, index) => checkRef(info.ref, `infos[${index}] (${info.title})`))
  for (const source of sourceKeys) if (!used.has(source)) issues.push(`sources (${source}): wird nirgends zitiert`)
  return issues
}

export function heatPumpKeywords(tool: HeatPumpTool): string[] {
  return [...tool.keywords, ...tool.modes.map((mode) => mode.label), ...tool.infos.map((info) => info.title)]
}
