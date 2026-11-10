// Ruft die Marktpreise für den Heizkosten-Vergleich ab und schreibt public/prices.json.
// Läuft täglich in der GitHub-Pages-Action vor dem Build; lokal: npm run prices
// Schlägt nie fehl: eine nicht erreichbare oder unlesbare Quelle wird übersprungen und gemeldet; die App nimmt dann
// den im Inhalt hinterlegten Preis.

import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import {
  findOilBulletinLink,
  isPlausible,
  LIVE_PRICE_SOURCES,
  parseCarmenWoodChips,
  parseDepiPellets,
  parseEurostat,
  parseOilBulletin,
  PRICES_FILE,
  type LivePrice,
  type LivePriceKey,
  type PricesData,
} from '../src/modules/tools/heatingCostSources.ts'
import { readXlsxRows } from './xlsx.ts'

const TIMEOUT_MS = 30_000
const HEADERS = { 'user-agent': 'SHK-Assistant Preise (+https://github.com/XxRexRaptorxX/SHK-Assistant)' }
const outFile = fileURLToPath(new URL(`../public/${PRICES_FILE}`, import.meta.url))

async function get(url: string): Promise<Response> {
  const response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(TIMEOUT_MS) })
  if (!response.ok) throw new Error(`HTTP ${response.status} bei ${url}`)
  return response
}

/** Eurostat-Statistik-API: Deutschland, Haushalte, alle Steuern, Euro je kWh, die letzten zwei Halbjahre */
const eurostat = (dataset: string, band: string) => async () =>
  parseEurostat(
    await (
      await get(
        `https://ec.europa.eu/eurostat/api/dissemination/statistics/1.0/data/${dataset}?geo=DE&nrg_cons=${band}&tax=I_TAX&currency=EUR&unit=KWH&lastTimePeriod=2&lang=de`,
      )
    ).json(),
  )

const fetchers: Record<LivePriceKey, () => Promise<LivePrice | undefined>> = {
  eurostatGas: eurostat('nrg_pc_202', 'GJ20-199'),
  eurostatElectricity: eurostat('nrg_pc_204', 'KWH2500-4999'),
  oilBulletin: async () => {
    const page = LIVE_PRICE_SOURCES.oilBulletin.url
    const link = findOilBulletinLink(await (await get(page)).text(), page)
    if (!link) throw new Error('Link „Prices with taxes latest prices“ nicht gefunden')
    return parseOilBulletin(readXlsxRows(new Uint8Array(await (await get(link)).arrayBuffer())))
  },
  depiPellets: async () => parseDepiPellets(await (await get(LIVE_PRICE_SOURCES.depiPellets.url)).text()),
  carmenWoodChips: async () => parseCarmenWoodChips(await (await get(LIVE_PRICE_SOURCES.carmenWoodChips.url)).text()),
}

const result: PricesData = { generatedAt: new Date().toISOString(), prices: {}, failed: [] }
for (const key of Object.keys(fetchers) as LivePriceKey[]) {
  const source = LIVE_PRICE_SOURCES[key]
  try {
    const price = await fetchers[key]()
    if (!price) throw new Error('Preis nicht gefunden (Seite geändert?)')
    if (!isPlausible(key, price.value)) throw new Error(`unplausibler Wert ${price.value} €/${source.unit}`)
    result.prices[key] = price
    console.log(`${source.publisher}: ${price.value} €/${source.unit} (${price.period})`)
  } catch (error) {
    result.failed.push(key)
    console.warn(`${source.publisher} (${key}): nicht abrufbar (${error instanceof Error ? error.message : String(error)})`)
  }
}

writeFileSync(outFile, JSON.stringify(result, null, 2))
console.log(`${Object.keys(result.prices).length} Preise → public/${PRICES_FILE}`)
