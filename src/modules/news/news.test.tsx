import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { NewsList, parseNewsData, type NewsData } from './NewsPage'
import { cleanText, parseFeed, safeLink, sortNews } from './parseFeed'

const rss = `<?xml version="1.0"?><rss><channel><title>Kanal</title>
<item><title><![CDATA[Heizung &amp; Bad]]></title><link>https://example.de/a</link>
<pubDate>Thu, 22 Oct 2026 08:47:38 +0000</pubDate><description>Teaser wird ignoriert</description></item>
<item><title>Ohne Link</title></item>
<item><title>Böser Link</title><link>javascript:alert(1)</link></item>
<item><title>Wärmepumpe &#8211; neu</title><link>https://example.de/b</link></item>
</channel></rss>`

const atom = `<feed><title>Atom</title>
<entry><title type="html">Atom-Meldung</title><link rel="self" href="https://example.de/self"/>
<link rel="alternate" href="https://example.de/c"/><updated>2026-10-21T10:00:00Z</updated></entry></feed>`

describe('Feed lesen', () => {
  it('liest Überschrift, Link und Datum aus RSS, ohne Teaser', () => {
    expect(parseFeed(rss, 'Test')).toEqual([
      { title: 'Heizung & Bad', link: 'https://example.de/a', date: '2026-10-22T08:47:38.000Z', source: 'Test' },
      { title: 'Wärmepumpe – neu', link: 'https://example.de/b', date: '', source: 'Test' },
    ])
  })

  it('liest Atom-Einträge mit dem passenden Link', () => {
    expect(parseFeed(atom, 'A')).toEqual([
      { title: 'Atom-Meldung', link: 'https://example.de/c', date: '2026-10-21T10:00:00.000Z', source: 'A' },
    ])
  })

  it('lässt nur http(s)-Links zu und bereinigt Text', () => {
    expect(safeLink('javascript:alert(1)')).toBeUndefined()
    expect(safeLink('nicht url')).toBeUndefined()
    expect(safeLink(' https://example.de/x ')).toBe('https://example.de/x')
    expect(cleanText('<b>A</b>&nbsp;&quot;B&quot; &#x2013;\n C')).toBe('A "B" – C')
  })

  it('sortiert neueste zuerst, ohne Datum ans Ende', () => {
    const items = parseFeed(rss, 'T').concat(parseFeed(atom, 'A'))
    expect(sortNews(items).map((i) => i.link)).toEqual([
      'https://example.de/a',
      'https://example.de/c',
      'https://example.de/b',
    ])
  })
})

describe('News-Seite', () => {
  const data: NewsData = {
    generatedAt: '2026-10-22T04:00:00.000Z',
    items: [{ title: 'Meldung A', link: 'https://example.de/a', date: '2026-10-21T22:30:00.000Z', source: 'SI SHK' }],
    failed: [],
  }

  it('prüft die geladene Datei und verwirft unsichere Einträge', () => {
    expect(parseNewsData(null)).toBeUndefined()
    expect(parseNewsData({ items: [] })).toBeUndefined()
    const parsed = parseNewsData({
      ...data,
      items: [...data.items, { title: 'X', link: 'javascript:x', date: '', source: 'Y' }, 'kaputt'],
    })
    expect(parsed?.items).toEqual(data.items)
  })

  it('zeigt Überschrift, Quelle und Datum (deutsche Zeit) als externen Link', () => {
    const html = renderToStaticMarkup(<NewsList data={data} />)
    expect(html).toContain('href="https://example.de/a" target="_blank" rel="noopener noreferrer"')
    expect(html).toContain('>Meldung A</span>')
    expect(html).toContain('SI SHK · 22.10.2026')
    expect(html).toContain('Stand: 22.10.2026, 06:00 Uhr')
  })

  it('weist auf nicht erreichbare Anbieter und leere Listen hin', () => {
    const html = renderToStaticMarkup(<NewsList data={{ ...data, items: [], failed: ['SI SHK'] }} />)
    expect(html).toContain('Beim letzten Abruf nicht erreichbar: SI SHK')
    expect(html).toContain('Keine aktuellen Meldungen.')
  })

  it('hat eine Kachel auf der Startseite und nennt die Quellen', () => {
    const at = (path: string) =>
      renderToStaticMarkup(
        <MemoryRouter initialEntries={[path]}>
          <App />
        </MemoryRouter>,
      )
    expect(at('/')).toContain('Branchen-News, täglich aktualisiert')
    const page = at('/news')
    expect(page).toContain('News werden geladen')
    expect(page).toContain('href="https://www.si-shk.de"')
    expect(page).toContain('Angezeigt werden nur Überschriften')
  })
})
