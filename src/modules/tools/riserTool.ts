import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'

// Lüftungsstrang-Tools ("kind": "ventilationRiser"): Auswahlhilfe eines Herstellers für Einzelraumlüfter nach
// DIN 18017-3. Bereich (z. B. Normal/Komfort), Lüftergeräte pro Etage mit Volumenstrom je Gerät und Anzahl der
// Etagen wählen; das Tool nennt die kleinste Strangdimension, die laut Diagramm so viele Etagen trägt. Es wird
// nichts abgeleitet: Kombinationen, die die Quelle nicht zeigt, gibt es im Tool nicht.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

export const ventilationRiserToolSchema = defineEntrySchema({
  kind: z.literal('ventilationRiser'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  keywords: z.array(z.string().trim().min(1)).default([]),
  /** Gerätereihe der Auswahlhilfe, z. B. „COSMO EL“ */
  product: z.string().trim().min(1),
  /** Hinweis der Quelle, steht unter dem Ergebnis */
  note: z.string().trim().default(''),
  /** Randbedingungen der Diagramme, z. B. „Etagenhöhe 2,6 m“ */
  conditions: z.array(z.string().trim().min(1)).default([]),
  /** Formel für die Strömungsgeschwindigkeit aus Volumenstrom (Vdot, m³/h) und Durchmesser (d, mm) */
  velocityFormula: z.string().trim().min(1),
  /** Einheit der Strangdimensionen, z. B. „mm“ */
  diameterUnit: z.string().trim().min(1),
  /** Strangdimensionen der Diagramme, aufsteigend */
  diameters: z.array(z.number().positive()).min(1),
  /** Auslegungsbereiche, z. B. Normal und Komfort mit der Strömungsgeschwindigkeit laut Quelle */
  ranges: z
    .array(
      z.strictObject({
        key,
        label: z.string().trim().min(1),
        /** z. B. „v < 8 m/s“ */
        note: z.string().trim().default(''),
      }),
    )
    .min(1),
  /** Je Diagramm: Geräte pro Etage, Volumenstrom je Gerät und höchste Etagenzahl je Bereich und Strangdimension */
  setups: z
    .array(
      z.strictObject({
        devices: z.number().int().positive(),
        /** Volumenstrom je Gerät in m³/h */
        airflow: z.number().positive(),
        /** Seite in der Quelle, z. B. „D 9“ */
        page: z.string().trim().default(''),
        /** Bereichs-key → höchste Etagenzahl je Strangdimension (gleiche Reihenfolge wie diameters) */
        maxFloors: z.record(z.string(), z.array(z.number().int().positive())),
      }),
    )
    .min(1),
})

export type VentilationRiserTool = z.output<typeof ventilationRiserToolSchema>
export type RiserSetup = VentilationRiserTool['setups'][number]

export const AIRFLOW_UNIT = 'm³/h'

/** Gerätezahlen pro Etage, für die es ein Diagramm gibt, aufsteigend */
export function deviceCounts(tool: VentilationRiserTool): number[] {
  return [...new Set(tool.setups.map((setup) => setup.devices))].sort((a, b) => a - b)
}

/** Volumenströme je Gerät, für die es bei dieser Gerätezahl ein Diagramm gibt, aufsteigend */
export function airflowsFor(tool: VentilationRiserTool, devices: number): number[] {
  return tool.setups
    .filter((setup) => setup.devices === devices)
    .map((setup) => setup.airflow)
    .sort((a, b) => a - b)
}

export function findSetup(tool: VentilationRiserTool, devices: number, airflow: number): RiserSetup | undefined {
  return tool.setups.find((setup) => setup.devices === devices && setup.airflow === airflow)
}

export type RiserSelection =
  | { kind: 'fits'; diameter: number; maxFloors: number }
  | { kind: 'beyond'; maxFloors: number; largest: number }

/** Kleinste Strangdimension, die laut Diagramm mindestens so viele Etagen trägt */
export function selectRiser(tool: VentilationRiserTool, setup: RiserSetup, range: string, floors: number): RiserSelection {
  const limits = setup.maxFloors[range] ?? []
  const index = limits.findIndex((limit) => limit >= floors)
  if (index === -1) return { kind: 'beyond', maxFloors: Math.max(0, ...limits), largest: tool.diameters.at(-1)! }
  return { kind: 'fits', diameter: tool.diameters[index]!, maxFloors: limits[index]! }
}

/** Luftdurchsatz im Strang bei Gleichzeitigkeitsfaktor 1,0: alle Geräte aller Etagen laufen */
export function riserAirflow(setup: RiserSetup, floors: number): { perFloor: number; total: number; devices: number } {
  return { perFloor: setup.devices * setup.airflow, total: floors * setup.devices * setup.airflow, devices: floors * setup.devices }
}

export function ventilationRiserKeywords(tool: VentilationRiserTool): string[] {
  return [
    tool.product,
    'Strangdimension',
    ...tool.keywords,
    ...tool.ranges.flatMap((range) => [range.label, range.note]),
  ]
}

export function checkVentilationRiserTool(tool: VentilationRiserTool): string[] {
  const issues: string[] = []
  if (new Set(tool.diameters).size !== tool.diameters.length) issues.push('diameters: Wert doppelt')
  if (tool.diameters.some((diameter, index) => index > 0 && diameter <= tool.diameters[index - 1]!)) {
    issues.push('diameters: nicht aufsteigend')
  }
  const rangeKeys = tool.ranges.map((range) => range.key)
  if (new Set(rangeKeys).size !== rangeKeys.length) issues.push('ranges: key doppelt vergeben')
  const combinations = tool.setups.map((setup) => `${setup.devices}×${setup.airflow}`)
  if (new Set(combinations).size !== combinations.length) issues.push('setups: Kombination aus devices und airflow doppelt')
  tool.setups.forEach((setup, index) => {
    const where = `setups[${index}] (${setup.devices} × ${setup.airflow} ${AIRFLOW_UNIT})`
    const missing = rangeKeys.filter((range) => !(range in setup.maxFloors))
    const unknown = Object.keys(setup.maxFloors).filter((range) => !rangeKeys.includes(range))
    if (missing.length > 0) issues.push(`${where}: maxFloors fehlt für ${missing.join(', ')}`)
    if (unknown.length > 0) issues.push(`${where}: unbekannter Bereich ${unknown.join(', ')}`)
    for (const [range, limits] of Object.entries(setup.maxFloors)) {
      if (limits.length !== tool.diameters.length) {
        issues.push(`${where}, ${range}: ${limits.length} Werte, erwartet ${tool.diameters.length} (je Strangdimension einer)`)
      }
      // Ein größerer Strang trägt nie weniger Etagen
      if (limits.some((limit, i) => i > 0 && limit < limits[i - 1]!)) issues.push(`${where}, ${range}: Etagenzahl fällt ab`)
    }
  })
  return issues
}
