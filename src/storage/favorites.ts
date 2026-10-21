import { getDb, type FavoriteRecord } from './db'

/** Alle Favoriten, älteste zuerst */
export async function listFavorites(): Promise<FavoriteRecord[]> {
  const db = await getDb()
  const favorites = await db.getAll('favorites')
  return favorites.sort((a, b) => a.addedAt.localeCompare(b.addedAt))
}

export async function isFavorite(id: string): Promise<boolean> {
  const db = await getDb()
  return (await db.getKey('favorites', id)) !== undefined
}

/** Fügt hinzu; ein bestehender Favorit behält sein ursprüngliches Datum. */
export async function addFavorite(id: string): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('favorites', 'readwrite')
  if ((await tx.store.getKey(id)) === undefined) {
    await tx.store.put({ id, addedAt: new Date().toISOString() })
  }
  await tx.done
}

export async function removeFavorite(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('favorites', id)
}

/** Schaltet um und liefert den neuen Zustand (true = ist Favorit). */
export async function toggleFavorite(id: string): Promise<boolean> {
  const db = await getDb()
  const tx = db.transaction('favorites', 'readwrite')
  const exists = (await tx.store.getKey(id)) !== undefined
  if (exists) {
    await tx.store.delete(id)
  } else {
    await tx.store.put({ id, addedAt: new Date().toISOString() })
  }
  await tx.done
  return !exists
}
