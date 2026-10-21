import { content } from '../../content'
import { normalizeForSearch } from '../../lib/text'
import { LEXICON_ID_PREFIX } from './constants'
import type { LexiconEntry } from './schema'

/** Alle Einträge der aktuellen Edition, alphabetisch nach Begriff */
export const lexiconEntries: LexiconEntry[] = sortLexicon(content.lexicon)

export function sortLexicon(entries: readonly LexiconEntry[]): LexiconEntry[] {
  return [...entries].sort((a, b) => a.term.localeCompare(b.term, 'de'))
}

/** URL-Teil ohne Modul-Präfix: "lexicon.sicherheitsventil" → "sicherheitsventil" */
export function lexiconSlug(id: string): string {
  return id.slice(LEXICON_ID_PREFIX.length + 1)
}

export function lexiconPath(id: string): string {
  return `/lexikon/${lexiconSlug(id)}`
}

export function findLexiconEntry(entries: readonly LexiconEntry[], slug: string | undefined) {
  if (!slug) return undefined
  const id = `${LEXICON_ID_PREFIX}.${slug}`
  return entries.find((entry) => entry.id === id)
}

/** Filtert nach Begriff und Synonymen (Teilwort, Groß-/Kleinschreibung und Umlaute egal). */
export function filterLexicon(entries: readonly LexiconEntry[], query: string): LexiconEntry[] {
  const needle = normalizeForSearch(query)
  if (needle === '') return [...entries]
  return entries.filter((entry) =>
    [entry.term, ...entry.synonyms].some((text) => normalizeForSearch(text).includes(needle)),
  )
}
