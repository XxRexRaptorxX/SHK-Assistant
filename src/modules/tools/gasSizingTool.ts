import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'

// Gasleitung und Gasströmungswächter ("kind": "gasSizing"): Bemessung einer Gas-Leitungsanlage (Niederdruck)
// im Tabellenverfahren der TRGI 2018, Spalten wie im DVGW-Tabellenformular „Bemessung der Leitungsanlage“.
// - GS-Auswahl aus der Nennbelastung (ein Gerät) bzw. Summenbelastung (mehrere Geräte)
// - Spitzenbelastung je Teilstrecke: Q = Faktor · (ΣQNB + QNBmax)
// - Rohrdruckgefälle R nach den Rechenformeln aus DVGW G 617 (Reibungsbeiwert nach Zanke) statt aus den
//   Tabellen der TRGI, die nicht frei verfügbar sind; Formteile über ζ, GS, Zählergruppe und Armaturen über
//   ihre Druckverlustformeln, Höhenunterschied über die Dichtedifferenz Gas/Luft.
// Alle Zahlen (Stoffwerte, Beiwerte, Auswahlgrenzen, Rohrmaße, Grenzwerte) stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)
const positive = z.number().positive()

const flowMonitorSizeSchema = z.strictObject({
  key,
  /** z. B. „GS 4“ */
  label: text,
  /** Nenndurchfluss für Erdgas L in m³/h */
  nominalFlow: positive,
  /** Farbe des Typschilds */
  color: z.string().trim().default(''),
  /** Größte Nennbelastung in kW bei Einzelzuleitung (nur ein Gerät) */
  maxSingle: positive,
  /** Größte Summenbelastung in kW bei Verbrauchs-/Verteilungsleitung (mehrere Geräte) */
  maxMultiple: positive,
})

const flowMonitorTypeSchema = z.strictObject({
  key,
  /** z. B. „GS-K“ */
  label: text,
  /** Höchster Schließfaktor fS = VS/VN */
  closingFactor: positive,
  /** Nur in metallenen Leitungen zulässig */
  metalOnly: z.boolean().default(false),
  text,
})

const meterSchema = z.strictObject({
  key,
  /** z. B. „G4“ */
  label: text,
  /** Nenngröße GN */
  nominal: positive,
  /** Beiwert b der Zählergruppe in Pa */
  b: positive,
})

const valveRowSchema = z.strictObject({
  /** Nennweite DN */
  dn: z.number().int().positive(),
  /** Nennvolumenstrom V1 Durchgangsform in m³/h */
  straight: positive,
  /** Nennvolumenstrom V1 Eckform in m³/h; null = nicht anwendbar */
  angle: positive.nullable(),
  /** Druckverlust Δp1 bei V1 in Pa, falls abweichend vom Wert der Bauart */
  referenceLoss: positive.optional(),
})

const valveTypeSchema = z.strictObject({
  key,
  /** z. B. „Absperreinrichtung ohne TAE“ */
  label: text,
  note: z.string().trim().default(''),
  /** Druckverlust Δp1 bei V1 in Pa */
  referenceLoss: positive,
  rows: z.array(valveRowSchema).min(1),
})

const pipeSizeSchema = z.strictObject({
  key,
  /** z. B. „22 × 1“ */
  label: text,
  /** Außendurchmesser in mm */
  outer: positive,
  /** Wanddicke in mm */
  wall: positive,
})

const pipeSeriesSchema = z.strictObject({
  key,
  /** z. B. „Kupferrohr“ */
  label: text,
  note: z.string().trim().default(''),
  /** Rohrrauigkeit k in mm */
  roughness: positive,
  /** Metallene Leitung (für GS-M und den zulässigen Druckverlust beim direkten Abgleich) */
  metal: z.boolean(),
  sizes: z.array(pipeSizeSchema).min(1),
  source: text,
})

const lineTypeSchema = z.strictObject({
  key,
  label: text,
  note: z.string().trim().default(''),
  /** Erstauswahl: Rohrdruckgefälle höchstens so viel Pa/m */
  firstChoiceR: positive,
})

const fittingSchema = z.strictObject({
  key,
  /** z. B. „90°-Winkel“ */
  label: text,
  /** Druckverlustbeiwert ζ */
  zeta: positive,
})


