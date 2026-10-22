import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { SearchDocument, SearchGroup } from '../search/search'
import { DraftBadge } from './DraftBadge'
import { categoryHeading } from './headings'

type EntryAction = (entry: SearchDocument) => ReactNode

interface EntryListProps {
  groups: SearchGroup[]
  /** Optionaler Knopf rechts neben jedem Eintrag, z. B. Favoriten-Stern */
  action?: EntryAction
}

/** Einträge aus beliebigen Modulen, gruppiert nach Modul (Suche) */
export function EntryList({ groups, action }: EntryListProps) {
  return groups.map((group) => (
    <section key={group.moduleTitle} className="mt-5">
      <h2 className={categoryHeading}>{group.moduleTitle}</h2>
      <EntryRows entries={group.results} action={action} />
    </section>
  ))
}

/** Einfache Liste von Einträgen mit Titel, Zusatzzeile und optionalem Knopf */
export function EntryRows({ entries, action }: { entries: readonly SearchDocument[]; action?: EntryAction }) {
  return (
    <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line">
      {entries.map((entry) => (
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
  )
}

/** Gruppiert in der Reihenfolge des ersten Auftretens */
export function groupInOrder<T>(items: readonly T[], key: (item: T) => string): { key: string; items: T[] }[] {
  const groups = new Map<string, T[]>()
  for (const item of items) {
    const name = key(item)
    groups.set(name, [...(groups.get(name) ?? []), item])
  }
  return [...groups.entries()].map(([name, grouped]) => ({ key: name, items: grouped }))
}

/** Gruppiert nach Modul in der Reihenfolge des ersten Auftretens */
export function groupByModule(entries: readonly SearchDocument[]): SearchGroup[] {
  return groupInOrder(entries, (entry) => entry.moduleTitle).map((group) => ({
    moduleTitle: group.key,
    results: group.items,
  }))
}
