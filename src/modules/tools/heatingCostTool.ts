import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { LIVE_PRICE_SOURCES, type LivePriceKey, type PricesData } from './heatingCostSources.ts'

// Heizkosten-Vergleich ("kind": "heatingCost"): Jahresverbrauch der eigenen (Referenz-)Heizung eingeben,
// daraus die Nutzwärme rechnen und für jedes andere Heizsystem Brennstoffmenge und Kosten pro Jahr zeigen.
//
// Rechenweg (alles auf den Heizwert Hi bezogen):
//   Nutzwärme      = Verbrauch × Heizwert je Einheit × Nutzungsgrad (bzw. JAZ) der Referenz
//   Brennstoff     = Nutzwärme ÷ Nutzungsgrad (bzw. JAZ) des Systems   (in kWh Hi)
//   Menge          = Brennstoff ÷ Heizwert je Preiseinheit
//   Kosten pro Jahr = Menge × Preis
// Erdgas wird nach Brennwert (Hs) abgerechnet; die Einheit „kWh Brennwert“ hat deshalb den Heizwert 1 kWh je 1,11 kWh.
//
// Die Heizwerte stehen nicht hier, sondern im Umrechner „Energieträger“ (content/converter, kind "factors", Bezugsgröße
// 1 kWh Heizwert). Jede Einheit nennt nur ihren Faktor dort; resolveHeatingCostTool() setzt beides zusammen.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)

const fuelUnitSchema = z.strictObject({
  /** z. B. "l", "kWhHs", "rm" */
  key,
  /** Kurzform für Ergebnisse, z. B. "l", "Rm", "kWh (Hs)" */
  symbol: text,
  /** Ausgeschrieben für Auswahl und Screenreader, z. B. „Liter“ */
  label: text,
  /** key des Faktors im Umrechner `heatingValues`, z. B. "heizoel-l" */
  factor: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'factor: nur a-z, 0-9 und Bindestriche'),
})

const fuelSchema = z.strictObject({
  key,
  name: text,
  units: z.array(fuelUnitSchema).min(1),
  price: z.strictObject({
    /** Einheit, auf die sich der Preis bezieht (key aus units) */
    unit: key,
    /** Standardpreis in Euro je Einheit; fehlt er, muss man selbst einen eintragen */
    value: z.number().positive().optional(),
    /** Zeitraum des Standardpreises, z. B. „Oktober 2026“ */
    period: z.string().trim().default(''),
    source: text,
    /** Solange der Standardpreis fehlt: beginnt mit „TODO: Inhalt fehlt“ */
    todo: z.string().trim().default(''),
  }),
  /** Aktueller Marktpreis aus public/prices.json (tools/fetch-prices.ts), falls abrufbar */
  live: z.enum(Object.keys(LIVE_PRICE_SOURCES) as [LivePriceKey, ...LivePriceKey[]]).optional(),
})

/** Einschätzung in Stufen 1 bis 3 (€, €€, €€€) */
const ratingSchema = z.number().int().min(1).max(3)

const systemSchema = z.strictObject({
  key,
  name: text,
  /** key des Energieträgers */
  fuel: key,
  efficiency: z.strictObject({
    /** Jahresnutzungsgrad (z. B. 0,9) bzw. Jahresarbeitszahl (z. B. 3,4) */
    value: z.number().positive(),
    kind: z.enum(['efficiency', 'performanceFactor']),
    source: text,
    /** Solange keine eigene Quelle vorliegt: beginnt mit „TODO: Inhalt fehlt“ */
    todo: z.string().trim().default(''),
  }),
  /** Anschaffung und Wartung im Vergleich, 1 = günstig, 3 = teuer */
  purchase: ratingSchema,
  maintenance: ratingSchema,
})

export const heatingCostToolSchema = defineEntrySchema({
  kind: z.literal('heatingCost'),
  title: text,
  summary: text,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  /** Hinweis am Ende, z. B. dass Grundpreise und Investitionen fehlen */
  closingNote: z.string().trim().default(''),
  /** id des Umrechners mit den Heizwerten (kind "factors", Bezugsgröße 1 kWh Heizwert), z. B. "converter.energietraeger" */
  heatingValues: text,
  fuels: z.array(fuelSchema).min(1),
  systems: z.array(systemSchema).min(2),
})

/** So, wie er in content/tools steht: Einheiten nur mit Verweis auf den Umrechner */
export type HeatingCostToolEntry = z.output<typeof heatingCostToolSchema>
type FuelEntry = HeatingCostToolEntry['fuels'][number]
export type HeatingSystem = HeatingCostToolEntry['systems'][number]

