import { content } from '../../content'
import { formatAnyUnit } from '../units/labels'
import { CONVERTER_ID_PREFIX } from './constants'
import type { ConverterEntry } from './schema'

/** Alle Größen der aktuellen Edition, alphabetisch */
export const converterEntries: ConverterEntry[] = [...content.converter].sort((a, b) =>
  a.title.localeCompare(b.title, 'de'),
)

export function converterSlug(id: string): string {
  return id.slice(CONVERTER_ID_PREFIX.length + 1)
}

export function converterPath(id: string): string {
  return `/umrechner/${converterSlug(id)}`
}

export function findConverter(entries: readonly ConverterEntry[], slug: string | undefined) {
  if (!slug) return undefined
  const id = `${CONVERTER_ID_PREFIX}.${slug}`
  return entries.find((entry) => entry.id === id)
}

/** Name mit Formelzeichen als Text, z. B. „Fläche A“ (Seitentitel); in Überschriften: ConverterTitle */
export function converterTitle(entry: ConverterEntry): string {
  return entry.symbol ? `${entry.title} ${entry.symbol}` : entry.title
}

/** Reihenfolge der Kategorien in der Liste (Vorgabe des Inhabers); andere folgen alphabetisch davor „Allgemein“ */
export const CONVERTER_CATEGORY_ORDER = ['Geometrie', 'Hydraulik', 'Mechanik', 'Thermodynamik', 'Elektrotechnik']

function categoryRank(category: string): number {
  if (category === 'Allgemein') return Number.MAX_SAFE_INTEGER
  const index = CONVERTER_CATEGORY_ORDER.indexOf(category)
  return index === -1 ? CONVERTER_CATEGORY_ORDER.length : index
}

/** Gruppiert nach Kategorie in fester Reihenfolge; ohne Kategorie unter „Allgemein“, diese Gruppe zuletzt */
export function groupConvertersByCategory(entries: readonly ConverterEntry[]) {
  const groups = new Map<string, ConverterEntry[]>()
  for (const entry of entries) {
    const category = entry.category || 'Allgemein'
    groups.set(category, [...(groups.get(category) ?? []), entry])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => categoryRank(a) - categoryRank(b) || a.localeCompare(b, 'de'))
    .map(([category, items]) => ({ category, entries: items }))
}

/** Kurzbeschreibung für Listen und Suche */
export function converterSummary(entry: ConverterEntry): string {
  switch (entry.kind) {
    case 'units':
      return entry.units.map(formatAnyUnit).join(' · ')
    case 'factors':
      return entry.factors.map((factor) => factor.label).join(' · ')
    case 'slope':
      return '% · ‰ · ° · 1 : x'
    case 'ratio':
      return '% · ‰ · ‱ · ppm · ppb · pu · Bruch'
    case 'fractions':
      return 'Halbe · Viertel · Achtel · … · Hundertstel'
    case 'numeral':
      return 'Dual · Ternär · Oktal · Dezimal · Duodezimal · Hexadezimal'
    case 'table':
      return entry.columns.join(' · ')
  }
}
