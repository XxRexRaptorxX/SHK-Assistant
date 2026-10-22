// Liest Überschrift, Link und Datum aus RSS- und Atom-Feeds. Bewusst ohne XML-Bibliothek:
// mehr als diese drei Angaben wird nicht gebraucht (nur Überschrift, Datum, Quelle, Link).
// Wird auch von tools/fetch-news.ts geladen: ohne Importe aus dem App-Code.

export interface NewsItem {
  title: string
  /** Immer http(s) */
  link: string
  /** ISO-Zeitstempel; leer, wenn der Feed kein lesbares Datum liefert */
  date: string
  /** Name des Anbieters */
  source: string
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' }

/** CDATA auspacken, Tags entfernen, Entitäten auflösen, Leerraum zusammenfassen */
export function cleanText(raw: string): string {
  return raw
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]*>/g, '')
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
      if (code.startsWith('#x') || code.startsWith('#X')) return String.fromCodePoint(parseInt(code.slice(2), 16))
      if (code.startsWith('#')) return String.fromCodePoint(Number(code.slice(1)))
      return ENTITIES[code.toLowerCase()] ?? match
    })
    .replace(/\s+/g, ' ')
    .trim()
}

function tagContent(xml: string, tag: string): string | undefined {
  const match = new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>`, 'i').exec(xml)
  return match?.[1]
}

/** Nur http(s)-Adressen, damit kein "javascript:" o. Ä. als Link landet */
export function safeLink(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  try {
    const url = new URL(cleanText(raw))
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : undefined
  } catch {
    return undefined
  }
}

function isoDate(raw: string | undefined): string {
  if (!raw) return ''
  const time = Date.parse(cleanText(raw))
  return Number.isNaN(time) ? '' : new Date(time).toISOString()
}

function atomLink(entry: string): string | undefined {
  const links = [...entry.matchAll(/<link\b([^>]*)\/?>/gi)].map((m) => m[1] ?? '')
  const alternate = links.find((attrs) => !/rel=/i.test(attrs) || /rel=["']alternate["']/i.test(attrs))
  return /href=["']([^"']+)["']/i.exec(alternate ?? '')?.[1]
}

/** Alle Meldungen eines Feeds; Einträge ohne Überschrift oder gültigen Link entfallen */
export function parseFeed(xml: string, source: string): NewsItem[] {
  const items: NewsItem[] = []
  for (const [, block = ''] of xml.matchAll(/<item\b[^>]*>([\s\S]*?)<\/item>/gi)) {
    const title = cleanText(tagContent(block, 'title') ?? '')
    const link = safeLink(tagContent(block, 'link'))
    const date = isoDate(tagContent(block, 'pubDate') ?? tagContent(block, 'dc:date'))
    if (title && link) items.push({ title, link, date, source })
  }
  for (const [, block = ''] of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/gi)) {
    const title = cleanText(tagContent(block, 'title') ?? '')
    const link = safeLink(atomLink(block))
    const date = isoDate(tagContent(block, 'published') ?? tagContent(block, 'updated'))
    if (title && link) items.push({ title, link, date, source })
  }
  return items
}

/** Neueste zuerst; Meldungen ohne Datum ans Ende */
export function sortNews(items: readonly NewsItem[]): NewsItem[] {
  return [...items].sort((a, b) => (b.date || '').localeCompare(a.date || ''))
}
