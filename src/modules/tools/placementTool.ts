import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'

// Aufstellungs-Tools ("kind": "placement"): Kältemittel, Aufstellort und Umgebung eines Außengeräts angeben, dann die
// allgemeinen Vorgaben aus einem herstellerübergreifenden Leitfaden sehen. Maße von Schutzbereichen und Mindestabständen
// sind herstellerspezifisch; sie stehen nur in Beispielen aus Herstelleranleitungen, deutlich als Beispiel gekennzeichnet.
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

/** Seite des Geräts für die Skizze (Draufsicht): Ansaugseite hinten, Ausblasseite vorn */
export const PLACEMENT_SIDES = ['intake', 'exhaust', 'side', 'top'] as const

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
  /** Zahl in Metern für die Skizze; nur mit side */
  meters: z.number().positive().optional(),
  /** Seite in der Skizze */
  side: z.enum(PLACEMENT_SIDES).optional(),
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

/** Beispiel aus einer Herstelleranleitung, je Geräteserie; zeigt, wie Maße und Vorgaben dort aussehen */
const exampleSchema = z.strictObject({
  key,
  /** key des Gerätetyps */
  type: key,
  /** key der Kältemittel-Gruppe */
  refrigerant: key,
  manufacturer: z.string().trim().min(1),
  /** Geräteserie; Maße gelten immer je Serie, nie pauschal je Hersteller */
  series: z.string().trim().min(1),
  /** Kältemittel wie in der Anleitung, z. B. „R290“ */
  refrigerantName: z.string().trim().min(1),
  /** Dokument mit Ausgabe, Seiten und, wenn vorhanden, Link */
  source: z.string().trim().min(1),
  zone: z
    .strictObject({
      name: z.string().trim().min(1),
      /** Abstand rund um das Gerät in Metern */
      meters: z.number().positive(),
      /** Abweichender Abstand je Aufstellort (key → Meter), z. B. Eckaufstellung zu den offenen Seiten */
      byLocation: z.record(key, z.number().positive()).default({}),
      description: z.string().trim().min(1),
      page,
    })
    .optional(),
  clearances: z.array(clearanceSchema).default([]),
  /** Vorgaben dieser Anleitung; refrigerants bleibt hier leer */
  rules: z.array(ruleSchema).default([]),
})

export const placementToolSchema = defineEntrySchema({
  kind: z.literal('placement'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
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
  examples: z.array(exampleSchema).default([]),
})

export type PlacementTool = z.output<typeof placementToolSchema>
export type PlacementGuide = PlacementTool['guide']
export type PlacementExample = PlacementTool['examples'][number]
export type PlacementRule = PlacementGuide['rules'][number]
export type PlacementClearance = PlacementExample['clearances'][number]
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

/** Abstand des Schutzbereichs eines Beispiels am gewählten Aufstellort */
export const exampleZoneMeters = (example: PlacementExample, location: string) =>
  example.zone ? (example.zone.byLocation[location] ?? example.zone.meters) : undefined

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
  for (const value of duplicates(tool.examples.map((example) => example.key))) issues.push(`examples: key "${value}" doppelt vergeben`)
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

  for (const example of tool.examples) {
    const where = `examples (${example.key})`
    if (!typeKeys.includes(example.type)) issues.push(`${where}: unbekannter Gerätetyp "${example.type}"`)
    if (!refrigerantKeys.includes(example.refrigerant)) issues.push(`${where}: unbekanntes Kältemittel "${example.refrigerant}"`)
    if (example.rules.some((rule) => rule.refrigerants.length > 0)) {
      issues.push(`${where}: refrigerants in Vorgaben eines Beispiels nicht erlaubt (gilt für das Beispiel)`)
    }
    for (const location of Object.keys(example.zone?.byLocation ?? {})) {
      if (!locationKeys.includes(location)) issues.push(`${where}: zone.byLocation mit unbekanntem Aufstellort "${location}"`)
    }
    for (const clearance of example.clearances) {
      if (clearance.meters !== undefined && !clearance.side) issues.push(`${where}: Abstand „${clearance.label}“ hat meters ohne side`)
    }
    const sides = example.clearances.flatMap((clearance) => (clearance.meters !== undefined && clearance.side ? [clearance.side] : []))
    for (const value of duplicates(sides)) issues.push(`${where}: mehrere Abstände mit Zahl für die Seite "${value}"`)
    checkRules(example.rules, where)
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
  ]
}
