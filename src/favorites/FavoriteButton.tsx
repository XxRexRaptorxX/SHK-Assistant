import { StarIcon } from '../components/icons'
import { toggleFavoriteInStore, useFavorites } from './favoritesStore'

interface FavoriteButtonProps {
  id: string
  /** Name des Eintrags für die Beschriftung (Screenreader) */
  title: string
}

export function FavoriteButton({ id, title }: FavoriteButtonProps) {
  const state = useFavorites()
  const active = state.status === 'ready' && state.favorites.some((f) => f.id === id)
  const label =
    state.status === 'unavailable'
      ? 'Favoriten sind auf diesem Gerät nicht verfügbar'
      : active
        ? `„${title}“ aus Favoriten entfernen`
        : `„${title}“ zu Favoriten hinzufügen`

  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={label}
      title={label}
      disabled={state.status !== 'ready'}
      onClick={() => void toggleFavoriteInStore(id)}
      className="flex size-12 shrink-0 items-center justify-center rounded-lg text-accent disabled:opacity-40"
    >
      <StarIcon className="size-8" fill={active ? 'currentColor' : 'none'} />
    </button>
  )
}
