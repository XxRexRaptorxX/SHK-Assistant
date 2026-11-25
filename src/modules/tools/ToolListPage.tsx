import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { categoryHeading, pageTitle } from '../../components/headings'
import { listCard } from '../../components/surfaces'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { usePageTitle } from '../../lib/usePageTitle'
import { groupToolsByCategory, toolEntries, toolPath } from './tools'
import type { ToolEntry } from './schema'
import { TopicTags } from '../../components/TopicTags'
import { ModuleHidden } from '../../hidden/ModuleHidden'
import { useListVisibility, visibilityOf } from '../../hidden/visibility'
import { ModeNotice } from '../modes/ModeNotice'
import type { ModeEntry } from '../modes/schema'

interface ToolListPageProps {
  /** Für Tests überschreibbar */
  entries?: ToolEntry[]
  modes?: readonly ModeEntry[]
  hiddenIds?: ReadonlySet<string>
}

export function ToolListPage({ entries = toolEntries, modes, hiddenIds }: ToolListPageProps) {
  usePageTitle(modules.tools.title)
  const state = useListVisibility({ hiddenIds, modes })
  const visible = entries.filter((entry) => visibilityOf(entry, state) === 'visible')
  const modeHiddenCount = entries.filter((entry) => visibilityOf(entry, state) === 'mode').length
  return (
    <>
      <h1 className={pageTitle}>{modules.tools.title}</h1>
      <ModeNotice modes={state.modes} hiddenCount={modeHiddenCount} noun="Tools" listTitle={modules.tools.title} />
      <ModuleFavorites moduleTitle={modules.tools.title} />
      {visible.length === 0 && (
        <p className="mt-2 text-muted">
          {entries.length === 0 ? 'Noch keine Tools vorhanden.' : 'Alle Tools sind ausgeblendet.'}
        </p>
      )}
      {groupToolsByCategory(visible).map((group) => (
          <section key={group.category} className="mt-5">
            <h2 className={categoryHeading}>{group.category}</h2>
            <ul className={`mt-2 ${listCard}`}>
              {group.entries.map((entry) => (
                <li key={entry.id}>
                  <Link to={toolPath(entry.id)} className="flex min-h-16 items-center justify-between gap-3 px-4 py-3">
                    <span>
                      <span className="block text-lg font-semibold">{entry.title}</span>
                      <span className="block text-base text-muted">{entry.summary}</span>
                      {/* „Ungeprüft“ unter der Beschreibung, damit rechts nur die Tags stehen */}
                      {entry.status === 'draft' && (
                        <span className="mt-1.5 block">
                          <DraftBadge variant="inline" />
                        </span>
                      )}
                    </span>
                    {/* Rechte Spalte: die Themen-Tags untereinander */}
                    <span className="flex shrink-0 flex-col items-end gap-1.5">
                      <TopicTags tags={entry.tags} stacked />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      <ModuleHidden moduleTitle={modules.tools.title} state={state} />
    </>
  )
}
