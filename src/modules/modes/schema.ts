import { z } from 'zod'
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Modi (Berufsgruppen): legen fest, welche Tools und Formeln in den Listen erscheinen.
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts, keine UI-Importe.

export const MODE_ID_PREFIX = 'mode'

/** Präfixe der Einträge, die ein Modus filtert */
const FILTERED_PREFIXES = ['tool.', 'formula.']

const idList = z
  .array(z.string().trim().min(1))
  .default([])
  .refine((ids) => new Set(ids).size === ids.length, 'id doppelt vergeben')

export const modeEntrySchema = defineEntrySchema({
  /** Name in den Einstellungen, z. B. "Elektriker" */
  title: z.string().trim().min(1),
  /** Reihenfolge in den Einstellungen, aufsteigend */
  order: z.number().int().min(0),
  /** Tools und Formeln mit mindestens einem dieser Themen-Tags erscheinen */
  tags: topicTagsSchema,
  /** Tools/Formeln, die zusätzlich erscheinen, auch ohne passenden Tag */
  include: idList,
  /** Tools/Formeln, die trotz passendem Tag nicht erscheinen */
  exclude: idList,
})

export type ModeEntry = z.output<typeof modeEntrySchema>

export const modeCollection = defineCollection({
  dir: 'modes',
  idPrefix: MODE_ID_PREFIX,
  schema: modeEntrySchema,
  check: (entry) => [
    ...[...entry.include, ...entry.exclude]
      .filter((id) => !FILTERED_PREFIXES.some((prefix) => id.startsWith(prefix)))
      .map((id) => `"${id}" ist kein Tool und keine Formel`),
    ...entry.include.filter((id) => entry.exclude.includes(id)).map((id) => `"${id}" steht in include und exclude`),
  ],
  // Der Build prüft, dass alle genannten Tools und Formeln existieren
  references: (entry) => [...entry.include, ...entry.exclude],
  // Interne Tools/Formeln fehlen im public-Build, ihre ids dürfen dort auch hier nicht stehen
  forEdition: (entry, isIncluded) => ({
    ...entry,
    include: entry.include.filter(isIncluded),
    exclude: entry.exclude.filter(isIncluded),
  }),
})
