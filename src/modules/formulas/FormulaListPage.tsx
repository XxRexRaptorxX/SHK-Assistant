import { useState } from 'react'
import { Link } from 'react-router'
import { DraftBadge } from '../../components/DraftBadge'
import { SearchInput } from '../../components/SearchInput'
import { usePageTitle } from '../../lib/usePageTitle'
import { filterFormulas, formulaEntries, formulaPath, groupFormulasByCategory } from './formulas'
import type { FormulaEntry } from './schema'

interface FormulaListPageProps {
  /** Für Tests überschreibbar */
  entries?: FormulaEntry[]
  initialQuery?: string
}

export function FormulaListPage({ entries = formulaEntries, initialQuery = '' }: FormulaListPageProps) {
  usePageTitle('Formeln')
  const [query, setQuery] = useState(initialQuery)
  const visible = filterFormulas(entries, query)

  return (
    <>
      <h1 className="text-2xl font-bold">Formeln</h1>

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
            {visible.length} von {entries.length} Formeln
          </p>
          {visible.length === 0 && <p className="mt-4">Keine Formeln gefunden.</p>}

          {groupFormulasByCategory(visible).map((group) => (
            <section key={group.category} className="mt-5">
              <h2 className="text-xl font-bold">{group.category}</h2>
              <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line">
                {group.entries.map((entry) => (
                  <li key={entry.id}>
                    <Link
                      to={formulaPath(entry.id)}
                      className="flex min-h-14 items-center justify-between gap-3 px-1 py-2"
                    >
                      <span className="font-semibold">{entry.title}</span>
                      {entry.status === 'draft' && <DraftBadge variant="inline" />}
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </>
      )}
    </>
  )
}
