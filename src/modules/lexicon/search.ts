import { modules } from '../../app/modules'
import type { SearchDocument } from '../../search/search'
import { lexiconEntries, lexiconPath } from './lexicon'
import type { LexiconEntry } from './schema'

export function lexiconSearchDocuments(entries: readonly LexiconEntry[] = lexiconEntries): SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    moduleTitle: modules.lexicon.title,
    title: entry.term,
    subtitle: entry.synonyms.length > 0 ? entry.synonyms.join(', ') : undefined,
    keywords: entry.synonyms,
    text: entry.definition,
    path: lexiconPath(entry.id),
    status: entry.status,
  }))
}
