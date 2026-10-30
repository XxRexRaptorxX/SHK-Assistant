import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { normalizeForSearch } from '../../lib/text.ts'

// Sinnbild-Tools ("kind": "symbols"): Sinnbilder (Schaltzeichen) aus Strang- und Anlagenschemata
// zum Durchsuchen, gegliedert nach Gruppen (je mit Norm). Die Zeichnungen sind eigene
// Nachzeichnungen als einfache Strichgrafik auf einer Fläche von 48 × 32 Einheiten
// (Rohrleitung waagerecht auf Höhe 16), damit keine Bilder Dritter im Inhalt landen.

/** Breite und Höhe der Zeichenfläche */
export const SYMBOL_VIEWBOX = { width: 48, height: 32 }

// Nur Pfadbefehle und Zahlen, damit kein Markup in die Zeichnung gelangt
const pathData = z
  .string()
  .trim()
  .regex(/^[MmLlHhVvCcSsQqTtAaZz0-9 .,-]+$/, 'd: nur SVG-Pfadbefehle und Zahlen')

/**
 * Farben für Leitungs- und Kennzeichnungsfarben (z. B. Trinkwasser kalt grün). Ohne Farbe gilt die
 * Textfarbe; Sinnbilder mit Farbe stehen auf weißem Grund, damit Schwarz und Gelb immer lesbar sind.
 */
export const SYMBOL_COLORS = {
  rot: '#af2b1e',
  blau: '#2271b3',
  gruen: '#3f8f2e',
  gelb: '#f0c800',
  violett: '#8a5a83',
  orange: '#ed760e',
  braun: '#9d622b',
  grau: '#8f999f',
  schwarz: '#0a0a0a',
  weiss: '#ffffff',
} as const

const colorName = z.enum(Object.keys(SYMBOL_COLORS) as [keyof typeof SYMBOL_COLORS, ...(keyof typeof SYMBOL_COLORS)[]])

/** Gemeinsame Strichangaben: gefüllt, gestrichelt, Strichpunkt, fett (z. B. breiter Querstrich) und Farbe */
const strokeShape = {
  fill: z.boolean().optional(),
  dash: z.boolean().optional(),
  dashDot: z.boolean().optional(),
  bold: z.boolean().optional(),
  color: colorName.optional(),
}

const symbolShapeSchema = z.union([
  z.strictObject({ d: pathData, ...strokeShape }),
  z.strictObject({ circle: z.tuple([z.number(), z.number(), z.number().positive()]), ...strokeShape }),
  z.strictObject({
    /** Beschriftung im Sinnbild, z. B. „FV“ oder „°C“ */
    text: z.string().trim().min(1).max(6),
    x: z.number(),
    y: z.number(),
    /** Schriftgröße in Einheiten der Zeichenfläche */
    size: z.number().positive().default(6),
    color: colorName.optional(),
  }),
])

const symbolSchema = z.strictObject({
  name: z.string().trim().min(1),
  /** Weitere Suchbegriffe, z. B. „RV“ oder „Rückschlagventil“ */
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Kurzer Zusatz unter dem Namen, z. B. was ein Stern im Sinnbild bedeutet */
  note: z.string().trim().default(''),
  draw: z.array(symbolShapeSchema).min(1),
})

const symbolGroupSchema = z.strictObject({
  title: z.string().trim().min(1),
  /** Norm der Gruppe, z. B. „DIN EN 806-1“ */
  norm: z.string().trim().min(1),
  /** Hinweis zur ganzen Gruppe, z. B. „Links Grundriss, rechts Aufriss“ */
  note: z.string().trim().default(''),
  symbols: z.array(symbolSchema).min(1),
})

export const symbolToolSchema = defineEntrySchema({
  kind: z.literal('symbols'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  groups: z.array(symbolGroupSchema).min(1),
})

export type SymbolTool = z.output<typeof symbolToolSchema>
export type SymbolGroup = SymbolTool['groups'][number]
export type SymbolEntry = SymbolGroup['symbols'][number]
export type SymbolShape = SymbolEntry['draw'][number]

/** Alle Wörter der Suche kommen in Name, Suchbegriffen oder Gruppe vor */
export function symbolMatches(symbol: SymbolEntry, group: SymbolGroup, query: string): boolean {
  const words = normalizeForSearch(query).split(/\s+/).filter(Boolean)
  if (words.length === 0) return true
  const haystack = normalizeForSearch([symbol.name, ...symbol.aliases, group.title, group.norm].join(' ')).replace(/-/g, ' ')
  return words.every((word) => haystack.includes(word.replace(/-/g, ' ')))
}

/** Gruppen mit den passenden Sinnbildern; Gruppen ohne Treffer fallen weg */
export function filterSymbolGroups(tool: SymbolTool, query: string): SymbolGroup[] {
  return tool.groups
    .map((group) => ({ ...group, symbols: group.symbols.filter((symbol) => symbolMatches(symbol, group, query)) }))
    .filter((group) => group.symbols.length > 0)
}

/** Zahlen eines Pfads, um die Zeichenfläche zu prüfen (Bögen: nur Endpunkte) */
function pathNumbers(d: string): number[] {
  return (d.match(/-?\d*\.?\d+/g) ?? []).map(Number)
}

export function checkSymbolTool(tool: SymbolTool): string[] {
  const issues: string[] = []
  const titles = tool.groups.map((group) => group.title)
  if (new Set(titles).size !== titles.length) issues.push('groups: title doppelt vergeben')
  tool.groups.forEach((group, groupIndex) => {
    // Namen sind je Gruppe eindeutig (z. B. „Druckmessgerät“ bei Gas und bei MSR)
    const names = new Set<string>()
    group.symbols.forEach((symbol, index) => {
      const where = `groups[${groupIndex}] (${group.title}), symbols[${index}] (${symbol.name})`
      if (names.has(symbol.name)) issues.push(`${where}: name doppelt vergeben`)
      names.add(symbol.name)
      if (!symbol.draw.some((shape) => !('text' in shape))) issues.push(`${where}: nur Text, keine Linien`)
      for (const shape of symbol.draw) {
        const numbers = 'd' in shape ? pathNumbers(shape.d) : 'circle' in shape ? [] : [shape.x, shape.y]
        // Relative Pfadbefehle können negative Zahlen enthalten; grob prüfen, dass nichts weit außerhalb liegt
        if (numbers.some((value) => value < -SYMBOL_VIEWBOX.width || value > SYMBOL_VIEWBOX.width * 2)) {
          issues.push(`${where}: Koordinate weit außerhalb der Zeichenfläche`)
        }
        if ('circle' in shape) {
          const [cx, cy, r] = shape.circle
          if (cx - r < 0 || cx + r > SYMBOL_VIEWBOX.width || cy - r < 0 || cy + r > SYMBOL_VIEWBOX.height) {
            issues.push(`${where}: Kreis ragt über die Zeichenfläche`)
          }
        }
      }
    })
  })
  return issues
}

/** Suchbegriffe für die globale Suche */
export function symbolKeywords(tool: SymbolTool): string[] {
  return tool.groups.flatMap((group) => [group.title, group.norm, ...group.symbols.flatMap((symbol) => [symbol.name, ...symbol.aliases])])
}
