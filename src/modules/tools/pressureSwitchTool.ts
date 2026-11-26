import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'
import { lookupTable, type TableLookup, type TablePoint } from './refrigerantTool.ts'

// Hochdruckschalter-Tools ("kind": "pressureSwitch"): maximal zulässiger Druck PS vom Typenschild und Art der
// Absicherung wählen; das Tool rechnet den Einstellwert des Sicherheitsdruckschalters, sein zulässiges Abschaltfenster
// und ggf. den Einstellwert des Druckbegrenzungsventils als Faktor × PS. Optional prüft es mit der Dampfdrucktabelle
// (eigenes Tool, über pressureTable verknüpft), ob die höchste Verflüssigungstemperatur unter dem Abschaltfenster
// bleibt. Faktoren, Texte und Quellen stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)

const refSchema = z.strictObject({ source: key, where: text })
const sourceSchema = z.strictObject({ key, name: text, source: text })

const inputSchema = z.strictObject({
  label: text,
  unit: text,
  min: z.number(),
  max: z.number(),
  step: z.number().positive(),
  default: z.number(),
  /** Was die Eingabe bedeutet, eigene Kurzfassung */
  text,
  ref: refSchema.optional(),
  /** Erklärung des Begriffs, sichtbar unter der Eingabe (z. B. „Was ist PS?“) */
  explanations: z.array(z.strictObject({ title: text, text, ref: refSchema })).default([]),
})

/** Art der Absicherung, z. B. nur Sicherheitsdruckschalter oder zusätzlich Druckbegrenzungsventil */
const setupSchema = z.strictObject({
  key,
  label: text,
  /** Wann diese Absicherung verwendet wird, eigene Kurzfassung */
  text,
  ref: refSchema,
  /** Einstellwert des Sicherheitsdruckschalters = switchFactor × PS */
  switchFactor: z.number().positive(),
  /** Höchster Einstellwert des Druckbegrenzungsventils = reliefValveFactor × PS; fehlt = kein Ventil */
  reliefValveFactor: z.number().positive().optional(),
})

const infoSchema = z.strictObject({ title: text, text, ref: refSchema })

