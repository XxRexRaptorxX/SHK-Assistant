import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { usePageTitle } from '../../lib/usePageTitle'
import { checklistEntries, checklistPath, countDone, groupChecklistsByCategory } from './checklists'
import type { ChecklistEntry } from './schema'
import { useAllChecklistProgress } from './useChecklistProgress'
import { categoryHeading } from '../../components/headings'

interface ChecklistListPageProps {
  /** Für Tests überschreibbar */
  entries?: ChecklistEntry[]
  progress?: ReadonlyMap<string, ReadonlySet<string>>
}

export function ChecklistListPage({ entries = checklistEntries, progress }: ChecklistListPageProps) {
  usePageTitle('Checklisten')
  const stored = useAllChecklistProgress()
  const checkedById = progress ?? stored

  return (
    <>
      <h1 className="text-2xl font-bold">Checklisten</h1>
      <ModuleFavorites moduleTitle={modules.checklists.title} />
      {entries.length === 0 && <p className="mt-2 text-muted">Noch keine Checklisten vorhanden.</p>}
      {groupChecklistsByCategory(entries).map((group) => (
        <section key={group.category} className="mt-5">
          <h2 className={categoryHeading}>{group.category}</h2>
          <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line">
            {group.entries.map((entry) => {
              const { done, total } = countDone(entry, checkedById.get(entry.id) ?? new Set())
              return (
                <li key={entry.id}>
                  <Link to={checklistPath(entry.id)} className="flex min-h-14 items-center justify-between gap-3 px-1 py-2">
                    <span>
                      <span className="block font-semibold">{entry.title}</span>
                      {total > 0 && (
                        <span className="block text-base text-muted">
                          {done > 0 ? `${done} von ${total} erledigt` : `${total} Punkte`}
                        </span>
                      )}
                    </span>
                    {entry.status === 'draft' && <DraftBadge variant="inline" />}
                  </Link>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </>
  )
}
