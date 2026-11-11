import { useMemo, useState } from 'react'
import { TopicTags } from '../../components/TopicTags'
import { TOPIC_TAGS, type TopicTag } from '../../content/schema/topicTags'
import { SearchFilterButton, SearchFilters } from '../../search/SearchFilters'
import { Link, useSearchParams } from 'react-router'
import { modules } from '../../app/modules'
import { BackLink } from '../../components/ContentPage'
import { DraftBadge } from '../../components/DraftBadge'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { SearchInput } from '../../components/SearchInput'
import { usePageTitle } from '../../lib/usePageTitle'
import { ALL_CATEGORIES, LEXICON_CATEGORIES } from './constants'
import { categoryLabel, entriesInCategory, filterLexicon, lexiconEntries, lexiconPath } from './lexicon'
import type { LexiconEntry } from './schema'
import { listCard } from '../../components/surfaces'
import { pageTitle } from '../../components/headings'

interface LexiconListPageProps {
  /** Für Tests überschreibbar */
  entries?: LexiconEntry[]
  initialQuery?: string
}

/**
 * Lexikon: zuerst die Kategorien; nach Auswahl einer Kategorie (?kategorie=…) deren Begriffe.
 * Wer in der Übersicht etwas eintippt, sucht direkt in allen Begriffen.
 */
export function LexiconListPage({ entries = lexiconEntries, initialQuery = '' }: LexiconListPageProps) {
  const [params] = useSearchParams()
  const category = params.get('kategorie')
  const label = category === null ? undefined : categoryLabel(category)
  usePageTitle(label ? `${label} – Lexikon` : 'Lexikon')
  const [query, setQuery] = useState(initialQuery)
  // Themen-Filter (Mehrfachauswahl); ein passender Tag genügt
  const [tags, setTags] = useState<readonly TopicTag[]>([])
  const [filtersOpen, setFiltersOpen] = useState(false)
  const tagOptions = useMemo(() => {
    const used = new Set(entries.flatMap((entry) => entry.tags))
    return TOPIC_TAGS.map((tag) => tag.key).filter((tag) => used.has(tag))
  }, [entries])

  if (entries.length === 0) {
    return (
      <>
        <h1 className={pageTitle}>Lexikon</h1>
        <p className="mt-2 text-muted">Noch keine Begriffe vorhanden.</p>
      </>
    )
  }

  const inCategory = label && category ? entriesInCategory(entries, category) : entries
  const searching = query.trim() !== '' || tags.length > 0
  const shown = filterLexicon(inCategory, query).filter(
    (entry) => tags.length === 0 || entry.tags.some((tag) => tags.includes(tag)),
  )

  return (
    <>
      {label && <BackLink to={modules.lexicon.path} label="Alle Kategorien" />}
      <h1 className={pageTitle}>{label ?? 'Lexikon'}</h1>
      {!label && !searching && <ModuleFavorites moduleTitle={modules.lexicon.title} />}

      <div className="mt-3">
        <SearchInput
          id="lexicon-filter"
          label="Begriffe filtern"
          value={query}
          onChange={setQuery}
          placeholder={label ? 'Begriff filtern …' : 'Begriff suchen …'}
          trailing={
            <SearchFilterButton
              open={filtersOpen}
              activeCount={tags.length}
              onToggle={() => setFiltersOpen((open) => !open)}
            />
          }
        />
      </div>
      {filtersOpen && (
        <SearchFilters
          options={{ modules: [], tags: tagOptions }}
          filter={{ modules: [], tags }}
          onChange={(next) => setTags(next.tags)}
        />
      )}

      {!label && !searching ? (
        <CategoryTiles entries={entries} />
      ) : (
        <TermList entries={shown} total={inCategory.length} />
      )}
    </>
  )
}

/** Kacheln der Kategorien mit Anzahl der Begriffe; „Alles“ zuerst */
function CategoryTiles({ entries }: { entries: readonly LexiconEntry[] }) {
  const tiles = [
    { key: ALL_CATEGORIES, label: 'Alles' },
    ...LEXICON_CATEGORIES,
  ].map((item) => ({ ...item, count: entriesInCategory(entries, item.key).length }))
  return (
    <ul className="mt-4 grid grid-cols-2 gap-2" aria-label="Kategorien">
      {tiles.map((tile) => (
        <li key={tile.key}>
          <Link
            to={`${modules.lexicon.path}?kategorie=${tile.key}`}
            className={`${listCard} flex h-full min-h-20 flex-col justify-between px-4 py-3`}
          >
            <span className="leading-tight font-semibold">{tile.label}</span>
            <span className="text-base text-muted">
              {tile.count} {tile.count === 1 ? 'Begriff' : 'Begriffe'}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  )
}

function TermList({ entries, total }: { entries: readonly LexiconEntry[]; total: number }) {
  return (
    <>
      <p className="mt-2 text-base text-muted" aria-live="polite">
        {entries.length} von {total} Begriffen
      </p>
      {entries.length === 0 ? (
        <p className="mt-4">Keine Begriffe gefunden.</p>
      ) : (
        <ul className={`mt-2 ${listCard}`}>
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link to={lexiconPath(entry.id)} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
                <span>
                  <span className="block font-semibold">{entry.term}</span>
                  {entry.synonyms.length > 0 && (
                    <span className="block text-base text-muted">{entry.synonyms.join(', ')}</span>
                  )}
                </span>
                {/* Rechte Spalte wie in der Tool-Liste: „Ungeprüft“ oben, darunter die Themen-Tags */}
                <span className="flex shrink-0 flex-col items-end gap-1.5">
                  {entry.status === 'draft' && <DraftBadge variant="inline" />}
                  <TopicTags tags={entry.tags} stacked />
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
