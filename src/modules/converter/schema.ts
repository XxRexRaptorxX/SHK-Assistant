import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { math } from '../../lib/math.ts'
import { isPendingUnit } from '../units/registry.ts'
import { CONVERTER_ID_PREFIX } from './constants.ts'

/**
 * Arten von Umrechnern:
 * - units: Einheiten derselben Größe über mathjs (Druck, Länge …)
 * - slope: Steigung in %, ‰, Grad und 1:x
 * - ratio: Prozent, Promille, Dezimalzahl und Bruch
 * - table: Nachschlagetabelle aus dem Inhalt (z. B. Rohrdimensionen)
 */
export const CONVERTER_KINDS = ['units', 'slope', 'ratio', 'table'] as const

export const converterEntrySchema = defineEntrySchema({
  title: z.string().trim().min(1),
  description: z.string().trim().default(''),
  kind: z.enum(CONVERTER_KINDS).default('units'),
  /** kind "units": mathjs-Einheiten oder Zusatzeinheiten aus content/units */
  units: z.array(z.string().trim().min(1)).default([]),
  /** kind "units": Voreinstellung "von" und "nach" */
  from: z.string().trim().default(''),
  to: z.string().trim().default(''),
  /** kind "units": kleinster erlaubter Eingabewert, z. B. 0 für Wasserhärte (keine negativen Werte) */
  min: z.number().optional(),
  /** kind "table": Spaltenüberschriften und Zeilen (Text je Zelle) */
  columns: z.array(z.string().trim().min(1)).default([]),
  rows: z.array(z.array(z.string())).default([]),
})

export type ConverterEntry = z.output<typeof converterEntrySchema>
export type ConverterKind = ConverterEntry['kind']

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
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
  for (const key of ['from', 'to'] as const) {
    if (!entry.units.includes(entry[key])) issues.push(`${key}: "${entry[key]}" steht nicht in units`)
  }
  return issues
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
  const unused = (fields: (keyof ConverterEntry)[]) =>
    [...fields, ...(entry.kind === 'units' ? [] : (['min'] as const))]
      .filter((field) => {
        const value = entry[field]
        return Array.isArray(value) ? value.length > 0 : value !== '' && value !== undefined
      })
      .map((field) => `${field}: wird bei kind "${entry.kind}" nicht verwendet`)

  switch (entry.kind) {
    case 'units':
      return [...checkUnits(entry), ...unused(['columns', 'rows'])]
    case 'table':
      return [...checkTable(entry), ...unused(['units', 'from', 'to'])]
    case 'slope':
    case 'ratio':
      return unused(['units', 'from', 'to', 'columns', 'rows'])
  }
}

export const converterCollection = defineCollection({
  dir: 'converter',
  idPrefix: CONVERTER_ID_PREFIX,
  schema: converterEntrySchema,
  check: checkConverter,
})
