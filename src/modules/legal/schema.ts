import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { LEGAL_ID_PREFIX } from './constants.ts'

const sectionSchema = z.strictObject({
  /** Zwischenüberschrift; leer = Absatz ohne Überschrift */
  heading: z.string().trim().default(''),
  /** Text; Leerzeilen trennen Absätze, **Wort** wird fett, Web- und E-Mail-Adressen werden klickbar */
  text: z.string().trim().min(1),
})

export const legalEntrySchema = defineEntrySchema({
  /** Seitentitel, z. B. „Impressum“ */
  title: z.string().trim().min(1),
  sections: z.array(sectionSchema).default([]),
})

export type LegalEntry = z.output<typeof legalEntrySchema>

export function checkLegal(entry: LegalEntry): string[] {
  return entry.status === 'verified' && entry.sections.length === 0
    ? ['Bei status "verified" ist mindestens ein Abschnitt Pflicht']
    : []
}

export const legalCollection = defineCollection({
  dir: 'legal',
  idPrefix: LEGAL_ID_PREFIX,
  schema: legalEntrySchema,
  check: checkLegal,
})
