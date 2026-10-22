import { EntryRows } from '../components/EntryList'
import type { SearchDocument } from '../search/search'
import { getContentIndex } from '../search/sources'
import { FavoriteButton } from './FavoriteButton'
import { useFavoriteIds } from './favoritesStore'
import { categoryHeading } from '../components/headings'

interface ModuleFavoritesProps {
  /** Modulname wie in der Navigation, z. B. "Formeln" */
  moduleTitle: string
  /** Für Tests überschreibbar */
  favoriteIds?: ReadonlySet<string>
  index?: ReadonlyMap<string, SearchDocument>
}

/** Bereich „Favoriten“ oben in der Liste eines Moduls; nichts, solange dort nichts gemerkt ist */
export function ModuleFavorites({ moduleTitle, favoriteIds, index }: ModuleFavoritesProps) {
  const stored = useFavoriteIds()
  const ids = favoriteIds ?? stored
  if (ids.size === 0) return null
  const entries = [...(index ?? getContentIndex()).values()].filter(
    (entry) => entry.moduleTitle === moduleTitle && ids.has(entry.id),
  )
  if (entries.length === 0) return null

  return (
    <section className="mt-5" aria-label={`Favoriten in ${moduleTitle}`}>
      <h2 className={categoryHeading}>Favoriten</h2>
      <EntryRows entries={entries} action={(entry) => <FavoriteButton id={entry.id} title={entry.title} />} />
    </section>
  )
}
