import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { UNIT_ID_PREFIX } from './constants.ts'
import { registerCustomUnits } from './registry.ts'

const unitName = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Einheitenname: nur A-Z, a-z, 0-9 und _')

export const unitEntrySchema = defineEntrySchema({
  /** Name in mathjs-Schreibweise, z. B. "mWS" */
  symbol: unitName,
  /** Ausgeschrieben, z. B. "Meter Wassersäule" */
  name: z.string().trim().min(1),
  /** Anzeige statt Symbol, z. B. "°dH" für "gradDH" */
  label: z.string().trim().min(1).optional(),
  /** Definition über vorhandene Einheiten, z. B. "1000 mmH2O"; bei draft darf sie fehlen */
  definition: z.string().trim().default(''),
  aliases: z.array(unitName).default([]),
  /** Testbeispiele: value und expected jeweils mit Einheit, z. B. "1 mWS" → "0.0980665 bar" */
  examples: z
    .array(
      z.strictObject({
        value: z.string().trim().min(1),
        expected: z.string().trim().min(1),
        tolerance: z.number().positive().max(0.1).default(0.001),
      }),
    )
    .default([]),
}).superRefine((entry, ctx) => {
  if (entry.status !== 'verified') return
  if (entry.definition === '') {
    ctx.addIssue({ code: 'custom', path: ['definition'], message: 'Pflicht bei status "verified"' })
  }
  if (entry.examples.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['examples'], message: 'Mindestens ein Testbeispiel bei status "verified"' })
  }
})

export type UnitEntry = z.output<typeof unitEntrySchema>

export const unitCollection = defineCollection({
  dir: 'units',
  idPrefix: UNIT_ID_PREFIX,
  schema: unitEntrySchema,
  // Vor Formeln und Umrechner registrieren, damit deren Prüfung die Einheiten kennt
  prepare: (entries) => registerCustomUnits(entries),
})
