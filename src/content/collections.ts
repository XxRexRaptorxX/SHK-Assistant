import type { z } from 'zod'
import type { CollectionDefinition } from './schema/base.ts'

// Wird auch von vite.config.ts geladen: Importe hier mit Dateiendung .ts.
// Register aller Inhaltstypen. Jedes Modul trägt hier seine Sammlung ein.
// Ordner in content/, die hier nicht stehen, lassen den Build fehlschlagen.
export const collections = {} satisfies Record<string, CollectionDefinition>

export type CollectionName = keyof typeof collections

export type ContentData = {
  [K in CollectionName]: z.output<(typeof collections)[K]['schema']>[]
}
