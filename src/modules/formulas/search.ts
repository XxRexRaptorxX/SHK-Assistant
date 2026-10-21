import { modules } from '../../app/modules'
import type { SearchDocument } from '../../search/search'
import { formulaEntries, formulaPath } from './formulas'
import type { FormulaEntry } from './schema'

export function formulaSearchDocuments(entries: readonly FormulaEntry[] = formulaEntries): SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    moduleTitle: modules.formulas.title,
    title: entry.title,
    subtitle: entry.category || undefined,
    keywords: [entry.category, ...entry.variables.map((v) => v.name), entry.result?.name ?? ''].filter(Boolean),
    text: entry.description,
    path: formulaPath(entry.id),
    status: entry.status,
  }))
}
