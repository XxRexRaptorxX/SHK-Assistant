import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Fühler-Tools ("kind": "sensorResistance"): Widerstandstabelle mehrerer Temperaturfühler. Fühler wählen,
// Temperatur oder gemessenen Widerstand eingeben, den anderen Wert aus der Tabelle ablesen. Zwischen zwei
// Tabellenzeilen wird linear gerechnet; außerhalb der Tabelle gibt es keinen Wert. Ob der Widerstand mit der
// Temperatur steigt oder fällt, ergibt sich aus den Tabellenwerten selbst.

export const sensorToolSchema = defineEntrySchema({
  kind: z.literal('sensorResistance'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Einheit der Widerstände wie in der Quelle, z. B. „Ω“ */
  resistanceUnit: z.string().trim().min(1),
  /** Hinweis zu den Werten; steht unter dem Ergebnis */
  tableNote: z.string().trim().default(''),
  /** Temperaturen der Tabellenzeilen in °C, aufsteigend */
  temperatures: z.array(z.number()).min(2),
  sensors: z
    .array(
      z.strictObject({
        /** Bezeichnung wie in der Quelle, z. B. „PT1000“ */
        name: z.string().trim().min(1),
        /** Gruppe in der Auswahlliste, z. B. „Standardfühler“ oder ein Hersteller */
        group: z.string().trim().default(''),
        /** Weitere Suchbegriffe, z. B. „NTC 10k“ */
        aliases: z.array(z.string().trim().min(1)).default([]),
        /** Hersteller mit dieser Kennlinie laut Quelle */
        equivalent: z.string().trim().default(''),
        /** Zusatz unter der Auswahl, z. B. Bauart oder für welche Geräte die Kennlinie gilt */
        note: z.string().trim().default(''),
        /** Hinweis der Quelle zum Messen, steht unter dem Ergebnis, z. B. „Messtoleranz ± 10 %“ */
        resultNote: z.string().trim().default(''),
        /** Eigene Quelle dieses Fühlers, wenn sie von der Quelle des Tools abweicht */
        source: z.string().trim().default(''),
        /** Eigene Temperaturstufen in °C (aufsteigend), wenn die Quelle andere Zeilen hat als das Tool */
        temperatures: z.array(z.number()).min(2).optional(),
        /** Widerstand je Tabellenzeile; null = die Quelle nennt keinen Wert (nur am Anfang und Ende) */
        resistances: z.array(z.number().positive().nullable()),
      }),
    )
    .min(1),
})

export type SensorTool = z.output<typeof sensorToolSchema>
export type Sensor = SensorTool['sensors'][number]

/** Ein Tabellenwert: Temperatur in °C und Widerstand */
export interface SensorPoint {
  temperature: number
  resistance: number
}

export type SensorQuantity = keyof SensorPoint

/** Temperaturstufen eines Fühlers: eigene oder die gemeinsamen des Tools */
export const sensorTemperatures = (tool: SensorTool, sensor: Sensor): number[] => sensor.temperatures ?? tool.temperatures

const ascending = (values: readonly number[]) => values.every((value, index) => index === 0 || value > values[index - 1]!)

/** Die Tabellenzeilen eines Fühlers, für die die Quelle einen Widerstand nennt (nach Temperatur aufsteigend) */
export function sensorPoints(tool: SensorTool, sensor: Sensor): SensorPoint[] {
  return sensorTemperatures(tool, sensor).flatMap((temperature, index) => {
    const resistance = sensor.resistances[index]
    return resistance === null || resistance === undefined ? [] : [{ temperature, resistance }]
  })
}

/**
 * "rising": Widerstand steigt mit der Temperatur (positiver Temperaturkoeffizient),
 * "falling": Widerstand sinkt mit steigender Temperatur (negativer Temperaturkoeffizient).
 * Aus den Tabellenwerten abgeleitet; die Build-Prüfung stellt sicher, dass die Richtung durchgehend gilt.
 */
export type SensorTrend = 'rising' | 'falling'

export function sensorTrend(points: readonly SensorPoint[]): SensorTrend {
  return points.at(-1)!.resistance > points[0]!.resistance ? 'rising' : 'falling'
}

export type SensorLookup =
  | { kind: 'exact'; value: number; point: SensorPoint }
  | { kind: 'interpolated'; value: number; lower: SensorPoint; upper: SensorPoint }
  | { kind: 'outOfRange'; first: SensorPoint; last: SensorPoint }

/**
 * Sucht zu einer Größe (Temperatur oder Widerstand) den anderen Wert. Trifft die Eingabe eine Tabellenzeile,
 * gilt deren Wert; dazwischen wird linear gerechnet. Fällt der Widerstand mit der Temperatur (NTC), wird für die
 * Suche nach Widerstand aufsteigend sortiert. first/last sind die Tabellenenden nach Temperatur.
 */
export function lookupSensor(points: readonly SensorPoint[], given: SensorQuantity, value: number): SensorLookup {
  const wanted: SensorQuantity = given === 'temperature' ? 'resistance' : 'temperature'
  const first = points[0]!
  const last = points.at(-1)!
  const sorted = [...points].sort((a, b) => a[given] - b[given])
  if (value < sorted[0]![given] || value > sorted.at(-1)![given]) return { kind: 'outOfRange', first, last }
  const exact = sorted.find((point) => point[given] === value)
  if (exact) return { kind: 'exact', value: exact[wanted], point: exact }
  const upperIndex = sorted.findIndex((point) => point[given] > value)
  const lower = sorted[upperIndex - 1]!
  const upper = sorted[upperIndex]!
  const share = (value - lower[given]) / (upper[given] - lower[given])
  const result = lower[wanted] + share * (upper[wanted] - lower[wanted])
  // lower/upper immer nach Temperatur, damit die Anzeige „zwischen kälter und wärmer“ lautet
  return lower.temperature < upper.temperature
    ? { kind: 'interpolated', value: result, lower, upper }
    : { kind: 'interpolated', value: result, lower: upper, upper: lower }
}

export function checkSensorTool(tool: SensorTool): string[] {
  const issues: string[] = []
  if (!ascending(tool.temperatures)) issues.push('temperatures: nicht aufsteigend')
  const names = tool.sensors.map((sensor) => sensor.name)
  if (new Set(names).size !== names.length) issues.push('sensors: name doppelt vergeben')
  for (const sensor of tool.sensors) {
    const where = `sensors (${sensor.name})`
    const temperatures = sensorTemperatures(tool, sensor)
    if (sensor.temperatures && !ascending(sensor.temperatures)) {
      issues.push(`${where}: temperatures nicht aufsteigend`)
      continue
    }
    if (sensor.resistances.length !== temperatures.length) {
      issues.push(`${where}: ${sensor.resistances.length} Widerstände für ${temperatures.length} Temperaturen`)
      continue
    }
    const filled = sensor.resistances.flatMap((resistance, index) => (resistance === null ? [] : [index]))
    if (filled.length < 2) {
      issues.push(`${where}: weniger als zwei Werte`)
      continue
    }
    // Lücken mitten in der Tabelle würden beim Rechnen stillschweigend überbrückt
    if (filled.length !== filled.at(-1)! - filled[0]! + 1) issues.push(`${where}: Lücke zwischen den Werten`)
    // Nur bei durchgehend steigendem oder fallendem Widerstand ist die Umrechnung eindeutig
    const points = sensorPoints(tool, sensor)
    const rising = sensorTrend(points) === 'rising'
    const broken = points.find((point, index) => {
      if (index === 0) return false
      const previous = points[index - 1]!.resistance
      return rising ? point.resistance <= previous : point.resistance >= previous
    })
    if (broken) issues.push(`${where}: Widerstand ${rising ? 'steigt' : 'fällt'} bei ${broken.temperature} °C nicht`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function sensorKeywords(tool: SensorTool): string[] {
  return [
    'Temperaturfühler',
    'Fühler',
    'Widerstand',
    'Kennlinie',
    'NTC',
    'PTC',
    ...tool.sensors.flatMap((sensor) =>
      [sensor.name, sensor.group, ...sensor.aliases, sensor.equivalent, sensor.note].filter((keyword) => keyword !== ''),
    ),
  ]
}
