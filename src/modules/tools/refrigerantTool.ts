import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Kältemittel-Tools ("kind": "refrigerantPressure"): Dampfdrucktabelle mehrerer Kältemittel. Kältemittel
// wählen, Druck oder Temperatur eingeben, den anderen Wert aus der Tabelle ablesen. Zwischen zwei
// Tabellenzeilen wird linear gerechnet; außerhalb der Tabelle gibt es keinen Wert.

export const refrigerantToolSchema = defineEntrySchema({
  kind: z.literal('refrigerantPressure'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
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
        /** Ausgeschriebener Name, z. B. „Propan“; leer = keiner (z. B. Gemische). Quelle im Feld source des Tools */
        fullName: z.string().trim().default(''),
        /** Weitere Suchbegriffe */
        aliases: z.array(z.string().trim().min(1)).default([]),
        /** Sicherheitsgruppe, z. B. „A2L“: Buchstabe = Giftigkeit, Rest = Brennbarkeit (Quelle in properties.source) */
        safetyGroup: z
          .string()
          .regex(/^[AB](1|2L|2|3)$/, 'Sicherheitsgruppe wie „A1“, „A2L“ oder „B3“')
          .optional(),
        /** Treibhauspotenzial als Text, weil Quellen auch „<1“ nennen */
        gwp: z.string().trim().min(1).optional(),
        /** Ozonabbaupotenzial */
        odp: z.number().min(0).optional(),
        /** Molmasse in g/mol; null = Wert fehlt noch (wird als „TODO: Inhalt fehlt“ angezeigt) */
        molarMass: z.number().positive().nullable().optional(),
        /** Untere Explosionsgrenze (LFL) in kg/m³, nur bei brennbaren Kältemitteln */
        lowerFlammabilityLimit: z.number().positive().optional(),
        // Erweiterte Eigenschaften; null = Wert fehlt noch („TODO: Inhalt fehlt“)
        /** Stoffklasse, z. B. „HFKW-Gemisch“ */
        class: z.string().trim().min(1).nullable().optional(),
        /** Summenformel (Reinstoff) oder Zusammensetzung (Gemisch) */
        formula: z.string().trim().min(1).nullable().optional(),
        /** CAS-Nummer; fehlt bei Gemischen */
        cas: z.string().regex(/^\d{2,7}-\d{2}-\d$/, 'CAS-Nummer wie „75-10-5“').optional(),
        /** Kältemaschinenöl */
        oil: z.string().trim().min(1).nullable().optional(),
        /** Siedepunkt bei Normaldruck in °C; bei Gemischen [Siedepunkt, Taupunkt] */
        boilingPoint: z.array(z.number()).min(1).max(2).nullable().optional(),
        /** Kritische Temperatur in °C */
        criticalTemperature: z.number().nullable().optional(),
        /** Kritischer Druck in bar (absolut) */
        criticalPressure: z.number().positive().nullable().optional(),
        /** Tripelpunkt in °C */
        triplePoint: z.number().nullable().optional(),
        /** Selbstentzündungstemperatur in °C */
        autoignitionTemperature: z.number().positive().nullable().optional(),
        /** Schlüssel in properties.regulations (Verbot und Nachfüllen) */
        regulation: z.string().trim().min(1).optional(),
        /** Druck je Tabellenzeile; null = die Quelle nennt keinen Wert (nur am Anfang und Ende) */
        pressures: z.array(z.number().nullable()),
      }),
    )
    .min(1),
  /** Eigenschaften-Block unter der Kältemittel-Auswahl; fehlt er, wird kein Block gezeigt */
  properties: z
    .strictObject({
      /** Quellen der Eigenschaften (Sicherheitsgruppe, LFL, Molmasse …) */
      source: z.string().trim().min(1),
      /** Molmasse trockener Luft in g/mol, für „schwerer als Luft“ */
      airMolarMass: z.number().positive(),
      /** Bedeutung des Buchstabens der Sicherheitsgruppe, z. B. { "A": "Geringere Giftigkeit" } */
      toxicity: z.record(z.string(), z.string().trim().min(1)),
      /** Bedeutung der Brennbarkeitsklasse, z. B. { "2L": "Gering brennbar …" } */
      flammability: z.record(z.string(), z.string().trim().min(1)),
      /** Rechtliche Einordnung je Gruppe: Kurzantwort und Erläuterung mit Fundstelle */
      regulations: z
        .record(
          z.string(),
          z.strictObject({
            /** Kurzfassung für die Zeile „EU-Recht“, z. B. „Erlaubt, auch das Nachfüllen“ */
            summary: z.string().trim().min(1),
            banned: z.string().trim().min(1),
            banDetail: z.string().trim().min(1),
            refill: z.string().trim().min(1),
            refillDetail: z.string().trim().min(1),
          }),
        )
        .default({}),
      note: z.string().trim().default(''),
    })
    .optional(),
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
    if (tool.properties) {
      const group = refrigerant.safetyGroup
      if (!group) {
        issues.push(`${where}: safetyGroup fehlt (properties ist gesetzt)`)
      } else {
        const { toxicity, flammability } = splitSafetyGroup(group)
        if (!tool.properties.toxicity[toxicity]) issues.push(`${where}: properties.toxicity.${toxicity} fehlt`)
        if (!tool.properties.flammability[flammability]) issues.push(`${where}: properties.flammability.${flammability} fehlt`)
        if (flammability === '1' && refrigerant.lowerFlammabilityLimit !== undefined) {
          issues.push(`${where}: Explosionsgrenze bei nicht brennbarem Kältemittel`)
        }
      }
      if (refrigerant.regulation !== undefined && !tool.properties.regulations[refrigerant.regulation]) {
        issues.push(`${where}: properties.regulations.${refrigerant.regulation} fehlt`)
      }
    }
  }
  return issues
}

