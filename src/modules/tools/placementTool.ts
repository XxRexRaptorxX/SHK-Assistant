import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { toolTagsSchema } from './toolTags.ts'

// Aufstellungs-Tools ("kind": "placement"): Kältemittel, optional Hersteller, Aufstellort und Umgebung eines Außengeräts
// angeben, dann die allgemeinen Vorgaben aus einem herstellerübergreifenden Leitfaden sehen und, wenn ein Hersteller gewählt
// ist, die Vorgaben aus dessen Anleitung. Maße von Schutzbereichen und Mindestabständen sind herstellerspezifisch; sie stehen
// nur bei den Herstellern, je Baureihe, sobald sich die Vorgaben innerhalb eines Herstellers unterscheiden.
// Es gibt keine Logik, die Zulässigkeit aus allgemeinen Regeln ableitet: Treffen Vorgaben der Stufe „Nicht zulässig“ über
// Aufstellort oder ein gewähltes Merkmal zu, werden sie genannt, sonst nur, dass keine zutrifft.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Verbindlichkeit einer Vorgabe; Reihenfolge = Sortierung in der Anzeige */
export const PLACEMENT_LEVELS = {
  forbidden: { label: 'Nicht zulässig' },
  required: { label: 'Vorgeschrieben' },
  avoid: { label: 'Vermeiden' },
  recommended: { label: 'Empfohlen' },
  note: { label: 'Hinweis' },
} as const

export type PlacementLevel = keyof typeof PLACEMENT_LEVELS

export const PLACEMENT_LEVEL_KEYS = Object.keys(PLACEMENT_LEVELS) as [PlacementLevel, ...PlacementLevel[]]

/** Wände in der Skizze: hinter der Ansaugseite und links daneben */
export const PLACEMENT_WALLS = ['back', 'left'] as const

const page = z.string().trim().min(1)
const keys = z.array(key).default([])

const optionSchema = z.strictObject({
  key,
  /** Beschriftung, z. B. „Vor einer Wand“ */
  label: z.string().trim().min(1),
  /** Kleiner Zusatz unter bzw. hinter der Beschriftung */
  note: z.string().trim().default(''),
  /** Weitere Suchbegriffe */
  aliases: z.array(z.string().trim().min(1)).default([]),
})

const locationSchema = optionSchema.extend({
  /** Wände in der Skizze; leer = freistehend */
  walls: z.array(z.enum(PLACEMENT_WALLS)).default([]),
})

const featureSchema = optionSchema.extend({
  /** Gruppe in der Auswahl, z. B. „Im Umkreis des Geräts“ */
  group: z.string().trim().min(1),
})

const deviceTypeSchema = z.strictObject({
  key,
  /** z. B. „Wärmepumpe“ */
  label: z.string().trim().min(1),
  /** Solange der Leitfaden diesen Gerätetyp nicht abdeckt: beginnt mit „TODO: Inhalt fehlt“ */
  todo: z.string().trim().default(''),
})

const ruleSchema = z.strictObject({
  level: z.enum(PLACEMENT_LEVEL_KEYS),
  /** Eigene Kurzfassung der Vorgabe, kein Text aus der Quelle */
  text: z.string().trim().min(1),
  /** Seite in der Quelle, z. B. „S. 7“ */
  page,
  /** Gilt nur für diese Kältemittel-Gruppen (key); leer = für alle */
  refrigerants: keys,
  /** Gilt nur bei diesen Aufstellorten (key); leer = überall */
  locations: keys,
  /** Betrifft diese Umgebungsmerkmale (key); leer = gilt immer */
  features: keys,
})

const clearanceSchema = z.strictObject({
  /** Wozu der Abstand gilt, z. B. „Ansaugseite zu Wand oder Hindernis“ */
  label: z.string().trim().min(1),
  /** Wert wie in der Quelle, z. B. „min. 0,6 m“ oder „frei lassen“ */
  value: z.string().trim().min(1),
  /** Gilt nur bei diesen Aufstellorten (key); leer = überall */
  locations: keys,
  /** Zusatz, z. B. eine Bedingung */
  note: z.string().trim().default(''),
  page,
})

