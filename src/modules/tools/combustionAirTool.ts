import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'

// Verbrennungsluft-Tools ("kind": "combustionAir"): Regelwerk wählen und die Nennleistung der raumluftabhängigen
// Feuerstätten eingeben. Das Tool nennt den Mindestquerschnitt der Öffnung ins Freie, ggf. den nötigen Volumenstrom
// und (wo das Regelwerk ihn kennt) den Mindest-Rauminhalt im Verbrennungsluftverbund, und prüft eingegebene Öffnungen
// bzw. Räume. Alle Grenzwerte, Texte und Quellen stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)
const positive = z.number().positive()

const refSchema = z.strictObject({ source: key, where: text })
const sourceSchema = z.strictObject({ key, name: text, source: text })
const noteSchema = z.strictObject({ title: text, text, ref: refSchema })

const regulationSchema = z.strictObject({
  key,
  label: text,
  /** Zweite, kleine Zeile in der Leiste, z. B. „Stand 2017“ */
  note: z.string().trim().default(''),
  /** Öffnung ins Freie */
  opening: z.strictObject({
    /** Bis einschließlich dieser Nennleistung (kW): eine Öffnung ≥ single oder zwei Öffnungen je ≥ pairEach */
    upTo: positive,
    /** cm², auch Grundwert über upTo */
    single: positive,
    /** cm² je Öffnung, wenn zwei Öffnungen */
    pairEach: positive,
    /** cm² mehr für jedes (angefangene) kW über upTo */
    perKwOver: positive,
    /** Über upTo: höchstens so viele Öffnungen oder Leitungen */
    maxParts: z.number().int().min(1),
    text,
    ref: refSchema,
    overText: text,
    overRef: refSchema,
  }),
  /** Rauminhalt bzw. Verbrennungsluftverbund; fehlt, wenn das Regelwerk ihn nicht kennt */
  compound: z
    .strictObject({
      /** Bis einschließlich dieser Nennleistung (kW) */
      upTo: positive,
      /** m³ Rauminhalt je kW */
      perKw: positive,
      /** cm² je Verbrennungsluftöffnung zwischen den Räumen */
      openingMin: positive,
      text,
      ref: refSchema,
    })
    .optional(),
  /** Hinweis, wenn es keinen Rauminhalt-Nachweis gibt */
  compoundMissing: text.optional(),
  /** Anderer Nachweis über einen verfügbaren Volumenstrom */
  volumeFlow: z.strictObject({ perKw: positive, text, ref: refSchema }).optional(),
  /** Anderer Nachweis ohne Zahlenwert */
  otherProof: z.strictObject({ text, ref: refSchema }).optional(),
  notes: z.array(noteSchema).default([]),
})

