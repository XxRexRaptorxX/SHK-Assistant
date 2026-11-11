import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'

// Heizkörper-Aufmaß ("kind": "radiatorSurvey"): Heizkörper je Raum mit Modell, Maßen und Thermostat,
// siehe RadiatorSurvey.tsx und radiatorSurveyCalc.ts. Das Modell bestimmt, welche Maße abgefragt werden und
// welche Pflicht sind; hat ein Maß Auswahlwerte, wird es angetippt statt eingetippt. Im Inhalt stehen nur die
// Auswahllisten; die Aufmaße sind Nutzerdaten auf dem Gerät (IndexedDB).

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

/** Größte Zahl eines Maßes (10 m in mm bzw. Gliederzahl) */
export const MAX_DIMENSION_VALUE = 10_000

/** Eintrag einer Auswahlliste. Unter dem key ist die Wahl gespeichert: nach dem ersten Einsatz nicht mehr ändern */
const optionSchema = z.strictObject({
  key,
  label: z.string().trim().min(1),
})

/** Ein Maß, das abgefragt werden kann, z. B. Höhe in mm */
const dimensionSchema = z.strictObject({
  key,
  label: z.string().trim().min(1),
  /** Einheit zur Anzeige, z. B. „mm“; leer bei Bauart oder Gliederzahl */
  unit: z.string().trim().default(''),
  /** Ganze Zahl von 1 bis MAX_DIMENSION_VALUE; sonst Freitext (z. B. Bauart „22“) */
  numeric: z.boolean().default(true),
})

/** Ein Maß bei einem Modell: Pflicht oder nicht, und wahlweise Werte zum Antippen */
const modelDimensionSchema = z.strictObject({
  /** dimensions[].key */
  key,
  required: z.boolean().default(false),
  /** Auswahlwerte als Text, z. B. "600"; leer = eintippen */
  options: z.array(z.string().trim().min(1)).default([]),
  /** Neben den Auswahlwerten ein anderes Maß eintippen erlauben */
  allowOther: z.boolean().default(true),
})

export const radiatorSurveyToolSchema = defineEntrySchema({
  kind: z.literal('radiatorSurvey'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Hinweis am Ende des Tools, z. B. wo die Daten bleiben */
  closingNote: z.string().trim().min(1),
  /** Was am Inhalt noch fehlt; beginnt mit „TODO: Inhalt fehlt“, bei verified nicht erlaubt */
  todo: z.string().trim().startsWith('TODO: Inhalt fehlt').optional(),
  /** Alle Maße, die ein Modell abfragen kann; ihre Reihenfolge gilt auch für Export und Anzeige */
  dimensions: z.array(dimensionSchema).min(1),
  /** Maße, wenn kein Modell gewählt ist */
  defaultDimensions: z.array(modelDimensionSchema).min(1),
  /** Auswahl „Modell“, z. B. Kompaktheizkörper, mit den Maßen, die es abfragt */
  models: z.array(optionSchema.extend({ dimensions: z.array(modelDimensionSchema).min(1) })).min(1),
  /** Auswahl „Thermostat“, z. B. 1/2" Eck */
  thermostats: z.array(optionSchema).min(1),
  /** Weitere Suchbegriffe */
  keywords: z.array(z.string().trim().min(1)).default([]),
})

export type RadiatorSurveyTool = z.output<typeof radiatorSurveyToolSchema>
export type RadiatorModel = RadiatorSurveyTool['models'][number]
export type Dimension = RadiatorSurveyTool['dimensions'][number]
export type ModelDimension = RadiatorSurveyTool['defaultDimensions'][number]

/** Ein Maß des gewählten Modells mit seinen Angaben aus dem Katalog */
export type DimensionField = Dimension & Omit<ModelDimension, 'key'>

/** Maße für ein Modell (undefined = ohne Modell) in der Reihenfolge des Katalogs */
export function dimensionFields(tool: RadiatorSurveyTool, modelKey: string | undefined): DimensionField[] {
  const model = modelKey === undefined ? undefined : tool.models.find((candidate) => candidate.key === modelKey)
  const chosen = model?.dimensions ?? tool.defaultDimensions
  return tool.dimensions.flatMap((dimension) => {
    const field = chosen.find((candidate) => candidate.key === dimension.key)
    return field ? [{ ...dimension, required: field.required, options: field.options, allowOther: field.allowOther }] : []
  })
}

const isValidNumber = (text: string) => /^\d+$/.test(text) && Number(text) >= 1 && Number(text) <= MAX_DIMENSION_VALUE

export function checkRadiatorSurveyTool(tool: RadiatorSurveyTool): string[] {
  const issues: string[] = []
  const duplicates = (keys: string[]) => keys.filter((item, index) => keys.indexOf(item) !== index)

  for (const [name, options] of [
    ['models', tool.models],
    ['thermostats', tool.thermostats],
    ['dimensions', tool.dimensions],
  ] as const) {
    const keys = duplicates(options.map((option) => option.key))
    if (keys.length > 0) issues.push(`${name}: key doppelt vergeben (${keys.join(', ')})`)
    const labels = duplicates(options.map((option) => option.label))
    if (labels.length > 0) issues.push(`${name}: label doppelt vergeben (${labels.join(', ')})`)
  }

  const used = new Set<string>()
  const checkFields = (where: string, fields: readonly ModelDimension[]) => {
    const keys = duplicates(fields.map((field) => field.key))
    if (keys.length > 0) issues.push(`${where}: Maß doppelt genannt (${keys.join(', ')})`)
    if (!fields.some((field) => field.required)) issues.push(`${where}: kein Pflichtmaß`)
    for (const field of fields) {
      used.add(field.key)
      const dimension = tool.dimensions.find((candidate) => candidate.key === field.key)
      if (!dimension) {
        issues.push(`${where}: unbekanntes Maß "${field.key}"`)
        continue
      }
      if (!field.allowOther && field.options.length === 0) issues.push(`${where} (${field.key}): weder Auswahlwerte noch Eingabe erlaubt`)
      const doubled = duplicates(field.options)
      if (doubled.length > 0) issues.push(`${where} (${field.key}): Auswahlwert doppelt (${doubled.join(', ')})`)
      if (dimension.numeric) {
        const invalid = field.options.filter((option) => !isValidNumber(option))
        if (invalid.length > 0) issues.push(`${where} (${field.key}): keine ganze Zahl von 1 bis ${MAX_DIMENSION_VALUE} (${invalid.join(', ')})`)
      }
    }
  }
  checkFields('defaultDimensions', tool.defaultDimensions)
  for (const model of tool.models) checkFields(`models (${model.key})`, model.dimensions)

  for (const dimension of tool.dimensions) {
    if (!used.has(dimension.key)) issues.push(`dimensions (${dimension.key}): von keinem Modell abgefragt`)
  }
  if (tool.status === 'verified' && tool.todo) issues.push('todo: bei verified nicht erlaubt')
  return issues
}

export function radiatorSurveyKeywords(tool: RadiatorSurveyTool): string[] {
  return [
    ...tool.keywords,
    ...tool.models.map((model) => model.label),
    ...tool.dimensions.map((dimension) => dimension.label),
    ...tool.thermostats.map((thermostat) => thermostat.label),
  ]
}
