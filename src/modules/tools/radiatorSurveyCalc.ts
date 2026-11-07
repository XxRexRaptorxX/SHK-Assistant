import { csvFile, csvText } from '../../lib/csv'
import type { RadiatorEntry, RadiatorSurvey, RadiatorSurveyRoom } from '../../storage/db'
import {
  appendRoom,
  ensureRoom as ensureAnyRoom,
  headerCsvLines,
  headerTextLines,
  isBlankHeader,
  mailtoUrl,
  newId,
  projectLabel,
  removeRoom as removeAnyRoom,
  roomLabel,
  updateRoom,
} from './surveyCommon'
import { dimensionFields, MAX_DIMENSION_VALUE, type DimensionField, type RadiatorSurveyTool } from './radiatorSurveyTool'

// Logik des Heizkörper-Aufmaßes, ohne Oberfläche und Speicher. Gemeinsames (Bauvorhaben, Räume, mailto) in surveyCommon.ts.
// Welche Maße ein Heizkörper hat, bestimmt sein Modell (dimensionFields); gespeichert sind sie als Text je Maß-key.

/** Höchste Anzahl gleicher Heizkörper in einem Eintrag */
export const MAX_RADIATORS = 99
export const ROOMS_TOO_LONG = 'Die Liste je Raum passt nicht in die E-Mail. Bitte die CSV-Datei anhängen.'

export function createRoom(name: string, now: Date): RadiatorSurveyRoom {
  return { id: newId(now), name: name.trim(), radiators: [] }
}

/** Neues, leeres Aufmaß mit einem Raum ohne Namen, damit man sofort eintragen kann */
export function createSurvey(toolId: string, now: Date): RadiatorSurvey {
  const stamp = now.toISOString()
  return { id: newId(now), toolId, project: '', rooms: [createRoom('', now)], createdAt: stamp, updatedAt: stamp }
}

export function addRoom(survey: RadiatorSurvey, name: string, now: Date): { survey: RadiatorSurvey; room: RadiatorSurveyRoom } {
  const room = createRoom(name, now)
  return { survey: appendRoom(survey, room, now), room }
}

export const removeRoom = (survey: RadiatorSurvey, roomId: string, now: Date) =>
  removeAnyRoom(survey, roomId, () => createRoom('', now), now)

export const ensureRoom = (survey: RadiatorSurvey, now: Date) => ensureAnyRoom(survey, () => createRoom('', now))

/** Anzahl Heizkörper eines Raums */
export const roomRadiators = (room: RadiatorSurveyRoom) => room.radiators.reduce((sum, radiator) => sum + radiator.count, 0)

/** Noch nichts eingetragen: solche Aufmaße werden nicht gespeichert */
export const isEmptySurvey = (survey: RadiatorSurvey) => isBlankHeader(survey) && survey.rooms[0]!.radiators.length === 0

/** Formularstand eines Heizkörpers, Maße als eingegebener Text */
export interface RadiatorDraft {
  /** Modell-key, leer = ohne Angabe */
  model: string
  /** Maß-key → Text; auch Maße eines vorher gewählten Modells bleiben stehen, gespeichert werden nur die passenden */
  values: Record<string, string>
  /** Thermostat-key, leer = ohne Angabe */
  thermostat: string
  count: number
  note: string
}

export const EMPTY_DRAFT: RadiatorDraft = { model: '', values: {}, thermostat: '', count: 1, note: '' }

/**
 * Eingabe eines Maßes bereinigt: Zahlen ohne Leerzeichen und Tausenderpunkte, Text ohne Rand.
 * '' = leer, undefined = keine gültige Zahl
 */
export function cleanValue(field: Pick<DimensionField, 'numeric'>, text: string): string | undefined {
  if (!field.numeric) return text.trim()
  const digits = text.replace(/[\s.]/g, '')
  if (digits === '') return ''
  if (!/^\d+$/.test(digits)) return undefined
  const value = Number(digits)
  return value >= 1 && value <= MAX_DIMENSION_VALUE ? String(value) : undefined
}