export const combustionAirToolSchema = defineEntrySchema({
  kind: z.literal('combustionAir'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  related: relatedToolsSchema,
  sources: z.array(sourceSchema).min(1),
  power: z.strictObject({ label: text, unit: text, max: positive, text, ref: refSchema }),
  regulations: z.array(regulationSchema).min(1),
  closingNote: text,
})

export type CombustionAirTool = z.output<typeof combustionAirToolSchema>
export type CombustionAirRegulation = CombustionAirTool['regulations'][number]
export type CombustionAirRef = z.output<typeof refSchema>

/** Gegen Rundungsfehler, z. B. 55,000000001 kW */
const EPSILON = 1e-9

export type OpeningRequirement =
  /** Bis zur Grenze: eine Öffnung ≥ single oder zwei je ≥ pairEach */
  | { kind: 'small'; single: number; pairEach: number; maxOpenings: 2 }
  /** Über der Grenze: Summe ≥ area auf höchstens maxOpenings Öffnungen */
  | { kind: 'large'; area: number; maxOpenings: number }

export function openingRequirement(regulation: CombustionAirRegulation, power: number): OpeningRequirement {
  const { opening } = regulation
  if (power <= opening.upTo + EPSILON) {
    return { kind: 'small', single: opening.single, pairEach: opening.pairEach, maxOpenings: 2 }
  }
  // „für jedes über der Grenze hinausgehende Kilowatt“: angefangene kW zählen voll (sichere Seite)
  const extraKw = Math.ceil(power - opening.upTo - EPSILON)
  return { kind: 'large', area: opening.single + extraKw * opening.perKwOver, maxOpenings: opening.maxParts }
}

export type OpeningCheck =
  | { kind: 'ok'; total: number }
  /** Bis zur Grenze: keine Öffnung groß genug, und nicht zwei je ≥ pairEach */
  | { kind: 'tooSmall'; total: number }
  /** Über der Grenze: Summe zu klein; missing = fehlende cm² */
  | { kind: 'missing'; total: number; missing: number }
  | { kind: 'tooMany'; total: number }

/** Lichte Querschnitte (cm²) der Öffnungen gegen die Anforderung prüfen */
export function checkOpenings(requirement: OpeningRequirement, areas: readonly number[]): OpeningCheck {
  const total = areas.reduce((sum, area) => sum + area, 0)
  if (areas.length > requirement.maxOpenings) return { kind: 'tooMany', total }
  if (requirement.kind === 'small') {
    const single = areas.some((area) => area + EPSILON >= requirement.single)
    const pair = areas.length === 2 && areas.every((area) => area + EPSILON >= requirement.pairEach)
    return single || pair ? { kind: 'ok', total } : { kind: 'tooSmall', total }
  }
  return total + EPSILON >= requirement.area ? { kind: 'ok', total } : { kind: 'missing', total, missing: requirement.area - total }
}

export type CompoundRequirement =
  | { kind: 'none' }
  /** Leistung über der Grenze des Rauminhalt-Nachweises */
  | { kind: 'overLimit'; upTo: number }
  | { kind: 'volume'; volume: number }

export function compoundRequirement(regulation: CombustionAirRegulation, power: number): CompoundRequirement {
  const { compound } = regulation
  if (!compound) return { kind: 'none' }
  if (power > compound.upTo + EPSILON) return { kind: 'overLimit', upTo: compound.upTo }
  return { kind: 'volume', volume: power * compound.perKw }
}

export interface CompoundRoom {
  /** Rauminhalt in m³; undefined = noch nicht eingegeben */
  volume: number | undefined
  /** Tür ins Freie oder Fenster, das sich öffnen lässt */
  toOutside: boolean
  /** Über eine Verbrennungsluftöffnung in Mindestgröße mit dem Verbund verbunden (beim Aufstellraum ohne Bedeutung) */
  connected: boolean
}

export type RoomStatus = 'counted' | 'noOutside' | 'notConnected' | 'noVolume'

/** Der erste Raum ist der Aufstellraum; ein Raum zählt nur mit Verbindung zum Freien und (außer dem Aufstellraum) Öffnung zum Verbund */
export function roomStatus(room: CompoundRoom, index: number): RoomStatus {
  if (index > 0 && !room.connected) return 'notConnected'
  if (!room.toOutside) return 'noOutside'
  if (room.volume === undefined || room.volume <= 0) return 'noVolume'
  return 'counted'
}

export interface CompoundCheck {
  /** Angerechneter Rauminhalt in m³ */
  counted: number
  required: number
  ok: boolean
  statuses: RoomStatus[]
}

export function checkCompound(requiredVolume: number, rooms: readonly CompoundRoom[]): CompoundCheck {
  const statuses = rooms.map(roomStatus)
  const counted = rooms.reduce((sum, room, index) => sum + (statuses[index] === 'counted' ? room.volume! : 0), 0)
  return { counted, required: requiredVolume, ok: counted + EPSILON >= requiredVolume, statuses }
}

/** Nötiger Volumenstrom in m³/h; undefined, wenn das Regelwerk keinen nennt */
export function volumeFlowRequirement(regulation: CombustionAirRegulation, power: number): number | undefined {
  return regulation.volumeFlow ? regulation.volumeFlow.perKw * power : undefined
}

export type OpeningShape = 'rect' | 'round' | 'area'

/** Lichter Querschnitt in cm²: rechteckig Breite × Höhe, rund aus dem Durchmesser, sonst direkt die Fläche (alles in cm) */
export function openingArea(shape: OpeningShape, a: number, b = 0): number {
  if (shape === 'rect') return a * b
  if (shape === 'round') return (Math.PI * a * a) / 4
  return a
}

export function combustionAirRefText(tool: CombustionAirTool, ref: CombustionAirRef): string {
  const source = tool.sources.find((candidate) => candidate.key === ref.source)
  return `${source?.name ?? ref.source}, ${ref.where}`
}

export function checkCombustionAirTool(tool: CombustionAirTool): string[] {
  const issues: string[] = []
  const sourceKeys = tool.sources.map((source) => source.key)
  if (new Set(sourceKeys).size !== sourceKeys.length) issues.push('sources: key doppelt vergeben')
  const used = new Set<string>()
  const checkRef = (ref: CombustionAirRef | undefined, where: string) => {
    if (!ref) return
    used.add(ref.source)
    if (!sourceKeys.includes(ref.source)) issues.push(`${where}: unbekannte Quelle "${ref.source}"`)
  }
  checkRef(tool.power.ref, 'power')
  const regulationKeys = tool.regulations.map((regulation) => regulation.key)
  if (new Set(regulationKeys).size !== regulationKeys.length) issues.push('regulations: key doppelt vergeben')
  for (const regulation of tool.regulations) {
    const where = `regulations (${regulation.key})`
    checkRef(regulation.opening.ref, `${where}.opening`)
    checkRef(regulation.opening.overRef, `${where}.opening`)
    if (regulation.opening.pairEach * 2 < regulation.opening.single) {
      issues.push(`${where}.opening: zwei Öffnungen je pairEach ergeben weniger als single`)
    }
    if (regulation.compound) {
      checkRef(regulation.compound.ref, `${where}.compound`)
      if (regulation.compoundMissing) issues.push(`${where}: compound und compoundMissing schließen sich aus`)
    } else if (!regulation.compoundMissing) {
      issues.push(`${where}: ohne compound ist compoundMissing Pflicht`)
    }
    checkRef(regulation.volumeFlow?.ref, `${where}.volumeFlow`)
    checkRef(regulation.otherProof?.ref, `${where}.otherProof`)
    regulation.notes.forEach((note, index) => checkRef(note.ref, `${where}.notes[${index}] (${note.title})`))
  }
  for (const source of sourceKeys) if (!used.has(source)) issues.push(`sources (${source}): wird nirgends zitiert`)
  return issues
}

export function combustionAirKeywords(tool: CombustionAirTool): string[] {
  return [
    ...tool.keywords,
    ...tool.regulations.flatMap((regulation) => [regulation.label, ...regulation.notes.map((note) => note.title)]),
  ]
}
