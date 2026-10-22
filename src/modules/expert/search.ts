import { modules } from '../../app/modules'
import type { SearchDocument } from '../../search/search'
import { expertCodeEntries, plainText } from './expertCodes'
import type { ExpertCodeEntry } from './schema'

/** Nur der Name ist durchsuchbar; der Code selbst erscheint erst hinter der PIN-Abfrage. */
export function expertCodeSearchDocuments(entries: readonly ExpertCodeEntry[] = expertCodeEntries): SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    moduleTitle: modules.expert.title,
    title: plainText(entry.name),
    keywords: [],
    text: '',
    path: modules.expert.path,
    status: entry.status,
  }))
}
