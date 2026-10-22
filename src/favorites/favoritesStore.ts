import { useMemo, useSyncExternalStore } from 'react'
import { importBackup, type Backup, type ImportMode } from '../storage/backup'
import type { FavoriteRecord } from '../storage/db'
import { listFavorites, removeFavorite, toggleFavorite } from '../storage/favorites'

// Gemeinsamer Favoriten-Zustand für alle Komponenten (Stern-Knöpfe, Favoritenseite).
// Quelle der Wahrheit bleibt IndexedDB; hier liegt nur eine Kopie für schnelles Rendern.

export type FavoritesState =
  | { status: 'loading' }
  | { status: 'ready'; favorites: FavoriteRecord[] }
  /** IndexedDB nicht nutzbar, z. B. privater Modus mancher Browser */
  | { status: 'unavailable' }

const LOADING: FavoritesState = { status: 'loading' }

let state: FavoritesState = LOADING
let loadStarted = false
const listeners = new Set<() => void>()
let channel: BroadcastChannel | undefined

function setState(next: FavoritesState) {
  state = next
  for (const listener of listeners) listener()
}

/** Liest die Favoriten neu aus IndexedDB. */
export async function reloadFavorites(): Promise<void> {
  try {
    setState({ status: 'ready', favorites: await listFavorites() })
  } catch {
    setState({ status: 'unavailable' })
  }
}

/** Andere offene Tabs/Fenster der App über Änderungen informieren */
function notifyOtherTabs() {
  channel?.postMessage('changed')
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!loadStarted) {
    loadStarted = true
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('shk-favorites')
      channel.onmessage = () => void reloadFavorites()
      // Node (Tests) hält den Prozess sonst offen
      ;(channel as { unref?: () => void }).unref?.()
    }
    void reloadFavorites()
  }
  return () => listeners.delete(listener)
}

export function getFavoritesSnapshot(): FavoritesState {
  return state
}

export function useFavorites(): FavoritesState {
  return useSyncExternalStore(subscribe, getFavoritesSnapshot, () => LOADING)
}

const NO_IDS: ReadonlySet<string> = new Set()

/** IDs aller Favoriten; leer, solange nicht geladen oder nicht verfügbar */
export function useFavoriteIds(): ReadonlySet<string> {
  const current = useFavorites()
  return useMemo(
    () => (current.status === 'ready' ? new Set(current.favorites.map((f) => f.id)) : NO_IDS),
    [current],
  )
}

/** Schaltet um. Die Anzeige reagiert sofort, gespeichert wird im Hintergrund. */
export async function toggleFavoriteInStore(id: string): Promise<void> {
  if (state.status === 'ready') {
    const exists = state.favorites.some((f) => f.id === id)
    setState({
      status: 'ready',
      favorites: exists
        ? state.favorites.filter((f) => f.id !== id)
        : [...state.favorites, { id, addedAt: new Date().toISOString() }],
    })
  }
  try {
    await toggleFavorite(id)
  } finally {
    await reloadFavorites()
    notifyOtherTabs()
  }
}

export async function removeFavoritesFromStore(ids: readonly string[]): Promise<void> {
  try {
    for (const id of ids) await removeFavorite(id)
  } finally {
    await reloadFavorites()
    notifyOtherTabs()
  }
}

/** Übernimmt ein Backup und liefert die Zahl der neu hinzugekommenen Favoriten. */
export async function importBackupIntoStore(backup: Backup, mode: ImportMode): Promise<number> {
  try {
    return await importBackup(backup, mode)
  } finally {
    await reloadFavorites()
    notifyOtherTabs()
  }
}

/** Nur für Tests: Zustand zurücksetzen */
export function resetFavoritesStoreForTests() {
  channel?.close()
  channel = undefined
  loadStarted = false
  listeners.clear()
  state = LOADING
}
