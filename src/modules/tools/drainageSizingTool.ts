import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'

// Abwasser-Bemessung ("kind": "drainageSizing"): Leitungsabschnitt wählen, eingebaute Entwässerungsgegenstände
// zählen, das Tool nennt die Nennweite. Je nach Abschnitt:
// - single: Einzelanschlussleitung, Nennweite je Gegenstand aus der Tabelle
// - branch: unbelüftete Sammelanschlussleitung, Summe der Anschlusswerte ΣDU gegen die Tabelle je Gebäudeart
// - stack:  Fallleitung, Qtot = K·√ΣDU + Qc + Qp (mindestens größter DU) gegen die Tabelle je Lüftung und Abzweig
// - slope:  liegende Leitung, wie stack, aber je Nennweite das kleinste Gefälle aus der Tabelle
// Anschlusswerte, K-Werte, Tabellen und Grenzen stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const dn = z.number().int().positive()
/** Abfluss in l/s; null = in der Quelle „–“ (nicht zulässig oder nicht angegeben) */
const capacity = z.number().positive().nullable()
const texts = z.array(z.string().trim().min(1)).default([])

const groupSchema = z.strictObject({ key, label: z.string().trim().min(1) })

const fixtureSchema = z.strictObject({
  key,
  /** Name in der Liste, z. B. „WC mit 6 l Spülkasten/Druckspüler“ */
  name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  group: key,
  /** Anschlusswert DU in l/s */
  du: z.number().positive(),
  /** Nennweite der Einzelanschlussleitung */
  connectionDn: dn,
  /** Hinweis zur Einzelanschlussleitung, z. B. wie der Gegenstand in der Tabelle eingeordnet ist */
  connectionNote: z.string().trim().default(''),
  /** Merkmale für Grenzen der Tabellen, z. B. "wc" */
  marks: z.array(key).default([]),
})

const usageSchema = z.strictObject({
  key,
  /** Kurz für die Leiste, z. B. „Unregelmäßig“ */
  label: z.string().trim().min(1),
  /** Beispiele, z. B. „Wohnhäuser, Pensionen, Büros“ */
  examples: z.string().trim().min(1),
  /** Abflusskennzahl K */
  k: z.number().positive(),
  note: z.string().trim().default(''),
})

/** Grenze einer Nennweite: höchstens max Gegenstände mit diesem Merkmal (0 = keine) */
const limitSchema = z.strictObject({
  mark: key,
  max: z.number().int().min(0),
  /** Gilt nur bei diesen Gebäudearten; leer = bei allen */
  usages: z.array(key).default([]),
  /** Text wie in der Quelle, z. B. „keine WCs“ */
  text: z.string().trim().min(1),
})

const optionSchema = z.strictObject({ key, label: z.string().trim().min(1), note: z.string().trim().default('') })

const lineBase = {
  key,
  /** Kurz für die Leiste, z. B. „Fallleitung“ */
  label: z.string().trim().min(1),
  /** Zweite Zeile in der Leiste, z. B. „innen“ */
  note: z.string().trim().default(''),
  /** Überschrift über dem Ergebnis, z. B. „Unbelüftete Sammelanschlussleitung“ */
  title: z.string().trim().min(1),
  /** Eigene Kurzfassung der Regeln für diesen Abschnitt */
  rules: texts,
}

const singleLineSchema = z.strictObject({ ...lineBase, type: z.literal('single') })

const branchLineSchema = z.strictObject({
  ...lineBase,
  type: z.literal('branch'),
  rows: z
    .array(
      z.strictObject({
        dn,
        /** Größte Summe der Anschlusswerte je Gebäudeart (key) in l/s; fehlt eine Gebäudeart, gibt es keinen Wert */
        maxSumDu: z.record(z.string(), z.number().positive()),
        /** Größte Rohrlänge ohne Belüftung in m */
        maxLength: z.number().positive(),
        limits: z.array(limitSchema).default([]),
      }),
    )
    .min(1),
  /** Was gilt, wenn die Summe über der Tabelle liegt */
  overTable: z.string().trim().min(1),
})