/** Einheit mit Heizwert aus dem Umrechner: `kWh` je `per` Einheiten */
export interface FuelUnit {
  key: string
  symbol: string
  label: string
  factor: string
  kWh: number
  per: number
  /** Quelle und Zusatz aus dem Umrechner */
  source: string
  note: string
}
export type Fuel = Omit<FuelEntry, 'units'> & { units: FuelUnit[] }
/** Fertig zum Rechnen: Heizwerte aus dem Umrechner eingesetzt */
export type HeatingCostTool = Omit<HeatingCostToolEntry, 'fuels'> & { fuels: Fuel[] }

/** Was der Heizkosten-Vergleich vom Umrechner braucht (ohne dessen Schema zu laden) */
export interface HeatingValueTable {
  id: string
  factors: readonly { key: string; value: number; per?: number; source?: string; note?: string }[]
}

export const CONTENT_MISSING = 'TODO: Inhalt fehlt'

export const findFuel = <F extends { key: string }>(tool: { fuels: F[] }, fuelKey: string) => tool.fuels.find((fuel) => fuel.key === fuelKey)
export const findUnit = <U extends { key: string }>(fuel: { units: U[] }, unitKey: string) => fuel.units.find((unit) => unit.key === unitKey)
export const priceUnit = (fuel: Fuel) => findUnit(fuel, fuel.price.unit)!

/** Heizwert Hi einer Einheit in kWh */
export const unitEnergy = (unit: FuelUnit) => unit.kWh / unit.per

/**
 * Setzt die Heizwerte aus dem Umrechner ein. Im Umrechner entsprechen `value` Einheiten `per` kWh Heizwert,
 * z. B. 1,96 l Flüssiggas = 12,87 kWh. Fehlt der Umrechner oder ein Faktor, gibt es einen Fehler mit allen Lücken.
 */
export function resolveHeatingCostTool(entry: HeatingCostToolEntry, table: HeatingValueTable | undefined): HeatingCostTool {
  if (!table || table.id !== entry.heatingValues) throw new Error(`Heizwerte „${entry.heatingValues}“ nicht gefunden`)
  const missing: string[] = []
  const fuels = entry.fuels.map((fuel) => ({
    ...fuel,
    units: fuel.units.map((unit): FuelUnit => {
      const factor = table.factors.find((candidate) => candidate.key === unit.factor)
      if (!factor) missing.push(unit.factor)
      return {
        ...unit,
        kWh: factor?.per ?? 1,
        per: factor?.value ?? 1,
        source: factor?.source ?? '',
        note: factor?.note ?? '',
      }
    }),
  }))
  if (missing.length > 0) throw new Error(`Faktor fehlt in „${table.id}“: ${missing.join(', ')}`)
  return { ...entry, fuels }
}

/** Nutzwärme in kWh aus dem Jahresverbrauch der Referenzheizung */
export function usefulHeat(amount: number, unit: FuelUnit, efficiency: number): number {
  return amount * unitEnergy(unit) * efficiency
}

export interface ComparisonInput {
  /** Nutzwärme in kWh pro Jahr */
  heat: number
  /** Preis je Energieträger in Euro je Preiseinheit; fehlt er, gibt es keine Kosten */
  prices: Record<string, number | undefined>
  /** Nutzungsgrad bzw. JAZ je System; fehlt einer, gilt der hinterlegte */
  efficiencies?: Record<string, number | undefined>
}

export interface ComparisonRow {
  system: HeatingSystem
  fuel: Fuel
  efficiency: number
  /** Brennstoffbedarf in kWh (Heizwert) */
  fuelEnergy: number
  /** Menge in der Preiseinheit, z. B. Liter */
  amount: number
  unit: FuelUnit
  price: number | undefined
  /** Euro pro Jahr; ohne Preis undefined */
  cost: number | undefined
  /** Euro je kWh Nutzwärme */
  costPerKWh: number | undefined
}

/** Brennstoffmenge und Kosten aller Systeme für dieselbe Nutzwärme */
export function compareSystems(tool: HeatingCostTool, input: ComparisonInput): ComparisonRow[] {
  return tool.systems.map((system) => {
    const fuel = findFuel(tool, system.fuel)!
    const unit = priceUnit(fuel)
    const efficiency = input.efficiencies?.[system.key] ?? system.efficiency.value
    const fuelEnergy = input.heat / efficiency
    const amount = fuelEnergy / unitEnergy(unit)
    const price = input.prices[fuel.key]
    return {
      system,
      fuel,
      efficiency,
      fuelEnergy,
      amount,
      unit,
      price,
      cost: price === undefined ? undefined : amount * price,
      costPerKWh: price === undefined ? undefined : price / unitEnergy(unit) / efficiency,
    }
  })
}

/** Nach Kosten aufsteigend; Systeme ohne Preis stehen am Ende in der Reihenfolge des Inhalts */
export function sortByCost(rows: ComparisonRow[]): ComparisonRow[] {
  return [...rows].sort((a, b) => (a.cost ?? Infinity) - (b.cost ?? Infinity))
}