/** Was am Formular noch fehlt oder falsch ist, je Maß ein Satz; leer, wenn es gespeichert werden kann */
export function draftIssues(tool: RadiatorSurveyTool, draft: RadiatorDraft): string[] {
  return dimensionFields(tool, draft.model || undefined).flatMap((field) => {
    const value = cleanValue(field, draft.values[field.key] ?? '')
    if (value === undefined) return [`${field.label}: bitte eine ganze Zahl von 1 bis ${MAX_DIMENSION_VALUE.toLocaleString('de')} eintragen.`]
    if (value === '') return field.required ? [`${field.label} fehlt.`] : []
    if (!field.allowOther && !field.options.includes(value)) return [`${field.label}: bitte einen Wert aus der Auswahl nehmen.`]
    return []
  })
}

/** Heizkörper aus dem Formular, nur mit den Maßen des gewählten Modells; vorher draftIssues prüfen */
export function radiatorFromDraft(tool: RadiatorSurveyTool, draft: RadiatorDraft, id: string): RadiatorEntry {
  const values = Object.fromEntries(
    dimensionFields(tool, draft.model || undefined).flatMap((field) => {
      const value = cleanValue(field, draft.values[field.key] ?? '')
      return value ? [[field.key, value]] : []
    }),
  )
  return {
    id,
    ...(draft.model ? { model: draft.model } : {}),
    values,
    ...(draft.thermostat ? { thermostat: draft.thermostat } : {}),
    count: Math.min(MAX_RADIATORS, Math.max(1, Math.trunc(draft.count) || 1)),
    ...(draft.note.trim() ? { note: draft.note.trim() } : {}),
  }
}

export function draftFromRadiator(radiator: RadiatorEntry): RadiatorDraft {
  return {
    model: radiator.model ?? '',
    values: { ...radiator.values },
    thermostat: radiator.thermostat ?? '',
    count: radiator.count,
    note: radiator.note ?? '',
  }
}

const withRoom = (survey: RadiatorSurvey, roomId: string, change: (room: RadiatorSurveyRoom) => RadiatorSurveyRoom, now: Date) => {
  const room = survey.rooms.find((candidate) => candidate.id === roomId)
  return room ? updateRoom(survey, change(room), now) : survey
}

export function addRadiator(tool: RadiatorSurveyTool, survey: RadiatorSurvey, roomId: string, draft: RadiatorDraft, now: Date) {
  const radiator = radiatorFromDraft(tool, draft, newId(now))
  return withRoom(survey, roomId, (room) => ({ ...room, radiators: [...room.radiators, radiator] }), now)
}

export function replaceRadiator(
  tool: RadiatorSurveyTool,
  survey: RadiatorSurvey,
  roomId: string,
  radiatorId: string,
  draft: RadiatorDraft,
  now: Date,
): RadiatorSurvey {
  const radiator = radiatorFromDraft(tool, draft, radiatorId)
  return withRoom(
    survey,
    roomId,
    (room) => ({ ...room, radiators: room.radiators.map((other) => (other.id === radiatorId ? radiator : other)) }),
    now,
  )
}

export function removeRadiator(survey: RadiatorSurvey, roomId: string, radiatorId: string, now: Date): RadiatorSurvey {
  return withRoom(survey, roomId, (room) => ({ ...room, radiators: room.radiators.filter((other) => other.id !== radiatorId) }), now)
}

/** Bezeichnung eines Modells; ein key, den es im Inhalt nicht mehr gibt, bleibt als solcher sichtbar */
export function modelLabel(tool: RadiatorSurveyTool, key: string | undefined): string {
  if (key === undefined) return ''
  return tool.models.find((model) => model.key === key)?.label ?? `Unbekanntes Modell (${key})`
}

export function thermostatLabel(tool: RadiatorSurveyTool, key: string | undefined): string {
  if (key === undefined) return ''
  return tool.thermostats.find((thermostat) => thermostat.key === key)?.label ?? `Unbekannter Thermostat (${key})`
}

/** Maße in der Reihenfolge des Katalogs, unbekannte Maß-keys danach */
function orderedValues(tool: RadiatorSurveyTool, values: Record<string, string>): { key: string; label: string; unit: string; value: string }[] {
  const known = tool.dimensions.flatMap((dimension) =>
    values[dimension.key] ? [{ key: dimension.key, label: dimension.label, unit: dimension.unit, value: values[dimension.key]! }] : [],
  )
  const unknown = Object.entries(values)
    .filter(([key]) => !tool.dimensions.some((dimension) => dimension.key === key))
    .map(([key, value]) => ({ key, label: key, unit: '', value }))
  return [...known, ...unknown]
}

