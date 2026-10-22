import { useState } from 'react'
import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { SearchInput } from '../../components/SearchInput'
import { usePageTitle } from '../../lib/usePageTitle'
import { filterLexicon, lexiconEntries, lexiconPath } from './lexicon'
import type { LexiconEntry } from './schema'
import { listCard } from '../../components/surfaces'
import { pageTitle } from '../../components/headings'

interface LexiconListPageProps {
  /** Für Tests überschreibbar */
  entries?: LexiconEntry[]
  initialQuery?: string
}

export function LexiconListPage({ entries = lexiconEntries, initialQuery = '' }: LexiconListPageProps) {
  usePageTitle('Lexikon')
  const [query, setQuery] = useState(initialQuery)
  const visible = filterLexicon(entries, query)

  return (
    <>
      <h1 className={pageTitle}>Lexikon</h1>
      {query.trim() === '' && <ModuleFavorites moduleTitle={modules.lexicon.title} />}

      {entries.length === 0 ? (
        <p className="mt-2 text-muted">Noch keine Begriffe vorhanden.</p>
      ) : (
        <>
          <div className="mt-3">
            <SearchInput
              id="lexicon-filter"
              label="Begriffe filtern"
              value={query}
              onChange={setQuery}
              placeholder="Begriff filtern …"
            />
          </div>
          <p className="mt-2 text-base text-muted" aria-live="polite">
            {visible.length} von {entries.length} Begriffen
          </p>

          {visible.length === 0 ? (
            <p className="mt-4">Keine Begriffe gefunden.</p>
          ) : (
            <ul className={`mt-2 ${listCard}`}>
              {visible.map((entry) => (
                <li key={entry.id}>
                  <Link
                    to={lexiconPath(entry.id)}
                    className="flex min-h-14 items-center justify-between gap-3 px-4 py-2"
                  >
                    <span>
                      <span className="block font-semibold">{entry.term}</span>
                      {entry.synonyms.length > 0 && (
                        <span className="block text-base text-muted">{entry.synonyms.join(', ')}</span>
                      )}
                    </span>
                    {entry.status === 'draft' && <DraftBadge variant="inline" />}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </>
  )
}
