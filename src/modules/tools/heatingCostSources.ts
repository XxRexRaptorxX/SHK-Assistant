// Marktpreise für den Heizkosten-Vergleich. tools/fetch-prices.ts ruft die Quellen täglich in der
// GitHub-Pages-Action ab und schreibt public/prices.json; die App liest nur diese Datei (offline vorgecacht).
// Ohne zod-Import, damit die App die Konstanten nutzen kann, ohne zod zu bündeln.
//
// Die Parser hier sind reine Textfunktionen ohne Netzzugriff, damit sie sich mit Beispieldaten testen lassen.

/** Datei mit den abgerufenen Preisen, erzeugt von tools/fetch-prices.ts (nicht im Repository) */
export const PRICES_FILE = 'prices.json'

export interface LivePriceSource {
  /** Herausgeber, z. B. „Eurostat“ */
  publisher: string
  /** Was genau erhoben wird */
  description: string
  /** Einheit (key aus units im Inhalt), auf die sich der Preis bezieht */
  unit: string
  /** Seite für Menschen (Link in der App) */
  url: string
  /** Plausibler Bereich in Euro je Einheit: Schutz gegen falsch gelesene Seiten, keine Fachangabe */
  plausible: readonly [number, number]
}

export const LIVE_PRICE_SOURCES = {
  eurostatGas: {
    publisher: 'Eurostat',
    description:
      'Erdgaspreis für Haushalte in Deutschland, Verbrauchsband D2 (20–199 GJ), alle Steuern und Abgaben, Bezug Brennwert; Halbjahreswert (Datensatz nrg_pc_202)',
    unit: 'kWhHs',
    url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_202/default/table?lang=de',
    plausible: [0.02, 1],
  },
  eurostatElectricity: {
    publisher: 'Eurostat',
    description:
      'Strompreis für Haushalte in Deutschland, Verbrauchsband DC (2.500–4.999 kWh), alle Steuern und Abgaben; Halbjahreswert (Datensatz nrg_pc_204)',
    unit: 'kWh',
    url: 'https://ec.europa.eu/eurostat/databrowser/view/nrg_pc_204/default/table?lang=de',
    plausible: [0.05, 2],
  },
  oilBulletin: {
    publisher: 'Europäische Kommission, Weekly Oil Bulletin',
    description: 'Heizölpreis Deutschland inkl. Steuern; Wochenwert',
    unit: 'l',
    url: 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en',
    plausible: [0.2, 5],
  },
  depiPellets: {
    publisher: 'Deutsches Pelletinstitut (DEPI)',
    description: 'DEPI-Pelletpreis Deutschland, ENplus A1, 6 t lose, Lieferung im Umkreis von 50 km, inkl. Nebenkosten und MwSt.; Monatswert',
    unit: 't',
    url: 'https://www.depi.de/pelletpreis-wirtschaftlichkeit/',
    plausible: [50, 2000],
  },
  carmenWoodChips: {
    publisher: 'C.A.R.M.E.N. e.V.',
    description:
      'Preisindex Waldhackschnitzel, Mittelwert Deutschland, Wassergehalt 20 %, 30 Srm, Lieferung im Umkreis von 20 km, brutto; Quartalswert',
    unit: 't',
    url: 'https://www.carmen-ev.de/service/marktueberblick-erneuerbare-energien/marktpreise-energieholz/marktpreise-hackschnitzel/',
    plausible: [20, 1000],
  },
} as const satisfies Record<string, LivePriceSource>

export type LivePriceKey = keyof typeof LIVE_PRICE_SOURCES

export interface LivePrice {
  /** Euro je Einheit der Quelle */
  value: number
  /** Zeitraum laut Quelle, z. B. „1. Halbjahr 2026“ */
  period: string
}

export interface PricesData {
  /** ISO-Zeitstempel des Abrufs */
  generatedAt: string
  prices: Partial<Record<LivePriceKey, LivePrice>>
  /** Quellen, die beim letzten Abruf nicht erreichbar oder nicht lesbar waren */
  failed: LivePriceKey[]
}

