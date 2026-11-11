import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Stundenzettel ("kind": "workHours"): Arbeitsstunden je Bauvorhaben notieren, siehe WorkHours.tsx und workHoursCalc.ts.
// Die Einträge sind Nutzerdaten und liegen auf dem Gerät (IndexedDB); hier stehen nur die Texte der Tool-Seite.

export const workHoursToolSchema = defineEntrySchema({
  kind: z.literal('workHours'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Hinweis am Ende des Tools, z. B. wo die Daten bleiben */
  closingNote: z.string().trim().min(1),
  /** Weitere Suchbegriffe, z. B. „Arbeitszeit“ */
  keywords: z.array(z.string().trim().min(1)).default([]),
})

export type WorkHoursTool = z.output<typeof workHoursToolSchema>
