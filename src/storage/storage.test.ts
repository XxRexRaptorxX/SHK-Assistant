import 'fake-indexeddb/auto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  BACKUP_FORMAT,
  backupFileName,
  BackupImportError,
  createBackup,
  importBackup,
  parseBackup,
  serializeBackup,
  type Backup,
} from './backup'
import {
  getChecklistProgress,
  listChecklistProgress,
  resetChecklistProgress,
  setChecklistItemChecked,
} from './checklistProgress'
import { closeDatabase, DB_NAME } from './db'
import { addFavorite, isFavorite, listFavorites, removeFavorite, toggleFavorite } from './favorites'

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

function setTime(iso: string) {
  vi.setSystemTime(new Date(iso))
}

beforeEach(() => {
  // Nur Date fälschen; IndexedDB braucht echte Timer
  vi.useFakeTimers({ toFake: ['Date'] })
  setTime('2026-10-01T08:00:00.000Z')
})

afterEach(async () => {
  vi.useRealTimers()
  await closeDatabase()
  await deleteDatabase()
})

describe('Favoriten', () => {
  it('fügt hinzu, prüft und entfernt', async () => {
    expect(await isFavorite('lexicon.a')).toBe(false)
    await addFavorite('lexicon.a')
    expect(await isFavorite('lexicon.a')).toBe(true)
    await removeFavorite('lexicon.a')
    expect(await isFavorite('lexicon.a')).toBe(false)
  })

  it('listet nach Hinzufügedatum und legt keine Duplikate an', async () => {
    await addFavorite('lexicon.b')
    setTime('2026-10-02T08:00:00.000Z')
    await addFavorite('formula.a')
    setTime('2026-10-03T08:00:00.000Z')
    await addFavorite('lexicon.b')

    expect(await listFavorites()).toEqual([
      { id: 'lexicon.b', addedAt: '2026-10-01T08:00:00.000Z' },
      { id: 'formula.a', addedAt: '2026-10-02T08:00:00.000Z' },
    ])
  })

  it('schaltet um und meldet den neuen Zustand', async () => {
    expect(await toggleFavorite('lexicon.a')).toBe(true)
    expect(await toggleFavorite('lexicon.a')).toBe(false)
    expect(await listFavorites()).toEqual([])
  })

  it('bleibt nach dem Schließen der Datenbank erhalten', async () => {
    await addFavorite('lexicon.a')
    await closeDatabase()
    expect(await isFavorite('lexicon.a')).toBe(true)
  })
})

describe('Checklisten-Fortschritt', () => {
  it('hakt Punkte an und ab', async () => {
    await setChecklistItemChecked('checklist.wartung', 'brenner', true)
    await setChecklistItemChecked('checklist.wartung', 'abgas', true)
    await setChecklistItemChecked('checklist.wartung', 'brenner', false)
    await setChecklistItemChecked('checklist.wartung', 'abgas', true)

    const progress = await getChecklistProgress('checklist.wartung')
    expect(progress?.checkedItemIds).toEqual(['abgas'])
  })

  it('aktualisiert den Zeitstempel bei jeder Änderung', async () => {
    await setChecklistItemChecked('checklist.wartung', 'brenner', true)
    setTime('2026-10-05T10:00:00.000Z')
    const record = await setChecklistItemChecked('checklist.wartung', 'abgas', true)
    expect(record.updatedAt).toBe('2026-10-05T10:00:00.000Z')
  })

  it('hält Checklisten getrennt und setzt einzeln zurück', async () => {
    await setChecklistItemChecked('checklist.a', 'x', true)
    await setChecklistItemChecked('checklist.b', 'y', true)
    await resetChecklistProgress('checklist.a')

    expect(await getChecklistProgress('checklist.a')).toBeUndefined()
    expect((await listChecklistProgress()).map((p) => p.checklistId)).toEqual(['checklist.b'])
  })
})

