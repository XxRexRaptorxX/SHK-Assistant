import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'

// Materialliste ("kind": "materialList"): je Bauvorhaben eigene Artikel mit Menge notieren, die beim nächsten Mal
// mitgenommen werden müssen, und abhaken; siehe MaterialList.tsx und materialListCalc.ts. Listen und gemerkte Eingaben
// sind Nutzerdaten auf dem Gerät (IndexedDB); hier stehen nur die Texte der Tool-Seite.

export const materialListToolSchema = defineEntrySchema({
  kind: z.literal('materialList'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Hinweis am Ende des Tools, z. B. wo die Daten bleiben */
  closingNote: z.string().trim().min(1),
  /** Weitere Suchbegriffe, z. B. „Einkaufsliste“ */
  keywords: z.array(z.string().trim().min(1)).default([]),
})

export type MaterialListTool = z.output<typeof materialListToolSchema>
