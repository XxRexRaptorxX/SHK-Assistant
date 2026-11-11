import { openDB, type DBSchema, type IDBPDatabase } from 'idb'

// Lokale Nutzerdaten (Favoriten, Checklisten-Fortschritt, Stundenzettel, Aufmaße, Materiallisten). Bleiben nur auf dem Gerät.

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

/** Ein Raum im Ventil-Aufmaß mit der gezählten Anzahl je Ventiltyp */
export interface ValveSurveyRoom {
  id: string
  /** Freitext, z. B. „Bad OG“; leer = ohne Raumangabe */
  name: string
  /** Ventiltyp-key (aus dem Tool-Inhalt) → Anzahl; Typen ohne Stück fehlen */
  counts: Record<string, number>
}

/** Ein Ventil-Aufmaß (Tool „valveSurvey“) für ein Bauvorhaben */
export interface ValveSurvey {
  id: string
  /** id des Tools, zu dem die Ventiltyp-keys gehören */
  toolId: string
  /** Bauvorhaben als Freitext */
  project: string
  /** Freitext zum Aufmaß (fehlt, wenn leer) */
  note?: string
  rooms: ValveSurveyRoom[]
  /** ISO-Zeitstempel */
  createdAt: string
  updatedAt: string
}

/** Ein Heizkörper im Heizkörper-Aufmaß; Modell und Thermostat sind Schlüssel aus dem Tool-Inhalt */
export interface RadiatorEntry {
  id: string
  /** Modell-key, z. B. „kompakt“; fehlt ohne Angabe */
  model?: string
  /** Maß-key (aus dem Tool-Inhalt, z. B. „hoehe“) → Wert als Text, z. B. „600“; nur ausgefüllte Maße */
  values: Record<string, string>
  /** Thermostat-key; fehlt ohne Angabe */
  thermostat?: string
  /** Anzahl gleicher Heizkörper im Raum */
  count: number
  /** Freitext (fehlt, wenn leer) */
  note?: string
}

export interface RadiatorSurveyRoom {
  id: string
  /** Freitext, z. B. „Bad OG“; leer = ohne Raumangabe */
  name: string
  radiators: RadiatorEntry[]
}

/** Ein Heizkörper-Aufmaß (Tool „radiatorSurvey“) für ein Bauvorhaben */
export interface RadiatorSurvey {
  id: string
  toolId: string
  project: string
  note?: string
  rooms: RadiatorSurveyRoom[]
  createdAt: string
  updatedAt: string
}

/** Ein Artikel auf der Materialliste */
export interface MaterialItem {
  id: string
  /** Artikel als Freitext, z. B. „Kugelhahn 1/2"“ */
  name: string
  /** Menge, ganze Zahl ab 1 */
  quantity: number
  /** Einheit als Freitext, z. B. „m“; fehlt, wenn leer (dann Stück) */
  unit?: string
  /** ISO-Zeitstempel, wann abgehakt; fehlt, solange der Artikel noch fehlt */
  doneAt?: string
}

/** Eine Materialliste (Tool „materialList“): was zum Bauvorhaben noch mitgenommen werden muss */
export interface MaterialList {
  id: string
  toolId: string
  project: string
  note?: string
  items: MaterialItem[]
  createdAt: string
  updatedAt: string
}

/** Gemerkte Eingabe der Materialliste für die Vervollständigung; bleibt auch nach dem Löschen der Liste */
export interface MaterialMemoryRecord {
  /** Art und vereinheitlichter Text, z. B. „article:kugelhahn 1/2"“ */
  key: string
  kind: 'project' | 'article'
  /** Text wie zuletzt eingegeben */
  text: string
  /** Nur Artikel: zuletzt genutzte Einheit (fehlt ohne Einheit) */
  unit?: string
  /** ISO-Zeitstempel der letzten Nutzung */
  usedAt: string
}

export interface ShkDbSchema extends DBSchema {
  favorites: { key: string; value: FavoriteRecord }
  checklistProgress: { key: string; value: ChecklistProgressRecord }
  workEntries: { key: string; value: WorkEntry }
  valveSurveys: { key: string; value: ValveSurvey }
  radiatorSurveys: { key: string; value: RadiatorSurvey }
  materialLists: { key: string; value: MaterialList }
  materialMemory: { key: string; value: MaterialMemoryRecord }
}

export type ShkDb = IDBPDatabase<ShkDbSchema>

export const DB_NAME = 'shk-assistant'
const DB_VERSION = 5

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
      if (oldVersion < 3) {
        db.createObjectStore('valveSurveys', { keyPath: 'id' })
      }
      if (oldVersion < 4) {
        db.createObjectStore('radiatorSurveys', { keyPath: 'id' })
      }
      if (oldVersion < 5) {
        db.createObjectStore('materialLists', { keyPath: 'id' })
        db.createObjectStore('materialMemory', { keyPath: 'key' })
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
