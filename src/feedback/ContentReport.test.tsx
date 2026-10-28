import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { ContentPage } from '../components/ContentPage'
import type { BaseEntry } from '../content/schema/base'
import { ContentReportDialog } from './ContentReport'
import {
  contentReportMailto,
  messageIssue,
  nextReportAllowedAt,
  recentReports,
  REPORT_LIMIT,
  REPORT_MAX_LENGTH,
  REPORT_WINDOW_MS,
} from './reportMail'

const entry: BaseEntry = {
  id: 'tool.gebaeudeklasse',
  visibility: 'public',
  status: 'verified',
  source: 'Test',
  verifiedBy: 'RR',
  verifiedAt: '2026-10-28',
}

describe('Inhaltsfehler melden', () => {
  it('füllt Betreff und Angaben zum Eintrag in die E-Mail', () => {
    const href = contentReportMailto({
      to: 'a@example.de',
      id: 'tool.gebaeudeklasse',
      title: 'Gebäudeklasse',
      url: 'https://example.de/#/tools/gebaeudeklasse',
      version: '0.1.0',
      edition: 'öffentlich',
      state: 'ungeprüft',
      message: '  Wert für GK 4 stimmt nicht & Quelle fehlt  ',
    })
    expect(href.startsWith('mailto:a@example.de?subject=')).toBe(true)
    const params = new URLSearchParams(href.slice(href.indexOf('?') + 1))
    expect(params.get('subject')).toBe('Inhaltsfehler: Gebäudeklasse (tool.gebaeudeklasse)')
    expect(params.get('body')).toBe(
      [
        'Wert für GK 4 stimmt nicht & Quelle fehlt',
        '',
        '---',
        'Eintrag: Gebäudeklasse',
        'Kennung: tool.gebaeudeklasse',
        'Seite: https://example.de/#/tools/gebaeudeklasse',
        'Stand: ungeprüft',
        'App-Version: 0.1.0 (öffentlich)',
      ].join('\r\n'),
    )
    // Leerzeichen als %20, nicht als „+“, sonst zeigen Mailprogramme Pluszeichen
    expect(href).not.toContain('+')
  })

  it('verlangt eine Beschreibung mit begrenzter Länge', () => {
    expect(messageIssue('   kurz  ')).toContain('mindestens')
    expect(messageIssue('Der Wert ist falsch.')).toBeUndefined()
    expect(messageIssue('x'.repeat(REPORT_MAX_LENGTH + 1))).toContain('höchstens')
  })

  it(`erlaubt höchstens ${REPORT_LIMIT} Meldungen je Stunde und Gerät`, () => {
    const now = 10 * REPORT_WINDOW_MS
    const times = [now - REPORT_WINDOW_MS, now - 50, now - 40, now - 30, now - 20]
    expect(recentReports(times, now)).toHaveLength(4)
    expect(nextReportAllowedAt(times, now)).toBeUndefined()
    const full = [...times, now - 10]
    // frei, sobald die älteste der letzten fünf aus dem Zeitraum fällt
    expect(nextReportAllowedAt(full, now)).toBe(now - 50 + REPORT_WINDOW_MS)
  })

  it('zeigt den Knopf auf Inhaltsseiten, aber nicht auf Rechtsseiten', () => {
    const render = (showSource: boolean) =>
      renderToStaticMarkup(
        <MemoryRouter>
          <ContentPage entry={entry} title="Gebäudeklasse" showSource={showSource}>
            Inhalt
          </ContentPage>
        </MemoryRouter>,
      )
    expect(render(true)).toContain('Fehler im Inhalt melden</button>')
    expect(render(false)).not.toContain('Fehler im Inhalt melden')
  })

  it('sperrt das Absenden ohne Beschreibung', () => {
    const html = renderToStaticMarkup(<ContentReportDialog entry={entry} title="Gebäudeklasse" onClose={() => {}} />)
    expect(html).toContain('Eintrag: <span class="font-semibold text-ink">Gebäudeklasse</span>')
    expect(html).toContain(`maxLength="${REPORT_MAX_LENGTH}"`)
    expect(html).toMatch(/<button type="button" class="[^"]*" disabled="">.*E-Mail öffnen<\/button>/)
    expect(html).not.toContain('href="mailto:')
  })
})
