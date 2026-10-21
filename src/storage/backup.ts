import { z } from 'zod'
import { ID_PATTERN } from '../content/schema/base'
import { getDb } from './db'

// Sicherung der Favoriten als JSON-Datei (Gerätewechsel, Weitergabe im Team).
// Checklisten-Fortschritt gehört bewusst nicht dazu.

export const BACKUP_FORMAT = 'shk-assistant-backup'
export const BACKUP_VERSION = 1

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(BACKUP_VERSION),
  exportedAt: z.iso.datetime(),
  favorites: z.array(z.object({ id: z.string().regex(ID_PATTERN), addedAt: z.iso.datetime() })),
})

export type Backup = z.output<typeof backupSchema>

/** Fehler mit deutscher, für Nutzer verständlicher Meldung */
export class BackupImportError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'BackupImportError'
  }
}

export async function createBackup(): Promise<Backup> {
  const db = await getDb()
  const favorites = await db.getAll('favorites')
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    favorites: favorites.sort((a, b) => a.addedAt.localeCompare(b.addedAt)),
  }
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2)
}

/** z. B. "shk-assistant-backup-2026-10-21.json" (lokales Datum) */
export function backupFileName(date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${BACKUP_FORMAT}-${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}.json`
}

/** Liest und prüft den Inhalt einer Backup-Datei. Wirft BackupImportError. */
export function parseBackup(text: string): Backup {
  let raw: unknown
  try {
    raw = JSON.parse(text)
  } catch {
    throw new BackupImportError('Die Datei ist keine gültige JSON-Datei.')
  }

  const header = z.object({ format: z.unknown(), version: z.unknown() }).safeParse(raw)
  if (!header.success || header.data.format !== BACKUP_FORMAT) {
    throw new BackupImportError('Die Datei ist kein Backup des SHK-Assistant.')
  }
  if (typeof header.data.version === 'number' && header.data.version > BACKUP_VERSION) {
    throw new BackupImportError(
      'Das Backup stammt aus einer neueren App-Version. Bitte zuerst die App aktualisieren.',
    )
  }

  const result = backupSchema.safeParse(raw)
  if (!result.success) {
    const field = result.error.issues[0]?.path.join('.') ?? ''
    throw new BackupImportError(`Das Backup ist beschädigt oder unvollständig (Feld „${field}“).`)
  }
  return result.data
}

export type ImportMode = 'merge' | 'replace'

/**
 * Übernimmt ein geprüftes Backup in einer einzigen Transaktion (alles oder nichts).
 * - "merge": fehlende Favoriten werden ergänzt, vorhandene bleiben unverändert.
 * - "replace": alle vorhandenen Favoriten werden ersetzt.
 * Rückgabe: Anzahl der neu hinzugekommenen Favoriten.
 */
export async function importBackup(backup: Backup, mode: ImportMode): Promise<number> {
  const db = await getDb()
  const tx = db.transaction('favorites', 'readwrite')
  if (mode === 'replace') await tx.store.clear()

  let added = 0
  for (const favorite of backup.favorites) {
    if ((await tx.store.getKey(favorite.id)) === undefined) {
      await tx.store.put(favorite)
      added++
    }
  }

  await tx.done
  return added
}
