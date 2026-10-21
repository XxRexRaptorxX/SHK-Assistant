import { lexiconSearchDocuments } from '../modules/lexicon/search'
import { createSearch, type SearchDocument, type SearchEngine } from './search'

// Jedes Modul trägt hier seine durchsuchbaren Einträge ein.
function allSearchDocuments(): SearchDocument[] {
  return [...lexiconSearchDocuments()]
}

let engine: SearchEngine | undefined

/** Suchindex über alle Module, wird beim ersten Gebrauch aufgebaut. */
export function getSearchEngine(): SearchEngine {
  engine ??= createSearch(allSearchDocuments())
  return engine
}