const isLivePriceKey = (value: unknown): value is LivePriceKey => typeof value === 'string' && value in LIVE_PRICE_SOURCES

/** Liegt der Preis im plausiblen Bereich der Quelle? */
export function isPlausible(key: LivePriceKey, value: number): boolean {
  const [min, max] = LIVE_PRICE_SOURCES[key].plausible
  return Number.isFinite(value) && value >= min && value <= max
}

/** Prüft die geladene prices.json; unbrauchbare Einträge entfallen */
export function parsePricesData(raw: unknown): PricesData | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const record = raw as Record<string, unknown>
  if (typeof record.generatedAt !== 'string' || typeof record.prices !== 'object' || record.prices === null) return undefined
  const prices: PricesData['prices'] = {}
  for (const [key, value] of Object.entries(record.prices as Record<string, unknown>)) {
    if (!isLivePriceKey(key) || typeof value !== 'object' || value === null) continue
    const entry = value as Record<string, unknown>
    if (typeof entry.value !== 'number' || !isPlausible(key, entry.value)) continue
    prices[key] = { value: entry.value, period: typeof entry.period === 'string' ? entry.period : '' }
  }
  const failed = Array.isArray(record.failed) ? record.failed.filter(isLivePriceKey) : []
  return { generatedAt: record.generatedAt, prices, failed }
}

// ---------------------------------------------------------------------------------------------------------------
// Parser für tools/fetch-prices.ts

