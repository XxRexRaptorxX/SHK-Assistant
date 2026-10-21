import { useState } from 'react'
import { Link } from 'react-router'
import { DraftBadge } from '../../components/DraftBadge'
import { usePageTitle } from '../../lib/usePageTitle'
import { filterLexicon, lexiconEntries, lexiconPath } from './lexicon'
import type { LexiconEntry } from './schema'

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
      <h1 className="text-2xl font-bold">Lexikon</h1>

      {entries.length === 0 ? (
        <p className="mt-2 text-muted">Noch keine Begriffe vorhanden.</p>
      ) : (
        <>
          <label htmlFor="lexicon-filter" className="sr-only">
            Begriffe filtern
          </label>
          <input
            id="lexicon-filter"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Begriff filtern …"
            autoComplete="off"
            className="mt-3 min-h-12 w-full rounded-lg border-2 border-line bg-page px-3 text-lg placeholder:text-muted"
          />
          <p className="mt-2 text-base text-muted" aria-live="polite">
            {visible.length} von {entries.length} Begriffen
          </p>

          {visible.length === 0 ? (
            <p className="mt-4">Keine Begriffe gefunden.</p>
          ) : (
            <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line">
              {visible.map((entry) => (
                <li key={entry.id}>
                  <Link
                    to={lexiconPath(entry.id)}
                    className="flex min-h-14 items-center justify-between gap-3 px-1 py-2"
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
