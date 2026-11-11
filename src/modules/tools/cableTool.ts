import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Kabel-Tools ("kind": "cables"): Man wählt eine Elektro-Komponente (z. B. Fühler oder Außengerät) oder eine
// Einbausituation (z. B. unter Putz oder im Freien) und bekommt die dafür genannten Kabelarten mit ihren
// Eigenschaften. Jede Zuordnung nennt ihre eigene Quelle.
// „Vorgeschrieben“ steht nur, wo eine Quelle es konkret verlangt, z. B. die Anleitung eines Geräts.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Kennzeichen einer Komponente, zu der noch keine belegte Kabelart vorliegt */
export const CONTENT_MISSING = 'TODO: Inhalt fehlt'

const propertySchema = z.strictObject({
  key,
  /** Eigenschaft, z. B. „UV-beständig“ */
  name: z.string().trim().min(1),
})

const cableSchema = z.strictObject({
  key,
  /** Typbezeichnung, z. B. „NYM-J“ */
  name: z.string().trim().min(1),
  /** Weitere Suchbegriffe, z. B. „Mantelleitung“ */
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Kurze eigene Beschreibung, z. B. „PVC-Mantelleitung für die feste Installation“ */
  description: z.string().trim().min(1),
  /** Norm oder Bauart, z. B. „DIN VDE 0250-204“ */
  standard: z.string().trim().default(''),
  /** Nennspannung, z. B. „300/500 V“ */
  voltage: z.string().trim().min(1),
  /** Temperaturbereich laut Datenblatt */
  temperature: z.string().trim().min(1),
  /** Wofür die Leitung laut Datenblatt gedacht ist */
  use: z.string().trim().min(1),
  /** Einschränkung laut Datenblatt, z. B. „Nicht in Rüttelbeton“ */
  limits: z.string().trim().default(''),
  /** Eigenschaft (key) → Wert; fehlt eine Eigenschaft, nennt die Quelle dazu nichts */
  properties: z.record(
    z.string(),
    z.strictObject({
      value: z.enum(['yes', 'no', 'conditional']),
      /** Bedingung, z. B. „vor direkter Sonne geschützt“ */
      note: z.string().trim().default(''),
    }),
  ),
  /** Woher die Kabeldaten stammen, kurz; die Links stehen in source des Eintrags */
  source: z.string().trim().min(1),
})

const recommendationSchema = z.strictObject({
  /** key der Kabelart */
  cable: key,
  /** required: von der Quelle verlangt; suitable: geeignet; avoid: laut Quelle nicht geeignet */
  level: z.enum(['required', 'suitable', 'avoid']),
  /** Bedingung oder Begründung für diese Komponente */
  note: z.string().trim().default(''),
  /** Woher die Zuordnung stammt, kurz; die Links stehen in source des Eintrags */
  source: z.string().trim().min(1),
})

/** Eine Auswahlmöglichkeit: Komponente oder Einbausituation */
const componentSchema = z.strictObject({
  key,
  /** Name in der Auswahl, z. B. „Umwälzpumpe“ oder „Unterputz“ */
  label: z.string().trim().min(1),
  /** Gruppe in der Auswahl, z. B. „Heizung und Regelung“ */
  group: z.string().trim().min(1),
  /** Weitere Suchbegriffe */
  aliases: z.array(z.string().trim().min(1)).default([]),
  /** Hinweis zur ganzen Auswahl; ohne Kabelarten beginnt er mit „TODO: Inhalt fehlt“ */
  note: z.string().trim().default(''),
  recommendations: z.array(recommendationSchema).default([]),
})