/** Deutsche Zahl aus einer Tabelle, z. B. „1.234,56“ oder „464,61 €/t“ */
export function parseGermanNumber(input: string): number | undefined {
  const match = /-?\d{1,3}(?:\.\d{3})*(?:,\d+)?|-?\d+(?:,\d+)?/.exec(input.replace(/\s/g, ''))
  if (!match) return undefined
  const value = Number(match[0].replace(/\./g, '').replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
}

const halfYear = (time: string) => {
  const match = /^(\d{4})-S([12])$/.exec(time)
  return match ? `${match[2]}. Halbjahr ${match[1]}` : time
}

/**
 * Eurostat-Statistik-API (JSON-stat 2.0), abgefragt für genau ein Land, Band, Steuer und Währung:
 * der jüngste Halbjahreswert mit Zahl.
 */
export function parseEurostat(raw: unknown): LivePrice | undefined {
  if (typeof raw !== 'object' || raw === null) return undefined
  const data = raw as { value?: Record<string, number | null>; dimension?: { time?: { category?: { index?: Record<string, number> } } } }
  const timeIndex = data.dimension?.time?.category?.index
  if (!data.value || !timeIndex) return undefined
  const times = Object.entries(timeIndex).sort((a, b) => b[1] - a[1])
  for (const [time, index] of times) {
    const value = data.value[String(index)]
    if (typeof value === 'number' && value > 0) return { value, period: halfYear(time) }
  }
  return undefined
}

/** Excel-Datum (Tage seit 30.12.1899) als TT.MM.JJJJ */
export function excelDateText(serial: number): string {
  const date = new Date(Date.UTC(1899, 11, 30) + Math.round(serial) * 86_400_000)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getUTCDate())}.${pad(date.getUTCMonth() + 1)}.${date.getUTCFullYear()}`
}

/**
 * Weekly Oil Bulletin „Prices with taxes“, erstes Blatt als Zeilen (Zelltexte):
 * Zeile 1 Überschriften (Spalte „Heating gas oil“), Zeile 2 Datum (Excel-Zahl) und Einheiten (1000 l),
 * danach je Land eine Zeile. Liefert Euro je Liter.
 */
export function parseOilBulletin(rows: string[][]): LivePrice | undefined {
  const [header, units] = rows
  if (!header || !units) return undefined
  const column = header.findIndex((cell) => /heating gas oil/i.test(cell))
  if (column === -1 || !/^1000\s*l$/i.test(units[column]?.trim() ?? '')) return undefined
  const germany = rows.find((row) => /^(germany|deutschland)$/i.test(row[0]?.trim() ?? ''))
  const perThousand = Number(germany?.[column])
  const serial = Number(units[0])
  if (!(perThousand > 0) || !Number.isFinite(perThousand)) return undefined
  return { value: perThousand / 1000, period: Number.isFinite(serial) && serial > 40_000 ? `Woche ab ${excelDateText(serial)}` : '' }
}

const decodeEntities = (value: string) =>
  value
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))

const cellText = (html: string) => decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim()

/** Alle Tabellen einer Seite als Überschriften und Zeilen (Zelltexte) */
export function htmlTables(html: string): { headers: string[]; rows: string[][] }[] {
  return [...html.matchAll(/<table\b[\s\S]*?<\/table>/gi)].map(([table]) => {
    const head = /<thead\b[\s\S]*?<\/thead>/i.exec(table)?.[0] ?? ''
    const headers = [...head.matchAll(/<th\b[^>]*>([\s\S]*?)<\/th>/gi)].map((match) => cellText(match[1]!))
    const body = table.replace(/<thead\b[\s\S]*?<\/thead>/i, '')
    const rows = [...body.matchAll(/<tr\b[\s\S]*?<\/tr>/gi)]
      .map(([row]) => [...row.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((match) => cellText(match[1]!)))
      .filter((cells) => cells.length > 0)
    return { headers, rows }
  })
}

/** DEPI-Seite „Pelletpreis & Wirtschaftlichkeit“: Tabelle „Aktueller Pelletpreis“ mit Monat und Preis für 6 t */
export function parseDepiPellets(html: string): LivePrice | undefined {
  for (const table of htmlTables(html)) {
    const row = table.rows.find((cells) => /pelletpreis\s+6\s+tonnen/i.test(cells[0] ?? ''))
    if (!row || !/€\s*\/\s*t/.test(row[1] ?? '')) continue
    const value = parseGermanNumber(row[1]!)
    const period = table.headers.find((cell) => /\b(19|20)\d{2}\b/.test(cell)) ?? ''
    if (value !== undefined && value > 0) return { value, period }
  }
  return undefined
}

/**
 * C.A.R.M.E.N.-Seite „Marktpreise Hackschnitzel“: Tabelle der aktuellen Preise (Region, Statistik, Quartal, Jahr,
 * Wassergehalt 35 %, Wassergehalt 20 % …). Genommen wird der Mittelwert „Gesamt“ des jüngsten Quartals, brutto.
 */
export function parseCarmenWoodChips(html: string): LivePrice | undefined {
  for (const table of htmlTables(html)) {
    const index = (name: string) => table.headers.findIndex((cell) => cell === name)
    const [region, statistic, quarter, year, price] = ['Region', 'Statistik', 'Quartal_Zahl', 'Jahr', 'Wassergehalt 20 %'].map(index)
    if ([region, statistic, quarter, year, price].some((column) => column === -1)) continue
    const candidates = table.rows
      .filter((cells) => cells[region!] === 'Gesamt' && cells[statistic!] === 'Mittelwert')
      .map((cells) => ({ year: Number(cells[year!]), quarter: Number(cells[quarter!]), value: parseGermanNumber(cells[price!] ?? '') }))
      .filter((entry) => entry.year > 2000 && entry.quarter >= 1 && entry.quarter <= 4 && entry.value !== undefined && entry.value > 0)
      .sort((a, b) => b.year - a.year || b.quarter - a.quarter)
    const latest = candidates[0]
    if (latest) return { value: latest.value!, period: `${latest.quarter}. Quartal ${latest.year}` }
  }
  return undefined
}

/** Seite des Weekly Oil Bulletin: Link zur Datei „Prices with taxes latest prices (xlsx)“, als volle Adresse */
export function findOilBulletinLink(html: string, pageUrl: string): string | undefined {
  for (const [anchor] of html.matchAll(/<a\s[^>]*>/gi)) {
    if (!/prices with taxes latest prices/i.test(anchor)) continue
    const href = /href="([^"]+)"/i.exec(anchor)?.[1]
    if (href) return new URL(decodeEntities(href), pageUrl).href
  }
  return undefined
}
