import { modules } from '../../app/modules'
import { formatUnit } from '../../lib/units'
import type { SearchDocument } from '../../search/search'
import { converterEntries, converterPath } from './converter'
import type { ConverterEntry } from './schema'

export function converterSearchDocuments(entries: readonly ConverterEntry[] = converterEntries): SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    moduleTitle: modules.converter.title,
    title: entry.title,
    subtitle: entry.units.map(formatUnit).join(', '),
    keywords: entry.units.map(formatUnit),
    text: entry.description,
    path: converterPath(entry.id),
    status: entry.status,
  }))
}
