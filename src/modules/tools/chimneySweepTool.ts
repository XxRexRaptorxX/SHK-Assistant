import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { normalizeForSearch } from '../../lib/text.ts'

// Bezirksschornsteinfeger-Tools ("kind": "chimneySweepFinder"): Adresse eingeben oder per GPS ermitteln, das Tool
// nennt die Suchportale des Bundeslands und übergibt die Adresse direkt an die Suche, wo das Portal es zulässt.
// Es gibt keine bundesweite Datenquelle; das Tool zeigt nie selbst einen Schornsteinfeger an, sondern verlinkt nur.

/** Bundesländer als Kürzel nach ISO 3166-2:DE, wie sie der Geocoder (Nominatim) liefert */
export const STATE_CODES = [
  'DE-BW', 'DE-BY', 'DE-BE', 'DE-BB', 'DE-HB', 'DE-HH', 'DE-HE', 'DE-MV',
  'DE-NI', 'DE-NW', 'DE-RP', 'DE-SL', 'DE-SN', 'DE-ST', 'DE-SH', 'DE-TH',
] as const

export type StateCode = (typeof STATE_CODES)[number]

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const url = z.string().regex(/^https?:\/\/[^\s]+$/, 'url: http(s)-Adresse erwartet')

/** Platzhalter in query: werden mit den Feldern der Adresse gefüllt */
export const ADDRESS_FIELDS = ['street', 'houseNumber', 'postcode', 'city'] as const
export type AddressField = (typeof ADDRESS_FIELDS)[number]
export type Address = Record<AddressField, string>

export const EMPTY_ADDRESS: Address = { street: '', houseNumber: '', postcode: '', city: '' }

const portalSchema = z.strictObject({
  key,
  /** Beschriftung, z. B. „BayernAtlas: Kehrbezirke“ */
  label: z.string().trim().min(1),
  /** Einstiegsseite des Portals; wird geöffnet, wenn sich die Adresse nicht übergeben lässt */
  url,
  /** Adresse der Suche mit {query} an der Stelle des Suchtexts; fehlt, wenn das Portal keine Übergabe zulässt */
  searchUrl: url.optional(),
  /**
   * Suchtext aus den Platzhaltern {street}, {houseNumber}, {postcode}, {city}, z. B. „{street} {houseNumber}“.
   * Mit searchUrl wird er übergeben, ohne searchUrl zum Kopieren angezeigt (was man im Portal eingibt).
   */
  query: z.string().trim().optional(),
  /** Nur für diese Orte zuständig, z. B. ["München"]; leer: ganzes Bundesland */
  cities: z.array(z.string().trim().min(1)).default([]),
  /** Was man im Portal tun muss, z. B. „Suchtreffer antippen, dann den Kehrbezirk anklicken“ */
  note: z.string().trim().default(''),
})

const stateSchema = z.strictObject({
  code: z.enum(STATE_CODES),
  name: z.string().trim().min(1),
  portals: z.array(portalSchema).default([]),
  /** Wo man ohne Online-Suche nachfragt, z. B. „Landratsamt, in kreisfreien Städten die Stadtverwaltung“ */
  authority: z.string().trim().default(''),
  /** Beginnt mit „TODO: Inhalt fehlt“, solange die zuständige Stelle nicht belegt ist */
  todo: z.string().trim().default(''),
})

export const chimneySweepToolSchema = defineEntrySchema({
  kind: z.literal('chimneySweepFinder'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  keywords: z.array(z.string().trim().min(1)).default([]),
  /** Hinweis beim GPS- und Adress-Abgleich: welche Daten an wen gehen */
  geocoderNote: z.string().trim().min(1),
  closingNote: z.string().trim().min(1),
  states: z.array(stateSchema).min(1),
})

export type ChimneySweepTool = z.output<typeof chimneySweepToolSchema>
export type SweepState = ChimneySweepTool['states'][number]
export type SweepPortal = SweepState['portals'][number]

const PLACEHOLDER = /\{(\w+)\}/g

/** Suchtext eines Portals; undefined, wenn außer der Hausnummer ein Feld fehlt */
export function fillQuery(template: string, address: Address): string | undefined {
  let complete = true
  const text = template.replace(PLACEHOLDER, (_, field: string) => {
    const value = (address[field as AddressField] ?? '').trim()
    if (value === '' && field !== 'houseNumber') complete = false
    return value
  })
  const query = text.replace(/\s+/g, ' ').trim()
  return complete && query !== '' ? query : undefined
}

/** Adresse, die der Knopf öffnet: mit übergebener Suche, sonst die Einstiegsseite */
export function portalLink(portal: SweepPortal, address: Address): { href: string; prefilled: boolean } {
  const query = portal.searchUrl && portal.query ? fillQuery(portal.query, address) : undefined
  if (portal.searchUrl && query) {
    return { href: portal.searchUrl.replaceAll('{query}', encodeURIComponent(query)), prefilled: true }
  }
  return { href: portal.url, prefilled: false }
}

/** Text zum Eintippen im Portal, wenn es keine Übergabe gibt */
export function copyText(portal: SweepPortal, address: Address): string | undefined {
  return !portal.searchUrl && portal.query ? fillQuery(portal.query, address) : undefined
}

export function findState(tool: ChimneySweepTool, code: string): SweepState | undefined {
  return tool.states.find((state) => state.code === code)
}

/**
 * Portale des Bundeslands für den Ort: passende Stadt-Portale vorn, dann die landesweiten.
 * Stadt-Portale anderer Orte stehen in others (falls der Ort falsch geschrieben ist).
 */
export function portalsFor(state: SweepState, city: string): { matching: SweepPortal[]; others: SweepPortal[] } {
  const needle = normalizeForSearch(city.trim())
  const inCity = (portal: SweepPortal) => needle !== '' && portal.cities.some((name) => normalizeForSearch(name) === needle)
  return {
    matching: [...state.portals.filter(inCity), ...state.portals.filter((portal) => portal.cities.length === 0)],
    others: state.portals.filter((portal) => portal.cities.length > 0 && !inCity(portal)),
  }
}

export function formatAddress(address: Address): string {
  const street = [address.street, address.houseNumber].map((part) => part.trim()).filter(Boolean).join(' ')
  const place = [address.postcode, address.city].map((part) => part.trim()).filter(Boolean).join(' ')
  return [street, place].filter(Boolean).join(', ')
}

// ---- Geocoder (OpenStreetMap Nominatim) ----

const NOMINATIM = 'https://nominatim.openstreetmap.org'

export function reverseGeocodeUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'de',
    zoom: '18',
    lat: lat.toFixed(6),
    lon: lon.toFixed(6),
  })
  return `${NOMINATIM}/reverse?${params}`
}

