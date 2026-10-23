import { calculatorSearchDocuments } from '../modules/calculator/calculators'
import { checklistSearchDocuments } from '../modules/checklists/search'
import { converterSearchDocuments } from '../modules/converter/search'
import { formulaSearchDocuments } from '../modules/formulas/search'
import { expertCodeSearchDocuments } from '../modules/expert/search'
import { lexiconSearchDocuments } from '../modules/lexicon/search'
import { createSearch, type SearchDocument, type SearchEngine } from './search'

// Jedes Modul trägt hier seine Einträge ein. Dient der Suche und den Favoriten
// als gemeinsames Verzeichnis aller Inhalte (id → Titel, Modul, Adresse).
// Reihenfolge: Module wie in der Navigation, Einträge wie in der Liste des Moduls
// (die Favoriten werden in dieser Reihenfolge angezeigt).
function allDocuments(): SearchDocument[] {
  return [
    ...formulaSearchDocuments(),
    ...converterSearchDocuments(),
    ...calculatorSearchDocuments(),
    ...checklistSearchDocuments(),
    ...lexiconSearchDocuments(),
    ...expertCodeSearchDocuments(),
  ]
}

let engine: SearchEngine | undefined
let index: Map<string, SearchDocument> | undefined

/** Suchindex über alle Module, wird beim ersten Gebrauch aufgebaut. */
export function getSearchEngine(): SearchEngine {
  engine ??= createSearch(allDocuments())
  return engine
}

/** Alle Inhalte der aktuellen Edition nach id */
export function getContentIndex(): Map<string, SearchDocument> {
  index ??= new Map(allDocuments().map((doc) => [doc.id, doc]))
  return index
}
