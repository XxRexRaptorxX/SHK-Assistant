import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { EntryList } from '../components/EntryList'
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

      <EntryList groups={groups} />
    </>
  )
}
