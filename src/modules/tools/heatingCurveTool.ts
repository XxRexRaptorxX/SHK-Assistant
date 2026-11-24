import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Heizkurven-Tools ("kind": "heatingCurve"): Heizkurve zeichnen und mit Neigung, Niveau, Raumsoll, Absenkung,
// Vorlaufbegrenzung und Heizgrenze verändern. Das Tool vergleicht mit einer Ausgangseinstellung, schätzt die Wirkung
// auf die Raumtemperatur und rechnet aus Beobachtungen (Problem, Messung, Wunsch-Vorlauf) Neigung und Niveau zurück.
//
// Kennlinie: VL = RT_soll + Niveau − Neigung · D · (c0 + c1 · D + c2 · D²) mit D = AT − RT_soll.
// Die Beiwerte c0 … c2 stehen im Inhalt (mit Quelle), nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)

const refSchema = z.strictObject({
  source: key,
  where: text,
})

const sourceSchema = z.strictObject({
  key,
  name: text,
  source: text,
})

/** Rechenbeispiel aus der Quelle: Einstellung und Außentemperatur → Vorlauf; der Build prüft das Ergebnis */
const curveExampleSchema = z.strictObject({
  label: text,
  neigung: z.number(),
  niveau: z.number(),
  roomSetpoint: z.number(),
  outdoor: z.number(),
  /** Vorlauf laut Quelle, so gerundet wie dort */
  flow: z.number(),
  ref: refSchema,
})

const measurementSchema = z.strictObject({
  roomSetpoint: z.number(),
  outdoor: z.number(),
  /** Gemessene Raumtemperatur */
  room: z.number(),
})

/** Beispiel aus der Quelle: Messungen bei bekannter Einstellung → passende Neigung und passendes Niveau */
const fitExampleSchema = z.strictObject({
  label: text,
  neigung: z.number(),
  niveau: z.number(),
  measurements: z.array(measurementSchema).length(2),
  expectedNeigung: z.number(),
  expectedNiveau: z.number(),
  ref: refSchema,
})

const modelSchema = z.strictObject({
  /** Name der Kennlinie in der Anzeige */
  name: text,
  /** Beiwerte c0, c1, c2 */
  coefficients: z.tuple([z.number(), z.number(), z.number()]),
  text,
  ref: refSchema,
  examples: z.array(curveExampleSchema).min(1),
  fitExamples: z.array(fitExampleSchema).default([]),
})

const parameterSchema = z.strictObject({
  label: text,
  unit: z.string().trim().default(''),
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  /** Startwert; null = aus (nur bei optionalen Einstellungen) */
  default: z.number().nullable(),
  /** Wert beim Einschalten einer optionalen Einstellung */
  start: z.number().optional(),
  /** Was die Einstellung an der Kurve bewirkt, eigene Kurzfassung */
  text,
  ref: refSchema.optional(),
})

export const CURVE_PARAMETER_KEYS = [
  'neigung',
  'niveau',
  'roomSetpoint',
  'reducedSetpoint',
  'maxFlow',
  'minFlow',
  'heatingLimit',
] as const
export type CurveParameterKey = (typeof CURVE_PARAMETER_KEYS)[number]
/** Einstellungen, die man ausschalten kann */
export const OPTIONAL_CURVE_PARAMETERS: readonly CurveParameterKey[] = ['reducedSetpoint', 'maxFlow', 'minFlow', 'heatingLimit']

const parametersSchema = z.strictObject(
  Object.fromEntries(CURVE_PARAMETER_KEYS.map((name) => [name, parameterSchema])) as Record<CurveParameterKey, typeof parameterSchema>,
)

const pointSchema = z.strictObject({
  label: text,
  outdoor: z.number(),
})

const bandSchema = z.strictObject({
  label: text,
  from: z.number(),
  to: z.number(),
  ref: refSchema,
})

const direction = z.enum(['up', 'down', 'keep'])

/** Problem, wie es der Kunde beschreibt, mit der Regel aus der Quelle */
const symptomSchema = z.strictObject({
  key,
  label: text,
  /** Abweichung der Raumtemperatur bei Kälte bzw. in der Übergangszeit: -1 zu kalt, 1 zu warm, 0 passt */
  cold: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  transition: z.union([z.literal(-1), z.literal(0), z.literal(1)]),
  /** Regel der Quelle */
  neigung: direction,
  niveau: direction,
  text,
  ref: refSchema,
})

