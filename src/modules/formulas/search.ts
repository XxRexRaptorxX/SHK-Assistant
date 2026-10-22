import { modules } from '../../app/modules'
import { stripEmphasis } from '../../lib/text'
import type { SearchDocument } from '../../search/search'
import { formulaEntries, formulaPath, groupFormulasByCategory } from './formulas'
import type { FormulaEntry } from './schema'

/** In der Reihenfolge der Formelliste (nach Kategorie gruppiert) */
export function formulaSearchDocuments(entries: readonly FormulaEntry[] = formulaEntries): SearchDocument[] {
  return groupFormulasByCategory(entries).flatMap((group) =>
    group.entries.map((entry) => ({
      id: entry.id,
      moduleTitle: modules.formulas.title,
      title: entry.title,
      group: group.category,
      subtitle: entry.category || undefined,
      keywords: [entry.category, ...entry.variables.map((v) => v.name), entry.result?.name ?? ''].filter(Boolean),
      text: stripEmphasis(entry.description),
      path: formulaPath(entry.id),
      status: entry.status,
    })),
  )
}
