import { modules } from '../../app/modules'
import { stripEmphasis } from '../../lib/text'
import type { SearchDocument } from '../../search/search'
import { checklistEntries, checklistPath } from './checklists'
import type { ChecklistEntry } from './schema'

export function checklistSearchDocuments(entries: readonly ChecklistEntry[] = checklistEntries): SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    moduleTitle: modules.checklists.title,
    title: entry.title,
    subtitle: entry.category || undefined,
    keywords: [entry.category, ...entry.sections.map((section) => section.title)].filter(Boolean),
    text: stripEmphasis(
      [entry.description, ...entry.sections.flatMap((s) => s.items.map((item) => item.text))].join(' '),
    ),
    path: checklistPath(entry.id),
    status: entry.status,
  }))
}