const stackLineSchema = z.strictObject({
  ...lineBase,
  type: z.literal('stack'),
  /** Art des Abzweigs, z. B. ohne / mit Innenradius */
  branchTypes: z.array(optionSchema).min(1),
  ventilations: z
    .array(
      z.strictObject({
        ...optionSchema.shape,
        rows: z
          .array(
            z.strictObject({
              dn,
              /** Nennweite der Nebenlüftung */
              ventDn: dn.optional(),
              /** Zulässiger Abfluss Qtot je Abzweig-Art (key) */
              capacity: z.record(z.string(), capacity),
              limits: z.array(limitSchema).default([]),
              /** Grenzen, die das Tool nicht nachzählt, z. B. „Maximal 4 Küchenablaufstellen“ */
              notes: texts,
            }),
          )
          .min(1),
      }),
    )
    .min(1),
  overTable: z.string().trim().min(1),
})

const slopeLineSchema = z.strictObject({
  ...lineBase,
  type: z.literal('slope'),
  /** Tabellen aus capacityTables mit ihrem Einsatzfall; die erste empfohlene ist vorausgewählt */
  tables: z
    .array(
      z.strictObject({
        /** key in capacityTables */
        key,
        /** Wann diese Tabelle gilt, z. B. „Nur hinter der Einleitung einer Abwasserhebeanlage“ */
        use: z.string().trim().min(1),
        /** Regelfall für diesen Abschnitt, in der Auswahl als „Empfohlen“ markiert */
        recommended: z.boolean().default(false),
      }),
    )
    .min(1),
  /** Empfohlene Mindestnennweite, kleinere werden mit dem Text markiert */
  recommendedMinDn: z.strictObject({ dn, text: z.string().trim().min(1) }).optional(),
  overTable: z.string().trim().min(1),
})

const lineSchema = z.discriminatedUnion('type', [singleLineSchema, branchLineSchema, stackLineSchema, slopeLineSchema])

/** Abflussvermögen liegender Leitungen: Gefälle (Zeilen) × Nennweite (Spalten) */
const capacityTableSchema = z.strictObject({
  key,
  /** Füllungsgrad für die Leiste, z. B. „50 %“ (angezeigt mit Überschrift „Füllungsgrad“) */
  label: z.string().trim().min(1),
  /** Bedingungen der Tabelle, z. B. „Füllungsgrad 50 %, Fließgeschwindigkeit ≥ 0,5 m/s“ */
  condition: z.string().trim().min(1),
  dns: z.array(dn).min(1),
  rows: z
    .array(
      z.strictObject({
        /** Gefälle in % */
        slope: z.number().positive(),
        capacity: z.array(capacity),
      }),
    )
    .min(1),
})

const exampleSchema = z.strictObject({
  label: z.string().trim().min(1),
  line: key,
  usage: key,
  /** Anzahl je Gegenstand (key) */
  fixtures: z.record(z.string(), z.number().int().positive()),
  /** Anzahl gleicher Einheiten, z. B. Wohnungen an der Fallleitung */
  units: z.number().int().positive().default(1),
  ventilation: key.optional(),
  branchType: key.optional(),
  table: key.optional(),
  expected: z.strictObject({
    sumDu: z.number().positive(),
    /** Maßgebender Abfluss, auf 2 Nachkommastellen wie in der Quelle */
    flow: z.number().positive().optional(),
    /** Nennweiten; bei liegenden Leitungen mit Mindestgefälle in % */
    results: z.array(z.strictObject({ dn, slope: z.number().positive().optional() })).min(1),
  }),
  source: z.string().trim().min(1),
})