/** „A2L“ → Giftigkeit „A“, Brennbarkeit „2L“ */
export function splitSafetyGroup(group: string): { toxicity: string; flammability: string } {
  return { toxicity: group.slice(0, 1), flammability: group.slice(1) }
}

/** Ein Wert im Eigenschaften-Block; missing = Inhalt fehlt noch */
export interface PropertyRow {
  label: string
  value: string
  /** Kleingedruckte Erläuterung unter dem Wert */
  detail?: string
  /** Längere Erläuterung, nur auf Tipp auf den i-Knopf sichtbar */
  info?: string
  /** Hervorheben (brennbar, giftiger, verboten) */
  warn?: boolean
  missing?: boolean
}

export interface PropertyRows {
  /** Immer sichtbar */
  basic: PropertyRow[]
  /** Auf Knopfdruck */
  extended: PropertyRow[]
}

const MISSING = 'TODO: Inhalt fehlt'

const missingRow = (label: string): PropertyRow => ({ label, value: MISSING, missing: true })

/**
 * Eigenschaften eines Kältemittels für die Anzeige. Nur Werte aus dem Inhalt; gerechnet wird allein die
 * Dichte gegenüber Luft aus dem Verhältnis der Molmassen.
 */
export function refrigerantProperties(
  tool: RefrigerantTool,
  refrigerant: Refrigerant,
  format: (value: number, decimals: number) => string,
): PropertyRows {
  const properties = tool.properties
  if (!properties || !refrigerant.safetyGroup) return { basic: [], extended: [] }
  const { toxicity, flammability } = splitSafetyGroup(refrigerant.safetyGroup)
  const flammable = flammability !== '1'
  const celsius = (value: number) => `${format(value, Number.isInteger(value) ? 0 : 1)} °C`
  /** Wert oder „TODO“, wenn er im Inhalt als null steht; fehlt das Feld ganz, gibt es keine Zeile */
  const optional = <T,>(label: string, value: T | null | undefined, show: (value: T) => string): PropertyRow[] =>
    value === undefined ? [] : value === null ? [missingRow(label)] : [{ label, value: show(value) }]

  const basic: PropertyRow[] = [
    { label: 'Sicherheitsgruppe', value: refrigerant.safetyGroup },
    { label: 'Giftigkeit', value: properties.toxicity[toxicity] ?? MISSING, detail: `Buchstabe ${toxicity}`, warn: toxicity === 'B' },
    { label: 'Brennbarkeit', value: properties.flammability[flammability] ?? MISSING, detail: `Klasse ${flammability}`, warn: flammable },
  ]
  if (flammable) {
    const lfl = refrigerant.lowerFlammabilityLimit
    basic.push(
      lfl === undefined
        ? missingRow('Untere Explosionsgrenze (LFL)')
        : { label: 'Untere Explosionsgrenze (LFL)', value: `${format(lfl, 3)} kg/m³`, detail: `= ${format(lfl * 1000, 0)} g je m³ Raumluft`, warn: true },
    )
  } else {
    basic.push({ label: 'Untere Explosionsgrenze (LFL)', value: 'Keine, nicht brennbar' })
  }
  const molarMass = refrigerant.molarMass
  if (molarMass === null || molarMass === undefined) {
    basic.push(missingRow('Dichte gegenüber Luft'))
  } else {
    const ratio = molarMass / properties.airMolarMass
    basic.push({
      label: 'Dichte gegenüber Luft',
      value: ratio > 1 ? `${format(ratio, 1)}-mal so schwer wie Luft` : `${format(ratio, 1)}-mal so schwer wie Luft (leichter)`,
      detail: `Molmasse ${format(molarMass, 1)} g/mol, Luft ${format(properties.airMolarMass, 1)} g/mol`,
    })
  }
  const regulation = refrigerant.regulation === undefined ? undefined : properties.regulations[refrigerant.regulation]
  if (refrigerant.regulation !== undefined) {
    basic.push(
      regulation
        ? {
            label: 'Beschränkungen (EU)',
            value: regulation.summary,
            info: `${regulation.banDetail} ${regulation.refillDetail}`,
            warn: regulation.banned !== 'Nein' || regulation.refill !== 'Ja',
          }
        : missingRow('Beschränkungen (EU)'),
    )
  }

  const blend = refrigerant.cas === undefined && refrigerant.formula !== undefined
  const extended: PropertyRow[] = [
    ...optional('Klasse', refrigerant.class, (value) => value),
    ...optional(blend ? 'Zusammensetzung' : 'Chemische Formel', refrigerant.formula, (value) => value),
    ...(refrigerant.formula === undefined ? [] : [{ label: 'CAS-Nummer', value: refrigerant.cas ?? 'Keine (Gemisch)' }]),
    ...optional('Öl', refrigerant.oil, (value) => value),
    ...optional('Siedepunkt bei 0 bar (Überdruck)', refrigerant.boilingPoint, (points) =>
      points.length === 2 ? `${celsius(points[0]!)} (Siedepunkt) / ${celsius(points[1]!)} (Taupunkt)` : celsius(points[0]!),
    ),
    ...optional('Kritische Temperatur', refrigerant.criticalTemperature, celsius),
    ...optional('Kritischer Druck', refrigerant.criticalPressure, (value) => `${format(value, 2)} bar (absolut)`),
    ...optional('Tripelpunkt', refrigerant.triplePoint, celsius),
    ...optional('Selbstentzündungstemperatur', refrigerant.autoignitionTemperature, celsius),
    ...(refrigerant.gwp === undefined ? [] : [{ label: 'Treibhauspotenzial (GWP)', value: refrigerant.gwp }]),
    ...(refrigerant.odp === undefined ? [] : [{ label: 'Ozonabbaupotenzial (ODP)', value: format(refrigerant.odp, refrigerant.odp === 0 ? 0 : 3) }]),
  ]
  return { basic, extended }
}

/** Suchbegriffe für die globale Suche */
export function refrigerantKeywords(tool: RefrigerantTool): string[] {
  return [
    'Dampfdruck',
    'Sättigungsdruck',
    'Sättigungstemperatur',
    tool.pressureName,
    ...tool.refrigerants.flatMap((refrigerant) => [
      refrigerant.name,
      ...(refrigerant.fullName ? [refrigerant.fullName] : []),
      ...refrigerant.aliases,
    ]),
  ]
}
