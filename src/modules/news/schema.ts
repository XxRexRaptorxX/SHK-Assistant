import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { NEWS_FEED_ID_PREFIX } from './constants.ts'

const httpUrl = z.url({ protocol: /^https?$/ })

export const newsFeedSchema = defineEntrySchema({
  /** Name des Anbieters, wie er unter jeder Meldung steht */
  name: z.string().trim().min(1),
  /** Adresse des RSS- oder Atom-Feeds */
  url: httpUrl,
  /** Startseite des Anbieters */
  website: httpUrl,
})

export type NewsFeedEntry = z.output<typeof newsFeedSchema>

export const newsFeedCollection = defineCollection({
  dir: 'news-feeds',
  idPrefix: NEWS_FEED_ID_PREFIX,
  schema: newsFeedSchema,
})
