import Fuse from 'fuse.js'
import { groupByModule } from '../components/EntryList'
import { normalizeForSearch } from '../lib/text'
import { TOPIC_TAGS, type TopicTag } from '../content/schema/topicTags'

/** Ein durchsuchbarer Eintrag. Jedes Modul liefert seine Einträge in dieser Form. */
export interface SearchDocument {
  id: string
  /** Modulname für die Gruppierung, z. B. "Lexikon" */
  moduleTitle: string
  title: string
  /** Unterüberschrift im Modul, z. B. Kategorie "Hydraulik"; fehlt bei Modulen ohne Gliederung (Lexikon) */
  group?: string
  /** Zusatzzeile in der Trefferliste, z. B. Synonyme */
  subtitle?: string
  /** Alternative Bezeichnungen, Abkürzungen */
  keywords: string[]
  /** Fließtext, schwach gewichtet */
  text: string
  path: string
  status: 'draft' | 'verified'
  /** Themen-Tags (Tools, Lexikon), rechts unter „Ungeprüft“ angezeigt */
  tags?: readonly TopicTag[]
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

/** Filter der Suchleiste; leere Liste = keine Einschränkung */
export interface SearchFilter {
  /** Modulnamen, z. B. „Tools“ */
  modules: readonly string[]
  /** Themen-Tags; nur Tools und Lexikon haben Tags, andere Einträge fallen dann heraus */
  tags: readonly TopicTag[]
}

export const NO_FILTER: SearchFilter = { modules: [], tags: [] }

export const isFilterActive = (filter: SearchFilter): boolean => filter.modules.length > 0 || filter.tags.length > 0

function matchesFilter(doc: SearchDocument, filter: SearchFilter): boolean {
  if (filter.modules.length > 0 && !filter.modules.includes(doc.moduleTitle)) return false
  if (filter.tags.length > 0 && !doc.tags?.some((tag) => filter.tags.includes(tag))) return false
  return true
}

export interface SearchEngine {
  /** Ohne Suchbegriff, aber mit Filter: alle passenden Einträge in Index-Reihenfolge */
  search(query: string, filter?: SearchFilter): SearchGroup[]
  /** Auswahl für den Filter: Module und Themen, die im Index vorkommen */
  filterOptions: { modules: string[]; tags: TopicTag[] }
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

  const usedTags = new Set(documents.flatMap((doc) => doc.tags ?? []))

  return {
    search(query, filter = NO_FILTER) {
      const needle = normalizeForSearch(query)
      const matches = (doc: SearchDocument) => matchesFilter(doc, filter)
      if (needle.length < MIN_QUERY_LENGTH) {
        return isFilterActive(filter) ? groupByModule(documents.filter(matches)) : []
      }
      // Treffer kommen nach Relevanz sortiert; die Gruppe mit dem besten Treffer steht zuerst.
      // Erst filtern, dann begrenzen, damit gefilterte Treffer nicht durch andere verdrängt werden.
      const hits = fuse.search(needle).map(({ item }) => item.doc)
      return groupByModule(hits.filter(matches).slice(0, MAX_RESULTS))
    },
    filterOptions: {
      modules: [...new Set(documents.map((doc) => doc.moduleTitle))],
      tags: TOPIC_TAGS.map((tag) => tag.key).filter((tag) => usedTags.has(tag)),
    },
  }
}
