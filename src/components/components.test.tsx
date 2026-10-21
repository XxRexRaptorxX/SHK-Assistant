import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BaseEntry } from '../content/schema/base'
import { formatIsoDate } from '../lib/format'
import { ContentPage } from './ContentPage'
import { DraftBadge } from './DraftBadge'
import { RichText } from './RichText'
import { SourceInfo } from './SourceInfo'

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
