import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { lexiconSearchDocuments } from '../modules/lexicon/search'
import { createSearch, NO_FILTER, type SearchDocument, type SearchFilter } from './search'
import { SearchPage } from './SearchPage'
import { getSearchEngine } from './sources'

function doc(overrides: Partial<SearchDocument> & Pick<SearchDocument, 'id' | 'title'>): SearchDocument {
  return {
    moduleTitle: 'Lexikon',
    keywords: [],
    text: '',
    path: `/x/${overrides.id}`,
    status: 'verified',
    ...overrides,
  }
}

const documents: SearchDocument[] = [
  doc({ id: 'lexicon.ag', title: 'Ausdehnungsgefäß', keywords: ['MAG'], subtitle: 'MAG' }),
  doc({ id: 'lexicon.sv', title: 'Sicherheitsventil', text: 'Schützt die Anlage vor Überdruck.' }),
  doc({ id: 'lexicon.weiche', title: 'Hydraulische Weiche', status: 'draft' }),
  doc({ id: 'formula.druck', title: 'Anlagendruck', moduleTitle: 'Formeln' }),
]
const engine = createSearch(documents)
const ids = (query: string) => engine.search(query).flatMap((g) => g.results.map((r) => r.id))

describe('Suche', () => {
  it('findet nach Titel, auch mit Teilwort', () => {
    expect(ids('Sicherheitsventil')[0]).toBe('lexicon.sv')
    expect(ids('weiche')).toEqual(['lexicon.weiche'])
  })

  it('ist tolerant gegenüber Umlaut-Schreibweise und Großschreibung', () => {
    expect(ids('ausdehnungsgefaess')[0]).toBe('lexicon.ag')
    expect(ids('AUSDEHNUNGSGEFÄSS')[0]).toBe('lexicon.ag')
  })

  it('verzeiht Tippfehler', () => {
    expect(ids('Sicherheitsventiel')[0]).toBe('lexicon.sv')
    expect(ids('Ausdenungsgefäß')[0]).toBe('lexicon.ag')
  })

  it('findet über Schlagwörter und Fließtext', () => {
    expect(ids('mag')).toContain('lexicon.ag')
    expect(ids('ueberdruck')).toContain('lexicon.sv')
  })

  it('liefert nichts für zu kurze oder unpassende Anfragen', () => {
    expect(engine.search('')).toEqual([])
    expect(engine.search(' a ')).toEqual([])
    expect(engine.search('Wärmepumpe')).toEqual([])
  })

  it('gruppiert nach Modul, beste Gruppe zuerst', () => {
    const groups = engine.search('druck')
    expect(groups.map((g) => g.moduleTitle)).toEqual(['Formeln', 'Lexikon'])
  })

  it('bezieht das Lexikon in den globalen Index ein', () => {
    const lexicon = lexiconSearchDocuments()
    expect(lexicon.length).toBeGreaterThan(0)
    const first = lexicon[0]!
    expect(getSearchEngine().search(first.title).flatMap((g) => g.results.map((r) => r.id))).toContain(first.id)
    expect(first.path).toMatch(/^\/lexikon\//)
  })
})

describe('Suchseite', () => {
  const renderAt = (path: string) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <SearchPage engine={engine} />
      </MemoryRouter>,
    )

  it('übernimmt den Suchbegriff aus der Adresse und zeigt gruppierte Treffer', () => {
    const html = renderAt('/suche?q=weiche')
    expect(html).toContain('value="weiche"')
    expect(html).toContain('1 Treffer')
    expect(html).toContain('>Lexikon</h2>')
    expect(html).toContain('href="/x/lexicon.weiche"')
    expect(html).toContain('Ungeprüft')
  })

  it('zeigt Synonyme als Zusatzzeile', () => {
    expect(renderAt('/suche?q=ausdehnung')).toContain('MAG</span>')
  })

  it('zeigt ohne Eingabe keinen Hinweis, bei fehlenden Treffern schon', () => {
    expect(renderAt('/suche')).not.toContain('Mindestens')
    expect(renderAt('/suche')).not.toContain('Treffer')
    expect(renderAt('/suche?q=W%C3%A4rmepumpe')).toContain('Keine Treffer für „Wärmepumpe“.')
  })

  it('hat einen Filter-Knopf rechts in der Suchleiste, Filter erst nach dem Öffnen', () => {
    const html = renderAt('/suche')
    expect(html).toContain('aria-label="Filter"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Bereiche')
  })

  it('übernimmt Filter aus der Adresse und zeigt sie geöffnet', () => {
    const html = renderAt('/suche?q=druck&bereich=Formeln')
    expect(html).toContain('aria-label="Filter (1 aktiv)"')
    expect(html).toContain('Bereiche')
    expect(html).toMatch(/aria-pressed="true"[^>]*>.*?Formeln/)
    expect(html).toContain('1 Treffer')
    expect(html).not.toContain('>Lexikon</h2>')
  })

  it('listet mit Filter auch ohne Suchbegriff alle passenden Einträge', () => {
    expect(renderAt('/suche?bereich=Lexikon')).toContain('3 Einträge')
    expect(renderAt('/suche?bereich=Unbekannt')).not.toContain('Einträge')
  })
})

describe('Suchfilter', () => {
  const tagged: SearchDocument[] = [
    ...documents,
    doc({ id: 'tool.heiz', title: 'Druckprobe Heizung', moduleTitle: 'Tools', tags: ['heizung'] }),
    doc({ id: 'tool.lueft', title: 'Druckverlust Lüftung', moduleTitle: 'Tools', tags: ['lueftung', 'klima'] }),
  ]
  const filtered = createSearch(tagged)
  const found = (query: string, filter: SearchFilter) =>
    filtered.search(query, filter).flatMap((group) => group.results.map((result) => result.id))

  it('bietet die vorhandenen Bereiche und Themen an', () => {
    expect(filtered.filterOptions.modules).toEqual(['Lexikon', 'Formeln', 'Tools'])
    expect(filtered.filterOptions.tags).toEqual(['heizung', 'lueftung', 'klima'])
  })

  it('schränkt auf Bereiche ein', () => {
    expect(found('druck', { modules: ['Tools'], tags: [] }).sort()).toEqual(['tool.heiz', 'tool.lueft'])
    expect(found('druck', { modules: ['Formeln', 'Tools'], tags: [] })).toContain('formula.druck')
  })

  it('schränkt auf Themen ein; ein passender Tag genügt', () => {
    expect(found('druck', { modules: [], tags: ['klima'] })).toEqual(['tool.lueft'])
    expect(found('druck', { modules: [], tags: ['heizung', 'klima'] }).sort()).toEqual(['tool.heiz', 'tool.lueft'])
  })

  it('ohne Filter und ohne Suchbegriff bleibt die Liste leer', () => {
    expect(filtered.search('', NO_FILTER)).toEqual([])
    expect(found('', { modules: [], tags: ['heizung'] })).toEqual(['tool.heiz'])
  })
})