export const drainageSizingToolSchema = defineEntrySchema({
  kind: z.literal('drainageSizing'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  keywords: z.array(z.string().trim().min(1)).default([]),
  related: relatedToolsSchema,
  /**
   * Querschnittsflächen je Nennweite (DN/OD) für den Umschalter Außen-/Innendurchmesser;
   * Innendurchmesser = √(4·A/π). system: Rohrsystem der Flächen, z. B. „POLO-KAL NG“
   */
  crossSections: z.strictObject({
    system: z.string().trim().min(1),
    rows: z.array(z.strictObject({ dn, /** Fläche in cm² */ area: z.number().positive() })).min(1),
  }),
  groups: z.array(groupSchema).min(1),
  fixtures: z.array(fixtureSchema).min(1),
  usages: z.array(usageSchema).min(1),
  lines: z.array(lineSchema).min(1),
  capacityTables: z.array(capacityTableSchema).default([]),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: z.string().trim().min(1),
  /** Rechenbeispiele aus der Quelle; der Build prüft, dass das Tool dasselbe ergibt */
  examples: z.array(exampleSchema).min(1),
})

export type DrainageSizingTool = z.output<typeof drainageSizingToolSchema>
export type DrainageFixture = DrainageSizingTool['fixtures'][number]
export type DrainageUsage = DrainageSizingTool['usages'][number]
export type DrainageLine = DrainageSizingTool['lines'][number]
export type BranchLine = Extract<DrainageLine, { type: 'branch' }>
export type StackLine = Extract<DrainageLine, { type: 'stack' }>
export type SlopeLine = Extract<DrainageLine, { type: 'slope' }>
export type CapacityTable = DrainageSizingTool['capacityTables'][number]
type Limit = z.output<typeof limitSchema>

/** Eigener Gegenstand, der nicht im Inhalt steht; Anschlusswert z. B. laut Hersteller */
export interface CustomFixture {
  key: string
  name: string
  /** Anschlusswert DU in l/s */
  du: number
  count: number
  /** Nennweite der Einzelanschlussleitung, falls bekannt */
  connectionDn?: number
  /** Zählt bei den WC-Grenzen der Tabellen mit */
  wc: boolean
}

/** Gegenstand aus dem Inhalt oder eigener; eigene haben nicht immer eine Einzelanschluss-Nennweite */
export type SizedFixture = Omit<DrainageFixture, 'connectionDn'> & { connectionDn?: number; custom: boolean }
type Counted = { fixture: SizedFixture; count: number }[]

/** Eingaben des Rechners */
export interface DrainageSelection {
  line: string
  usage: string
  /** Anzahl je Gegenstand (key) */
  counts: Readonly<Record<string, number>>
  /** Eigene Gegenstände; nur mit Anzahl und DU größer 0 zählen sie mit */
  custom?: readonly CustomFixture[]
  /** Anzahl gleicher Einheiten (nur Fall-, Sammel- und Grundleitung) */
  units?: number
  /** Dauerabfluss Qc in l/s */
  continuous?: number
  /** Pumpenförderstrom Qp in l/s */
  pump?: number
  ventilation?: string
  branchType?: string
  table?: string
}

/** Rundungsfehler (z. B. 0,1 + 0,2) sollen keine Nennweite kippen */
const EPSILON = 1e-9

export const dnLabel = (value: number) => `DN ${value}`

/** Innendurchmesser in mm aus der Querschnittsfläche (cm²); undefined, wenn die Nennweite fehlt */
export function innerDiameter(tool: DrainageSizingTool, value: number): number | undefined {
  const row = tool.crossSections.rows.find((candidate) => candidate.dn === value)
  return row ? Math.sqrt((4 * row.area) / Math.PI) * 10 : undefined
}

/** Alle Nennweiten, die das Tool als Ergebnis zeigen kann */
function usedDns(tool: DrainageSizingTool): number[] {
  return [
    ...tool.fixtures.map((fixture) => fixture.connectionDn),
    ...tool.lines.flatMap((line) =>
      line.type === 'branch'
        ? line.rows.map((row) => row.dn)
        : line.type === 'stack'
          ? line.ventilations.flatMap((ventilation) => ventilation.rows.flatMap((row) => [row.dn, ...(row.ventDn ? [row.ventDn] : [])]))
          : [],
    ),
    ...tool.capacityTables.flatMap((table) => table.dns),
  ]
}

export function findLine(tool: DrainageSizingTool, lineKey: string): DrainageLine | undefined {
  return tool.lines.find((line) => line.key === lineKey)
}

export function findUsage(tool: DrainageSizingTool, usageKey: string): DrainageUsage | undefined {
  return tool.usages.find((usage) => usage.key === usageKey)
}

export function findTable(tool: DrainageSizingTool, tableKey: string): CapacityTable | undefined {
  return tool.capacityTables.find((table) => table.key === tableKey)
}

/** Gezählte Gegenstände mit Anzahl > 0: erst die aus dem Inhalt in dessen Reihenfolge, dann die eigenen */
export function countedFixtures(
  tool: DrainageSizingTool,
  counts: Readonly<Record<string, number>>,
  custom: readonly CustomFixture[] = [],
): Counted {
  return [
    ...tool.fixtures.flatMap((fixture) => {
      const count = counts[fixture.key] ?? 0
      return count > 0 ? [{ fixture: { ...fixture, custom: false }, count }] : []
    }),
    ...custom.flatMap((item) =>
      item.count > 0 && item.du > 0
        ? [
            {
              fixture: {
                key: item.key,
                name: item.name.trim() || 'Eigener Gegenstand',
                aliases: [],
                group: '',
                du: item.du,
                ...(item.connectionDn !== undefined ? { connectionDn: item.connectionDn } : {}),
                connectionNote: '',
                marks: item.wc ? ['wc'] : [],
                custom: true,
              },
              count: item.count,
            },
          ]
        : [],
    ),
  ]
}

/** Abschnitte mit Gleichzeitigkeit: Anzahl gleicher Einheiten, Dauerabfluss und Hebeanlage zählen mit */
export const usesFlow = (line: DrainageLine) => line.type === 'stack' || line.type === 'slope'

const sumOf = (items: Counted, units = 1) => items.reduce((sum, { fixture, count }) => sum + fixture.du * count, 0) * units

const largestOf = (items: Counted) =>
  items.reduce<SizedFixture | undefined>((largest, { fixture }) => (!largest || fixture.du > largest.du ? fixture : largest), undefined)

/** Summe der Anschlusswerte ΣDU in l/s, je Einheit mal Anzahl der Einheiten */
export function sumDu(
  tool: DrainageSizingTool,
  counts: Readonly<Record<string, number>>,
  units = 1,
  custom: readonly CustomFixture[] = [],
): number {
  return sumOf(countedFixtures(tool, counts, custom), units)
}

/** Größter Anschlusswert unter den gezählten Gegenständen */
export function largestDu(
  tool: DrainageSizingTool,
  counts: Readonly<Record<string, number>>,
  custom: readonly CustomFixture[] = [],
): SizedFixture | undefined {
  return largestOf(countedFixtures(tool, counts, custom))
}

/** Verletzte Grenzen einer Nennweite */
function brokenLimits(limits: readonly Limit[], items: Counted, usage: string, units = 1): Limit[] {
  const markCount = (mark: string) =>
    items.reduce((sum, { fixture, count }) => sum + (fixture.marks.includes(mark) ? count : 0), 0) * units
  return limits.filter((limit) => (limit.usages.length === 0 || limit.usages.includes(usage)) && markCount(limit.mark) > limit.max)
}

export interface DesignFlow {
  sumDu: number
  k: number
  /** Schmutzwasserabfluss Qww = K·√ΣDU */
  qww: number
  /** Qtot = Qww + Qc + Qp */
  qtot: number
  largest?: SizedFixture
  /** Maßgebender Abfluss: der größere von Qtot und größtem DU */
  flow: number
  /** true, wenn der größte Anschlusswert maßgebend ist */
  largestGoverns: boolean
}

export function designFlow(tool: DrainageSizingTool, selection: DrainageSelection): DesignFlow {
  const usage = findUsage(tool, selection.usage)
  if (!usage) throw new Error(`Gebäudeart "${selection.usage}" fehlt im Inhalt`)
  const items = countedFixtures(tool, selection.counts, selection.custom)
  const total = sumOf(items, selection.units ?? 1)
  const qww = usage.k * Math.sqrt(total)
  const qtot = qww + (selection.continuous ?? 0) + (selection.pump ?? 0)
  const largest = largestOf(items)
  const largestGoverns = largest !== undefined && largest.du > qtot + EPSILON
  return { sumDu: total, k: usage.k, qww, qtot, largest, flow: largestGoverns ? largest.du : qtot, largestGoverns }
}

/** Nennweite, die wegen einer Grenze nicht passt */
export interface SkippedDn {
  dn: number
  reasons: string[]
}

export type SizingResult =
  | { type: 'single'; items: Counted }
  | {
      type: 'branch'
      sumDu: number
      /** Gebäudeart ohne Werte in der Tabelle */
      noValues: boolean
      row?: BranchLine['rows'][number]
      skipped: SkippedDn[]
      /** Größte Einzelanschlussleitung der gezählten Gegenstände, falls größer als das Ergebnis */
      largerConnection?: SizedFixture
    }
  | {
      type: 'stack'
      flow: DesignFlow
      row?: StackLine['ventilations'][number]['rows'][number]
      capacity?: number
      skipped: SkippedDn[]
    }
  | {
      type: 'slope'
      flow: DesignFlow
      table: CapacityTable
      /** Je Nennweite das kleinste Gefälle; endet bei der ersten Nennweite, die schon beim kleinsten Gefälle reicht */
      options: { dn: number; slope: number; capacity: number; belowRecommended: boolean }[]
    }

/** Gewählte Tabelle eines liegenden Abschnitts; ohne gültige Wahl die erste empfohlene */
export function selectedTable(line: SlopeLine, tableKey: string | undefined): SlopeLine['tables'][number] {
  return (
    line.tables.find((entry) => entry.key === tableKey) ??
    line.tables.find((entry) => entry.recommended) ??
    line.tables[0]!
  )
}

export function sizeLine(tool: DrainageSizingTool, selection: DrainageSelection): SizingResult {
  const line = findLine(tool, selection.line)
  if (!line) throw new Error(`Leitungsabschnitt "${selection.line}" fehlt im Inhalt`)
  const { usage } = selection
  const items = countedFixtures(tool, selection.counts, selection.custom)

  if (line.type === 'single') return { type: 'single', items }

  if (line.type === 'branch') {
    const total = sumOf(items)
    const noValues = !line.rows.some((row) => row.maxSumDu[usage] !== undefined)
    const skipped: SkippedDn[] = []
    let found: BranchLine['rows'][number] | undefined
    for (const row of line.rows) {
      const max = row.maxSumDu[usage]
      if (max === undefined || total > max + EPSILON) continue
      const broken = brokenLimits(row.limits, items, usage)
      if (broken.length > 0) {
        skipped.push({ dn: row.dn, reasons: broken.map((limit) => limit.text) })
        continue
      }
      found = row
      break
    }
    const largestConnection = items.reduce<SizedFixture | undefined>(
      (largest, { fixture }) =>
        fixture.connectionDn !== undefined && (!largest || fixture.connectionDn > largest.connectionDn!) ? fixture : largest,
      undefined,
    )
    const largerConnection = found && largestConnection && largestConnection.connectionDn! > found.dn ? largestConnection : undefined
    return { type: 'branch', sumDu: total, noValues, row: found, skipped, largerConnection }
  }

  const flow = designFlow(tool, selection)

  if (line.type === 'stack') {
    const ventilation = line.ventilations.find((option) => option.key === selection.ventilation) ?? line.ventilations[0]!
    const branchType = selection.branchType ?? line.branchTypes[0]!.key
    const skipped: SkippedDn[] = []
    for (const row of ventilation.rows) {
      const capacityValue = row.capacity[branchType]
      if (capacityValue === null || capacityValue === undefined || flow.flow > capacityValue + EPSILON) continue
      const broken = brokenLimits(row.limits, items, usage, selection.units ?? 1)
      if (broken.length > 0) {
        skipped.push({ dn: row.dn, reasons: broken.map((limit) => limit.text) })
        continue
      }
      return { type: 'stack', flow, row, capacity: capacityValue, skipped }
    }
    return { type: 'stack', flow, skipped }
  }

  const tableKey = selectedTable(line, selection.table).key
  const table = findTable(tool, tableKey)
  if (!table) throw new Error(`Tabelle "${tableKey}" fehlt im Inhalt`)
  const smallestSlope = Math.min(...table.rows.map((row) => row.slope))
  const options: Extract<SizingResult, { type: 'slope' }>['options'] = []
  for (const [column, value] of table.dns.entries()) {
    const row = table.rows.find((candidate) => {
      const capacityValue = candidate.capacity[column]
      return capacityValue !== null && capacityValue !== undefined && capacityValue + EPSILON >= flow.flow
    })
    if (!row) continue
    options.push({
      dn: value,
      slope: row.slope,
      capacity: row.capacity[column]!,
      belowRecommended: line.recommendedMinDn !== undefined && value < line.recommendedMinDn.dn,
    })
    // Größere Nennweiten bringen dann nichts mehr
    if (row.slope === smallestSlope) break
  }
  return { type: 'slope', flow, table, options }
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

const ascending = (values: number[]) => values.every((value, index) => index === 0 || value > values[index - 1]!)

export function checkDrainageSizingTool(tool: DrainageSizingTool): string[] {
  const issues: string[] = []
  const groupKeys = tool.groups.map((group) => group.key)
  const usageKeys = tool.usages.map((usage) => usage.key)
  const marks = new Set(tool.fixtures.flatMap((fixture) => fixture.marks))
  for (const value of duplicates(groupKeys)) issues.push(`groups: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.fixtures.map((fixture) => fixture.key))) issues.push(`fixtures: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.fixtures.map((fixture) => fixture.name))) issues.push(`fixtures: name "${value}" doppelt vergeben`)
  for (const value of duplicates(usageKeys)) issues.push(`usages: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.lines.map((line) => line.key))) issues.push(`lines: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.capacityTables.map((table) => table.key))) issues.push(`capacityTables: key "${value}" doppelt vergeben`)
  for (const fixture of tool.fixtures) {
    if (!groupKeys.includes(fixture.group)) issues.push(`fixtures (${fixture.name}): unbekannte Gruppe "${fixture.group}"`)
  }
  for (const group of tool.groups) {
    if (!tool.fixtures.some((fixture) => fixture.group === group.key)) issues.push(`groups (${group.label}): kein Gegenstand zugeordnet`)
  }

  const checkLimits = (where: string, limits: readonly Limit[]) => {
    for (const limit of limits) {
      if (!marks.has(limit.mark)) issues.push(`${where}: kein Gegenstand hat das Merkmal "${limit.mark}"`)
      for (const usage of limit.usages) if (!usageKeys.includes(usage)) issues.push(`${where}: unbekannte Gebäudeart "${usage}"`)
    }
  }

  for (const line of tool.lines) {
    const where = `lines (${line.key})`
    if (line.type === 'branch') {
      if (!ascending(line.rows.map((row) => row.dn))) issues.push(`${where}: Nennweiten nicht aufsteigend`)
      for (const row of line.rows) {
        for (const usage of Object.keys(row.maxSumDu)) {
          if (!usageKeys.includes(usage)) issues.push(`${where}, DN ${row.dn}: unbekannte Gebäudeart "${usage}"`)
        }
        checkLimits(`${where}, DN ${row.dn}`, row.limits)
      }
    }
    if (line.type === 'stack') {
      const branchKeys = line.branchTypes.map((option) => option.key)
      for (const value of duplicates(branchKeys)) issues.push(`${where}: Abzweig-key "${value}" doppelt vergeben`)
      for (const value of duplicates(line.ventilations.map((option) => option.key))) issues.push(`${where}: Lüftungs-key "${value}" doppelt vergeben`)
      for (const ventilation of line.ventilations) {
        if (!ascending(ventilation.rows.map((row) => row.dn))) issues.push(`${where} (${ventilation.key}): Nennweiten nicht aufsteigend`)
        for (const row of ventilation.rows) {
          const keys = Object.keys(row.capacity)
          const missing = branchKeys.filter((branchKey) => !keys.includes(branchKey))
          const unknown = keys.filter((branchKey) => !branchKeys.includes(branchKey))
          if (missing.length > 0) issues.push(`${where} (${ventilation.key}), DN ${row.dn}: Wert fehlt für ${missing.join(', ')}`)
          if (unknown.length > 0) issues.push(`${where} (${ventilation.key}), DN ${row.dn}: unbekannter Abzweig ${unknown.join(', ')}`)
          checkLimits(`${where} (${ventilation.key}), DN ${row.dn}`, row.limits)
        }
      }
    }
    if (line.type === 'slope') {
      for (const entry of line.tables) {
        if (!findTable(tool, entry.key)) issues.push(`${where}: unbekannte Tabelle "${entry.key}"`)
      }
      for (const value of duplicates(line.tables.map((entry) => entry.key))) issues.push(`${where}: Tabelle "${value}" doppelt`)
      if (!line.tables.some((entry) => entry.recommended)) issues.push(`${where}: keine Tabelle als empfohlen markiert`)
    }
  }

  for (const table of tool.capacityTables) {
    const where = `capacityTables (${table.key})`
    if (!ascending(table.dns)) issues.push(`${where}: Nennweiten nicht aufsteigend`)
    if (!ascending(table.rows.map((row) => row.slope))) issues.push(`${where}: Gefälle nicht aufsteigend`)
    for (const row of table.rows) {
      if (row.capacity.length !== table.dns.length) issues.push(`${where}, ${row.slope} %: ${row.capacity.length} Werte für ${table.dns.length} Nennweiten`)
    }
    // Mehr Gefälle oder größere Nennweite darf das Abflussvermögen nicht verkleinern (Tippfehler)
    table.dns.forEach((value, column) => {
      const values = table.rows.flatMap((row) => (row.capacity[column] ?? null) === null ? [] : [row.capacity[column]!])
      if (!ascending(values)) issues.push(`${where}, DN ${value}: Werte steigen mit dem Gefälle nicht an`)
    })
    for (const row of table.rows) {
      const values = row.capacity.filter((value): value is number => value !== null)
      if (!ascending(values)) issues.push(`${where}, ${row.slope} %: Werte steigen mit der Nennweite nicht an`)
    }
  }
  const sectionDns = tool.crossSections.rows.map((row) => row.dn)
  for (const value of duplicates(sectionDns.map(String))) issues.push(`crossSections: DN ${value} doppelt`)
  for (const value of new Set(usedDns(tool))) {
    if (!sectionDns.includes(value)) issues.push(`crossSections: Querschnitt für DN ${value} fehlt`)
  }
  if (!ascending(tool.crossSections.rows.map((row) => row.area))) issues.push('crossSections: Flächen steigen nicht mit der Nennweite')
  const usedTables = new Set(tool.lines.flatMap((line) => (line.type === 'slope' ? line.tables.map((entry) => entry.key) : [])))
  for (const table of tool.capacityTables) {
    if (!usedTables.has(table.key)) issues.push(`capacityTables (${table.key}): von keinem Abschnitt genutzt`)
  }

  if (issues.length > 0) return issues
  tool.examples.forEach((example, index) => {
    const where = `examples[${index}] (${example.label})`
    const line = findLine(tool, example.line)
    if (!line) return issues.push(`${where}: unbekannter Abschnitt "${example.line}"`)
    if (!findUsage(tool, example.usage)) return issues.push(`${where}: unbekannte Gebäudeart "${example.usage}"`)
    const unknown = Object.keys(example.fixtures).filter((fixture) => !tool.fixtures.some((candidate) => candidate.key === fixture))
    if (unknown.length > 0) return issues.push(`${where}: unbekannte Gegenstände ${unknown.join(', ')}`)
    const selection: DrainageSelection = { ...example, counts: example.fixtures }
    const result = sizeLine(tool, selection)
    const total = usesFlow(line) ? sumDu(tool, example.fixtures, example.units) : sumDu(tool, example.fixtures)
    if (Math.abs(total - example.expected.sumDu) > 1e-6) issues.push(`${where}: ΣDU ${total} statt ${example.expected.sumDu}`)
    if (example.expected.flow !== undefined) {
      const flow = result.type === 'stack' || result.type === 'slope' ? result.flow.flow : undefined
      if (flow === undefined || Math.round(flow * 100) / 100 !== example.expected.flow) {
        issues.push(`${where}: Abfluss ${flow} statt ${example.expected.flow}`)
      }
    }
    const actual =
      result.type === 'single'
        ? result.items.map(({ fixture }) => ({ dn: fixture.connectionDn }))
        : result.type === 'branch' || result.type === 'stack'
          ? result.row
            ? [{ dn: result.row.dn }]
            : []
          : result.options.map((option) => ({ dn: option.dn, slope: option.slope }))
    if (JSON.stringify(actual) !== JSON.stringify(example.expected.results)) {
      issues.push(`${where}: ergibt ${JSON.stringify(actual)} statt ${JSON.stringify(example.expected.results)}`)
    }
  })
  return issues
}

/** Suchbegriffe für die globale Suche */
export function drainageSizingKeywords(tool: DrainageSizingTool): string[] {
  return [
    ...tool.keywords,
    ...tool.fixtures.flatMap((fixture) => [fixture.name, ...fixture.aliases]),
    ...tool.lines.map((line) => line.title),
  ]
}