export const gasSizingToolSchema = defineEntrySchema({
  kind: z.literal('gasSizing'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  related: relatedToolsSchema,
  /** Stoffwerte des Gases, auf dem die Bemessung beruht */
  gas: z.strictObject({
    label: text,
    /** Betriebsheizwert Hi,B in kWh/m³ */
    heatingValue: positive,
    /** Dichte in kg/m³ */
    density: positive,
    /** Relative Dichte dV (Gas zu Luft) */
    relativeDensity: positive,
    /** Kinematische Viskosität in m²/s */
    viscosity: positive,
    /** Erdbeschleunigung in m/s² */
    gravity: positive,
    source: text,
  }),
  /** Spitzenbelastung Q = factor · (ΣQNB + QNBmax) */
  peakLoad: z.strictObject({ factor: positive, text, source: text }),
  /** Rohrreibungsbeiwert λ = [−factor · ln((ln Re)^exponent / Re + roughnessFactor · k/di)]^−2 */
  friction: z.strictObject({ factor: positive, exponent: positive, roughnessFactor: positive, text, source: text }),
  flowMonitor: z.strictObject({
    sizes: z.array(flowMonitorSizeSchema).min(1),
    /** Druckverlust in Pa bei Nenndurchfluss: ΔpGS = referenceLoss · (V/VN)² */
    referenceLoss: positive,
    types: z.array(flowMonitorTypeSchema).min(1),
    rules: z.array(text).min(1),
    source: text,
  }),
  /** Zählergruppe: ΔpZG = base + b · (V / (flowFactor · GN))² */
  meters: z.strictObject({
    base: z.number().nonnegative(),
    flowFactor: positive,
    sizes: z.array(meterSchema).min(1),
    note: z.string().trim().default(''),
    source: text,
  }),
  /** Absperreinrichtungen und Geräteanschlussarmaturen: Δp = dV · Δp1 · (V/V1)² */
  valves: z.strictObject({ types: z.array(valveTypeSchema).min(1), source: text }),
  fittings: z.strictObject({ items: z.array(fittingSchema).min(1), note: z.string().trim().default(''), source: text }),
  pipeSeries: z.array(pipeSeriesSchema).min(1),
  lineTypes: z.array(lineTypeSchema).min(1),
  /** Zulässiger Gesamtdruckverlust der Leitungsanlage im Tabellenverfahren in Pa */
  pressureBudget: z.strictObject({ total: positive, text, source: text }),
  /**
   * Abgleich des GS: Regeln, wann welches Verfahren gilt, und beim direkten Abgleich der zulässige
   * Gesamtdruckverlust bei Schließvolumenstrom in Pa (metal: nur metallene Leitungen, plastic: sonst)
   */
  balancing: z.strictObject({
    rules: z.array(text).min(1),
    limits: z.strictObject({ metal: positive, plastic: positive }),
    source: text,
  }),
  /** Gegenproben aus Quellen; der Build prüft, dass das Tool dasselbe ergibt */
  checks: z.strictObject({
    flowMonitor: z
      .array(
        z.strictObject({
          label: text,
          /** Nennbelastungen der Geräte in kW */
          loads: z.array(positive).min(1),
          /** key der Baugröße; null = keine passende Baugröße */
          expected: key.nullable(),
          source: text,
        }),
      )
      .min(1),
    pipe: z
      .array(
        z.strictObject({
          label: text,
          series: key,
          size: key,
          /** Belastung in kW */
          load: positive,
          /** Rohrdruckgefälle der Quelle in Pa/m */
          r: positive,
          /** Erlaubte relative Abweichung, z. B. 0.1 = 10 % */
          tolerance: positive,
          source: text,
        }),
      )
      .min(1),
  }),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: text,
})

export type GasSizingTool = z.output<typeof gasSizingToolSchema>
export type FlowMonitorSize = GasSizingTool['flowMonitor']['sizes'][number]
export type GasMeter = GasSizingTool['meters']['sizes'][number]
export type PipeSeries = GasSizingTool['pipeSeries'][number]
export type PipeSize = PipeSeries['sizes'][number]
export type ValveType = GasSizingTool['valves']['types'][number]
export type LineType = GasSizingTool['lineTypes'][number]

/** Rundungsfehler sollen keine Baugröße kippen */
const EPSILON = 1e-9

// ---------- Eingaben ----------

export interface GasAppliance {
  key: string
  name: string
  /** Nennbelastung QNB in kW */
  load: number
}

export type ValveForm = 'straight' | 'angle'

export interface ValveInput {
  /** key der Bauart */
  type: string
  form: ValveForm
  dn: number
  count: number
}

export interface SectionInput {
  key: string
  lineType: string
  series: string
  size: string
  /** Leitungslänge in m */
  length: number
  /** Anzahl je Formteil (key) */
  fittings: Readonly<Record<string, number>>
  /** Höhenunterschied Ende minus Anfang in m, nach oben positiv */
  height: number
  /** Geräte (keys), die über diese Teilstrecke versorgt werden */
  appliances: readonly string[]
  valves: readonly ValveInput[]
}

export interface GasSelection {
  appliances: readonly GasAppliance[]
  /** Teilstrecken in Fließrichtung vom GS bis zum ungünstigsten Gerät */
  sections: readonly SectionInput[]
  /** Baugröße von Hand (key); ohne Angabe die ausgewählte */
  flowMonitor?: string
  /** Zähler im Fließweg (key); ohne Angabe kein Zähler */
  meter?: string
}

// ---------- Belastungen ----------

export interface Loads {
  /** Summenbelastung ΣQNB in kW */
  sum: number
  /** Größte Nennbelastung QNBmax in kW */
  max: number
  /** Spitzenbelastung Q in kW */
  peak: number
  count: number
}

/** Belastungen der Geräte; Geräte ohne Nennbelastung größer 0 zählen nicht */
export function loadsOf(tool: GasSizingTool, loads: readonly number[]): Loads {
  const valid = loads.filter((load) => load > 0)
  const sum = valid.reduce((total, load) => total + load, 0)
  const max = valid.reduce((largest, load) => Math.max(largest, load), 0)
  return { sum, max, peak: valid.length === 0 ? 0 : tool.peakLoad.factor * (sum + max), count: valid.length }
}

/** Volumenstrom in m³/h aus einer Belastung in kW */
export const volumeFlow = (tool: GasSizingTool, load: number) => load / tool.gas.heatingValue

// ---------- Gasströmungswächter ----------

export interface FlowMonitorChoice {
  loads: Loads
  /** single: ein Gerät, Grenze je Nennbelastung; multiple: mehrere Geräte, Grenze je Summenbelastung */
  basis: 'single' | 'multiple'
  size?: FlowMonitorSize
  /** Mehrere Geräte: Baugröße wegen des größten Geräts (Grenze als Einzelgerät) größer gewählt */
  raisedForLargest: boolean
}

/**
 * Baugröße aus der Tabelle: die kleinste, deren Grenze die Belastung nicht überschreitet.
 * Liegt die Belastung zwischen zwei Grenzen (z. B. 27,3 kW bei „bis 27“ und „28 bis 41“), gilt die größere.
 */
export function chooseFlowMonitor(tool: GasSizingTool, applianceLoads: readonly number[]): FlowMonitorChoice {
  const loads = loadsOf(tool, applianceLoads)
  const sizes = tool.flowMonitor.sizes
  if (loads.count <= 1) {
    const size = sizes.find((candidate) => loads.max <= candidate.maxSingle + EPSILON)
    return { loads, basis: 'single', size: loads.count === 0 ? undefined : size, raisedForLargest: false }
  }
  const bySum = sizes.findIndex((candidate) => loads.sum <= candidate.maxMultiple + EPSILON)
  const byLargest = sizes.findIndex((candidate) => loads.max <= candidate.maxSingle + EPSILON)
  if (bySum === -1 || byLargest === -1) return { loads, basis: 'multiple', raisedForLargest: false }
  return { loads, basis: 'multiple', size: sizes[Math.max(bySum, byLargest)], raisedForLargest: byLargest > bySum }
}

/** Druckverlust des GS in Pa */
export function flowMonitorLoss(tool: GasSizingTool, size: FlowMonitorSize, flow: number): number {
  return tool.flowMonitor.referenceLoss * (flow / size.nominalFlow) ** 2
}

// ---------- Zählergruppe, Armaturen, Höhe ----------

/** Druckverlust der Zählergruppe in Pa */
export function meterLoss(tool: GasSizingTool, meter: GasMeter, flow: number): number {
  return tool.meters.base + meter.b * (flow / (tool.meters.flowFactor * meter.nominal)) ** 2
}

/** Druckverlust einer Armatur in Pa; undefined, wenn Nennweite oder Bauform in der Tabelle fehlt */
export function valveLoss(tool: GasSizingTool, valve: Omit<ValveInput, 'count'>, flow: number): number | undefined {
  const type = tool.valves.types.find((candidate) => candidate.key === valve.type)
  const row = type?.rows.find((candidate) => candidate.dn === valve.dn)
  const nominal = row ? (valve.form === 'angle' ? row.angle : row.straight) : null
  if (!type || !row || nominal === null) return undefined
  return tool.gas.relativeDensity * (row.referenceLoss ?? type.referenceLoss) * (flow / nominal) ** 2
}

/** Druckdifferenz aus dem Höhenunterschied in Pa; negativ = Druckgewinn (Gas leichter als Luft, Leitung steigt) */
export function heightLoss(tool: GasSizingTool, height: number): number {
  const air = tool.gas.density / tool.gas.relativeDensity
  return (tool.gas.density - air) * tool.gas.gravity * height
}

// ---------- Rohr ----------

/** Innendurchmesser in mm */
export const innerDiameter = (size: PipeSize) => size.outer - 2 * size.wall

/** Mittlere Fließgeschwindigkeit in m/s */
export function velocity(flow: number, innerMm: number): number {
  const area = (Math.PI / 4) * (innerMm / 1000) ** 2
  return flow / 3600 / area
}

export interface PipeFlow {
  /** Fließgeschwindigkeit in m/s */
  velocity: number
  reynolds: number
  lambda: number
  /** Rohrdruckgefälle R in Pa/m */
  r: number
  /** Staudruck ρ/2·w² in Pa */
  dynamicPressure: number
}

/** Strömung im Rohr bei Belastung load (kW); undefined ohne Durchfluss */
export function pipeFlow(tool: GasSizingTool, series: PipeSeries, size: PipeSize, load: number): PipeFlow | undefined {
  return pipeFlowAt(tool, series, size, volumeFlow(tool, load))
}

/** Strömung im Rohr bei Volumenstrom flow (m³/h); undefined ohne Durchfluss */
export function pipeFlowAt(tool: GasSizingTool, series: PipeSeries, size: PipeSize, flow: number): PipeFlow | undefined {
  if (flow <= 0) return undefined
  const inner = innerDiameter(size)
  const w = velocity(flow, inner)
  const reynolds = (w * inner) / 1000 / tool.gas.viscosity
  const { factor, exponent, roughnessFactor } = tool.friction
  const lambda = (-factor * Math.log(Math.log(reynolds) ** exponent / reynolds + (roughnessFactor * series.roughness) / inner)) ** -2
  const dynamicPressure = (tool.gas.density / 2) * w ** 2
  return { velocity: w, reynolds, lambda, r: (lambda / (inner / 1000)) * dynamicPressure, dynamicPressure }
}

/** Kleinste Dimension der Reihe, deren Rohrdruckgefälle die Erstauswahl-Grenze einhält */
export function firstChoice(tool: GasSizingTool, series: PipeSeries, lineType: LineType, load: number): PipeSize | undefined {
  if (load <= 0) return undefined
  return series.sizes.find((size) => (pipeFlow(tool, series, size, load)?.r ?? Infinity) <= lineType.firstChoiceR + EPSILON)
}

// ---------- Bemessung ----------

export interface SectionResult {
  input: SectionInput
  series?: PipeSeries
  size?: PipeSize
  lineType?: LineType
  loads: Loads
  /** Volumenstrom bei Spitzenbelastung in m³/h */
  flow: number
  pipe?: PipeFlow
  firstChoice?: PipeSize
  /** Berechnungslänge lR = l + Σläq in m */
  calcLength: number
  /** Äquivalente Länge der Formteile in m */
  fittingLength: number
  pipeLoss: number
  fittingLoss: number
  valveLoss: number
  /** Armaturen, deren Nennweite oder Bauform in der Tabelle fehlt */
  unknownValves: ValveInput[]
  heightLoss: number
  flowMonitorLoss: number
  meterLoss: number
  /** Druckverlust der Teilstrecke ΔpTS in Pa */
  total: number
  /** Druckverlust bis zum Ende dieser Teilstrecke in Pa */
  cumulative: number
}

export interface GasSizingResult {
  flowMonitor: FlowMonitorChoice
  /** Für die Rechnung genutzte Baugröße (von Hand gewählt oder ausgewählt) */
  usedFlowMonitor?: FlowMonitorSize
  meter?: GasMeter
  sections: SectionResult[]
  total: number
  budget: number
  /** Mindestens eine Teilstrecke ohne Rohr, Geräte oder mit unbekannter Armatur */
  incomplete: boolean
}

export function findSeries(tool: GasSizingTool, seriesKey: string): PipeSeries | undefined {
  return tool.pipeSeries.find((series) => series.key === seriesKey)
}

/** Rohr, Formteile, Armaturen und Höhe einer Teilstrecke bei Volumenstrom flow (m³/h) */
function lossesAt(tool: GasSizingTool, input: SectionInput, flow: number) {
  const series = findSeries(tool, input.series)
  const size = series?.sizes.find((candidate) => candidate.key === input.size)
  const pipe = series && size ? pipeFlowAt(tool, series, size, flow) : undefined
  const zetaSum = tool.fittings.items.reduce((sum, item) => sum + item.zeta * (input.fittings[item.key] ?? 0), 0)
  const fittingLoss = pipe ? zetaSum * pipe.dynamicPressure : 0
  const unknownValves: ValveInput[] = []
  let valveSum = 0
  for (const valve of input.valves) {
    if (valve.count <= 0) continue
    const loss = valveLoss(tool, valve, flow)
    if (loss === undefined) unknownValves.push(valve)
    else valveSum += loss * valve.count
  }
  return {
    series,
    size,
    pipe,
    pipeLoss: pipe ? pipe.r * input.length : 0,
    fittingLoss,
    fittingLength: pipe && pipe.r > 0 ? fittingLoss / pipe.r : 0,
    valveLoss: valveSum,
    unknownValves,
    heightLoss: heightLoss(tool, input.height),
  }
}

export interface BalancingSection {
  input: SectionInput
  pipe?: PipeFlow
  pipeLoss: number
  fittingLoss: number
  valveLoss: number
  unknownValves: ValveInput[]
  heightLoss: number
  flowMonitorLoss: number
  meterLoss: number
  total: number
  cumulative: number
}

export interface BalancingResult {
  type: FlowMonitorType
  size: FlowMonitorSize
  /** Schließvolumenstrom VS = fS · VN in m³/h */
  closingFlow: number
  /** Zulässiger Gesamtdruckverlust in Pa */
  limit: number
  /** Alle Teilstrecken aus metallenen Rohren */
  metal: boolean
  sections: BalancingSection[]
  total: number
  /** Größter Druckverlust bis zum Ende einer Teilstrecke */
  max: number
  ok: boolean
  incomplete: boolean
  /** Bauart ist nur für metallene Leitungen zulässig, die Leitung ist es nicht */
  typeNotAllowed: boolean
}

export type FlowMonitorType = GasSizingTool['flowMonitor']['types'][number]

/**
 * Direkter Abgleich: Bei einem Bruch am Ende des Fließwegs strömt durch alle Teilstrecken der Schließvolumenstrom
 * des GS. Der Druckverlust der Leitungsanlage samt GS, Zählergruppe und Armaturen darf dann den zulässigen Wert
 * nicht überschreiten, sonst schließt der GS nicht sicher.
 */
export function calculateBalancing(tool: GasSizingTool, selection: GasSelection, typeKey: string): BalancingResult | undefined {
  const type = tool.flowMonitor.types.find((candidate) => candidate.key === typeKey)
  const size =
    tool.flowMonitor.sizes.find((candidate) => candidate.key === selection.flowMonitor) ??
    chooseFlowMonitor(
      tool,
      selection.appliances.map((appliance) => appliance.load),
    ).size
  if (!type || !size || selection.sections.length === 0) return undefined
  const meter = tool.meters.sizes.find((candidate) => candidate.key === selection.meter)
  const closingFlow = type.closingFactor * size.nominalFlow
  const metal = selection.sections.every((input) => findSeries(tool, input.series)?.metal === true)
  const limit = metal ? tool.balancing.limits.metal : tool.balancing.limits.plastic
  let cumulative = 0
  let max = 0
  let incomplete = false
  const sections = selection.sections.map((input, index): BalancingSection => {
    const losses = lossesAt(tool, input, closingFlow)
    const first = index === 0
    const gsLoss = first ? flowMonitorLoss(tool, size, closingFlow) : 0
    const zgLoss = first && meter ? meterLoss(tool, meter, closingFlow) : 0
    const total = losses.pipeLoss + losses.fittingLoss + losses.valveLoss + losses.heightLoss + gsLoss + zgLoss
    cumulative += total
    max = Math.max(max, cumulative)
    if (!losses.pipe || losses.unknownValves.length > 0) incomplete = true
    return {
      input,
      pipe: losses.pipe,
      pipeLoss: losses.pipeLoss,
      fittingLoss: losses.fittingLoss,
      valveLoss: losses.valveLoss,
      unknownValves: losses.unknownValves,
      heightLoss: losses.heightLoss,
      flowMonitorLoss: gsLoss,
      meterLoss: zgLoss,
      total,
      cumulative,
    }
  })
  return {
    type,
    size,
    closingFlow,
    limit,
    metal,
    sections,
    total: cumulative,
    max,
    ok: max <= limit + EPSILON,
    incomplete,
    typeNotAllowed: type.metalOnly && !metal,
  }
}

export function calculateGasSizing(tool: GasSizingTool, selection: GasSelection): GasSizingResult {
  const flowMonitor = chooseFlowMonitor(
    tool,
    selection.appliances.map((appliance) => appliance.load),
  )
  const usedFlowMonitor =
    tool.flowMonitor.sizes.find((size) => size.key === selection.flowMonitor) ?? flowMonitor.size
  const meter = tool.meters.sizes.find((size) => size.key === selection.meter)
  const allFlow = volumeFlow(tool, flowMonitor.loads.peak)
  let cumulative = 0
  let incomplete = false
  const sections = selection.sections.map((input, index): SectionResult => {
    const lineType = tool.lineTypes.find((candidate) => candidate.key === input.lineType)
    const loads = loadsOf(
      tool,
      selection.appliances.filter((appliance) => input.appliances.includes(appliance.key)).map((appliance) => appliance.load),
    )
    const flow = volumeFlow(tool, loads.peak)
    const { series, size, pipe, pipeLoss, fittingLoss, fittingLength, valveLoss: valveSum, unknownValves, heightLoss: height } =
      lossesAt(tool, input, flow)
    const first = index === 0
    const gsLoss = first && usedFlowMonitor && allFlow > 0 ? flowMonitorLoss(tool, usedFlowMonitor, allFlow) : 0
    const zgLoss = first && meter && allFlow > 0 ? meterLoss(tool, meter, allFlow) : 0
    const total = pipeLoss + fittingLoss + valveSum + height + gsLoss + zgLoss
    cumulative += total
    if (!pipe || unknownValves.length > 0) incomplete = true
    return {
      input,
      series,
      size,
      lineType,
      loads,
      flow,
      pipe,
      firstChoice: series && lineType ? firstChoice(tool, series, lineType, loads.peak) : undefined,
      calcLength: input.length + fittingLength,
      fittingLength,
      pipeLoss,
      fittingLoss,
      valveLoss: valveSum,
      unknownValves,
      heightLoss: height,
      flowMonitorLoss: gsLoss,
      meterLoss: zgLoss,
      total,
      cumulative,
    }
  })
  if (sections.length === 0) incomplete = true
  return { flowMonitor, usedFlowMonitor, meter, sections, total: cumulative, budget: tool.pressureBudget.total, incomplete }
}

// ---------- Prüfung des Inhalts ----------

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

const ascending = (values: readonly number[]) => values.every((value, index) => index === 0 || value > values[index - 1]!)

export function checkGasSizingTool(tool: GasSizingTool): string[] {
  const issues: string[] = []
  const sizes = tool.flowMonitor.sizes
  for (const value of duplicates(sizes.map((size) => size.key))) issues.push(`flowMonitor.sizes: key "${value}" doppelt`)
  if (!ascending(sizes.map((size) => size.nominalFlow))) issues.push('flowMonitor.sizes: Nenndurchfluss steigt nicht')
  if (!ascending(sizes.map((size) => size.maxSingle))) issues.push('flowMonitor.sizes: maxSingle steigt nicht')
  if (!ascending(sizes.map((size) => size.maxMultiple))) issues.push('flowMonitor.sizes: maxMultiple steigt nicht')
  for (const size of sizes) {
    if (size.maxMultiple < size.maxSingle) issues.push(`flowMonitor.sizes (${size.label}): maxMultiple kleiner als maxSingle`)
  }
  for (const value of duplicates(tool.flowMonitor.types.map((type) => type.key))) issues.push(`flowMonitor.types: key "${value}" doppelt`)
  if (tool.balancing.limits.plastic > tool.balancing.limits.metal) issues.push('balancing.limits: Kunststoff über Metall')
  for (const value of duplicates(tool.meters.sizes.map((meter) => meter.key))) issues.push(`meters.sizes: key "${value}" doppelt`)
  if (!ascending(tool.meters.sizes.map((meter) => meter.nominal))) issues.push('meters.sizes: Nenngröße steigt nicht')
  for (const value of duplicates(tool.valves.types.map((type) => type.key))) issues.push(`valves.types: key "${value}" doppelt`)
  for (const type of tool.valves.types) {
    if (!ascending(type.rows.map((row) => row.dn))) issues.push(`valves.types (${type.key}): Nennweiten nicht aufsteigend`)
  }
  for (const value of duplicates(tool.fittings.items.map((item) => item.key))) issues.push(`fittings: key "${value}" doppelt`)
  for (const value of duplicates(tool.lineTypes.map((type) => type.key))) issues.push(`lineTypes: key "${value}" doppelt`)
  for (const value of duplicates(tool.pipeSeries.map((series) => series.key))) issues.push(`pipeSeries: key "${value}" doppelt`)
  for (const series of tool.pipeSeries) {
    const where = `pipeSeries (${series.key})`
    for (const value of duplicates(series.sizes.map((size) => size.key))) issues.push(`${where}: Größe "${value}" doppelt`)
    for (const size of series.sizes) {
      if (innerDiameter(size) <= 0) issues.push(`${where}, ${size.label}: Wanddicke zu groß`)
    }
    if (!ascending(series.sizes.map(innerDiameter))) issues.push(`${where}: Innendurchmesser steigen nicht`)
  }
  if (issues.length > 0) return issues

  tool.checks.flowMonitor.forEach((check, index) => {
    const actual = chooseFlowMonitor(tool, check.loads).size?.key ?? null
    if (actual !== check.expected) issues.push(`checks.flowMonitor[${index}] (${check.label}): ergibt ${actual} statt ${check.expected}`)
  })
  tool.checks.pipe.forEach((check, index) => {
    const where = `checks.pipe[${index}] (${check.label})`
    const series = findSeries(tool, check.series)
    const size = series?.sizes.find((candidate) => candidate.key === check.size)
    if (!series || !size) return issues.push(`${where}: unbekannte Reihe oder Größe`)
    const r = pipeFlow(tool, series, size, check.load)!.r
    if (Math.abs(r - check.r) / check.r > check.tolerance) {
      issues.push(`${where}: R = ${r.toFixed(2)} Pa/m statt ${check.r} Pa/m (±${check.tolerance * 100} %)`)
    }
  })
  return issues
}

/** Suchbegriffe für die globale Suche */
export function gasSizingKeywords(tool: GasSizingTool): string[] {
  return [
    ...tool.keywords,
    ...tool.flowMonitor.sizes.map((size) => size.label),
    ...tool.flowMonitor.types.map((type) => type.label),
    ...tool.pipeSeries.map((series) => series.label),
  ]
}
