import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BaseEntry } from '../content/schema/base'
import { formatIsoDate } from '../lib/format'
import { ContentPage } from './ContentPage'
import { DraftBadge } from './DraftBadge'
import { RichText } from './RichText'
import { SourceInfo } from './SourceInfo'
import { splitLinks } from '../lib/links'
import { splitSources } from '../lib/sources'
import { TechBackdrop } from './TechBackdrop'
import { ShareButton } from './ShareButton'
import { App } from '../App'
import { MemoryRouter } from 'react-router'
import { HomePage } from '../pages/HomePage'
import { Slogan } from './Slogan'

const verified: BaseEntry = {
  id: 'item.beispiel',
  visibility: 'public',
  status: 'verified',
  source: 'Testquelle S. 12',
  verifiedBy: 'TS',
  verifiedAt: '2026-01-15',
}

const draft: BaseEntry = { ...verified, status: 'draft', source: '', verifiedBy: '', verifiedAt: '' }

describe('formatIsoDate', () => {
  it('formatiert ISO-Datum deutsch', () => {
    expect(formatIsoDate('2026-01-05')).toBe('05.01.2026')
  })
})

describe('RichText', () => {
  it('stellt **…** fett dar, trennt Absätze und führt kein HTML aus', () => {
    const html = renderToStaticMarkup(<RichText text={'Ein **Ventil** <b>x</b>\n\nZweiter Absatz'} />)
    expect(html).toBe('<p class="mt-3 whitespace-pre-line first:mt-0">Ein <strong>Ventil</strong> &lt;b&gt;x&lt;/b&gt;</p>' +
      '<p class="mt-3 whitespace-pre-line first:mt-0">Zweiter Absatz</p>')
  })
})

describe('DraftBadge', () => {
  it('weist deutlich auf ungeprüfte Inhalte hin', () => {
    expect(renderToStaticMarkup(<DraftBadge />)).toContain('Ungeprüft')
    expect(renderToStaticMarkup(<DraftBadge variant="inline" />)).toContain('Ungeprüft')
  })
})

describe('SourceInfo', () => {
  it('zeigt Quelle, Prüfdatum und Kürzel bei geprüften Einträgen', () => {
    const html = renderToStaticMarkup(<SourceInfo entry={verified} />)
    expect(html).toContain('Testquelle S. 12')
    expect(html).toContain('15.01.2026 (TS)')
  })

  it('zeigt bei Entwürfen "noch nicht geprüft"', () => {
    const html = renderToStaticMarkup(<SourceInfo entry={draft} />)
    expect(html).toContain('noch nicht geprüft')
    expect(html).toContain('nicht angegeben')
  })

  it('verlinkt Quellen, die nur aus einer URL bestehen', () => {
    const html = renderToStaticMarkup(
      <SourceInfo entry={{ ...verified, source: 'https://example.org/doku.pdf' }} />,
    )
    expect(html).toContain('href="https://example.org/doku.pdf"')
    expect(html).toContain('rel="noopener noreferrer"')
  })

  it('verlinkt Adressen mitten in der Quellenangabe, ohne angehängte Satzzeichen', () => {
    const source = 'Wikipedia „Ventil“, https://de.wikipedia.org/wiki/Ventil_(Technik); Hersteller, https://example.org/a.pdf.'
    const html = renderToStaticMarkup(<SourceInfo entry={{ ...verified, source }} />)
    expect(html).toContain('href="https://de.wikipedia.org/wiki/Ventil_(Technik)"')
    expect(html).toContain('href="https://example.org/a.pdf"')
    expect(html).toContain('<li><span>Wikipedia „Ventil“, </span>')
    expect(html).toContain('<li><span>Hersteller, </span>')
  })

  it('zeigt mehrere Quellen als Aufzählung in einem scrollbaren Bereich, eine einzelne als Text', () => {
    const html = renderToStaticMarkup(<SourceInfo entry={{ ...verified, source: 'Erste Quelle; zweite Quelle' }} />)
    expect(html).toContain('class="max-h-48 overflow-y-auto')
    expect(html).toContain('aria-label="Quellenangaben"')
    expect(html.match(/<li>/g)).toHaveLength(2)
    expect(renderToStaticMarkup(<SourceInfo entry={verified} />)).not.toContain('<ul')
  })
})

