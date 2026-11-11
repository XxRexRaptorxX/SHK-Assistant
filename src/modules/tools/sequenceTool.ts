import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { toolTagsSchema } from './toolTags.ts'

// Ablauf-Tools ("kind": "sequence"): Programmablauf eines Geräts als Zeitdiagramm, z. B. der Start
// eines Feuerungsautomaten. Je Variante (z. B. Brennerart) gibt es Signale (Zeilen), Phasen (Spalten,
// mit typischer Dauer) und Störungen mit Ursachen in Prüfreihenfolge. Eine Stoppuhr misst die Phasen
// beim Start mit; bleibt der Ablauf stehen, zeigt das Tool die Störungen dieser Phase.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

const signalSchema = z.strictObject({
  key,
  /** Zeile im Diagramm, z. B. „Gebläsemotor“ */
  label: z.string().trim().min(1),
})

const phaseSchema = z.strictObject({
  key,
  /** z. B. „Vorbelüftung“ */
  label: z.string().trim().min(1),
  /** Kürzel im Diagramm, z. B. „VS“ */
  abbr: z.string().trim().min(1).max(4),
  /** Lexikon-Begriff, auf den Kürzel und Name verlinken, z. B. „Vorspülzeit“ */
  term: z.string().trim().min(1).optional(),
  /** Dauer zur Anzeige, z. B. „21,5 s“ oder „max. 10 s“; leer, wenn es keinen üblichen Wert gibt */
  duration: z.string().trim().default(''),
  /** Typische Dauer in Sekunden für den Vergleich mit der Stoppuhr; fehlt bei offenem Ende (Betrieb) */
  seconds: z.number().positive().optional(),
  /** Bedeutung von seconds: üblicher Wert, Höchstwert (z. B. Sicherheitszeit) oder Mindestwert */
  limit: z.enum(['typ', 'max', 'min']).default('typ'),
  /**
   * Nur wenn die Phase wiederholt werden darf: höchste Anzahl (im Diagramm „max. 3×“; fehlt, wenn die
   * Quelle keine Zahl nennt) und Erklärung
   */
  repeat: z
    .strictObject({
      count: z.number().int().positive().optional(),
      text: z.string().trim().min(1),
    })
    .optional(),
  /** Woran der Monteur den Beginn der Phase erkennt, z. B. „Zündfunke hörbar“ */
  event: z.string().trim().min(1),
  /** Signale, die in dieser Phase anliegen */
  signals: z.array(key).min(1),
  /** Was in der Phase passiert */
  description: z.string().trim().min(1),
  /** Worauf beim Prüfen zu achten ist */
  check: z.string().trim().default(''),
})

const faultSchema = z.strictObject({
  /** Beobachtung, z. B. „Zündfunke da, keine Flamme“ */
  symptom: z.string().trim().min(1),
  /** Phase, in der der Ablauf stehen bleibt */
  phase: key,
  /** Ursachen in Prüfreihenfolge */
  causes: z.array(z.string().trim().min(1)).min(1),
  /** Hinweis unter den Ursachen, z. B. zur Entriegelung */
  note: z.string().trim().default(''),
})

const variantSchema = z.strictObject({
  key,
  /** Beschriftung in der Leiste, z. B. „Öl“ */
  label: z.string().trim().min(1),
  /** Zweite, kleine Zeile in der Leiste, z. B. „Gebläsebrenner“ */
  note: z.string().trim().default(''),
  title: z.string().trim().min(1),
  /** Einordnung, z. B. Beispielgerät, auf das sich die Zeiten beziehen */
  description: z.string().trim().min(1),
  signals: z.array(signalSchema).min(1),
  phases: z.array(phaseSchema).min(2),
  faults: z.array(faultSchema).min(1),
})

