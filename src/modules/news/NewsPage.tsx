import { useEffect, useState } from 'react'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { pageTitle } from '../../components/headings'
import { listCard } from '../../components/surfaces'
import { content } from '../../content'
import { usePageTitle } from '../../lib/usePageTitle'
import { NEWS_FILE } from './constants'
import { safeLink, type NewsItem } from './parseFeed'
import type { NewsFeedEntry } from './schema'

export interface NewsData {
  /** ISO-Zeitstempel des Abrufs */
  generatedAt: string
  items: NewsItem[]
  /** Anbieter, die beim letzten Abruf nicht erreichbar waren */
  failed: string[]
}

type NewsState = { status: 'loading' } | { status: 'ready'; data: NewsData } | { status: 'missing' }

const isString = (value: unknown): value is string => typeof value === 'string'

/** Prüft die geladene Datei; kaputte Einträge und Links, die nicht http(s) sind, entfallen */
export function parseNewsData(raw: unknown): NewsData | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const record = raw as Record<string, unknown>
  if (!isString(record.generatedAt) || !Array.isArray(record.items)) return undefined
  const items = record.items.flatMap((value: unknown): NewsItem[] => {
    if (typeof value !== 'object' || value === null) return []
    const item = value as Record<string, unknown>
    const link = isString(item.link) ? safeLink(item.link) : undefined
    if (!isString(item.title) || !link || !isString(item.date) || !isString(item.source)) return []
    return [{ title: item.title, link, date: item.date, source: item.source }]
  })
  const failed = Array.isArray(record.failed) ? record.failed.filter(isString) : []
  return { generatedAt: record.generatedAt, items, failed }
}

function useNews(): NewsState {
  const [state, setState] = useState<NewsState>({ status: 'loading' })
  useEffect(() => {
    let active = true
    fetch(`${import.meta.env.BASE_URL}${NEWS_FILE}`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then((raw: unknown) => {
        const data = parseNewsData(raw)
        if (active) setState(data ? { status: 'ready', data } : { status: 'missing' })
      })
      .catch(() => {
        if (active) setState({ status: 'missing' })
      })
    return () => {
      active = false
    }
  }, [])
  return state
}

const dateFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  timeZone: 'Europe/Berlin',
})
const dateTimeFormat = new Intl.DateTimeFormat('de-DE', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: 'Europe/Berlin',
})

const formatDate = (iso: string, format = dateFormat) => (iso ? format.format(new Date(iso)) : '')

export function NewsPage({ feeds = content.newsFeeds }: { feeds?: NewsFeedEntry[] }) {
  usePageTitle(modules.news.title)
  const state = useNews()
  return (
    <>
      <h1 className={pageTitle}>{modules.news.title}</h1>
      {state.status === 'loading' && <p className="mt-3 text-muted">News werden geladen …</p>}
      {state.status === 'missing' && <p className="mt-3">Noch keine News vorhanden.</p>}
      {state.status === 'ready' && <NewsList data={state.data} />}
      <NewsSources feeds={feeds} />
    </>
  )
}

/** Nur Überschrift, Datum und Quelle; der Artikel öffnet sich beim Anbieter */
export function NewsList({ data }: { data: NewsData }) {
  return (
    <>
      <p className="mt-2 text-base text-muted">
        Täglich aktualisiert · Stand: {formatDate(data.generatedAt, dateTimeFormat)} Uhr
      </p>
      {data.failed.length > 0 && (
        <p role="alert" className="mt-3 rounded-xl bg-warn p-2 font-semibold text-warn-ink">
          Beim letzten Abruf nicht erreichbar: {data.failed.join(', ')}
        </p>
      )}
      {data.items.length === 0 ? (
        <p className="mt-4">Keine aktuellen Meldungen.</p>
      ) : (
        <ul className={`mt-4 ${listCard}`}>
          {data.items.map((item) => (
            <li key={item.link}>
              <a
                href={item.link}
                target="_blank"
                rel="noopener noreferrer"
                className="flex min-h-14 flex-col justify-center gap-0.5 px-4 py-3"
              >
                <span className="font-semibold">{item.title}</span>
                <span className="text-base text-muted">
                  {item.source}
                  {item.date && ` · ${formatDate(item.date)}`}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

function NewsSources({ feeds }: { feeds: readonly NewsFeedEntry[] }) {
  if (feeds.length === 0) return null
  return (
    <footer className="mt-8 border-t-2 border-line pt-4 text-base text-muted">
      <p>
        <span className="font-semibold">Quellen: </span>
        {feeds.map((feed, index) => (
          <span key={feed.id}>
            {index > 0 && ', '}
            <a href={feed.website} target="_blank" rel="noopener noreferrer" className="text-accent underline">
              {feed.name}
            </a>
            {feed.status === 'draft' && (
              <span className="ml-2 align-middle">
                <DraftBadge variant="inline" />
              </span>
            )}
          </span>
        ))}
      </p>
      <p className="mt-1">Angezeigt werden nur Überschriften. Der Artikel öffnet sich auf der Seite des Anbieters.</p>
    </footer>
  )
}
