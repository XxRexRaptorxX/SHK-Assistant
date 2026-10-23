import { useState } from 'react'
import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { SearchInput } from '../../components/SearchInput'
import { usePageTitle } from '../../lib/usePageTitle'
import { filterFormulas, formulaEntries, formulaPath, groupFormulasByCategory } from './formulas'
import type { FormulaEntry } from './schema'
import { categoryHeading, pageTitle } from '../../components/headings'
import { useHiddenIds } from '../../hidden/hiddenStore'
import { ModuleHidden } from '../../hidden/ModuleHidden'
import { listCard } from '../../components/surfaces'

/** Name der Formel, dahinter grau das Formelzeichen des Ergebnisses (z. B. „Kreisfläche  A“) */
export function FormulaTitle({ entry }: { entry: Pick<FormulaEntry, 'title' | 'result'> }) {
  const symbol = entry.result && (entry.result.label ?? entry.result.symbol)
  return (
    <>
      {entry.title}
      {symbol && <span className="ml-2 font-normal text-muted">{symbol}</span>}
    </>
  )
}

interface FormulaListPageProps {
  /** Für Tests überschreibbar */
  entries?: FormulaEntry[]
  initialQuery?: string
  hiddenIds?: ReadonlySet<string>
}

export function FormulaListPage({ entries = formulaEntries, initialQuery = '', hiddenIds }: FormulaListPageProps) {
  usePageTitle('Formeln')
  const [query, setQuery] = useState(initialQuery)
  const storedHidden = useHiddenIds()
  const hidden = hiddenIds ?? storedHidden
  const listed = entries.filter((entry) => !hidden.has(entry.id))
  const visible = filterFormulas(listed, query)

  return (
    <>
      <h1 className={pageTitle}>Formeln</h1>
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
          <ModuleHidden moduleTitle={modules.formulas.title} hiddenIds={hidden} />
        </>
      )}
    </>
  )
}
