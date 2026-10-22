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
import { ModuleFavorites } from './ModuleFavorites'
import { getContentIndex } from '../search/sources'
import { FormulaListPage } from '../modules/formulas/FormulaListPage'
import { ConverterListPage } from '../modules/converter/ConverterListPage'
import { ChecklistListPage } from '../modules/checklists/ChecklistListPage'
import { LexiconListPage } from '../modules/lexicon/LexiconListPage'
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

const doc = (id: string, title: string, moduleTitle = 'Lexikon', group?: string): SearchDocument => ({
  id,
  title,
  moduleTitle,
  group,
  keywords: [],
  text: '',
  path: `/x/${id}`,
  status: 'verified',
})

// Reihenfolge wie im Inhaltsverzeichnis: Module, darin Unterüberschriften, darin Einträge
const index = new Map(
  [
    doc('formula.c', 'Gamma', 'Formeln', 'Hydraulik'),
    doc('formula.d', 'Delta', 'Formeln', 'Hydraulik'),
    doc('formula.e', 'Epsilon', 'Formeln', 'Thermodynamik'),
    doc('lexicon.a', 'Alpha'),
    doc('lexicon.b', 'Beta'),
  ].map((d) => [d.id, d]),
)

describe('Favoritenliste', () => {
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

  it('gliedert nach Modul und Unterüberschrift in der Reihenfolge der Module, mit Stern-Knopf', () => {
    const html = render(['lexicon.b', 'formula.e', 'lexicon.a', 'formula.c'])
    expect(html.indexOf('>Formeln</h2>')).toBeLessThan(html.indexOf('>Lexikon</h2>'))
    expect(html.indexOf('>Hydraulik</h3>')).toBeLessThan(html.indexOf('>Thermodynamik</h3>'))
    expect(html.indexOf('Gamma')).toBeLessThan(html.indexOf('Epsilon'))
    expect(html.indexOf('Alpha')).toBeLessThan(html.indexOf('Beta'))
    expect(html).not.toContain('Delta')
    expect(html.match(/<h3/g)).toHaveLength(2) // Lexikon ohne Unterüberschrift
    expect(html).toContain('href="/x/formula.c"')
    expect(html.match(/aria-label="„/g)).toHaveLength(4)
  })

  it('weist auf nicht mehr vorhandene Einträge hin', () => {
    const html = render(['lexicon.a', 'lexicon.geloescht', 'lexicon.weg'])
    expect(html).toContain('2 gemerkte Einträge sind in dieser Version nicht mehr vorhanden.')
    expect(html).toContain('Aufräumen')
    expect(html).toContain('Alpha')
  })
})

describe('Favoriten im Modul', () => {
  const render = (ids: string[]) =>
    renderToStaticMarkup(
      <MemoryRouter>
        <ModuleFavorites moduleTitle="Formeln" favoriteIds={new Set(ids)} index={index} />
      </MemoryRouter>,
    )

  it('zeigt nur die gemerkten Einträge dieses Moduls unter „Favoriten“', () => {
    const html = render(['formula.e', 'lexicon.a', 'formula.c'])
    expect(html).toContain('>Favoriten</h2>')
    expect(html.indexOf('Gamma')).toBeLessThan(html.indexOf('Epsilon'))
    expect(html).not.toContain('Alpha')
    expect(html).toContain('aria-label="„Gamma“')
  })

  it('zeigt nichts, wenn im Modul nichts gemerkt ist', () => {
    expect(render([])).toBe('')
    expect(render(['lexicon.a'])).toBe('')
  })

  it('erscheint in den Listen aller Module, solange nichts gemerkt ist aber nicht', () => {
    const pages = [<FormulaListPage />, <ConverterListPage />, <ChecklistListPage />, <LexiconListPage />]
    for (const page of pages) {
      expect(renderToStaticMarkup(<MemoryRouter>{page}</MemoryRouter>)).not.toContain('>Favoriten</h2>')
    }
  })

  it('liefert Unterüberschriften in der Reihenfolge der Modul-Listen', () => {
    const docs = [...getContentIndex().values()]
    const converterGroups = [...new Set(docs.filter((d) => d.moduleTitle === 'Umrechner').map((d) => d.group))]
    expect(converterGroups[0]).toBe('Geometrie')
    expect(converterGroups.at(-1)).toBe('Allgemein')
    expect(docs.filter((d) => d.moduleTitle === 'Lexikon').every((d) => d.group === undefined)).toBe(true)
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