const pointRangeSchema = z.strictObject({
  label: text,
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  /** Was die Einstellung an der Kurve bewirkt, eigene Kurzfassung */
  text,
})

/** Einstellart „Fußpunkt/Endpunkt“: zwei Vorlaufwerte statt Neigung und Niveau */
const twoPointSchema = z.strictObject({
  /** Außentemperatur, auf die sich der Fußpunkt bezieht */
  footOutdoor: z.number(),
  foot: pointRangeSchema,
  end: pointRangeSchema,
  /** Außentemperatur des Endpunkts, einstellbar */
  endOutdoor: pointRangeSchema.extend({ default: z.number() }),
  text,
  ref: refSchema,
})

const infoSchema = z.strictObject({
  title: text,
  text,
  ref: refSchema,
})

export const heatingCurveToolSchema = defineEntrySchema({
  kind: z.literal('heatingCurve'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  closingNote: text,
  /** Solange Angaben fehlen: beginnt mit „TODO: Inhalt fehlt“ */
  todo: z.string().trim().default(''),
  sources: z.array(sourceSchema).min(1),
  model: modelSchema,
  parameters: parametersSchema,
  /** Bereich der x-Achse im Diagramm */
  chart: z.strictObject({ outdoorFrom: z.number(), outdoorTo: z.number() }),
  /** Außentemperaturen, an denen Ausgang und neue Einstellung verglichen werden */
  comparePoints: z.array(pointSchema).min(2),
  /** Temperaturbereiche, im Diagramm hinterlegt, z. B. Übergangszeit */
  bands: z.array(bandSchema).default([]),
  /** Außentemperaturen, an denen ein beschriebenes Problem in Zahlen übersetzt wird */
  symptomPoints: z.strictObject({ cold: z.number(), transition: z.number(), text }),
  symptoms: z.array(symptomSchema).min(1),
  twoPoint: twoPointSchema,
  infos: z.array(infoSchema).default([]),
})

export type HeatingCurveTool = z.output<typeof heatingCurveToolSchema>
export type HeatingCurveModel = HeatingCurveTool['model']
export type CurveSymptom = HeatingCurveTool['symptoms'][number]
export type CurveRef = z.output<typeof refSchema>

/** Einstellung eines Heizkreises; null = Funktion aus */
export interface CurveSettings {
  neigung: number
  niveau: number
  roomSetpoint: number
  reducedSetpoint: number | null
  maxFlow: number | null
  minFlow: number | null
  heatingLimit: number | null
}

export const defaultSettings = (tool: HeatingCurveTool): CurveSettings => {
  const value = (name: CurveParameterKey) => tool.parameters[name].default
  return {
    neigung: value('neigung') ?? 1,
    niveau: value('niveau') ?? 0,
    roomSetpoint: value('roomSetpoint') ?? 20,
    reducedSetpoint: value('reducedSetpoint'),
    maxFlow: value('maxFlow'),
    minFlow: value('minFlow'),
    heatingLimit: value('heatingLimit'),
  }
}

/** Zahl für einen mathjs-Ausdruck; sehr kleine Beiwerte als Mantisse · 10^Exponent (247.9 * 10^(-6)) */
function coefficientExpression(value: number): string {
  if (value === 0 || Math.abs(value) >= 0.001) return String(value)
  const exponent = Math.floor(Math.log10(Math.abs(value)) / 3) * 3
  const mantissa = Number((value / 10 ** exponent).toPrecision(6))
  return `${mantissa} * 10^(${exponent})`
}

/**
 * Kennlinie als mathjs-Ausdruck für die Anzeige im Rechenweg, erzeugt aus den Beiwerten des Inhalts.
 * In drei Zeilen, damit es aufs Handy passt. Symbole: VL, RT (Raumsoll), Ni (Niveau), Ne (Neigung),
 * fD (Krümmungsfaktor f(D)), D (= AT − RT), AT
 */
export function curveExpressions(model: HeatingCurveModel): {
  flow: string
  factor: string
  difference: string
  /** Kennlinie in einer Gleichung, f(D) eingesetzt */
  full: string
} {
  const [c0, c1, c2] = model.coefficients.map(coefficientExpression)
  const factor = `${c0} + ${c1} * D + ${c2} * D^2`
  return {
    flow: 'RT + Ni - Ne * D * fD',
    factor,
    difference: 'AT - RT',
    full: `RT + Ni - Ne * D * (${factor})`,
  }
}

const SUPERSCRIPT_DIGITS: Record<string, string> = {
  '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
}

/** Zahl als Text mit Komma; sehr kleine Beiwerte als 247,9 · 10⁻⁶ */
function coefficientText(value: number): string {
  const comma = (number: number) => String(number).replace('.', ',')
  if (value === 0 || Math.abs(value) >= 0.001) return comma(value)
  const exponent = Math.floor(Math.log10(Math.abs(value)) / 3) * 3
  const mantissa = Number((value / 10 ** exponent).toPrecision(6))
  return `${comma(mantissa)} · 10${[...String(exponent)].map((char) => SUPERSCRIPT_DIGITS[char]).join('')}`
}

/** Kennlinie als einfacher Text zum Kopieren, z. B. für Tabellenkalkulation oder Notizen */
export function curveFormulaText(model: HeatingCurveModel): string {
  const [c0, c1, c2] = model.coefficients.map(coefficientText)
  return `VL = RT_soll + Niveau − Neigung · D · (${c0} + ${c1} · D + ${c2} · D²) mit D = AT − RT_soll`
}

/** Kurvenanteil D · (c0 + c1 · D + c2 · D²) mit D = AT − RT_soll */
export function curveTerm(model: HeatingCurveModel, difference: number): number {
  const [c0, c1, c2] = model.coefficients
  return difference * (c0 + c1 * difference + c2 * difference * difference)
}

/** Vorlauf-Sollwert der reinen Kennlinie, ohne Begrenzung und Heizgrenze */
export function rawFlow(model: HeatingCurveModel, neigung: number, niveau: number, roomSetpoint: number, outdoor: number): number {
  return roomSetpoint + niveau - neigung * curveTerm(model, outdoor - roomSetpoint)
}

export interface FlowResult {
  /** Vorlauf-Sollwert; null = Heizbetrieb aus (Heizgrenze) */
  flow: number | null
  /** Wert der Kennlinie ohne Begrenzung */
  raw: number
  /** Welche Begrenzung greift */
  limitedBy: 'max' | 'min' | null
}

/** Vorlauf-Sollwert mit Begrenzung und Heizgrenze; reduced: Raumsoll des Absenkbetriebs statt des normalen */
export function flowAt(model: HeatingCurveModel, settings: CurveSettings, outdoor: number, reduced = false): FlowResult {
  const setpoint = reduced && settings.reducedSetpoint !== null ? settings.reducedSetpoint : settings.roomSetpoint
  const raw = rawFlow(model, settings.neigung, settings.niveau, setpoint, outdoor)
  if (settings.heatingLimit !== null && outdoor > settings.heatingLimit) return { flow: null, raw, limitedBy: null }
  if (settings.maxFlow !== null && raw > settings.maxFlow) return { flow: settings.maxFlow, raw, limitedBy: 'max' }
  if (settings.minFlow !== null && raw < settings.minFlow) return { flow: settings.minFlow, raw, limitedBy: 'min' }
  return { flow: raw, raw, limitedBy: null }
}

/** Punkte der Kurve für das Diagramm; Abschnitte ohne Heizbetrieb trennen die Linie */
export function curveSegments(
  model: HeatingCurveModel,
  settings: CurveSettings,
  from: number,
  to: number,
  reduced = false,
  step = 0.5,
): { outdoor: number; flow: number }[][] {
  const segments: { outdoor: number; flow: number }[][] = []
  let current: { outdoor: number; flow: number }[] = []
  const count = Math.round((to - from) / step)
  for (let index = 0; index <= count; index++) {
    const outdoor = from + index * step
    const { flow } = flowAt(model, settings, outdoor, reduced)
    if (flow === null) {
      if (current.length > 0) segments.push(current)
      current = []
    } else current.push({ outdoor, flow })
  }
  if (current.length > 0) segments.push(current)
  return segments
}

/**
 * Raumtemperatur, bei der die Kennlinie der Ausgangseinstellung genau diesen Vorlauf liefern würde. Annahme wie in der
 * Quelle: Die Ausgangskurve passt zum Gebäude, d. h. mit Raumsoll R stellt sich im Raum R ein. Die Funktion steigt in R
 * streng (1 + Neigung · Ableitung > 0), daher Bisektion.
 */
export function roomFor(model: HeatingCurveModel, base: CurveSettings, outdoor: number, flow: number): number | null {
  const residual = (room: number) => rawFlow(model, base.neigung, base.niveau, room, outdoor) - flow
  let low = -20
  let high = 60
  if (residual(low) > 0 || residual(high) < 0) return null
  for (let index = 0; index < 60; index++) {
    const middle = (low + high) / 2
    if (residual(middle) > 0) high = middle
    else low = middle
  }
  return (low + high) / 2
}

/** Beobachtung: Bei dieser Außentemperatur und diesem Vorlauf stellt sich diese Raumtemperatur ein (bzw. soll sich einstellen) */
export interface CurveObservation {
  outdoor: number
  flow: number
  room: number
}

export type FitResult =
  | { ok: true; neigung: number; niveau: number }
  | { ok: false; reason: 'samePoint' | 'noSlope' | 'tooMany' | 'none' }

/**
 * Neigung und Niveau so, dass die Kennlinie mit Raumsoll = room durch (outdoor, flow) geht (Gleichung der Quelle).
 * - 'both': zwei Beobachtungen, beide Werte (lineares Gleichungssystem in Neigung und Niveau)
 * - 'niveau': eine Beobachtung, Neigung bleibt
 * - 'neigung': eine Beobachtung, Niveau bleibt
 */
export function fitCurve(
  model: HeatingCurveModel,
  observations: readonly CurveObservation[],
  current: Pick<CurveSettings, 'neigung' | 'niveau'>,
  mode: 'both' | 'niveau' | 'neigung',
): FitResult {
  if (observations.length === 0) return { ok: false, reason: 'none' }
  const term = (observation: CurveObservation) => curveTerm(model, observation.outdoor - observation.room)
  if (mode === 'both') {
    if (observations.length !== 2) return { ok: false, reason: observations.length > 2 ? 'tooMany' : 'none' }
    const [first, second] = observations as [CurveObservation, CurveObservation]
    // flow − room = Niveau − Neigung · term
    const denominator = term(second) - term(first)
    if (Math.abs(denominator) < 1) return { ok: false, reason: 'samePoint' }
    const neigung = (first.flow - first.room - (second.flow - second.room)) / denominator
    const niveau = first.flow - first.room + neigung * term(first)
    return { ok: true, neigung, niveau }
  }
  const observation = observations[0]!
  if (mode === 'niveau') {
    return { ok: true, neigung: current.neigung, niveau: observation.flow - observation.room + current.neigung * term(observation) }
  }
  const curvePart = term(observation)
  if (Math.abs(curvePart) < 1) return { ok: false, reason: 'noSlope' }
  return { ok: true, neigung: (observation.room + current.niveau - observation.flow) / curvePart, niveau: current.niveau }
}

/** Fußpunkt und Endpunkt der Kennlinie (Vorlauf ohne Begrenzung) bei den Außentemperaturen der Zwei-Punkt-Einstellung */
export function pointsFromSettings(
  tool: HeatingCurveTool,
  settings: Pick<CurveSettings, 'neigung' | 'niveau' | 'roomSetpoint'>,
  endOutdoor: number,
): { foot: number; end: number } {
  const at = (outdoor: number) => rawFlow(tool.model, settings.neigung, settings.niveau, settings.roomSetpoint, outdoor)
  return { foot: at(tool.twoPoint.footOutdoor), end: at(endOutdoor) }
}

/** Neigung und Niveau, mit denen die Kennlinie (beim eingestellten Raumsoll) durch Fußpunkt und Endpunkt geht */
export function settingsFromPoints(
  tool: HeatingCurveTool,
  settings: CurveSettings,
  foot: number,
  end: number,
  endOutdoor: number,
): FitResult {
  return fitCurve(
    tool.model,
    [
      { outdoor: tool.twoPoint.footOutdoor, flow: foot, room: settings.roomSetpoint },
      { outdoor: endOutdoor, flow: end, room: settings.roomSetpoint },
    ],
    settings,
    'both',
  )
}

/** Auf die Schrittweite des Reglers runden */
export const roundToStep = (value: number, step: number): number => {
  const decimals = Math.max(0, -Math.floor(Math.log10(step)) + 1)
  return Number((Math.round(value / step) * step).toFixed(decimals))
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

export interface Recommendation {
  neigung: number
  niveau: number
  /** Ungerundete Werte vor dem Begrenzen auf den Einstellbereich */
  exactNeigung: number
  exactNiveau: number
  /** Liegt der errechnete Wert außerhalb des Einstellbereichs? */
  outOfRange: boolean
}

/**
 * Ergebnis der Rückrechnung, auf die Schrittweiten gerundet und auf den Einstellbereich begrenzt. Mit Beobachtungen
 * wird das Niveau nach dem Runden der Neigung so angepasst, dass die Kurve im Mittel durch die Punkte geht; sonst
 * würden sich die Rundungsfehler beider Werte addieren.
 */
export function toRecommendation(
  tool: HeatingCurveTool,
  fit: Extract<FitResult, { ok: true }>,
  observations: readonly CurveObservation[] = [],
): Recommendation {
  const { neigung: neigungParameter, niveau: niveauParameter } = tool.parameters
  const outOfRange =
    fit.neigung < neigungParameter.min ||
    fit.neigung > neigungParameter.max ||
    fit.niveau < niveauParameter.min ||
    fit.niveau > niveauParameter.max
  const neigung = clamp(roundToStep(fit.neigung, neigungParameter.step), neigungParameter.min, neigungParameter.max)
  const niveau =
    observations.length > 0
      ? observations.reduce(
          (sum, observation) =>
            sum + observation.flow - observation.room + neigung * curveTerm(tool.model, observation.outdoor - observation.room),
          0,
        ) / observations.length
      : fit.niveau
  return {
    neigung,
    niveau: clamp(roundToStep(niveau, niveauParameter.step), niveauParameter.min, niveauParameter.max),
    exactNeigung: fit.neigung,
    exactNiveau: fit.niveau,
    outOfRange,
  }
}

/**
 * Ein beschriebenes Problem als Beobachtungen: bei Kälte und in der Übergangszeit liefert die jetzige Einstellung ihren
 * Vorlauf, im Raum stellt sich Raumsoll ± Abweichung ein. Heizgrenze und Begrenzung bleiben außen vor (reine Kennlinie).
 */
export function symptomObservations(
  tool: HeatingCurveTool,
  settings: CurveSettings,
  symptom: CurveSymptom,
  deviation: number,
): CurveObservation[] {
  const observe = (outdoor: number, sign: number): CurveObservation => ({
    outdoor,
    flow: rawFlow(tool.model, settings.neigung, settings.niveau, settings.roomSetpoint, outdoor),
    room: settings.roomSetpoint + sign * deviation,
  })
  return [observe(tool.symptomPoints.cold, symptom.cold), observe(tool.symptomPoints.transition, symptom.transition)]
}

/** Richtung einer Änderung mit Toleranz */
export function changeDirection(before: number, after: number, tolerance: number): 'up' | 'down' | 'keep' {
  if (after - before > tolerance) return 'up'
  if (before - after > tolerance) return 'down'
  return 'keep'
}

export interface PointComparison {
  label: string
  outdoor: number
  before: FlowResult
  after: FlowResult
  /** Vorlaufänderung in K; null, wenn eine Seite nicht heizt */
  delta: number | null
  /** Geschätzte Änderung der Raumtemperatur in K (Annahme: Kennlinie passt zum Gebäude); null, wenn nicht bestimmbar */
  roomDelta: number | null
}

export function comparePoints(tool: HeatingCurveTool, base: CurveSettings, next: CurveSettings): PointComparison[] {
  return tool.comparePoints.map((point) => {
    const before = flowAt(tool.model, base, point.outdoor)
    const after = flowAt(tool.model, next, point.outdoor)
    const delta = before.flow !== null && after.flow !== null ? after.flow - before.flow : null
    // Ohne Heizbetrieb auf einer Seite ist die Raumtemperatur nicht abschätzbar
    let roomDelta: number | null = null
    if (before.flow !== null && after.flow !== null) {
      const roomBefore = roomFor(tool.model, base, point.outdoor, before.flow)
      const roomAfter = roomFor(tool.model, base, point.outdoor, after.flow)
      if (roomBefore !== null && roomAfter !== null) roomDelta = roomAfter - roomBefore
    }
    return { label: point.label, outdoor: point.outdoor, before, after, delta, roomDelta }
  })
}

/** Welche Einstellungen sich gegenüber dem Ausgang geändert haben */
export function changedParameters(base: CurveSettings, next: CurveSettings): CurveParameterKey[] {
  // Toleranz: Fußpunkt/Endpunkt rechnen Neigung und Niveau zurück, dabei entstehen Rundungsreste
  return CURVE_PARAMETER_KEYS.filter((name) => {
    const before = base[name]
    const after = next[name]
    return before === null || after === null ? before !== after : Math.abs(before - after) > 1e-6
  })
}

/** Außentemperatur, ab der die Begrenzung greift (Schnittpunkt der Kennlinie mit dem Grenzwert); null, wenn nie */
export function limitCrossing(
  model: HeatingCurveModel,
  settings: CurveSettings,
  limit: number,
  from: number,
  to: number,
): number | null {
  const value = (outdoor: number) => rawFlow(model, settings.neigung, settings.niveau, settings.roomSetpoint, outdoor) - limit
  let low = from
  let high = to
  if (Math.sign(value(low)) === Math.sign(value(high))) return null
  for (let index = 0; index < 60; index++) {
    const middle = (low + high) / 2
    if (Math.sign(value(middle)) === Math.sign(value(low))) low = middle
    else high = middle
  }
  return (low + high) / 2
}

/** Fundstelle als Text, z. B. „Viessmann Heizkurve, Abschnitt Praxis-Anleitung“ */
export function curveRefText(tool: HeatingCurveTool, ref: CurveRef): string {
  const source = tool.sources.find((candidate) => candidate.key === ref.source)
  return `${source?.name ?? ref.source}, ${ref.where}`
}

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkHeatingCurveTool(tool: HeatingCurveTool): string[] {
  const issues: string[] = []
  const sourceKeys = tool.sources.map((source) => source.key)
  for (const value of duplicates(sourceKeys)) issues.push(`sources: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.symptoms.map((symptom) => symptom.key))) issues.push(`symptoms: key "${value}" doppelt vergeben`)

  const usedSources = new Set<string>()
  const checkRef = (ref: CurveRef | undefined, where: string) => {
    if (!ref) return
    usedSources.add(ref.source)
    if (!sourceKeys.includes(ref.source)) issues.push(`${where}: unbekannte Quelle "${ref.source}"`)
  }

  if (tool.todo && !tool.todo.startsWith('TODO: Inhalt fehlt')) issues.push('todo muss mit „TODO: Inhalt fehlt“ beginnen')
  if (tool.todo && tool.status === 'verified') issues.push('todo bei verified nicht erlaubt')

  checkRef(tool.model.ref, 'model')
  tool.model.examples.forEach((example, index) => {
    const where = `model.examples[${index}] (${example.label})`
    checkRef(example.ref, where)
    const flow = rawFlow(tool.model, example.neigung, example.niveau, example.roomSetpoint, example.outdoor)
    // Quelle rundet auf eine Nachkommastelle
    if (Math.abs(flow - example.flow) > 0.05 + 1e-9) issues.push(`${where}: ergibt ${flow.toFixed(2)} statt ${example.flow}`)
  })
  tool.model.fitExamples.forEach((example, index) => {
    const where = `model.fitExamples[${index}] (${example.label})`
    checkRef(example.ref, where)
    const observations = example.measurements.map((measurement) => ({
      outdoor: measurement.outdoor,
      room: measurement.room,
      flow: rawFlow(tool.model, example.neigung, example.niveau, measurement.roomSetpoint, measurement.outdoor),
    }))
    const fit = fitCurve(tool.model, observations, example, 'both')
    if (!fit.ok) issues.push(`${where}: nicht lösbar`)
    else {
      if (Math.abs(fit.neigung - example.expectedNeigung) > 0.005) issues.push(`${where}: Neigung ${fit.neigung.toFixed(3)}`)
      if (Math.abs(fit.niveau - example.expectedNiveau) > 0.05) issues.push(`${where}: Niveau ${fit.niveau.toFixed(2)}`)
    }
  })

  for (const name of CURVE_PARAMETER_KEYS) {
    const parameter = tool.parameters[name]
    const where = `parameters.${name}`
    checkRef(parameter.ref, where)
    if (parameter.min >= parameter.max) issues.push(`${where}: min muss kleiner als max sein`)
    const optional = OPTIONAL_CURVE_PARAMETERS.includes(name)
    if (!optional && parameter.default === null) issues.push(`${where}: default fehlt`)
    if (optional && parameter.start === undefined) issues.push(`${where}: start fehlt`)
    for (const value of [parameter.default, parameter.start]) {
      if (value !== null && value !== undefined && (value < parameter.min || value > parameter.max)) {
        issues.push(`${where}: ${value} außerhalb von min/max`)
      }
    }
  }
  if (tool.chart.outdoorFrom >= tool.chart.outdoorTo) issues.push('chart: outdoorFrom muss kleiner als outdoorTo sein')
  tool.bands.forEach((band, index) => {
    checkRef(band.ref, `bands[${index}] (${band.label})`)
    if (band.from >= band.to) issues.push(`bands[${index}] (${band.label}): from muss kleiner als to sein`)
  })
  tool.infos.forEach((info, index) => checkRef(info.ref, `infos[${index}] (${info.title})`))

  const { twoPoint } = tool
  checkRef(twoPoint.ref, 'twoPoint')
  for (const [name, range] of [['foot', twoPoint.foot], ['end', twoPoint.end], ['endOutdoor', twoPoint.endOutdoor]] as const) {
    if (range.min >= range.max) issues.push(`twoPoint.${name}: min muss kleiner als max sein`)
  }
  if (twoPoint.endOutdoor.max >= twoPoint.footOutdoor) issues.push('twoPoint: Endpunkt muss kälter sein als der Fußpunkt')
  if (twoPoint.endOutdoor.default < twoPoint.endOutdoor.min || twoPoint.endOutdoor.default > twoPoint.endOutdoor.max) {
    issues.push('twoPoint.endOutdoor: default außerhalb von min/max')
  }

  // Die Rückrechnung muss bei der Starteinstellung in dieselbe Richtung weisen wie die Regel der Quelle
  const settings = defaultSettings(tool)
  for (const symptom of tool.symptoms) {
    const where = `symptoms (${symptom.key})`
    checkRef(symptom.ref, where)
    if (symptom.cold === 0 && symptom.transition === 0) issues.push(`${where}: cold und transition sind beide 0`)
    const fit = fitCurve(tool.model, symptomObservations(tool, settings, symptom, 1), settings, 'both')
    if (!fit.ok) {
      issues.push(`${where}: Rückrechnung nicht lösbar`)
      continue
    }
    const neigung = changeDirection(settings.neigung, fit.neigung, 0.005)
    const niveau = changeDirection(settings.niveau, fit.niveau, 0.05)
    if (symptom.neigung !== 'keep' && neigung !== symptom.neigung) issues.push(`${where}: Rückrechnung ergibt Neigung ${neigung}`)
    if (symptom.niveau !== 'keep' && niveau !== symptom.niveau) issues.push(`${where}: Rückrechnung ergibt Niveau ${niveau}`)
  }

  for (const source of sourceKeys) {
    if (!usedSources.has(source)) issues.push(`sources (${source}): wird nirgends zitiert`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function heatingCurveKeywords(tool: HeatingCurveTool): string[] {
  return [
    ...tool.keywords,
    ...CURVE_PARAMETER_KEYS.map((name) => tool.parameters[name].label),
    ...tool.symptoms.map((symptom) => symptom.label),
    ...tool.infos.map((info) => info.title),
  ]
}