describe('Backup', () => {
  async function seed() {
    await addFavorite('lexicon.a')
    setTime('2026-10-02T08:00:00.000Z')
    await addFavorite('formula.b')
    await setChecklistItemChecked('checklist.wartung', 'brenner', true)
  }

  it('übersteht den Weg Export → Datei → Import vollständig', async () => {
    await seed()
    const text = serializeBackup(await createBackup())

    await closeDatabase()
    await deleteDatabase()
    expect(await listFavorites()).toEqual([])

    expect(await importBackup(parseBackup(text), 'replace')).toBe(2)
    expect(await listFavorites()).toEqual([
      { id: 'lexicon.a', addedAt: '2026-10-01T08:00:00.000Z' },
      { id: 'formula.b', addedAt: '2026-10-02T08:00:00.000Z' },
    ])
  })

  it('enthält keinen Checklisten-Fortschritt', async () => {
    await seed()
    const text = serializeBackup(await createBackup())
    expect(text).not.toContain('checklist')
  })

  it('ergänzt beim Zusammenführen nur fehlende Favoriten', async () => {
    await seed()
    const backup: Backup = {
      ...(await createBackup()),
      favorites: [
        { id: 'lexicon.a', addedAt: '2020-01-01T00:00:00.000Z' },
        { id: 'lexicon.neu', addedAt: '2026-09-01T00:00:00.000Z' },
      ],
    }

    expect(await importBackup(backup, 'merge')).toBe(1)
    expect(await listFavorites()).toEqual([
      { id: 'lexicon.neu', addedAt: '2026-09-01T00:00:00.000Z' },
      { id: 'lexicon.a', addedAt: '2026-10-01T08:00:00.000Z' },
      { id: 'formula.b', addedAt: '2026-10-02T08:00:00.000Z' },
    ])
  })

  it('ersetzt beim Ersetzen alle Favoriten, Checklisten bleiben unberührt', async () => {
    await seed()
    const backup: Backup = {
      ...(await createBackup()),
      favorites: [{ id: 'lexicon.neu', addedAt: '2026-09-01T00:00:00.000Z' }],
    }
    expect(await importBackup(backup, 'replace')).toBe(1)
    expect((await listFavorites()).map((f) => f.id)).toEqual(['lexicon.neu'])
    expect((await getChecklistProgress('checklist.wartung'))?.checkedItemIds).toEqual(['brenner'])
  })

  it('benennt die Datei mit Datum', () => {
    expect(backupFileName(new Date(2026, 9, 5))).toBe('shk-assistant-backup-2026-10-05.json')
  })

  describe('parseBackup lehnt ungültige Dateien verständlich ab', () => {
    const valid = {
      format: BACKUP_FORMAT,
      version: 1,
      exportedAt: '2026-10-01T08:00:00.000Z',
      favorites: [{ id: 'lexicon.a', addedAt: '2026-10-01T08:00:00.000Z' }],
    }
    const parse = (value: unknown) => () => parseBackup(typeof value === 'string' ? value : JSON.stringify(value))

    it('akzeptiert ein gültiges Backup', () => {
      expect(parse(valid)()).toEqual(valid)
    })

    it.each([
      ['kein JSON', '{kaputt', /keine gültige JSON-Datei/],
      ['fremde Datei', { hallo: 'welt' }, /kein Backup des SHK-Assistant/],
      ['JSON-Array', [1, 2], /kein Backup des SHK-Assistant/],
      ['neuere Version', { ...valid, version: 2 }, /neueren App-Version/],
      ['ungültige id', { ...valid, favorites: [{ id: 'Kein Präfix', addedAt: valid.exportedAt }] }, /favorites\.0\.id/],
      ['fehlendes Feld', { ...valid, favorites: undefined }, /favorites/],
    ])('%s', (_name, value, message) => {
      expect(parse(value)).toThrow(BackupImportError)
      expect(parse(value)).toThrow(message)
    })
  })
})