/** Menge in einer anderen Einheit desselben Energieträgers, z. B. Pellets in kg statt t */
export function convertAmount(amount: number, from: FuelUnit, to: FuelUnit): number {
  return (amount * unitEnergy(from)) / unitEnergy(to)
}

export type PriceOrigin = 'own' | 'live' | 'content' | 'missing'

export interface ResolvedPrice {
  value: number | undefined
  origin: PriceOrigin
  /** Zeitraum des Preises, z. B. „Oktober 2026“ */
  period: string
  source: string
  url?: string
}

/** Welcher Preis gilt: eigener vor aktuellem Marktpreis vor hinterlegtem Standardpreis */
export function resolvePrice(fuel: Fuel, live: PricesData | undefined, own: number | undefined): ResolvedPrice {
  if (own !== undefined && own > 0) return { value: own, origin: 'own', period: '', source: 'eigener Preis' }
  const livePrice = fuel.live ? live?.prices[fuel.live] : undefined
  if (fuel.live && livePrice) {
    const source = LIVE_PRICE_SOURCES[fuel.live]
    return { value: livePrice.value, origin: 'live', period: livePrice.period, source: `${source.publisher}: ${source.description}`, url: source.url }
  }
  if (fuel.price.value !== undefined) {
    return { value: fuel.price.value, origin: 'content', period: fuel.price.period, source: fuel.price.source }
  }
  return { value: undefined, origin: 'missing', period: '', source: fuel.price.todo }
}

export function heatingCostKeywords(tool: HeatingCostToolEntry): string[] {
  return [
    ...tool.keywords,
    ...tool.fuels.map((fuel) => fuel.name),
    ...tool.systems.map((system) => system.name),
  ]
}

export function checkHeatingCostTool(tool: HeatingCostToolEntry): string[] {
  const issues: string[] = []
  const duplicates = (keys: string[]) => keys.filter((value, index) => keys.indexOf(value) !== index)

  for (const duplicate of duplicates(tool.fuels.map((fuel) => fuel.key))) issues.push(`fuels: key „${duplicate}“ doppelt`)
  for (const duplicate of duplicates(tool.systems.map((system) => system.key))) issues.push(`systems: key „${duplicate}“ doppelt`)

  for (const fuel of tool.fuels) {
    const where = `fuels (${fuel.key})`
    for (const duplicate of duplicates(fuel.units.map((unit) => unit.key))) issues.push(`${where}: Einheit „${duplicate}“ doppelt`)
    if (!findUnit(fuel, fuel.price.unit)) issues.push(`${where}: price.unit „${fuel.price.unit}“ ist keine Einheit des Energieträgers`)
    if (fuel.price.value === undefined && !fuel.price.todo.startsWith(CONTENT_MISSING)) {
      issues.push(`${where}: ohne price.value muss price.todo mit „${CONTENT_MISSING}“ beginnen`)
    }
    if (fuel.price.value !== undefined && fuel.price.todo) issues.push(`${where}: price.todo gesetzt, obwohl ein Preis hinterlegt ist`)
    if (fuel.price.value !== undefined && !fuel.price.period) issues.push(`${where}: price.period fehlt (Zeitraum des Preises)`)
    if (fuel.price.todo && tool.status === 'verified') issues.push(`${where}: price.todo bei verified nicht erlaubt`)
    if (fuel.live && LIVE_PRICE_SOURCES[fuel.live].unit !== fuel.price.unit) {
      issues.push(`${where}: live „${fuel.live}“ liefert Preise je „${LIVE_PRICE_SOURCES[fuel.live].unit}“, price.unit ist „${fuel.price.unit}“`)
    }
    if (!tool.systems.some((system) => system.fuel === fuel.key)) issues.push(`${where}: von keinem System genutzt`)
  }

  for (const system of tool.systems) {
    const where = `systems (${system.key})`
    if (!findFuel(tool, system.fuel)) issues.push(`${where}: unbekannter Energieträger „${system.fuel}“`)
    const { value, kind, todo } = system.efficiency
    if (kind === 'efficiency' && value > 1.11) issues.push(`${where}: Nutzungsgrad ${value} über 1,11 (Brennwert/Heizwert) unplausibel`)
    if (kind === 'performanceFactor' && value < 1) issues.push(`${where}: Jahresarbeitszahl unter 1`)
    if (todo && !todo.startsWith(CONTENT_MISSING)) issues.push(`${where}: efficiency.todo muss mit „${CONTENT_MISSING}“ beginnen`)
    if (todo && tool.status === 'verified') issues.push(`${where}: efficiency.todo bei verified nicht erlaubt`)
  }
  return issues
}
