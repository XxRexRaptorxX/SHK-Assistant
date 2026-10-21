import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { CHECKLIST_ID_PREFIX } from './constants.ts'

/** Stabil halten: der gespeicherte Fortschritt hängt an dieser id */
const itemId = z
  .string()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Punkt-id: nur a-z, 0-9 und Bindestriche, z. B. "abgasweg-pruefen"')

const itemSchema = z.strictObject({
  id: itemId,
  text: z.string().trim().min(1),
  /** Optionaler Zusatz, z. B. worauf zu achten ist */
  note: z.string().trim().default(''),
})

const sectionSchema = z.strictObject({
  title: z.string().trim().min(1),
  items: z.array(itemSchema).min(1),
})

export const checklistEntrySchema = defineEntrySchema({
  title: z.string().trim().min(1),
  description: z.string().trim().default(''),
  /** Gruppierung in der Liste, z. B. "Wartung" */
  category: z.string().trim().default(''),
  sections: z.array(sectionSchema).default([]),
}).superRefine((entry, ctx) => {
  if (entry.status === 'verified' && entry.sections.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['sections'], message: 'Pflicht bei status "verified"' })
  }
})

export type ChecklistEntry = z.output<typeof checklistEntrySchema>
export type ChecklistItem = z.output<typeof itemSchema>

/** Punkt-ids müssen innerhalb einer Checkliste eindeutig sein */
export function checkChecklist(entry: ChecklistEntry): string[] {
  const seen = new Set<string>()
  const issues: string[] = []
  for (const item of entry.sections.flatMap((section) => section.items)) {
    if (seen.has(item.id)) issues.push(`Punkt-id "${item.id}" ist doppelt vergeben`)
    seen.add(item.id)
  }
  return issues
}

export const checklistCollection = defineCollection({
  dir: 'checklists',
  idPrefix: CHECKLIST_ID_PREFIX,
  schema: checklistEntrySchema,
  check: checkChecklist,
})
