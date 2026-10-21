import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { lexiconSearchDocuments } from '../modules/lexicon/search'
import { createSearch, type SearchDocument } from './search'
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
    expect(html).toContain('<h2 class="text-xl font-bold">Lexikon</h2>')
    expect(html).toContain('href="/x/lexicon.weiche"')
    expect(html).toContain('Ungeprüft')
  })

  it('zeigt Synonyme als Zusatzzeile', () => {
    expect(renderAt('/suche?q=ausdehnung')).toContain('MAG</span>')
  })

  it('weist auf zu kurze Eingaben und fehlende Treffer hin', () => {
    expect(renderAt('/suche')).toContain('Mindestens 2 Zeichen eingeben.')
    expect(renderAt('/suche?q=W%C3%A4rmepumpe')).toContain('Keine Treffer für „Wärmepumpe“.')
  })
})
