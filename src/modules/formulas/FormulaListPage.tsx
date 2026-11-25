import { useState } from 'react'
import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { SearchInput } from '../../components/SearchInput'
import { usePageTitle } from '../../lib/usePageTitle'
import { filterFormulas, formulaEntries, formulaPath, groupFormulasByCategory, rearrangedIds } from './formulas'
import { FormulaTitle } from './FormulaTitle'
import type { FormulaEntry } from './schema'
import { categoryHeading, pageTitle } from '../../components/headings'
import { ModuleHidden } from '../../hidden/ModuleHidden'
import { useListVisibility, visibilityOf } from '../../hidden/visibility'
import { listCard } from '../../components/surfaces'
import { ModeNotice } from '../modes/ModeNotice'
import type { ModeEntry } from '../modes/schema'

interface FormulaListPageProps {
  /** Für Tests überschreibbar */
  entries?: FormulaEntry[]
  initialQuery?: string
  hiddenIds?: ReadonlySet<string>
  modes?: readonly ModeEntry[]
}

export function FormulaListPage({ entries = formulaEntries, initialQuery = '', hiddenIds, modes }: FormulaListPageProps) {
  usePageTitle('Formeln')
  const [query, setQuery] = useState(initialQuery)
  const state = useListVisibility({ hiddenIds, modes })
  const shown = entries.filter((entry) => visibilityOf(entry, state) === 'visible')
  // Für den Hinweis zählen nur die Formeln, die sonst in der Liste stünden
  const modeHiddenCount = entries.filter(
    (entry) => !rearrangedIds.has(entry.id) && visibilityOf(entry, state) === 'mode',
  ).length
  // Umgestellte Formeln erscheinen erst beim Filtern, sonst würde die Liste unübersichtlich
  const listed = query.trim() === '' ? shown.filter((entry) => !rearrangedIds.has(entry.id)) : shown
  const visible = filterFormulas(listed, query)

  return (
    <>
      <h1 className={pageTitle}>Formeln</h1>
      <ModeNotice modes={state.modes} hiddenCount={modeHiddenCount} noun="Formeln" listTitle={modules.formulas.title} />
      {query.trim() === '' && <ModuleFavorites moduleTitle={modules.formulas.title} />}

      {entries.length === 0 ? (
        <p className="mt-2 text-muted">Noch keine Formeln vorhanden.</p>
      ) : (
        <>
          <div className="mt-3">
            <SearchInput
              id="formula-filter"
              label="Formeln filtern"
              value={query}
              onChange={setQuery}
              placeholder="Formel filtern …"
            />
          </div>
          <p className="mt-2 text-base text-muted" aria-live="polite">
            {visible.length} von {listed.length} Formeln
          </p>
          {visible.length === 0 && <p className="mt-4">Keine Formeln gefunden.</p>}

          {groupFormulasByCategory(visible).map((group) => (
            <section key={group.category} className="mt-5">
              <h2 className={categoryHeading}>{group.category}</h2>
              <ul className={`mt-2 ${listCard}`}>
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      to={formulaPath(entry.id)}
                      className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                    >
                      <span className="font-semibold">
                        <FormulaTitle entry={entry} />
                      </span>
                      {entry.status === 'draft' && <DraftBadge variant="inline" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
          <ModuleHidden moduleTitle={modules.formulas.title} state={state} skip={rearrangedIds} />
        </>
      )}
    </>
  )
}
