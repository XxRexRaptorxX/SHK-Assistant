import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { SearchDocument, SearchGroup } from '../search/search'
import { DraftBadge } from './DraftBadge'

interface EntryListProps {
  groups: SearchGroup[]
  /** Optionaler Knopf rechts neben jedem Eintrag, z. B. Favoriten-Stern */
  action?: (entry: SearchDocument) => ReactNode
}

/** Einträge aus beliebigen Modulen, gruppiert nach Modul (Suche, Favoriten) */
export function EntryList({ groups, action }: EntryListProps) {
  return groups.map((group) => (
    <section key={group.moduleTitle} className="mt-5">
      <h2 className="text-xl font-bold">{group.moduleTitle}</h2>
      <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line">
        {group.results.map((entry) => (
          <li key={entry.id} className="flex items-center gap-1">
            <Link to={entry.path} className="flex min-h-14 flex-1 items-center justify-between gap-3 px-1 py-2">
              <span>
                <span className="block font-semibold">{entry.title}</span>
                {entry.subtitle && <span className="block text-base text-muted">{entry.subtitle}</span>}
              </span>
              {entry.status === 'draft' && <DraftBadge variant="inline" />}
            </Link>
            {action?.(entry)}
          </li>
        ))}
      </ul>
    </section>
  ))
}

/** Gruppiert nach Modul in der Reihenfolge des ersten Auftretens */
export function groupByModule(entries: readonly SearchDocument[]): SearchGroup[] {
  const groups = new Map<string, SearchGroup>()
  for (const entry of entries) {
    let group = groups.get(entry.moduleTitle)
    if (!group) {
      group = { moduleTitle: entry.moduleTitle, results: [] }
      groups.set(entry.moduleTitle, group)
    }
    group.results.push(entry)
  }
  return [...groups.values()]
}