describe('ShareButton', () => {
  it('steht in der Kopfleiste jeder Seite', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools']}>
        <App />
      </MemoryRouter>,
    )
    // Reihenfolge: Suche, Favoriten, Teilen, Einstellungen
    const nav = html.slice(html.indexOf('<nav aria-label="Werkzeuge"'), html.indexOf('</nav>'))
    const order = ['aria-label="Suche"', 'aria-label="Favoriten"', 'aria-label="Seite teilen"', 'aria-label="Einstellungen"'].map((label) => nav.indexOf(label))
    expect(order.every((position) => position >= 0)).toBe(true)
    expect([...order].sort((a, b) => a - b)).toEqual(order)
    expect(renderToStaticMarkup(<ShareButton className="x" />)).toContain('role="status"')
  })
})

describe('TechBackdrop', () => {
  it('hat eine feste Höhe statt inset-0, damit das Bild am Handy beim Scrollen nicht springt', () => {
    const html = renderToStaticMarkup(<TechBackdrop />)
    expect(html).toContain('fixed inset-x-0 top-0 -z-10 h-backdrop')
    expect(html).not.toContain('inset-0 -z-10')
  })
})

describe('splitSources', () => {
  it('trennt an Semikolon und Satzende, aber nicht nach Abkürzungen, Ordnungszahlen oder in Klammern', () => {
    expect(
      splitSources(
        'Norm A, S. 12 (Abs. 3; Tab. 2). 1. BImSchV § 10 Abs. 1; Hersteller B, https://example.org/a.pdf. Abgerufen am 28.10.2026.',
      ),
    ).toEqual([
      // vor einer Zahl wird nicht getrennt, damit „1. BImSchV“ zusammenbleibt
      'Norm A, S. 12 (Abs. 3; Tab. 2). 1. BImSchV § 10 Abs. 1',
      'Hersteller B, https://example.org/a.pdf.',
      'Abgerufen am 28.10.2026.',
    ])
    expect(splitSources('z. B. Lüftung nach DIN 1946-6')).toEqual(['z. B. Lüftung nach DIN 1946-6'])
    expect(splitSources('  ')).toEqual([])
  })
})

describe('splitLinks', () => {
  it('trennt Text und Adressen und lässt Satzzeichen am Ende außen vor', () => {
    expect(splitLinks('Quelle: https://example.org/x, S. 3')).toEqual([
      { text: 'Quelle: ' },
      { text: 'https://example.org/x', href: 'https://example.org/x' },
      { text: ', S. 3' },
    ])
    expect(splitLinks('(siehe https://example.org/a_(b))')).toEqual([
      { text: '(siehe ' },
      { text: 'https://example.org/a_(b)', href: 'https://example.org/a_(b)' },
      { text: ')' },
    ])
    expect(splitLinks('ohne Adresse')).toEqual([{ text: 'ohne Adresse' }])
  })
})

describe('Slogan', () => {
  it('steht auf der Startseite und hebt „Heizungsbauern“ hervor', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <HomePage />
      </MemoryRouter>,
    )
    expect(html).toContain(
      'Von <span class="text-accent">Heizungsbauern</span>, für <span class="text-accent">Heizungsbauern</span>!',
    )
    expect(renderToStaticMarkup(<Slogan />).replace(/<[^>]+>/g, '')).toBe('Von Heizungsbauern, für Heizungsbauern!')
  })
})

describe('ContentPage', () => {
  it('zeigt bei Entwürfen den Ungeprüft-Hinweis und immer die Quelle', () => {
    const html = renderToStaticMarkup(
      <ContentPage entry={draft} title="Titel">
        Inhalt
      </ContentPage>,
    )
    expect(html).toContain('Ungeprüft:')
    expect(html).toContain('Quelle')
  })

  it('zeigt bei geprüften Einträgen keinen Ungeprüft-Hinweis', () => {
    const html = renderToStaticMarkup(
      <ContentPage entry={verified} title="Titel">
        Inhalt
      </ContentPage>,
    )
    expect(html).not.toContain('Ungeprüft')
    expect(html).toContain('15.01.2026 (TS)')
  })
})