/** Herstellerübergreifender Leitfaden: allgemeine Vorgaben ohne Maße */
const guideSchema = z.strictObject({
  /** Kurzname für die Seitenangaben, z. B. „BWP-Leitfaden“ */
  name: z.string().trim().min(1),
  /** Dokument mit Herausgeber, Stand und Link */
  source: z.string().trim().min(1),
  /** Gerätetypen, für die der Leitfaden gilt */
  deviceTypes: z.array(key).min(1),
  zone: z
    .strictObject({
      /** Name wie in der Quelle, z. B. „Schutzbereich“ */
      name: z.string().trim().min(1),
      /** Für welche Kältemittel-Gruppen der Bereich gilt */
      refrigerants: z.array(key).min(1),
      /** Eigene Kurzbeschreibung; Maße nennt der Leitfaden nicht */
      description: z.string().trim().min(1),
      page,
    })
    .optional(),
  rules: z.array(ruleSchema).min(1),
})

/** Eine Zeile zum Schutzbereich einer Baureihe */
const zoneRowSchema = z.strictObject({
  /** Aufstellorte (key), für die die Zeile gilt; leer = alle */
  locations: keys,
  /** Bedingung, z. B. „Montagehöhe < 400 mm“; leer = immer */
  condition: z.string().trim().default(''),
  /** Maße wie in der Anleitung, z. B. „1.000 mm rundum“ */
  value: z.string().trim().min(1),
  note: z.string().trim().default(''),
  page,
})

/** Baureihe eines Herstellers mit den Vorgaben aus ihrer Anleitung */
const seriesSchema = z.strictObject({
  key,
  /** key des Gerätetyps */
  type: key,
  /** key der Kältemittel-Gruppe */
  refrigerant: key,
  /** Baureihe bzw. Außeneinheit, z. B. „aroTHERM plus/8“ */
  name: z.string().trim().min(1),
  /** Für welche Geräte die Anleitung gilt, z. B. Leistungsgrößen oder zugehörige Inneneinheiten */
  covers: z.string().trim().default(''),
  /** Kältemittel wie in der Anleitung, z. B. „R290“ */
  refrigerantName: z.string().trim().min(1),
  /** Dokumente mit Ausgabe, Seiten und, wenn vorhanden, Link */
  source: z.string().trim().min(1),
  /** Schutzbereich je Aufstellort, wie in der Anleitung; mehrere Zeilen je Ort bei Bedingungen (z. B. Montagehöhe) */
  zones: z.array(zoneRowSchema).default([]),
  /** Hinweis zum Schutzbereich, der für alle Aufstellorte gilt */
  zoneNote: z.string().trim().default(''),
  clearances: z.array(clearanceSchema).default([]),
  /** Vorgaben dieser Anleitung; refrigerants bleibt hier leer */
  rules: z.array(ruleSchema).default([]),
})

/** Hersteller mit einer oder mehreren Baureihen; mehrere nur, wenn sich die Vorgaben unterscheiden */
const manufacturerSchema = z.strictObject({
  key,
  name: z.string().trim().min(1),
  aliases: z.array(z.string().trim().min(1)).default([]),
  series: z.array(seriesSchema).min(1),
})

