import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { math } from '../../lib/math.ts'
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { MATERIAL_ID_PREFIX } from './constants.ts'

const valueSchema = z.strictObject({
  /** Stoff, z. B. „Wasser“ */
  name: z.string().trim().min(1),
  /** Bedingung oder Zusatz, z. B. „20 °C“ */
  note: z.string().trim().default(''),
  value: z.number(),
  /** Einheit, falls abweichend von der Einheit der Sammlung */
  unit: z.string().trim().optional(),
  /** Quelle, falls abweichend von der Quelle der Sammlung */
  source: z.string().trim().optional(),
})

export const materialSetSchema = defineEntrySchema({
  /** Größe, für die die Werte gelten; passt zu Formel-Variablen mit diesem Namen oder Lexikon-Begriff (term) */
  quantities: z.array(z.string().trim().min(1)).min(1),
  /** Einheit der Werte (mathjs-Schreibweise); leer = ohne Einheit */
  unit: z.string().trim(),
  values: z.array(valueSchema).min(1),
})

export type MaterialSet = z.output<typeof materialSetSchema>
export type MaterialValue = z.output<typeof valueSchema>

export function checkMaterialSet(entry: MaterialSet): string[] {
  const issues: string[] = []
  for (const value of entry.values) {
    const unit = value.unit ?? entry.unit
    if (unit === '') continue
    try {
      math.unit(1, unit)
    } catch {
      issues.push(`${value.name}: unbekannte Einheit "${unit}"`)
    }
  }
  return issues
}

export const materialCollection = defineCollection({
  dir: 'materials',
  idPrefix: MATERIAL_ID_PREFIX,
  schema: materialSetSchema,
  check: checkMaterialSet,
})
