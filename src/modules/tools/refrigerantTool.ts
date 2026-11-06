import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'

// Kältemittel-Tools ("kind": "refrigerantPressure"): Dampfdrucktabelle mehrerer Kältemittel. Kältemittel
// wählen, Druck oder Temperatur eingeben, den anderen Wert aus der Tabelle ablesen. Zwischen zwei
// Tabellenzeilen wird linear gerechnet; außerhalb der Tabelle gibt es keinen Wert.

export const refrigerantToolSchema = defineEntrySchema({
  kind: z.literal('refrigerantPressure'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Art des Drucks wie in der Quelle, z. B. „Überdruck“ */
  pressureName: z.string().trim().min(1),
  /** Einheit der Drücke zur Anzeige, z. B. „bar“ */
  pressureUnit: z.string().trim().min(1),
  /** Hinweis der Quelle zu den Werten, z. B. gerundet oder Taupunkt; steht unter dem Ergebnis */
  tableNote: z.string().trim().default(''),
  /** Temperaturen der Tabellenzeilen in °C, aufsteigend */
  temperatures: z.array(z.number()).min(2),
  refrigerants: z
    .array(
      z.strictObject({
        /** Bezeichnung, z. B. „R32“ */
        name: z.string().trim().min(1),
        /** Weitere Suchbegriffe */
        aliases: z.array(z.string().trim().min(1)).default([]),
        /** Druck je Tabellenzeile; null = die Quelle nennt keinen Wert (nur am Anfang und Ende) */
        pressures: z.array(z.number().nullable()),
      }),
    )
    .min(1),
})

export type RefrigerantTool = z.output<typeof refrigerantToolSchema>
export type Refrigerant = RefrigerantTool['refrigerants'][number]

/** Ein Tabellenwert: Sättigungstemperatur in °C und Druck */
export interface TablePoint {
  temperature: number
  pressure: number
}

/** Die Tabellenzeilen eines Kältemittels, für die die Quelle einen Druck nennt */
export function tablePoints(tool: RefrigerantTool, refrigerant: Refrigerant): TablePoint[] {
  return tool.temperatures.flatMap((temperature, index) => {
    const pressure = refrigerant.pressures[index]
    return pressure === null || pressure === undefined ? [] : [{ temperature, pressure }]
  })
}

export type Quantity = keyof TablePoint

export type TableLookup =
  | { kind: 'exact'; value: number; point: TablePoint }
  | { kind: 'interpolated'; value: number; lower: TablePoint; upper: TablePoint }
  | { kind: 'outOfRange'; first: TablePoint; last: TablePoint }

/**
 * Sucht zu einer Größe (Temperatur oder Druck) den anderen Wert. Trifft die Eingabe eine Tabellenzeile,
 * gilt deren Wert; dazwischen wird linear gerechnet. Beide Größen steigen in der Tabelle (geprüft beim Build).
 */
export function lookupTable(points: readonly TablePoint[], given: Quantity, value: number): TableLookup {
  const wanted: Quantity = given === 'temperature' ? 'pressure' : 'temperature'
  const first = points[0]!
  const last = points.at(-1)!
  if (value < first[given] || value > last[given]) return { kind: 'outOfRange', first, last }
  const exact = points.find((point) => point[given] === value)
  if (exact) return { kind: 'exact', value: exact[wanted], point: exact }
  const upperIndex = points.findIndex((point) => point[given] > value)
  const lower = points[upperIndex - 1]!
  const upper = points[upperIndex]!
  const share = (value - lower[given]) / (upper[given] - lower[given])
  return { kind: 'interpolated', value: lower[wanted] + share * (upper[wanted] - lower[wanted]), lower, upper }
}

export function checkRefrigerantTool(tool: RefrigerantTool): string[] {
  const issues: string[] = []
  if (tool.temperatures.some((temperature, index) => index > 0 && temperature <= tool.temperatures[index - 1]!)) {
    issues.push('temperatures: nicht aufsteigend')
  }
  const names = tool.refrigerants.map((refrigerant) => refrigerant.name)
  if (new Set(names).size !== names.length) issues.push('refrigerants: name doppelt vergeben')
  for (const refrigerant of tool.refrigerants) {
    const where = `refrigerants (${refrigerant.name})`
    if (refrigerant.pressures.length !== tool.temperatures.length) {
      issues.push(`${where}: ${refrigerant.pressures.length} Drücke für ${tool.temperatures.length} Temperaturen`)
      continue
    }
    const filled = refrigerant.pressures.flatMap((pressure, index) => (pressure === null ? [] : [index]))
    if (filled.length < 2) {
      issues.push(`${where}: weniger als zwei Werte`)
      continue
    }
    // Lücken mitten in der Tabelle würden beim Rechnen stillschweigend überbrückt
    if (filled.length !== filled.at(-1)! - filled[0]! + 1) issues.push(`${where}: Lücke zwischen den Werten`)
    const points = tablePoints(tool, refrigerant)
    const falling = points.find((point, index) => index > 0 && point.pressure <= points[index - 1]!.pressure)
    if (falling) issues.push(`${where}: Druck steigt bei ${falling.temperature} °C nicht`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function refrigerantKeywords(tool: RefrigerantTool): string[] {
  return [
    'Dampfdruck',
    'Sättigungsdruck',
    'Sättigungstemperatur',
    tool.pressureName,
    ...tool.refrigerants.flatMap((refrigerant) => [refrigerant.name, ...refrigerant.aliases]),
  ]
}
