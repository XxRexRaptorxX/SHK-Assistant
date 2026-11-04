import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// Lokale Nutzerdaten (Favoriten, Checklisten-Fortschritt, Stundenzettel). Bleiben nur auf dem Gerät.

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

/** Ein Eintrag im Stundenzettel */
export interface WorkEntry {
  id: string
  /** Bauvorhaben als Freitext */
  project: string
  /** Arbeitstag als lokales Datum "YYYY-MM-DD" */
  date: string
  /** Beginn in Minuten seit Mitternacht; fehlt nur bei frühen Einträgen, die ohne Arbeitsbeginn erfasst wurden */
  startMinute?: number
  /** Dauer in ganzen Minuten; das Ende ist startMinute + minutes */
  minutes: number
  /** ISO-Zeitstempel der Erfassung */
  recordedAt: string
  /** Freitext zum Eintrag (fehlt, wenn leer) */
  note?: string
  /** Pause statt Arbeitszeit; project ist dann leer */
  isBreak?: boolean
  /** ISO-Zeitstempel der letzten nachträglichen Änderung */
  editedAt?: string
}

export interface ShkDbSchema extends DBSchema {
  favorites: { key: string; value: FavoriteRecord }
  checklistProgress: { key: string; value: ChecklistProgressRecord }
  workEntries: { key: string; value: WorkEntry }
}

export type ShkDb = IDBPDatabase<ShkDbSchema>

export const DB_NAME = 'shk-assistant'
const DB_VERSION = 2

let dbPromise: Promise<ShkDb> | undefined

export function getDb(): Promise<ShkDb> {
  dbPromise ??= openDB<ShkDbSchema>(DB_NAME, DB_VERSION, {
    // Migrationen schrittweise je Version ergänzen, nie bestehende Schritte ändern.
    upgrade(db, oldVersion) {
      if (oldVersion < 1) {
        db.createObjectStore('favorites', { keyPath: 'id' })
        db.createObjectStore('checklistProgress', { keyPath: 'checklistId' })
      }
      if (oldVersion < 2) {
        db.createObjectStore('workEntries', { keyPath: 'id' })
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
