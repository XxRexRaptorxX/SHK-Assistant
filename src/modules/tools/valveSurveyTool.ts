import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { toolTagsSchema } from './toolTags.ts'

// Aufmaß-Tools ("kind": "valveSurvey"): vorhandene Ventile je Raum zählen und daraus die Stückliste für den
// Tausch bilden, siehe ValveSurvey.tsx und valveSurveyCalc.ts. Im Inhalt stehen nur die Ventiltypen mit
// Artikelnummer des Ersatzes und die Summen; die gezählten Aufmaße sind Nutzerdaten auf dem Gerät (IndexedDB).

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

const valveTypeSchema = z.strictObject({
  /** Fester Schlüssel; unter ihm sind die Zählungen gespeichert, daher nach dem ersten Einsatz nicht mehr ändern */
  key,
  /** Vollständige Bezeichnung, auch in Export und E-Mail, z. B. „1/2" Eck“ */
  label: z.string().trim().min(1),
  /** Artikelnummer des Ersatzes; fehlt, wenn nichts getauscht wird (z. B. Einbauventil) */
  article: z.string().trim().min(1).optional(),
  /** Zusatz unter der Bezeichnung, z. B. „zählt als Stellantrieb“ */
  note: z.string().trim().default(''),
  /** Summen (totals[].key), in die jedes gezählte Stück eingeht */
  counts: z.array(key).min(1),
})

export const valveSurveyToolSchema = defineEntrySchema({
  kind: z.literal('valveSurvey'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: toolTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Hinweis am Ende des Tools, z. B. wo die Daten bleiben */
  closingNote: z.string().trim().min(1),
  /** Ersatzprodukt der Artikelnummern, z. B. „Danfoss RA-N“ (Spaltenkopf der Stückliste) */
  replacementName: z.string().trim().min(1),
  /** Ventiltypen in Gruppen; jede Gruppe bekommt in der Stückliste eine Zwischensumme */
  groups: z
    .array(
      z.strictObject({
        key,
        /** z. B. „Eck“ */
        name: z.string().trim().min(1),
        types: z.array(valveTypeSchema).min(1),
      }),
    )
    .min(1),
  /** Summen unter der Stückliste, z. B. Thermostatventile, Thermostatköpfe, Stellantriebe */
  totals: z
    .array(
      z.strictObject({
        key,
        name: z.string().trim().min(1),
      }),
    )
    .min(1),
  /** Weitere Suchbegriffe */
  keywords: z.array(z.string().trim().min(1)).default([]),
})

export type ValveSurveyTool = z.output<typeof valveSurveyToolSchema>
export type ValveGroup = ValveSurveyTool['groups'][number]
export type ValveType = ValveGroup['types'][number]

/** Alle Ventiltypen in der Reihenfolge des Inhalts */
export const valveTypes = (tool: ValveSurveyTool): ValveType[] => tool.groups.flatMap((group) => group.types)

export function checkValveSurveyTool(tool: ValveSurveyTool): string[] {
  const issues: string[] = []
  const duplicates = (keys: string[]) => keys.filter((item, index) => keys.indexOf(item) !== index)

  const groupKeys = duplicates(tool.groups.map((group) => group.key))
  if (groupKeys.length > 0) issues.push(`groups: key doppelt vergeben (${groupKeys.join(', ')})`)
  const typeKeys = duplicates(valveTypes(tool).map((type) => type.key))
  if (typeKeys.length > 0) issues.push(`types: key doppelt vergeben (${typeKeys.join(', ')})`)
  const totalKeys = tool.totals.map((total) => total.key)
  if (duplicates(totalKeys).length > 0) issues.push(`totals: key doppelt vergeben (${duplicates(totalKeys).join(', ')})`)

  for (const type of valveTypes(tool)) {
    for (const total of type.counts) {
      if (!totalKeys.includes(total)) issues.push(`types (${type.key}): unbekannte Summe "${total}"`)
    }
    if (duplicates(type.counts).length > 0) issues.push(`types (${type.key}): Summe doppelt genannt`)
  }
  for (const total of totalKeys) {
    if (!valveTypes(tool).some((type) => type.counts.includes(total))) issues.push(`totals (${total}): kein Ventiltyp zählt dazu`)
  }
  return issues
}

export function valveSurveyKeywords(tool: ValveSurveyTool): string[] {
  return [
    ...tool.keywords,
    tool.replacementName,
    ...tool.groups.map((group) => group.name),
    ...valveTypes(tool).flatMap((type) => (type.article ? [type.label, type.article] : [type.label])),
    ...tool.totals.map((total) => total.name),
  ]
}
