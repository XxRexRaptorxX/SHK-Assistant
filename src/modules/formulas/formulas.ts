import { content } from '../../content'
import { normalizeForSearch } from '../../lib/text'
import { FORMULA_ID_PREFIX } from './constants'
import type { FormulaEntry } from './schema'

/** Alle Formeln der aktuellen Edition, alphabetisch */
export const formulaEntries: FormulaEntry[] = sortFormulas(content.formulas)

export function sortFormulas(entries: readonly FormulaEntry[]): FormulaEntry[] {
  return [...entries].sort((a, b) => a.title.localeCompare(b.title, 'de'))
}

export function formulaSlug(id: string): string {
  return id.slice(FORMULA_ID_PREFIX.length + 1)
}

export function formulaPath(id: string): string {
  return `/formeln/${formulaSlug(id)}`
}

export function findFormula(entries: readonly FormulaEntry[], slug: string | undefined) {
  if (!slug) return undefined
  const id = `${FORMULA_ID_PREFIX}.${slug}`
  return entries.find((entry) => entry.id === id)
}

/** Filtert nach Titel, Beschreibung, Kategorie und Variablennamen. */
export function filterFormulas(entries: readonly FormulaEntry[], query: string): FormulaEntry[] {
  const needle = normalizeForSearch(query)
  if (needle === '') return [...entries]
  return entries.filter((entry) =>
    [entry.title, entry.description, entry.category, ...entry.variables.map((v) => v.name)].some((text) =>
      normalizeForSearch(text).includes(needle),
    ),
  )
}

/** Gruppiert nach Kategorie; ohne Kategorie unter "Allgemein", diese Gruppe zuletzt */
export function groupFormulasByCategory(entries: readonly FormulaEntry[]): { category: string; entries: FormulaEntry[] }[] {
  const groups = new Map<string, FormulaEntry[]>()
  for (const entry of entries) {
    const category = entry.category || 'Allgemein'
    groups.set(category, [...(groups.get(category) ?? []), entry])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'Allgemein' ? 1 : b === 'Allgemein' ? -1 : a.localeCompare(b, 'de')))
    .map(([category, items]) => ({ category, entries: items }))
}
