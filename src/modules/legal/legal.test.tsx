import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { LEGAL_PAGES, legalEntries } from './legal'
import { LegalPage, LegalText } from './LegalPage'
import { checkLegal, type LegalEntry } from './schema'

const impressum = LEGAL_PAGES[0]

const fixture: LegalEntry = {
  id: impressum.id,
  visibility: 'public',
  status: 'verified',
  source: 'Test',
  verifiedBy: 'RR',
  verifiedAt: '2026-10-22',
  title: 'Impressum',
  sections: [{ heading: 'Kontakt', text: 'Musterstraße 1\nMusterstadt\n\nE-Mail: info@example.com' }],
}

const renderPage = (entries: LegalEntry[]) =>
  renderToStaticMarkup(
    <MemoryRouter>
      <LegalPage page={impressum} entries={entries} />
    </MemoryRouter>,
  )

describe('Rechtliche Seiten', () => {
  it('liegen als Platzhalter für Impressum und Datenschutzerklärung vor', () => {
    for (const page of LEGAL_PAGES) {
      const entry = legalEntries.find((candidate) => candidate.id === page.id)
      expect(entry?.visibility).toBe('public')
      expect(entry && checkLegal(entry)).toEqual([])
    }
  })

  it('verlangt bei geprüften Seiten mindestens einen Abschnitt', () => {
    expect(checkLegal({ ...fixture, sections: [] })).toEqual(['Bei status "verified" ist mindestens ein Abschnitt Pflicht'])
    expect(checkLegal({ ...fixture, status: 'draft', sections: [] })).toEqual([])
  })

  it('zeigt Überschriften, Absätze und einen Zurück-Link zu den Einstellungen', () => {
    const html = renderPage([fixture])
    expect(html).toContain('Impressum</h1>')
    expect(html).toContain('Kontakt</h2>')
    expect(html).toContain('href="/einstellungen"')
    expect(html.match(/<p class="mt-3 whitespace-pre-line/g)).toHaveLength(2)
  })

  it('macht Web- und E-Mail-Adressen klickbar und führt kein HTML aus', () => {
    const html = renderToStaticMarkup(
      <LegalText text={'Mail an a.b@example.de oder https://example.de. **Wichtig** <b>roh</b>'} />,
    )
    expect(html).toContain('href="mailto:a.b@example.de"')
    expect(html).toContain('href="https://example.de" target="_blank"')
    expect(html).toContain('<strong>Wichtig</strong>')
    expect(html).toContain('&lt;b&gt;roh&lt;/b&gt;')
  })

  it('weist auf fehlende Inhalte hin und ist unter /impressum und /datenschutz erreichbar', () => {
    expect(renderPage([])).toContain('TODO: Inhalt fehlt')
    for (const page of LEGAL_PAGES) {
      const html = renderToStaticMarkup(
        <MemoryRouter initialEntries={[page.path]}>
          <App />
        </MemoryRouter>,
      )
      expect(html).toContain(`${page.title}</h1>`)
      expect(html).toContain('Ungeprüft')
    }
  })
})