export const sequenceToolSchema = defineEntrySchema({
  kind: z.literal('sequence'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: toolTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Was umgeschaltet wird, z. B. „Brennerart“ */
  name: z.string().trim().min(1),
  variants: z.array(variantSchema).min(1),
})

export type SequenceTool = z.output<typeof sequenceToolSchema>
export type SequenceVariant = SequenceTool['variants'][number]
export type SequencePhase = SequenceVariant['phases'][number]
export type SequenceFault = SequenceVariant['faults'][number]

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkSequenceTool(tool: SequenceTool): string[] {
  const issues: string[] = []
  for (const value of duplicates(tool.variants.map((variant) => variant.key))) issues.push(`variants: key "${value}" doppelt`)
  for (const variant of tool.variants) {
    const where = `variants (${variant.key})`
    const signalKeys = variant.signals.map((signal) => signal.key)
    const phaseKeys = variant.phases.map((phase) => phase.key)
    for (const value of duplicates(signalKeys)) issues.push(`${where}: Signal "${value}" doppelt`)
    for (const value of duplicates(phaseKeys)) issues.push(`${where}: Phase "${value}" doppelt`)
    for (const value of duplicates(variant.faults.map((fault) => fault.symptom))) issues.push(`${where}: Störung "${value}" doppelt`)
    for (const phase of variant.phases) {
      for (const signal of phase.signals) {
        if (!signalKeys.includes(signal)) issues.push(`${where}, Phase ${phase.key}: unbekanntes Signal "${signal}"`)
      }
      if (phase.limit !== 'typ' && phase.seconds === undefined) issues.push(`${where}, Phase ${phase.key}: limit ohne seconds`)
    }
    // Jedes Signal kommt im Ablauf vor, sonst wäre die Zeile leer
    for (const signal of signalKeys) {
      if (!variant.phases.some((phase) => phase.signals.includes(signal))) issues.push(`${where}: Signal "${signal}" in keiner Phase`)
    }
    for (const fault of variant.faults) {
      if (!phaseKeys.includes(fault.phase)) issues.push(`${where}, Störung "${fault.symptom}": unbekannte Phase "${fault.phase}"`)
    }
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function sequenceKeywords(tool: SequenceTool): string[] {
  return tool.variants.flatMap((variant) => [
    variant.label,
    variant.note,
    variant.title,
    ...variant.signals.map((signal) => signal.label),
    ...variant.phases.map((phase) => phase.label),
    ...variant.faults.map((fault) => fault.symptom),
  ])
}

/** Störungen der Phase zuerst, danach die übrigen in Ablauf-Reihenfolge */
export function faultsByPhase(variant: SequenceVariant, phaseKey?: string): SequenceFault[] {
  const order = (fault: SequenceFault) => variant.phases.findIndex((phase) => phase.key === fault.phase)
  return [...variant.faults].sort((a, b) => {
    if (phaseKey !== undefined) {
      const aHere = a.phase === phaseKey ? 0 : 1
      const bHere = b.phase === phaseKey ? 0 : 1
      if (aHere !== bHere) return aHere - bHere
    }
    return order(a) - order(b)
  })
}

// Stoppuhr: Der Monteur startet bei der Wärmeanforderung und tippt bei jedem Phasenwechsel.
// Zeiten in Millisekunden seit einem beliebigen Bezugspunkt (performance.now()).

export type Stopwatch =
  | { state: 'idle' }
  | { state: 'running'; marks: number[] }
  | { state: 'stopped'; marks: number[]; end: number; phase: number }
  | { state: 'done'; marks: number[] }

/** marks[i] = Beginn von Phase i */
export const startStopwatch = (now: number): Stopwatch => ({ state: 'running', marks: [now] })

/** Nächste Phase beginnt; mit der letzten Phase (Betrieb) ist der Start geschafft */
export function nextPhase(watch: Stopwatch, now: number, phaseCount: number): Stopwatch {
  if (watch.state !== 'running') return watch
  const marks = [...watch.marks, now]
  return marks.length >= phaseCount ? { state: 'done', marks } : { state: 'running', marks }
}

/** Ablauf bleibt stehen: die laufende Phase ist die, in der der Fehler auftritt */
export function stopStopwatch(watch: Stopwatch, now: number): Stopwatch {
  if (watch.state !== 'running') return watch
  return { state: 'stopped', marks: watch.marks, end: now, phase: watch.marks.length - 1 }
}

/** Index der laufenden bzw. angehaltenen Phase; undefined, wenn nichts läuft */
export function activePhase(watch: Stopwatch): number | undefined {
  if (watch.state === 'running') return watch.marks.length - 1
  if (watch.state === 'stopped') return watch.phase
  if (watch.state === 'done') return watch.marks.length - 1
  return undefined
}

/** Gemessene Dauer je abgeschlossener Phase in Sekunden (die laufende Phase fehlt) */
export function measuredSeconds(watch: Stopwatch): number[] {
  if (watch.state === 'idle') return []
  const ends = watch.state === 'stopped' ? [...watch.marks.slice(1), watch.end] : watch.marks.slice(1)
  return ends.map((end, index) => (end - watch.marks[index]!) / 1000)
}

/** Messung von Hand: Abweichungen bis 1 s gelten als Reaktionszeit */
const TOLERANCE = 1

/** Liegt eine Messung außerhalb eines Höchst- bzw. Mindestwerts? Übliche Werte werden nicht bewertet. */
export function outsideLimit(phase: SequencePhase, seconds: number): 'over' | 'under' | undefined {
  if (phase.seconds === undefined) return undefined
  if (phase.limit === 'max' && seconds > phase.seconds + TOLERANCE) return 'over'
  if (phase.limit === 'min' && seconds < phase.seconds - TOLERANCE) return 'under'
  return undefined
}

/** Sekunden für die Anzeige, auf ganze Sekunden aufgerundet, z. B. 19,2 → „20 s“ */
export function formatSeconds(seconds: number): string {
  // Kleine Rechenreste (z. B. 3,0000001) nicht auf die nächste Sekunde heben
  return `${Math.ceil(Math.round(seconds * 1000) / 1000)} s`
}

/** Verbleibende Zeit bis zum üblichen Ende bzw. zur Grenze der Phase; undefined ohne Vergleichswert */
export function remainingSeconds(phase: SequencePhase, elapsed: number): number | undefined {
  return phase.seconds === undefined ? undefined : Math.max(0, phase.seconds - elapsed)
}
