import { useState } from 'react'
import { Link } from 'react-router'
import { EMPTY_LIST_FILTER, ListSearchBar, listFilterOptions, matchesListFilter, type ListFilter } from '../../search/listFilter'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { categoryHeading, pageTitle } from '../../components/headings'
import { listCard } from '../../components/surfaces'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { usePageTitle } from '../../lib/usePageTitle'
import { filterTools, groupToolsByCategory, toolEntries, toolPath } from './tools'
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
  initialQuery?: string
  initialFilter?: ListFilter
  initialFiltersOpen?: boolean
}

export function ToolListPage({
  entries = toolEntries,
  modes,
  hiddenIds,
  initialQuery = '',
  initialFilter = EMPTY_LIST_FILTER,
  initialFiltersOpen = false,
}: ToolListPageProps) {
  usePageTitle(modules.tools.title)
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState<ListFilter>(initialFilter)
  const state = useListVisibility({ hiddenIds, modes })
  const shown = entries.filter((entry) => visibilityOf(entry, state) === 'visible')
  const visible = filterTools(shown, query).filter((entry) => matchesListFilter(entry, filter))
  const searching = query.trim() !== '' || filter.categories.length + filter.tags.length > 0
  const modeHiddenCount = entries.filter((entry) => visibilityOf(entry, state) === 'mode').length
  return (
    <>
      <h1 className={pageTitle}>{modules.tools.title}</h1>
      <ModeNotice modes={state.modes} hiddenCount={modeHiddenCount} noun="Tools" listTitle={modules.tools.title} />
      {!searching && <ModuleFavorites moduleTitle={modules.tools.title} />}
      {shown.length === 0 ? (
        <p className="mt-2 text-muted">
          {entries.length === 0 ? 'Noch keine Tools vorhanden.' : 'Alle Tools sind ausgeblendet.'}
        </p>
      ) : (
        <>
          <ListSearchBar
            id="tool-filter"
            label="Tools filtern"
            placeholder="Tool filtern …"
            query={query}
            onQueryChange={setQuery}
            filter={filter}
            onFilterChange={setFilter}
            options={listFilterOptions(shown, groupToolsByCategory)}
            initialOpen={initialFiltersOpen}
          />
          <p className="mt-2 text-base text-muted" aria-live="polite">
            {visible.length} von {shown.length} Tools
          </p>
          {visible.length === 0 && <p className="mt-4">Keine Tools gefunden.</p>}
        </>
      )}
      {groupToolsByCategory(visible).map((group) => (
          <section key={group.category} className="mt-5">
            <h2 className={categoryHeading}>{group.category}</h2>
            <ul className={`mt-2 ${listCard}`}>
              {group.entries.map((entry) => (
                <li key={entry.id} className="flex items-center">
                  <Link to={toolPath(entry.id)} className="flex min-h-16 flex-1 items-center gap-3 px-4 py-3">
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
                  </Link>
                  {/* Rechte Spalte: die Themen-Tags untereinander, neben dem Link (jeder Tag führt zur Themen-Übersicht) */}
                  <span className="shrink-0 py-3 pr-4">
                    <TopicTags tags={entry.tags} stacked linked />
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      <ModuleHidden moduleTitle={modules.tools.title} state={state} />
    </>
  )
}
