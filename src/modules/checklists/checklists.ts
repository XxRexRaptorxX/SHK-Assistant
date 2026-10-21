import { content } from '../../content'
import { CHECKLIST_ID_PREFIX } from './constants'
import type { ChecklistEntry } from './schema'

/** Alle Checklisten der aktuellen Edition, alphabetisch */
export const checklistEntries: ChecklistEntry[] = [...content.checklists].sort((a, b) =>
  a.title.localeCompare(b.title, 'de'),
)

export function checklistSlug(id: string): string {
  return id.slice(CHECKLIST_ID_PREFIX.length + 1)
}

export function checklistPath(id: string): string {
  return `/checklisten/${checklistSlug(id)}`
}

export function findChecklist(entries: readonly ChecklistEntry[], slug: string | undefined) {
  if (!slug) return undefined
  const id = `${CHECKLIST_ID_PREFIX}.${slug}`
  return entries.find((entry) => entry.id === id)
}

export function checklistItemIds(entry: ChecklistEntry): string[] {
  return entry.sections.flatMap((section) => section.items.map((item) => item.id))
}

/** Erledigte Punkte zählen; gespeicherte ids, die es nicht mehr gibt, zählen nicht mit */
export function countDone(entry: ChecklistEntry, checked: ReadonlySet<string>): { done: number; total: number } {
  const ids = checklistItemIds(entry)
  return { done: ids.filter((id) => checked.has(id)).length, total: ids.length }
}

/** Gruppiert nach Kategorie; ohne Kategorie unter "Allgemein", diese Gruppe zuletzt */
export function groupChecklistsByCategory(entries: readonly ChecklistEntry[]) {
  const groups = new Map<string, ChecklistEntry[]>()
  for (const entry of entries) {
    const category = entry.category || 'Allgemein'
    groups.set(category, [...(groups.get(category) ?? []), entry])
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a === 'Allgemein' ? 1 : b === 'Allgemein' ? -1 : a.localeCompare(b, 'de')))
    .map(([category, items]) => ({ category, entries: items }))
}
