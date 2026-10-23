import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { pageTitle } from '../../components/headings'
import { listCard } from '../../components/surfaces'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { usePageTitle } from '../../lib/usePageTitle'
import { toolEntries, toolPath } from './tools'
import type { ToolEntry } from './schema'

export function ToolListPage({ entries = toolEntries }: { entries?: ToolEntry[] }) {
  usePageTitle(modules.tools.title)
  return (
    <>
      <h1 className={pageTitle}>{modules.tools.title}</h1>
      <ModuleFavorites moduleTitle={modules.tools.title} />
      {entries.length === 0 ? (
        <p className="mt-2 text-muted">Noch keine Tools vorhanden.</p>
      ) : (
        <ul className={`mt-5 ${listCard}`}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link to={toolPath(entry.id)} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
                <span>
                  <span className="block text-lg font-semibold">{entry.title}</span>
                  {entry.result && <span className="block text-base text-muted">Ergebnis: {entry.result.name}</span>}
                </span>
                {entry.status === 'draft' && <DraftBadge variant="inline" />}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