export const pressureSwitchToolSchema = defineEntrySchema({
  kind: z.literal('pressureSwitch'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  related: relatedToolsSchema,
  closingNote: text,
  sources: z.array(sourceSchema).min(1),
  /** Kennung des Dampfdruck-Tools ("kind": "refrigerantPressure") für die Prüfung der Verflüssigungstemperatur */
  pressureTable: text,
  /** Nachkommastellen der Drücke im Ergebnis */
  pressureDecimals: z.number().int().min(0).max(2),
  inputs: z.strictObject({ ps: inputSchema, condensing: inputSchema }),
  setups: z.array(setupSchema).min(1),
  /** Vorausgewählte Absicherung (key) */
  defaultSetup: key,
  /** Zulässiges Abschaltfenster des Schalters: von lowerFactor × Einstellwert bis zum Einstellwert (+0 %) */
  tripWindow: z.strictObject({ lowerFactor: z.number().positive().max(1), text, ref: refSchema }),
  /** Werksdruckprüfung des Druckschalters über factor × PS */
  factoryTest: z.strictObject({ factor: z.number().positive(), text, ref: refSchema }),
  /** Hinweis zur Prüfung der Verflüssigungstemperatur */
  condensingText: text,
  condensingRef: refSchema,
  infos: z.array(infoSchema).default([]),
})

export type PressureSwitchTool = z.output<typeof pressureSwitchToolSchema>
export type PressureSwitchSetup = PressureSwitchTool['setups'][number]
export type PressureSwitchRef = z.output<typeof refSchema>

export interface PressureSwitchResult {
  /** Einstellwert des Sicherheitsdruckschalters */
  switchSetting: number
  /** Unterste zulässige Abschaltung des Schalters (Beginn des Abschaltfensters) */
  tripLow: number
  /** Höchster Einstellwert des Druckbegrenzungsventils; null = keins */
  reliefValve: number | null
  /** Werksdruckprüfung des Schalters über diesem Druck */
  factoryTest: number
}

export function evaluatePressureSwitch(tool: PressureSwitchTool, setup: PressureSwitchSetup, ps: number): PressureSwitchResult {
  const switchSetting = setup.switchFactor * ps
  return {
    switchSetting,
    tripLow: tool.tripWindow.lowerFactor * switchSetting,
    reliefValve: setup.reliefValveFactor === undefined ? null : setup.reliefValveFactor * ps,
    factoryTest: tool.factoryTest.factor * ps,
  }
}

export type CondensingCheck =
  | { kind: 'ok'; pressure: TableLookup & { kind: 'exact' | 'interpolated' }; margin: number }
  | { kind: 'tooHigh'; pressure: TableLookup & { kind: 'exact' | 'interpolated' }; margin: number }
  | { kind: 'outOfRange'; first: TablePoint; last: TablePoint }

/**
 * Sättigungsdruck bei der höchsten Verflüssigungstemperatur im Vergleich zum Beginn des Abschaltfensters.
 * Liegt er darunter, kann der Schalter im Betrieb nicht ansprechen; margin = Abstand in bar (negativ = darüber).
 */
export function checkCondensing(points: readonly TablePoint[], condensing: number, tripLow: number): CondensingCheck {
  const pressure = lookupTable(points, 'temperature', condensing)
  if (pressure.kind === 'outOfRange') return pressure
  const margin = tripLow - pressure.value
  return { kind: margin > 0 ? 'ok' : 'tooHigh', pressure, margin }
}

/**
 * Höchste Verflüssigungstemperatur, deren Sättigungsdruck noch unter dem Abschaltfenster liegt. null = liegt über
 * dem Tabellenende (Wert: letzte Zeile) bzw. unter dem Anfang.
 */
export function maxCondensingTemperature(
  points: readonly TablePoint[],
  tripLow: number,
): { kind: 'value'; temperature: number; interpolated: boolean } | { kind: 'aboveTable'; last: TablePoint } | { kind: 'belowTable' } {
  const lookup = lookupTable(points, 'pressure', tripLow)
  if (lookup.kind === 'outOfRange') return tripLow > lookup.last.pressure ? { kind: 'aboveTable', last: lookup.last } : { kind: 'belowTable' }
  return { kind: 'value', temperature: lookup.value, interpolated: lookup.kind === 'interpolated' }
}

export function pressureSwitchRefText(tool: PressureSwitchTool, ref: PressureSwitchRef): string {
  const source = tool.sources.find((candidate) => candidate.key === ref.source)
  return `${source?.name ?? ref.source}, ${ref.where}`
}

export function checkPressureSwitchTool(tool: PressureSwitchTool): string[] {
  const issues: string[] = []
  const sourceKeys = tool.sources.map((source) => source.key)
  if (new Set(sourceKeys).size !== sourceKeys.length) issues.push('sources: key doppelt vergeben')
  const used = new Set<string>()
  const checkRef = (ref: PressureSwitchRef | undefined, where: string) => {
    if (!ref) return
    used.add(ref.source)
    if (!sourceKeys.includes(ref.source)) issues.push(`${where}: unbekannte Quelle "${ref.source}"`)
  }
  for (const name of ['ps', 'condensing'] as const) {
    const input = tool.inputs[name]
    checkRef(input.ref, `inputs.${name}`)
    input.explanations.forEach((explanation, index) => checkRef(explanation.ref, `inputs.${name}.explanations[${index}]`))
    if (input.min >= input.max) issues.push(`inputs.${name}: min muss kleiner als max sein`)
    if (input.default < input.min || input.default > input.max) issues.push(`inputs.${name}: default außerhalb von min/max`)
  }
  const setupKeys = tool.setups.map((setup) => setup.key)
  if (new Set(setupKeys).size !== setupKeys.length) issues.push('setups: key doppelt vergeben')
  if (!setupKeys.includes(tool.defaultSetup)) issues.push(`defaultSetup: unbekannte Absicherung "${tool.defaultSetup}"`)
  for (const setup of tool.setups) {
    checkRef(setup.ref, `setups (${setup.key})`)
    // Der Schalter muss vor dem Ventil abschalten
    if (setup.reliefValveFactor !== undefined && setup.switchFactor >= setup.reliefValveFactor) {
      issues.push(`setups (${setup.key}): switchFactor muss unter reliefValveFactor liegen`)
    }
  }
  checkRef(tool.tripWindow.ref, 'tripWindow')
  checkRef(tool.factoryTest.ref, 'factoryTest')
  checkRef(tool.condensingRef, 'condensingRef')
  tool.infos.forEach((info, index) => checkRef(info.ref, `infos[${index}] (${info.title})`))
  for (const source of sourceKeys) if (!used.has(source)) issues.push(`sources (${source}): wird nirgends zitiert`)
  return issues
}

export function pressureSwitchKeywords(tool: PressureSwitchTool): string[] {
  return [...tool.keywords, ...tool.setups.map((setup) => setup.label), ...tool.infos.map((info) => info.title)]
}
