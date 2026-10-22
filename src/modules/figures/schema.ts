import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { FIGURE_ID_PREFIX } from './constants.ts'

/**
 * Skizzen (z. B. Maßskizzen zu Formeln): je Eintrag eine JSON-Datei mit Metadaten und daneben
 * eine gleichnamige SVG-Datei. Die SVG wird in die Seite eingebettet, damit sie die Farben des
 * Designs übernimmt (CSS-Klassen, siehe .figure-art in src/index.css).
 */
export const figureEntrySchema = defineEntrySchema({
  /** Kurzbeschreibung für Bedienhilfen (Screenreader), z. B. „Kreis mit Durchmesser d und Fläche A“ */
  title: z.string().trim().min(1),
  /** Inhalt der Begleitdatei (.svg), vom Loader eingelesen */
  svg: z.string().min(1, 'SVG-Datei fehlt oder ist leer'),
})

export type FigureEntry = z.output<typeof figureEntrySchema>

/** Eigene, eingebettete Zeichnungen: keine Skripte, Ereignisse oder externen Verweise */
export function checkSvg(svg: string): string[] {
  const issues: string[] = []
  if (!/^\s*<svg[\s>]/.test(svg)) issues.push('svg: muss mit <svg beginnen')
  if (!/\sviewBox="[^"]+"/.test(svg)) issues.push('svg: viewBox fehlt (nötig für die Größenanpassung)')
  if (/<script/i.test(svg)) issues.push('svg: <script> ist nicht erlaubt')
  if (/<foreignObject/i.test(svg)) issues.push('svg: <foreignObject> ist nicht erlaubt')
  if (/\son[a-z]+\s*=/i.test(svg)) issues.push('svg: Ereignis-Attribute (on…) sind nicht erlaubt')
  if (/href\s*=\s*["'](?!#)/i.test(svg)) issues.push('svg: nur Verweise innerhalb der Datei (href="#…") erlaubt')
  return issues
}

export const figureCollection = defineCollection({
  dir: 'figures',
  idPrefix: FIGURE_ID_PREFIX,
  schema: figureEntrySchema,
  attachment: { extension: '.svg', field: 'svg' },
  check: (entry) => checkSvg(entry.svg),
})