export const placementToolSchema = defineEntrySchema({
  kind: z.literal('placement'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: toolTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Hinweis am Ende, z. B. dass die Herstelleranleitung vorgeht */
  closingNote: z.string().trim().min(1),
  keywords: z.array(z.string().trim().min(1)).default([]),
  deviceTypes: z.array(deviceTypeSchema).min(1),
  /** Kältemittel nach Sicherheitsgruppe, z. B. A3 (R290) */
  refrigerants: z.array(optionSchema).min(1),
  locations: z.array(locationSchema).min(1),
  features: z.array(featureSchema).default([]),
  guide: guideSchema,
  /** Hersteller mit Vorgaben aus ihren Anleitungen; Maße gelten je Baureihe */
  manufacturers: z.array(manufacturerSchema).default([]),
})

export type PlacementTool = z.output<typeof placementToolSchema>
export type PlacementGuide = PlacementTool['guide']
export type PlacementManufacturer = PlacementTool['manufacturers'][number]
export type PlacementSeries = PlacementManufacturer['series'][number]
export type PlacementZoneRow = PlacementSeries['zones'][number]
export type PlacementRule = PlacementGuide['rules'][number]
export type PlacementClearance = PlacementSeries['clearances'][number]
export type PlacementLocation = PlacementTool['locations'][number]
export type PlacementFeature = PlacementTool['features'][number]

/** Vorgaben zu den Angaben, je Abschnitt nach Verbindlichkeit sortiert */
export interface PlacementResult {
  /** „Nicht zulässig“, ausgelöst durch Aufstellort oder ein gewähltes Merkmal */
  excluded: PlacementRule[]
  /** Übrige Vorgaben zu gewählten Merkmalen oder zum gewählten Aufstellort */
  matching: PlacementRule[]
  /** Vorgaben ohne Merkmal und Aufstellort, die immer gelten */
  general: PlacementRule[]
  /** Vorgaben zu Merkmalen, die nicht gewählt sind */
  other: PlacementRule[]
}

const byLevel = (a: PlacementRule, b: PlacementRule) =>
  PLACEMENT_LEVEL_KEYS.indexOf(a.level) - PLACEMENT_LEVEL_KEYS.indexOf(b.level)

/** Ordnet Vorgaben den Angaben zu. Nur Zuordnung über keys, keine eigene Bewertung. */
export function placementResult(
  rules: readonly PlacementRule[],
  refrigerant: string,
  location: string,
  features: readonly string[],
): PlacementResult {
  const relevant = rules.filter(
    (rule) =>
      (rule.refrigerants.length === 0 || rule.refrigerants.includes(refrigerant)) &&
      (rule.locations.length === 0 || rule.locations.includes(location)),
  )
  const triggeredOnce = new Set<string>()
  // Gleiche Vorgabe über Aufstellort und Merkmal (z. B. Rammschutz bei Garage und Parkplatz) nur einmal zeigen
  const once = (rule: PlacementRule) => {
    if (triggeredOnce.has(rule.text)) return false
    triggeredOnce.add(rule.text)
    return true
  }
  const triggered = (rule: PlacementRule) =>
    rule.features.some((feature) => features.includes(feature)) ||
    // Vorgaben nur für einen Aufstellort, ohne Merkmal: der Ort selbst löst sie aus
    (rule.features.length === 0 && rule.locations.includes(location))
  const excluded = relevant.filter((rule) => rule.level === 'forbidden' && triggered(rule) && once(rule))
  const matching = relevant.filter((rule) => rule.level !== 'forbidden' && triggered(rule) && once(rule))
  const general = relevant.filter((rule) => rule.features.length === 0 && rule.locations.length === 0)
  // Nicht ausgelöste Vorgaben, außer sie stehen schon oben
  const other = relevant.filter((rule) => rule.features.length > 0 && !triggered(rule) && !triggeredOnce.has(rule.text) && once(rule))
  return { excluded, matching: matching.sort(byLevel), general: general.sort(byLevel), other: other.sort(byLevel) }
}

/** Zeilen zum Schutzbereich einer Baureihe am gewählten Aufstellort */
export const zoneRowsAt = (series: PlacementSeries, location: string) =>
  series.zones.filter((row) => row.locations.length === 0 || row.locations.includes(location))

/** Mindestabstände einer Baureihe am gewählten Aufstellort */
export const clearancesAt = (series: PlacementSeries, location: string) =>
  series.clearances.filter((clearance) => clearance.locations.length === 0 || clearance.locations.includes(location))

/** Hersteller, die Baureihen für Gerätetyp und Kältemittel-Gruppe haben, jeweils nur mit diesen Baureihen */
export function manufacturersFor(tool: PlacementTool, type: string, refrigerant: string): PlacementManufacturer[] {
  return tool.manufacturers.flatMap((manufacturer) => {
    const series = manufacturer.series.filter((entry) => entry.type === type && entry.refrigerant === refrigerant)
    return series.length > 0 ? [{ ...manufacturer, series }] : []
  })
}

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkPlacementTool(tool: PlacementTool): string[] {
  const issues: string[] = []
  const typeKeys = tool.deviceTypes.map((type) => type.key)
  const refrigerantKeys = tool.refrigerants.map((refrigerant) => refrigerant.key)
  const locationKeys = tool.locations.map((location) => location.key)
  const featureKeys = tool.features.map((feature) => feature.key)
  for (const value of duplicates(typeKeys)) issues.push(`deviceTypes: key "${value}" doppelt vergeben`)
  for (const value of duplicates(refrigerantKeys)) issues.push(`refrigerants: key "${value}" doppelt vergeben`)
  for (const value of duplicates(locationKeys)) issues.push(`locations: key "${value}" doppelt vergeben`)
  for (const value of duplicates(featureKeys)) issues.push(`features: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.manufacturers.map((manufacturer) => manufacturer.key))) {
    issues.push(`manufacturers: key "${value}" doppelt vergeben`)
  }
  for (const location of tool.locations) {
    if (duplicates(location.walls).length > 0) issues.push(`locations (${location.key}): Wand doppelt`)
  }

  for (const type of tool.guide.deviceTypes) {
    if (!typeKeys.includes(type)) issues.push(`guide: unbekannter Gerätetyp "${type}"`)
  }
  for (const type of tool.deviceTypes) {
    const covered = tool.guide.deviceTypes.includes(type.key)
    if (!covered && !type.todo.startsWith('TODO: Inhalt fehlt')) {
      issues.push(`deviceTypes (${type.key}): nicht im Leitfaden; todo muss mit „TODO: Inhalt fehlt“ beginnen`)
    }
    if (covered && type.todo) issues.push(`deviceTypes (${type.key}): todo gesetzt, obwohl der Leitfaden ihn abdeckt`)
    if (type.todo && tool.status === 'verified') issues.push(`deviceTypes (${type.key}): todo bei verified nicht erlaubt`)
  }
  for (const refrigerant of tool.guide.zone?.refrigerants ?? []) {
    if (!refrigerantKeys.includes(refrigerant)) issues.push(`guide.zone: unbekanntes Kältemittel "${refrigerant}"`)
  }

  const usedFeatures = new Set<string>()
  const checkRules = (rules: readonly PlacementRule[], where: string) => {
    for (const [index, rule] of rules.entries()) {
      const ruleWhere = `${where}, rules[${index}]`
      for (const refrigerant of rule.refrigerants) {
        if (!refrigerantKeys.includes(refrigerant)) issues.push(`${ruleWhere}: unbekanntes Kältemittel "${refrigerant}"`)
      }
      for (const location of rule.locations) {
        if (!locationKeys.includes(location)) issues.push(`${ruleWhere}: unbekannter Aufstellort "${location}"`)
      }
      for (const feature of rule.features) {
        if (!featureKeys.includes(feature)) issues.push(`${ruleWhere}: unbekanntes Merkmal "${feature}"`)
        usedFeatures.add(feature)
      }
      if (duplicates(rule.features).length > 0) issues.push(`${ruleWhere}: Merkmal doppelt`)
    }
  }
  checkRules(tool.guide.rules, 'guide')

  for (const manufacturer of tool.manufacturers) {
    for (const value of duplicates(manufacturer.series.map((series) => series.key))) {
      issues.push(`manufacturers (${manufacturer.key}): Baureihe "${value}" doppelt vergeben`)
    }
    for (const series of manufacturer.series) {
      const where = `manufacturers (${manufacturer.key}/${series.key})`
      if (!typeKeys.includes(series.type)) issues.push(`${where}: unbekannter Gerätetyp "${series.type}"`)
      if (!refrigerantKeys.includes(series.refrigerant)) issues.push(`${where}: unbekanntes Kältemittel "${series.refrigerant}"`)
      if (series.rules.some((rule) => rule.refrigerants.length > 0)) {
        issues.push(`${where}: refrigerants in Vorgaben einer Baureihe nicht erlaubt (das Kältemittel steht an der Baureihe)`)
      }
      for (const location of [...series.zones, ...series.clearances].flatMap((row) => row.locations)) {
        if (!locationKeys.includes(location)) issues.push(`${where}: unbekannter Aufstellort "${location}" bei Schutzbereich oder Abstand`)
      }
      if (series.rules.length === 0) issues.push(`${where}: keine Vorgaben`)
      checkRules(series.rules, where)
    }
  }
  // Ein Merkmal ohne Vorgabe würde angeboten, aber nie etwas zeigen
  for (const feature of featureKeys) {
    if (!usedFeatures.has(feature)) issues.push(`features (${feature}): kommt in keiner Vorgabe vor`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function placementKeywords(tool: PlacementTool): string[] {
  return [
    ...tool.keywords,
    ...tool.deviceTypes.map((type) => type.label),
    ...tool.refrigerants.flatMap((refrigerant) => [refrigerant.label, ...refrigerant.aliases]),
    ...tool.locations.flatMap((location) => [location.label, ...location.aliases]),
    ...tool.features.flatMap((feature) => [feature.label, ...feature.aliases]),
    ...(tool.guide.zone ? [tool.guide.zone.name] : []),
    tool.guide.name,
    ...tool.manufacturers.flatMap((manufacturer) => [
      manufacturer.name,
      ...manufacturer.aliases,
      ...manufacturer.series.flatMap((series) => [series.name, `${manufacturer.name} ${series.name}`, series.refrigerantName]),
    ]),
  ]
}
