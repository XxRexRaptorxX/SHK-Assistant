import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { DraftBadge } from '../components/DraftBadge'
import { SearchInput } from '../components/SearchInput'
import { usePageTitle } from '../lib/usePageTitle'
import { MIN_QUERY_LENGTH, type SearchEngine } from './search'
import { getSearchEngine } from './sources'

export function SearchPage({ engine }: { /** Für Tests überschreibbar */ engine?: SearchEngine }) {
  usePageTitle('Suche')
  // Suchbegriff in der Adresse (#/suche?q=…), damit "Zurück" zur Trefferliste führt
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const groups = useMemo(() => (engine ?? getSearchEngine()).search(query), [engine, query])
  const count = groups.reduce((sum, group) => sum + group.results.length, 0)
  const tooShort = query.trim().length < MIN_QUERY_LENGTH

  return (
    <>
      <h1 className="text-2xl font-bold">Suche</h1>
      <div className="mt-3">
        <SearchInput
          id="global-search"
          label="In allen Modulen suchen"
          value={query}
          onChange={(value) => setParams(value ? { q: value } : {}, { replace: true })}
          placeholder="Begriff, Formel, Checkliste …"
          autoFocus
        />
      </div>

      <p className="mt-2 text-base text-muted" aria-live="polite">
        {tooShort
          ? `Mindestens ${MIN_QUERY_LENGTH} Zeichen eingeben.`
          : count === 0
            ? `Keine Treffer für „${query.trim()}“.`
            : `${count} Treffer`}
      </p>

      {groups.map((group) => (
        <section key={group.moduleTitle} className="mt-5">
          <h2 className="text-xl font-bold">{group.moduleTitle}</h2>
          <ul className="mt-2 divide-y-2 divide-line border-y-2 border-line">
            {group.results.map((result) => (
              <li key={result.id}>
                <Link to={result.path} className="flex min-h-14 items-center justify-between gap-3 px-1 py-2">
                  <span>
                    <span className="block font-semibold">{result.title}</span>
                    {result.subtitle && <span className="block text-base text-muted">{result.subtitle}</span>}
                  </span>
                  {result.status === 'draft' && <DraftBadge variant="inline" />}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </>
  )
}
