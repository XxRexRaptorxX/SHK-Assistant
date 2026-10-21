import Fuse from 'fuse.js'
import { normalizeForSearch } from '../lib/text'

/** Ein durchsuchbarer Eintrag. Jedes Modul liefert seine Einträge in dieser Form. */
export interface SearchDocument {
  id: string
  /** Modulname für die Gruppierung, z. B. "Lexikon" */
  moduleTitle: string
  title: string
  /** Zusatzzeile in der Trefferliste, z. B. Synonyme */
  subtitle?: string
  /** Alternative Bezeichnungen, Abkürzungen */
  keywords: string[]
  /** Fließtext, schwach gewichtet */
  text: string
  path: string
  status: 'draft' | 'verified'
}

export interface SearchGroup {
  moduleTitle: string
  results: SearchDocument[]
}

export const MIN_QUERY_LENGTH = 2
const MAX_RESULTS = 50

interface IndexedDocument {
  doc: SearchDocument
  title: string
  keywords: string[]
  text: string
}

export interface SearchEngine {
  search(query: string): SearchGroup[]
}

export function createSearch(documents: readonly SearchDocument[]): SearchEngine {
  // Umlaut-tolerant: Felder und Anfrage werden gleich vereinheitlicht
  const indexed: IndexedDocument[] = documents.map((doc) => ({
    doc,
    title: normalizeForSearch(doc.title),
    keywords: doc.keywords.map(normalizeForSearch),
    text: normalizeForSearch(doc.text),
  }))

  const fuse = new Fuse(indexed, {
    keys: [
      { name: 'title', weight: 3 },
      { name: 'keywords', weight: 2 },
      { name: 'text', weight: 0.5 },
    ],
    includeScore: true,
    ignoreLocation: true,
    // 0 = exakt, 1 = alles. 0,25 verzeiht einzelne Tippfehler ohne Zufallstreffer.
    threshold: 0.25,
    minMatchCharLength: MIN_QUERY_LENGTH,
  })

  return {
    search(query) {
      const needle = normalizeForSearch(query)
      if (needle.length < MIN_QUERY_LENGTH) return []

      // Gruppen nach Modul; die Gruppe mit dem besten Treffer zuerst
      const groups = new Map<string, SearchGroup>()
      for (const { item } of fuse.search(needle, { limit: MAX_RESULTS })) {
        const { moduleTitle } = item.doc
        let group = groups.get(moduleTitle)
        if (!group) {
          group = { moduleTitle, results: [] }
          groups.set(moduleTitle, group)
        }
        group.results.push(item.doc)
      }
      return [...groups.values()]
    },
  }
}
