import { useState } from 'react'
import { SearchInput } from '../components/SearchInput'
import { TOPIC_TAGS, type TopicTag } from '../content/schema/topicTags'
import { SearchFilterButton, SearchFilters } from './SearchFilters'

/** Einträge mit Kategorie und Themen-Tags, z. B. Formeln und Tools */
export interface CategorizedEntry {
  category: string
  tags: readonly TopicTag[]
}

/** Auswahl im Filter einer Liste; leere Liste = keine Einschränkung */
export interface ListFilter {
  categories: readonly string[]
  tags: readonly TopicTag[]
}

export const EMPTY_LIST_FILTER: ListFilter = { categories: [], tags: [] }

/** Einträge ohne Kategorie stehen in der Liste unter „Allgemein“, so heißen sie auch im Filter */
const categoryOf = (entry: CategorizedEntry) => entry.category || 'Allgemein'

/** Wie im Lexikon: innerhalb einer Gruppe genügt ein Treffer, beide Gruppen müssen passen */
export function matchesListFilter(entry: CategorizedEntry, filter: ListFilter): boolean {
  if (filter.categories.length > 0 && !filter.categories.includes(categoryOf(entry))) return false
  if (filter.tags.length > 0 && !entry.tags.some((tag) => filter.tags.includes(tag))) return false
  return true
}

/** Angebotene Filter: nur was in den Einträgen vorkommt; Kategorien in der Reihenfolge der Liste */
export function listFilterOptions<T extends CategorizedEntry>(
  entries: readonly T[],
  groupByCategory: (entries: readonly T[]) => { category: string }[],
): { categories: string[]; tags: TopicTag[] } {
  const used = new Set(entries.flatMap((entry) => entry.tags))
  return {
    categories: groupByCategory(entries).map((group) => group.category),
    tags: TOPIC_TAGS.map((tag) => tag.key).filter((tag) => used.has(tag)),
  }
}

/**
 * Suchleiste einer Liste wie im Lexikon: Texteingabe, rechts der Filter-Knopf,
 * darunter aufklappbar die Auswahl nach Kategorien und Themen (Mehrfachauswahl).
 */
export function ListSearchBar({
  id,
  label,
  placeholder,
  query,
  onQueryChange,
  filter,
  onFilterChange,
  options,
  initialOpen = false,
}: {
  id: string
  label: string
  placeholder: string
  query: string
  onQueryChange: (query: string) => void
  filter: ListFilter
  onFilterChange: (filter: ListFilter) => void
  options: { categories: readonly string[]; tags: readonly TopicTag[] }
  /** Für Tests */
  initialOpen?: boolean
}) {
  const [open, setOpen] = useState(initialOpen)
  return (
    <>
      <div className="mt-3">
        <SearchInput
          id={id}
          label={label}
          value={query}
          onChange={onQueryChange}
          placeholder={placeholder}
          trailing={
            <SearchFilterButton
              open={open}
              activeCount={filter.categories.length + filter.tags.length}
              onToggle={() => setOpen((value) => !value)}
            />
          }
        />
      </div>
      {open && (
        // Kategorien laufen über die erste Auswahl der Suchfilter (dort sonst „Bereiche“)
        <SearchFilters
          modulesLegend="Kategorien"
          options={{ modules: [...options.categories], tags: [...options.tags] }}
          filter={{ modules: [...filter.categories], tags: [...filter.tags] }}
          onChange={(next) => onFilterChange({ categories: next.modules, tags: next.tags })}
        />
      )}
    </>
  )
}
