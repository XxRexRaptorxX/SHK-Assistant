import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { math } from '../../lib/math.ts'
import { isPendingUnit } from '../units/registry.ts'
import { CONVERTER_ID_PREFIX } from './constants.ts'

/**
 * Arten von Umrechnern:
 * - units: Einheiten derselben Größe über mathjs (Druck, Länge …)
 * - factors: Richtwert-Faktoren aus dem Inhalt (z. B. Holzmaße), bewusst ohne mathjs,
 *   weil es keine festen Einheiten-Verhältnisse sind
 * - slope: Steigung in %, ‰, Grad und 1:x
 * - ratio: Prozent, Promille, Dezimalzahl und Bruch
 * - table: Nachschlagetabelle aus dem Inhalt (z. B. Rohrdimensionen)
 */
export const CONVERTER_KINDS = ['units', 'factors', 'slope', 'ratio', 'table'] as const

const factorSchema = z.strictObject({
  /** Schlüssel für from/to, z. B. "fm" */
  key: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'key: nur a-z, 0-9 und Bindestriche'),
  label: z.string().trim().min(1),
  /** Menge, die einer gemeinsamen Bezugsmenge entspricht, z. B. 1 fm = 1,4 rm → fm: 1, rm: 1.4 */
  value: z.number().positive(),
})

export const converterEntrySchema = defineEntrySchema({
  title: z.string().trim().min(1),
  /** Formelzeichen der Größe, angezeigt hinter dem Namen, z. B. "A" → „Fläche [A]“ */
  symbol: z.string().trim().min(1).optional(),
  /** Gruppierung in der Liste, z. B. "Hydraulik" (leer = „Allgemein“) */
  category: z.string().trim().default(''),
  description: z.string().trim().default(''),
  kind: z.enum(CONVERTER_KINDS).default('units'),
  /** kind "factors": true = Richtwerte (mit „≈“, 3 Stellen), false = exakte Verhältnisse (z. B. Stückmaß) */
  approximate: z.boolean().default(true),
  /** kind "units": mathjs-Einheiten oder Zusatzeinheiten aus content/units */
  units: z.array(z.string().trim().min(1)).default([]),
  /** kind "factors": Größen mit ihren Faktoren */
  factors: z.array(factorSchema).default([]),
  /** kind "units"/"factors": Voreinstellung "von" und "nach" */
  from: z.string().trim().default(''),
  to: z.string().trim().default(''),
  /** kind "units"/"factors": kleinster erlaubter Eingabewert, z. B. 0 (keine negativen Werte) */
  min: z.number().optional(),
  /** kind "table": Spaltenüberschriften und Zeilen (Text je Zelle) */
  columns: z.array(z.string().trim().min(1)).default([]),
  rows: z.array(z.array(z.string())).default([]),
})

export type ConverterEntry = z.output<typeof converterEntrySchema>
export type ConverterKind = ConverterEntry['kind']
export type ConverterFactor = z.output<typeof factorSchema>

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function checkFromTo(entry: ConverterEntry, keys: readonly string[], listName: string): string[] {
  return (['from', 'to'] as const)
    .filter((key) => !keys.includes(entry[key]))
    .map((key) => `${key}: "${entry[key]}" steht nicht in ${listName}`)
}

function checkUnits(entry: ConverterEntry): string[] {
  const issues: string[] = []
  if (entry.units.length < 2) issues.push('units: mindestens zwei Einheiten nötig')
  const available: string[] = []
  for (const unit of entry.units) {
    if (isPendingUnit(unit)) continue // angekündigt, Definition folgt (Entwurf in content/units)
    try {
      math.unit(1, unit)
      available.push(unit)
    } catch (error) {
      issues.push(`Einheit "${unit}" unbekannt (${describeError(error)})`)
    }
  }
  const [first, ...rest] = available
  for (const unit of rest) {
    if (first && !math.unit(1, unit).equalBase(math.unit(1, first))) {
      issues.push(`Einheit "${unit}" passt nicht zu "${first}"`)
    }
  }
  if (new Set(entry.units).size !== entry.units.length) issues.push('Einheiten doppelt aufgeführt')
  return [...issues, ...checkFromTo(entry, entry.units, 'units')]
}

function checkFactors(entry: ConverterEntry): string[] {
  const issues: string[] = []
  const keys = entry.factors.map((factor) => factor.key)
  if (keys.length < 2) issues.push('factors: mindestens zwei Größen nötig')
  if (new Set(keys).size !== keys.length) issues.push('factors: key doppelt vergeben')
  return [...issues, ...checkFromTo(entry, keys, 'factors')]
}

function checkTable(entry: ConverterEntry): string[] {
  const issues: string[] = []
  if (entry.columns.length === 0) issues.push('columns: mindestens eine Spalte nötig')
  if (entry.status === 'verified' && entry.rows.length === 0) issues.push('rows: Pflicht bei status "verified"')
  entry.rows.forEach((row, index) => {
    if (row.length !== entry.columns.length) {
      issues.push(`rows.${index}: ${row.length} Zellen, erwartet ${entry.columns.length}`)
    }
  })
  return issues
}

/** Prüft je nach Art die passenden Felder; nicht benutzte Felder müssen leer sein. */
export function checkConverter(entry: ConverterEntry): string[] {
  const usesMin = entry.kind === 'units' || entry.kind === 'factors'
  const unused = (fields: (keyof ConverterEntry)[]) =>
    [...fields, ...(usesMin ? [] : (['min'] as const))]
      .filter((field) => {
        const value = entry[field]
        return Array.isArray(value) ? value.length > 0 : value !== '' && value !== undefined
      })
      .map((field) => `${field}: wird bei kind "${entry.kind}" nicht verwendet`)

  switch (entry.kind) {
    case 'units':
      return [...checkUnits(entry), ...unused(['factors', 'columns', 'rows'])]
    case 'factors':
      return [...checkFactors(entry), ...unused(['units', 'columns', 'rows'])]
    case 'table':
      return [...checkTable(entry), ...unused(['units', 'factors', 'from', 'to'])]
    case 'slope':
    case 'ratio':
      return unused(['units', 'factors', 'from', 'to', 'columns', 'rows'])
  }
}

export const converterCollection = defineCollection({
  dir: 'converter',
  idPrefix: CONVERTER_ID_PREFIX,
  schema: converterEntrySchema,
  check: checkConverter,
})
