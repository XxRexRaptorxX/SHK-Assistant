import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { math } from '../../lib/math.ts'
import { CONVERTER_ID_PREFIX } from './constants.ts'

/** Eine Größe im Umrechner (z. B. Druck) mit den angebotenen Einheiten */
export const converterEntrySchema = defineEntrySchema({
  title: z.string().trim().min(1),
  description: z.string().trim().default(''),
  /** mathjs-Einheiten, z. B. ["bar", "mbar", "Pa"]; Zusatzeinheiten aus content/units erlaubt */
  units: z.array(z.string().trim().min(1)).min(2),
  /** Voreinstellung "von" und "nach" */
  from: z.string().trim().min(1),
  to: z.string().trim().min(1),
})

export type ConverterEntry = z.output<typeof converterEntrySchema>

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Alle Einheiten bekannt und untereinander umrechenbar; from/to aus der Liste */
export function checkConverter(entry: ConverterEntry): string[] {
  const issues: string[] = []
  const valid: string[] = []
  for (const unit of entry.units) {
    try {
      math.unit(1, unit)
      valid.push(unit)
    } catch (error) {
      issues.push(`Einheit "${unit}" unbekannt (${describeError(error)})`)
    }
  }
  const [first, ...rest] = valid
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

export const converterCollection = defineCollection({
  dir: 'converter',
  idPrefix: CONVERTER_ID_PREFIX,
  schema: converterEntrySchema,
  check: checkConverter,
})