export const cableToolSchema = defineEntrySchema({
  kind: z.literal('cables'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Was bei jeder Kabelart angezeigt wird, z. B. „UV-beständig“ */
  properties: z.array(propertySchema).min(1),
  cables: z.array(cableSchema).min(1),
  components: z.array(componentSchema).min(1),
  situations: z.array(componentSchema).min(1),
})

export type CableTool = z.output<typeof cableToolSchema>
export type CableEntry = CableTool['cables'][number]
export type CableComponent = CableTool['components'][number]
export type CableRecommendation = CableComponent['recommendations'][number]
export type CableLevel = CableRecommendation['level']

const LEVEL_ORDER: CableLevel[] = ['required', 'suitable', 'avoid']

/** Kabelarten einer Komponente: Vorgeschriebenes zuerst, Ungeeignetes zuletzt; innerhalb wie im Inhalt */
export function sortedRecommendations(component: CableComponent): CableRecommendation[] {
  return LEVEL_ORDER.flatMap((level) => component.recommendations.filter((entry) => entry.level === level))
}

/** Komponenten oder Einbausituationen je Gruppe, in der Reihenfolge des Inhalts */
export function groupComponents(components: CableComponent[]): { group: string; components: CableComponent[] }[] {
  const groups: { group: string; components: CableComponent[] }[] = []
  for (const component of components) {
    const known = groups.find((entry) => entry.group === component.group)
    if (known) known.components.push(component)
    else groups.push({ group: component.group, components: [component] })
  }
  return groups
}

function duplicates(values: string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkCableTool(tool: CableTool): string[] {
  const issues: string[] = []
  const propertyKeys = tool.properties.map((property) => property.key)
  const cableKeys = tool.cables.map((cable) => cable.key)
  for (const value of duplicates(propertyKeys)) issues.push(`properties: key "${value}" doppelt vergeben`)
  for (const value of duplicates(cableKeys)) issues.push(`cables: key "${value}" doppelt vergeben`)
  for (const value of duplicates(tool.components.map((component) => component.key))) {
    issues.push(`components: key "${value}" doppelt vergeben`)
  }
  for (const value of duplicates(tool.situations.map((situation) => situation.key))) {
    issues.push(`situations: key "${value}" doppelt vergeben`)
  }
  for (const cable of tool.cables) {
    for (const [propertyKey, property] of Object.entries(cable.properties)) {
      if (!propertyKeys.includes(propertyKey)) issues.push(`cables (${cable.name}): unbekannte Eigenschaft "${propertyKey}"`)
      if (property.value === 'conditional' && !property.note) {
        issues.push(`cables (${cable.name}): "${propertyKey}" ist bedingt, aber ohne Bedingung`)
      }
    }
  }
  const used = new Set<string>()
  for (const component of [...tool.components, ...tool.situations]) {
    const where = `${tool.components.includes(component) ? 'components' : 'situations'} (${component.label})`
    const missing = component.note.startsWith(CONTENT_MISSING)
    if (component.recommendations.length === 0 && !missing) issues.push(`${where}: keine Kabelart und kein „${CONTENT_MISSING}“`)
    if (missing && tool.status === 'verified') issues.push(`${where}: „${CONTENT_MISSING}“ ist bei verified nicht erlaubt`)
    for (const value of duplicates(component.recommendations.map((entry) => entry.cable))) {
      issues.push(`${where}: Kabelart "${value}" doppelt`)
    }
    for (const recommendation of component.recommendations) {
      used.add(recommendation.cable)
      if (!cableKeys.includes(recommendation.cable)) issues.push(`${where}: unbekannte Kabelart "${recommendation.cable}"`)
      // Bedingung oder Grund muss dabeistehen, sonst liest sich das Verbot oder die Pflicht wie eine allgemeine Regel
      if (recommendation.level !== 'suitable' && !recommendation.note) {
        issues.push(`${where}: "${recommendation.cable}" (${recommendation.level}) braucht note`)
      }
    }
  }
  for (const cable of tool.cables) {
    if (!used.has(cable.key)) issues.push(`cables (${cable.name}): nirgends verwendet`)
  }
  return issues
}

/** Suchbegriffe für die globale Suche */
export function cableKeywords(tool: CableTool): string[] {
  return [
    ...tool.properties.map((property) => property.name),
    ...tool.cables.flatMap((cable) => [cable.name, ...cable.aliases]),
    ...[...tool.components, ...tool.situations].flatMap((component) => [component.label, component.group, ...component.aliases]),
  ]
}
