import { modules } from '../../app/modules'
import type { SearchDocument } from '../../search/search'
import { formatAnyUnit } from '../units/labels'
import { converterEntries, converterPath, converterSummary } from './converter'
import type { ConverterEntry } from './schema'

export function converterSearchDocuments(entries: readonly ConverterEntry[] = converterEntries): SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    moduleTitle: modules.converter.title,
    title: entry.title,
    subtitle: converterSummary(entry),
    keywords: [...entry.units.map(formatAnyUnit), ...entry.factors.map((factor) => factor.label), ...entry.columns],
    text: entry.description,
    path: converterPath(entry.id),
    status: entry.status,
  }))
}
