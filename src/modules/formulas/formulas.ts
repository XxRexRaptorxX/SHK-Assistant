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

/** Größe einer Variable bzw. des Ergebnisses: Lexikon-Begriff, sonst Name (vereinheitlicht) */
const quantityOf = (item: { name: string; term?: string }) => normalizeForSearch(item.term ?? item.name)

/** So allgemeine Größen, dass eine gemeinsame Variable noch keine Verwandtschaft bedeutet */
const GENERIC_QUANTITIES = new Set(['Zeit', 'Masse', 'Länge', 'Höhe', 'Temperatur'].map(normalizeForSearch))

/** Geometrie liefert Eingaben (Fläche, Volumen, Durchmesser) für Formeln aller Gruppen */
const GEOMETRY = 'Geometrie'

/**
 * Verwandte Formeln, ohne die Formel selbst und ohne Doppelte, in dieser Reihenfolge:
 * gleiche Skizze, dann Formeln, die eine Eingabe dieser Formel berechnen (gleiche Gruppe oder
 * Geometrie), dann Formeln derselben Gruppe, die ihr Ergebnis als Eingabe verwenden, zuletzt
 * Formeln derselben Gruppe mit mindestens zwei gemeinsamen Eingaben.
 */
export function relatedFormulas(formula: FormulaEntry, entries: readonly FormulaEntry[], limit = 8): FormulaEntry[] {
  const others = entries.filter((entry) => entry.id !== formula.id)
  const specific = (quantity: string) => !GENERIC_QUANTITIES.has(quantity)
  const inputs = new Set(formula.variables.map(quantityOf).filter(specific))
  const result = formula.result ? quantityOf(formula.result) : undefined
  const sameGroup = (entry: FormulaEntry) => entry.category === formula.category
  const candidates = [
    ...(formula.figure ? others.filter((entry) => entry.figure === formula.figure) : []),
    ...others.filter(
      (entry) =>
        (sameGroup(entry) || entry.category === GEOMETRY) && entry.result && inputs.has(quantityOf(entry.result)),
    ),
    ...(result && specific(result)
      ? others.filter((entry) => sameGroup(entry) && entry.variables.some((v) => quantityOf(v) === result))
      : []),
    // Geschwister: gleiche Gruppe, mindestens zwei gemeinsame Eingaben
    ...others.filter(
      (entry) => sameGroup(entry) && entry.variables.filter((v) => inputs.has(quantityOf(v))).length >= 2,
    ),
  ]
  return [...new Map(candidates.map((entry) => [entry.id, entry])).values()].slice(0, limit)
}
