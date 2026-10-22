// Ruft die Branchen-Feeds aus content/news-feeds ab und schreibt public/news.json.
// Läuft täglich in der GitHub-Pages-Action vor dem Build; lokal: npm run news
// Schlägt nie fehl: ein nicht erreichbarer Feed wird übersprungen und gemeldet.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { collections } from '../src/content/collections.ts'
import { NEWS_FILE } from '../src/modules/news/constants.ts'
import { parseFeed, sortNews, type NewsItem } from '../src/modules/news/parseFeed.ts'
import type { NewsFeedEntry } from '../src/modules/news/schema.ts'
import { loadContent } from './content-loader.ts'

/** Pro Feed höchstens so viele Meldungen */
const MAX_PER_FEED = 30
const TIMEOUT_MS = 20_000

const contentDir = fileURLToPath(new URL('../content', import.meta.url))
const outFile = fileURLToPath(new URL(`../public/${NEWS_FILE}`, import.meta.url))

const feeds = loadContent({ contentDir, edition: 'public', collections }).data.newsFeeds as NewsFeedEntry[]

const items: NewsItem[] = []
const failed: string[] = []
for (const feed of feeds) {
  try {
    const response = await fetch(feed.url, {
      headers: { 'user-agent': 'SHK-Assistant News (+https://github.com/XxRexRaptorxX/SHK-Assistant)' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const found = sortNews(parseFeed(await response.text(), feed.name)).slice(0, MAX_PER_FEED)
    items.push(...found)
    console.log(`${feed.name}: ${found.length} Meldungen`)
  } catch (error) {
    failed.push(feed.name)
    console.warn(`${feed.name}: nicht abrufbar (${error instanceof Error ? error.message : String(error)})`)
  }
}

writeFileSync(outFile, JSON.stringify({ generatedAt: new Date().toISOString(), items: sortNews(items), failed }, null, 2))
console.log(`${items.length} Meldungen → public/${NEWS_FILE}`)
