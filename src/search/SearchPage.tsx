import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EntryList } from '../components/EntryList'
import { SearchInput } from '../components/SearchInput'
import { usePageTitle } from '../lib/usePageTitle'
import { isFilterActive, MIN_QUERY_LENGTH, type SearchEngine, type SearchFilter } from './search'
import { SearchFilterButton, SearchFilters } from './SearchFilters'
import { getSearchEngine } from './sources'
import { pageTitle } from '../components/headings'

/** Adresse der Suche: #/suche?q=…&bereich=Tools&thema=heizung (Filter mehrfach möglich) */
const MODULE_PARAM = 'bereich'
const TAG_PARAM = 'thema'

export function SearchPage({ engine }: { /** Für Tests überschreibbar */ engine?: SearchEngine }) {
  usePageTitle('Suche')
  const searchEngine = engine ?? getSearchEngine()
  const options = searchEngine.filterOptions
  // Suchbegriff und Filter in der Adresse, damit "Zurück" zur Trefferliste führt
  const [params, setParams] = useSearchParams()
  const query = params.get('q') ?? ''
  const moduleParams = params.getAll(MODULE_PARAM).join('\n')
  const tagParams = params.getAll(TAG_PARAM).join('\n')
  // Unbekannte Werte (z. B. alte Links) ignorieren
  const filter = useMemo<SearchFilter>(
    () => ({
      modules: options.modules.filter((module) => moduleParams.split('\n').includes(module)),
      tags: options.tags.filter((tag) => tagParams.split('\n').includes(tag)),
    }),
    [options, moduleParams, tagParams],
  )
  const filterActive = isFilterActive(filter)
  const [filtersOpen, setFiltersOpen] = useState(filterActive)

  const groups = useMemo(() => searchEngine.search(query, filter), [searchEngine, query, filter])
  const count = groups.reduce((sum, group) => sum + group.results.length, 0)
  const tooShort = query.trim().length < MIN_QUERY_LENGTH

  function update(nextQuery: string, nextFilter: SearchFilter) {
    const next = new URLSearchParams()
    if (nextQuery) next.set('q', nextQuery)
    for (const module of nextFilter.modules) next.append(MODULE_PARAM, module)
    for (const tag of nextFilter.tags) next.append(TAG_PARAM, tag)
    setParams(next, { replace: true })
  }

  const status =
    tooShort && !filterActive
      ? ''
      : count > 0
        ? `${count} ${tooShort ? (count === 1 ? 'Eintrag' : 'Einträge') : 'Treffer'}`
        : `${tooShort ? 'Keine Einträge' : `Keine Treffer für „${query.trim()}“`}${filterActive ? ' mit diesen Filtern' : ''}.`

  return (
    <>
      <h1 className={pageTitle}>Suche</h1>
      <div className="mt-3">
        <SearchInput
          id="global-search"
          label="In allen Modulen suchen"
          value={query}
          onChange={(value) => update(value, filter)}
          placeholder="Begriff, Formel, Checkliste …"
          autoFocus
          trailing={
            <SearchFilterButton
              open={filtersOpen}
              activeCount={filter.modules.length + filter.tags.length}
              onToggle={() => setFiltersOpen((open) => !open)}
            />
          }
        />
      </div>
      {filtersOpen && (
        <SearchFilters
          options={options}
          filter={filter}
          onChange={(next) => update(query, next)}
          tagNote="(nur Tools und Lexikon)"
        />
      )}

      <p className="mt-2 text-base text-muted" aria-live="polite">
        {status}
      </p>

      <EntryList groups={groups} />
    </>
  )
}
