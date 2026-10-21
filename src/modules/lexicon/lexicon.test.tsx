import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { normalizeForSearch, splitParagraphs } from '../../lib/text'
import { filterLexicon, findLexiconEntry, lexiconEntries, lexiconPath, sortLexicon } from './lexicon'
import { LexiconDetailPage } from './LexiconDetailPage'
import { LexiconListPage } from './LexiconListPage'
import type { LexiconEntry } from './schema'

function lexiconEntry(overrides: Partial<LexiconEntry>): LexiconEntry {
  return {
    id: 'lexicon.beispiel',
    visibility: 'public',
    status: 'verified',
    source: 'Testquelle',
    verifiedBy: 'TS',
    verifiedAt: '2026-01-15',
    term: 'Beispiel',
    synonyms: [],
    definition: 'Erster Absatz.\n\nZweiter Absatz.',
    related: [],
    ...overrides,
  }
}

const fixtures = sortLexicon([
  lexiconEntry({ id: 'lexicon.zentralheizung', term: 'Zentralheizung' }),
  lexiconEntry({ id: 'lexicon.ausdehnungsgefaess', term: 'Ausdehnungsgefäß', synonyms: ['AG'] }),
  lexiconEntry({
    id: 'lexicon.oelbrenner',
    term: 'Ölbrenner',
    status: 'draft',
    related: ['lexicon.ausdehnungsgefaess', 'lexicon.nur-intern'],
  }),
])

describe('Text-Hilfen', () => {
  it('vereinheitlicht Umlaute, ß und Groß-/Kleinschreibung', () => {
    expect(normalizeForSearch('Ausdehnungsgefäß')).toBe('ausdehnungsgefaess')
    expect(normalizeForSearch(' ÖLBRENNER ')).toBe('oelbrenner')
  })

  it('teilt Absätze an Leerzeilen', () => {
    expect(splitParagraphs('A\nB\n\n  \nC\n')).toEqual(['A\nB', 'C'])
  })
})

describe('Lexikon-Daten', () => {
  it('sortiert alphabetisch mit deutschen Umlauten', () => {
    expect(fixtures.map((e) => e.term)).toEqual(['Ausdehnungsgefäß', 'Ölbrenner', 'Zentralheizung'])
  })

  it('filtert nach Begriff und Synonym, unabhängig von Umlaut-Schreibweise', () => {
    const terms = (query: string) => filterLexicon(fixtures, query).map((e) => e.term)
    expect(terms('gefaess')).toEqual(['Ausdehnungsgefäß'])
    expect(terms('oel')).toEqual(['Ölbrenner'])
    expect(terms('ag')).toEqual(['Ausdehnungsgefäß'])
    expect(terms('  ')).toHaveLength(3)
    expect(terms('xyz')).toEqual([])
  })

  it('bildet ids und Adressen aufeinander ab', () => {
    expect(lexiconPath('lexicon.oelbrenner')).toBe('/lexikon/oelbrenner')
    expect(findLexiconEntry(fixtures, 'oelbrenner')?.term).toBe('Ölbrenner')
    expect(findLexiconEntry(fixtures, 'gibt-es-nicht')).toBeUndefined()
    expect(findLexiconEntry(fixtures, undefined)).toBeUndefined()
  })

  it('lädt die echten Inhalte aus content/lexicon', () => {
    expect(lexiconEntries.length).toBeGreaterThan(0)
    expect(lexiconEntries.every((e) => e.id.startsWith('lexicon.'))).toBe(true)
  })
})

describe('Lexikon-Seiten', () => {
  function renderAt(path: string) {
    return renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/lexikon" element={<LexiconListPage entries={fixtures} />} />
          <Route path="/lexikon/:slug" element={<LexiconDetailPage entries={fixtures} />} />
        </Routes>
      </MemoryRouter>,
    )
  }

  it('listet alle Begriffe mit Synonymen und markiert Entwürfe', () => {
    const html = renderAt('/lexikon')
    expect(html).toContain('3 von 3 Begriffen')
    expect(html).toContain('href="/lexikon/ausdehnungsgefaess"')
    expect(html).toContain('AG')
    expect(html.match(/Ungeprüft/g)).toHaveLength(1)
  })

  it('zeigt die Detailseite mit Absätzen, Quelle und Zurück-Link', () => {
    const html = renderAt('/lexikon/ausdehnungsgefaess')
    expect(html).toContain('Ausdehnungsgefäß</h1>')
    expect(html).toContain('Erster Absatz.</p>')
    expect(html).toContain('Zweiter Absatz.</p>')
    expect(html).toContain('Testquelle')
    expect(html).toContain('href="/lexikon"')
    expect(html).not.toContain('Ungeprüft')
  })

  it('zeigt bei Entwürfen den Hinweis und nur vorhandene Verweise unter "Siehe auch"', () => {
    const html = renderAt('/lexikon/oelbrenner')
    expect(html).toContain('Ungeprüft:')
    expect(html).toContain('Siehe auch')
    expect(html).toContain('href="/lexikon/ausdehnungsgefaess"')
    expect(html).not.toContain('nur-intern')
  })

  it('meldet unbekannte Begriffe', () => {
    expect(renderAt('/lexikon/gibt-es-nicht')).toContain('Begriff nicht gefunden')
  })

  it('zeigt bei leerem Filterergebnis einen Hinweis', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LexiconListPage entries={fixtures} initialQuery="xyz" />
      </MemoryRouter>,
    )
    expect(html).toContain('Keine Begriffe gefunden.')
  })
})
