import { content } from '../../content'
import { normalizeForSearch } from '../../lib/text'
import { lexiconPath } from './lexicon'
import type { LexiconEntry } from './schema'

// Verlinkung von Einheiten und Bezeichnungen (Formeln, Umrechner) auf das Lexikon.
// Gesucht wird nur nach exakter Übereinstimmung mit Begriff oder Synonym, damit keine
// falschen Treffer entstehen. Neue Lexikon-Einträge werden automatisch verlinkt.

export type TermIndex = ReadonlyMap<string, string>

/** Begriff und Synonyme (normalisiert) → Pfad des Lexikon-Eintrags; der erste Eintrag gewinnt */
export function buildTermIndex(entries: readonly LexiconEntry[]): TermIndex {
  const index = new Map<string, string>()
  for (const entry of entries) {
    for (const text of [entry.term, ...entry.synonyms]) {
      const key = normalizeForSearch(text.trim())
      if (key !== '' && !index.has(key)) index.set(key, lexiconPath(entry.id))
    }
  }
  return index
}

let defaultIndex: TermIndex | undefined

/** Pfad zum Lexikon-Eintrag für den ersten passenden Text, z. B. ("Millibar", "mbar") */
export function lexiconPathFor(texts: readonly (string | undefined)[], index?: TermIndex): string | undefined {
  const lookup = index ?? (defaultIndex ??= buildTermIndex(content.lexicon))
  for (const text of texts) {
    if (!text) continue
    const path = lookup.get(normalizeForSearch(text.trim()))
    if (path) return path
  }
  return undefined
}

let unitNames: Map<string, string> | undefined

/** Ausgeschriebener Name einer Einheit aus den Umrechnern, z. B. "kWh" → "Kilowattstunde" */
export function unitNameFor(unit: string): string | undefined {
  unitNames ??= new Map(content.converter.flatMap((entry) => Object.entries(entry.names)).reverse())
  return unitNames.get(unit)
}
