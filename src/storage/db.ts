import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// Lokale Nutzerdaten (Favoriten, Checklisten-Fortschritt). Bleiben nur auf dem Gerät.

export interface FavoriteRecord {
  /** id des Inhaltseintrags, z. B. "lexicon.ausdehnungsgefaess" */
  id: string
  /** ISO-Zeitstempel */
  addedAt: string
}

export interface ChecklistProgressRecord {
  checklistId: string
  checkedItemIds: string[]
  /** Freitext-Titel, z. B. Kunde oder Anlage (fehlt, wenn leer) */
  title?: string
  /** Freitext-Notizen zur Checkliste (fehlt, wenn leer) */
  notes?: string
  /** ISO-Zeitstempel der letzten Änderung */
  updatedAt: string
}

export interface ShkDbSchema extends DBSchema {
  favorites: { key: string; value: FavoriteRecord }
  checklistProgress: { key: string; value: ChecklistProgressRecord }
}

export type ShkDb = IDBPDatabase<ShkDbSchema>

export const DB_NAME = 'shk-assistant'
const DB_VERSION = 1

let dbPromise: Promise<ShkDb> | undefined

export function getDb(): Promise<ShkDb> {
  dbPromise ??= openDB<ShkDbSchema>(DB_NAME, DB_VERSION, {
    // Migrationen schrittweise je Version ergänzen, nie bestehende Schritte ändern.
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('favorites', { keyPath: 'id' })
        db.createObjectStore('checklistProgress', { keyPath: 'checklistId' })
      }
    },
    // Eine neuere App-Version (anderer Tab) will migrieren: Verbindung freigeben.
    blocking() {
      void closeDatabase()
    },
  }).catch((error: unknown) => {
    // Nicht dauerhaft im Fehlerzustand bleiben; beim nächsten Zugriff neu versuchen.
    dbPromise = undefined
    throw error
  })
  return dbPromise
}

export async function closeDatabase(): Promise<void> {
  const pending = dbPromise
  dbPromise = undefined
  if (pending) (await pending).close()
}
