import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { afterEach, describe, expect, it } from 'vitest'
import type { SearchDocument } from '../search/search'
import { BACKUP_FORMAT } from '../storage/backup'
import { closeDatabase, DB_NAME } from '../storage/db'
import { listFavorites } from '../storage/favorites'
import { FavoriteButton } from './FavoriteButton'
import { FavoritesList } from './FavoritesPage'
import {
  getFavoritesSnapshot,
  importBackupIntoStore,
  removeFavoritesFromStore,
  resetFavoritesStoreForTests,
  toggleFavoriteInStore,
} from './favoritesStore'

function deleteDatabase(): Promise<void> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.deleteDatabase(DB_NAME)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })
}

afterEach(async () => {
  resetFavoritesStoreForTests()
  await closeDatabase()
  await deleteDatabase()
})

function snapshotIds(): string[] {
  const state = getFavoritesSnapshot()
  return state.status === 'ready' ? state.favorites.map((f) => f.id) : []
}

describe('Favoriten-Speicher', () => {
  it('schaltet um und hält Anzeige und IndexedDB gleich', async () => {
    await toggleFavoriteInStore('lexicon.a')
    expect(snapshotIds()).toEqual(['lexicon.a'])
    expect((await listFavorites()).map((f) => f.id)).toEqual(['lexicon.a'])

    await toggleFavoriteInStore('lexicon.a')
    expect(snapshotIds()).toEqual([])
    expect(await listFavorites()).toEqual([])
  })

  it('entfernt mehrere Einträge auf einmal', async () => {
    await toggleFavoriteInStore('lexicon.a')
    await toggleFavoriteInStore('lexicon.b')
    await toggleFavoriteInStore('lexicon.c')
    await removeFavoritesFromStore(['lexicon.a', 'lexicon.c'])
    expect(snapshotIds()).toEqual(['lexicon.b'])
  })

  it('übernimmt importierte Favoriten in die Anzeige', async () => {
    await toggleFavoriteInStore('lexicon.a')
    const added = await importBackupIntoStore(
      {
        format: BACKUP_FORMAT,
        version: 1,
        exportedAt: '2026-10-01T08:00:00.000Z',
        favorites: [{ id: 'lexicon.b', addedAt: '2026-10-01T08:00:00.000Z' }],
      },
      'merge',
    )
    expect(added).toBe(1)
    expect(snapshotIds().sort()).toEqual(['lexicon.a', 'lexicon.b'])
  })
})

const doc = (id: string, title: string, moduleTitle = 'Lexikon'): SearchDocument => ({
  id,
  title,
  moduleTitle,
  keywords: [],
  text: '',
  path: `/x/${id}`,
  status: 'verified',
})

describe('Favoritenliste', () => {
  const index = new Map(
    [doc('lexicon.a', 'Alpha'), doc('lexicon.b', 'Beta'), doc('formula.c', 'Gamma', 'Formeln')].map((d) => [d.id, d]),
  )
  const render = (ids: string[]) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <FavoritesList
          favorites={ids.map((id, i) => ({ id, addedAt: `2026-10-0${i + 1}T00:00:00.000Z` }))}
          index={index}
        />
      </MemoryRouter>,
    )

  it('zeigt einen Hinweis, wenn nichts gemerkt ist', () => {
    expect(render([])).toContain('Noch keine Favoriten.')
  })

  it('zeigt die neuesten zuerst, gruppiert nach Modul, mit Stern-Knopf', () => {
    const html = render(['lexicon.a', 'formula.c', 'lexicon.b'])
    expect(html.indexOf('Beta')).toBeLessThan(html.indexOf('Alpha'))
    expect(html.indexOf('>Lexikon</h2>')).toBeLessThan(html.indexOf('>Formeln</h2>'))
    expect(html).toContain('href="/x/formula.c"')
    expect(html.match(/aria-label="„/g)).toHaveLength(3)
  })

  it('weist auf nicht mehr vorhandene Einträge hin', () => {
    const html = render(['lexicon.a', 'lexicon.geloescht', 'lexicon.weg'])
    expect(html).toContain('2 gemerkte Einträge sind in dieser Version nicht mehr vorhanden.')
    expect(html).toContain('Aufräumen')
    expect(html).toContain('Alpha')
  })
})

describe('Favoriten-Knopf', () => {
  it('ist beschriftet und bis zum Laden gesperrt', () => {
    const html = renderToStaticMarkup(<FavoriteButton id="lexicon.a" title="Alpha" />)
    expect(html).toContain('aria-pressed="false"')
    expect(html).toContain('aria-label="„Alpha“ zu Favoriten hinzufügen"')
    expect(html).toContain('disabled')
  })
})
