import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { DisclaimerDialog, DisclaimerGate } from './DisclaimerDialog'
import { DISCLAIMER_PAGE, LEGAL_PAGES, legalEntries } from './legal'
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
  it('liegen für Impressum und Datenschutzerklärung öffentlich vor', () => {
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

  it('zeigt keine Quelle und kein Prüfdatum', () => {
    const html = renderPage([fixture])
    expect(html).not.toContain('>Quelle</dt>')
    expect(html).not.toContain('>Geprüft</dt>')
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

  it('macht Absätze nur aus Fettdruck zu Unterüberschriften', () => {
    const html = renderToStaticMarkup(<LegalText text={'**Cookies**\n\n**Frage?**\nAntwort'} />)
    expect(html).toContain('<h3 class="mt-5 text-lg font-bold first:mt-0">Cookies</h3>')
    expect(html).toContain('<strong>Frage?</strong>\nAntwort</p>')
  })

  it('enthält die Datenschutzerklärung des Inhabers mit verantwortlicher Stelle und Hoster', () => {
    const entry = legalEntries.find((candidate) => candidate.id === 'legal.datenschutz')
    const text = entry?.sections.map((section) => section.text).join('\n') ?? ''
    expect(entry?.sections.map((section) => section.heading)).toEqual([
      '1. Datenschutz auf einen Blick',
      '2. Hosting',
      '3. Allgemeine Hinweise und Pflichtinformationen',
      '4. Datenerfassung auf dieser Website',
    ])
    expect(text).toContain('GitHub, Inc.')
    expect(text).toContain('simon@biebl-haustechnik.de')
    expect(text).not.toMatch(/\[[^\]]*\]/)
  })

  it('zeigt den Haftungshinweis als Dialog, der nur über „Verstanden“ schließt', () => {
    const entry = legalEntries.find((candidate) => candidate.id === DISCLAIMER_PAGE.id)
    const text = entry?.sections.map((section) => section.text).join('\n') ?? ''
    expect(DISCLAIMER_PAGE.path).toBe('/haftung')
    expect(text).toContain('keine Gewähr')
    expect(text).toContain('Quelle und das Datum der Prüfung')

    const html = renderToStaticMarkup(<DisclaimerDialog onAccept={() => {}} />)
    expect(html).toContain('<dialog aria-labelledby="disclaimer-title"')
    expect(html).toContain('Haftungshinweis</h2>')
    expect(html).toContain('<strong>Ungeprüft</strong>')
    expect(html).toContain('Verstanden</button>')
    // Ohne Browser gilt der Hinweis als bestätigt, damit Seiten-Tests ihn nicht sehen
    expect(renderToStaticMarkup(<DisclaimerGate />)).toBe('')
  })

  it('enthält das Impressum des Inhabers ohne Platzhalter', () => {
    const entry = legalEntries.find((candidate) => candidate.id === 'legal.impressum')
    const text = entry?.sections.map((section) => `${section.heading}\n${section.text}`).join('\n') ?? ''
    expect(text).toContain('Simon Biebl\nSeigen 3\n93426 Roding')
    expect(text).toContain('Umsatzsteuer-Identifikationsnummer')
    expect(text).not.toMatch(/TODO|\[[^\]]*\]/)
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