/** z. B. „Höhe 600 mm, Länge 1000 mm“ */
export function valuesText(tool: RadiatorSurveyTool, values: Record<string, string>): string {
  return orderedValues(tool, values)
    .map((item) => `${item.label} ${item.value}${item.unit ? ` ${item.unit}` : ''}`)
    .join(', ')
}

/** z. B. „Kompaktheizkörper, Bauart / Typ 22, Höhe 600 mm, Länge 1000 mm“ */
export function radiatorName(tool: RadiatorSurveyTool, radiator: Pick<RadiatorEntry, 'model' | 'values'>): string {
  return [modelLabel(tool, radiator.model), valuesText(tool, radiator.values)].filter(Boolean).join(', ') || 'Heizkörper'
}

/** Eine Zeile je Heizkörper-Eintrag: Anzahl, Name, Thermostat und Notiz */
export function radiatorLine(tool: RadiatorSurveyTool, radiator: RadiatorEntry): string {
  const thermostat = radiator.thermostat ? `, Thermostat ${thermostatLabel(tool, radiator.thermostat)}` : ''
  const note = radiator.note ? ` (${radiator.note})` : ''
  return `${radiator.count} × ${radiatorName(tool, radiator)}${thermostat}${note}`
}

export interface SizeLine {
  model?: string
  values: Record<string, string>
  count: number
}

export interface RadiatorSummary {
  /** Gleiche Heizkörper (Modell und alle Maße) über alle Räume zusammengefasst */
  sizes: SizeLine[]
  /** Anzahl je Thermostat in der Reihenfolge des Inhalts, unbekannte danach; ohne Angabe extra */
  thermostats: { key: string; label: string; count: number }[]
  withoutThermostat: number
  total: number
}

export function radiatorSummary(tool: RadiatorSurveyTool, survey: RadiatorSurvey): RadiatorSummary {
  const radiators = survey.rooms.flatMap((room) => room.radiators)
  const sizes = new Map<string, SizeLine>()
  const thermostats = new Map<string, number>()
  let withoutThermostat = 0
  for (const radiator of radiators) {
    const key = JSON.stringify([radiator.model, Object.entries(radiator.values).sort(([a], [b]) => a.localeCompare(b))])
    const line = sizes.get(key)
    if (line) line.count += radiator.count
    else sizes.set(key, { ...(radiator.model ? { model: radiator.model } : {}), values: radiator.values, count: radiator.count })
    if (radiator.thermostat) thermostats.set(radiator.thermostat, (thermostats.get(radiator.thermostat) ?? 0) + radiator.count)
    else withoutThermostat += radiator.count
  }

  // Modelle in der Reihenfolge des Inhalts, unbekannte danach, ohne Angabe zuletzt; dann die Maße aufsteigend
  const modelRank = (key: string | undefined) => {
    if (key === undefined) return tool.models.length + 1
    const index = tool.models.findIndex((model) => model.key === key)
    return index === -1 ? tool.models.length : index
  }
  const compareValues = (a: SizeLine, b: SizeLine) => {
    for (const dimension of tool.dimensions) {
      const order = (a.values[dimension.key] ?? '').localeCompare(b.values[dimension.key] ?? '', 'de', { numeric: true })
      if (order !== 0) return order
    }
    return 0
  }
  const known = tool.thermostats.flatMap((thermostat) => {
    const count = thermostats.get(thermostat.key) ?? 0
    return count > 0 ? [{ key: thermostat.key, label: thermostat.label, count }] : []
  })
  const unknown = [...thermostats]
    .filter(([key]) => !tool.thermostats.some((thermostat) => thermostat.key === key))
    .map(([key, count]) => ({ key, label: thermostatLabel(tool, key), count }))
  return {
    sizes: [...sizes.values()].sort((a, b) => modelRank(a.model) - modelRank(b.model) || compareValues(a, b)),
    thermostats: [...known, ...unknown],
    withoutThermostat,
    total: radiators.reduce((sum, radiator) => sum + radiator.count, 0),
  }
}