export function searchGeocodeUrl(address: Address): string {
  const params = new URLSearchParams({
    format: 'jsonv2',
    addressdetails: '1',
    'accept-language': 'de',
    countrycodes: 'de',
    limit: '1',
  })
  const street = [address.houseNumber, address.street].map((part) => part.trim()).filter(Boolean).join(' ')
  if (street) params.set('street', street)
  if (address.postcode.trim()) params.set('postalcode', address.postcode.trim())
  if (address.city.trim()) params.set('city', address.city.trim())
  return `${NOMINATIM}/search?${params}`
}

export interface GeocodedPlace {
  address: Address
  stateCode?: StateCode
  /** Landkreis bzw. kreisfreie Stadt, für die Behördenauskunft */
  district: string
}

const geocodeSchema = z.object({
  address: z.record(z.string(), z.string()).optional(),
})

/** Ergebnis von Nominatim (reverse: ein Objekt, search: Liste) in Adresse und Bundesland umwandeln */
export function parseGeocode(json: unknown): GeocodedPlace | undefined {
  const first = Array.isArray(json) ? json[0] : json
  const parsed = geocodeSchema.safeParse(first)
  const raw = parsed.success ? parsed.data.address : undefined
  if (!raw) return undefined
  const city = raw.city ?? raw.town ?? raw.village ?? raw.municipality ?? ''
  const code = raw['ISO3166-2-lvl4']
  return {
    address: { street: raw.road ?? '', houseNumber: raw.house_number ?? '', postcode: raw.postcode ?? '', city },
    stateCode: (STATE_CODES as readonly string[]).includes(code ?? '') ? (code as StateCode) : undefined,
    district: raw.county ?? city,
  }
}

// ---- Prüfung beim Build ----

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkChimneySweepTool(tool: ChimneySweepTool): string[] {
  const issues: string[] = []
  const codes = tool.states.map((state) => state.code)
  for (const code of duplicates(codes)) issues.push(`states: ${code} doppelt`)
  for (const code of STATE_CODES) if (!codes.includes(code)) issues.push(`states: ${code} fehlt`)
  for (const state of tool.states) {
    const where = `states (${state.name})`
    for (const value of duplicates(state.portals.map((portal) => portal.key))) issues.push(`${where}: portal key "${value}" doppelt`)
    if (state.portals.length === 0 && state.authority === '' && state.todo === '') {
      issues.push(`${where}: weder Portal noch zuständige Stelle noch TODO`)
    }
    if (state.todo !== '' && !state.todo.startsWith('TODO: Inhalt fehlt')) issues.push(`${where}: todo muss mit „TODO: Inhalt fehlt“ beginnen`)
    if (state.todo !== '' && tool.status === 'verified') issues.push(`${where}: TODO bei status "verified"`)
    for (const portal of state.portals) {
      const at = `${where}, ${portal.key}`
      if (portal.searchUrl && !portal.searchUrl.includes('{query}')) issues.push(`${at}: searchUrl ohne {query}`)
      if (portal.searchUrl && !portal.query) issues.push(`${at}: searchUrl ohne query`)
      for (const [, field] of (portal.query ?? '').matchAll(PLACEHOLDER)) {
        if (!(ADDRESS_FIELDS as readonly string[]).includes(field!)) issues.push(`${at}: unbekannter Platzhalter {${field}}`)
      }
    }
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function chimneySweepKeywords(tool: ChimneySweepTool): string[] {
  return [...tool.keywords, ...tool.states.map((state) => state.name)]
}