/** Räume mit mindestens einem Heizkörper */
export const roomsWithRadiators = (survey: RadiatorSurvey) => survey.rooms.filter((room) => room.radiators.length > 0)

/** Das Aufmaß als Text für die E-Mail; ohne Liste je Raum, wenn withRooms false ist */
export function surveyText(tool: RadiatorSurveyTool, survey: RadiatorSurvey, withRooms = true): string {
  const summary = radiatorSummary(tool, survey)
  const lines = [...headerTextLines(tool.title, survey), '']
  if (summary.total === 0) {
    lines.push('Noch keine Heizkörper eingetragen.')
    return lines.join('\r\n')
  }
  lines.push('Heizkörper je Raum')
  if (withRooms) {
    for (const room of roomsWithRadiators(survey)) {
      lines.push(`${roomLabel(room)}:`, ...room.radiators.map((radiator) => `  ${radiatorLine(tool, radiator)}`))
    }
  } else {
    lines.push(ROOMS_TOO_LONG)
  }
  lines.push('', 'Zusammenfassung', ...summary.sizes.map((size) => `${size.count} × ${radiatorName(tool, size)}`))
  if (summary.thermostats.length > 0) {
    lines.push('', 'Thermostate', ...summary.thermostats.map((thermostat) => `${thermostat.count} × ${thermostat.label}`))
    if (summary.withoutThermostat > 0) lines.push(`${summary.withoutThermostat} × ohne Angabe`)
  }
  lines.push('', `Heizkörper gesamt: ${summary.total}`)
  return lines.join('\r\n')
}

/** mailto-Adresse mit der Liste im Text; ist sie zu lang, bleibt nur die Zusammenfassung */
export function surveyMailto(tool: RadiatorSurveyTool, survey: RadiatorSurvey, recipients: readonly string[]): string {
  return mailtoUrl(recipients, `${tool.title}: ${projectLabel(survey)}`, [
    surveyText(tool, survey),
    surveyText(tool, survey, false),
  ])
}

/**
 * CSV für Excel in deutscher Einstellung: eine Zeile je Heizkörper-Eintrag mit einer Spalte je Maß (leer, wenn das
 * Modell es nicht abfragt), darunter die Zusammenfassung und die Thermostate
 */
export function surveyCsv(tool: RadiatorSurveyTool, survey: RadiatorSurvey): string {
  const summary = radiatorSummary(tool, survey)
  const dimensionHeads = tool.dimensions.map((dimension) => csvText(dimension.unit ? `${dimension.label} (${dimension.unit})` : dimension.label))
  const dimensionCells = (values: Record<string, string>) => tool.dimensions.map((dimension) => csvText(values[dimension.key] ?? ''))
  const lines = [
    ...headerCsvLines(tool.title, survey),
    '',
    ['Raum', 'Modell', ...dimensionHeads, 'Thermostat', 'Anzahl', 'Notiz'].join(';'),
    ...roomsWithRadiators(survey).flatMap((room) =>
      room.radiators.map((radiator) =>
        [
          csvText(roomLabel(room)),
          csvText(modelLabel(tool, radiator.model)),
          ...dimensionCells(radiator.values),
          csvText(thermostatLabel(tool, radiator.thermostat)),
          radiator.count,
          csvText(radiator.note ?? ''),
        ].join(';'),
      ),
    ),
    '',
    'Zusammenfassung',
    ['Modell', ...dimensionHeads, 'Anzahl'].join(';'),
    ...summary.sizes.map((size) => [csvText(modelLabel(tool, size.model)), ...dimensionCells(size.values), size.count].join(';')),
    ['Gesamt', ...tool.dimensions.map(() => ''), summary.total].join(';'),
  ]
  if (summary.thermostats.length > 0) {
    lines.push(
      '',
      'Thermostat;Anzahl',
      ...summary.thermostats.map((thermostat) => `${csvText(thermostat.label)};${thermostat.count}`),
      ...(summary.withoutThermostat > 0 ? [`ohne Angabe;${summary.withoutThermostat}`] : []),
    )
  }
  return csvFile(lines)
}
