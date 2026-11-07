import { csvFile, csvText } from '../../lib/csv'
import { normalizeForSearch } from '../../lib/text'
import type { ValveSurvey, ValveSurveyRoom } from '../../storage/db'
import { valveTypes, type ValveSurveyTool, type ValveType } from './valveSurveyTool'

// Logik des Ventil-Aufmaßes, ohne Oberfläche und Speicher. Alle Änderungen liefern ein neues Aufmaß
// mit neuem updatedAt zurück; das alte bleibt unverändert.

/** Höchste Stückzahl je Raum und Ventiltyp */
export const MAX_COUNT = 999
/** Längste mailto-Adresse; manche Mailprogramme schneiden längere ab */
export const MAILTO_MAX_LENGTH = 1800
export const NO_PROJECT = 'Ohne Bauvorhaben'
export const NO_ROOM = 'Ohne Raumangabe'
export const ROOMS_TOO_LONG = 'Die Aufteilung nach Räumen passt nicht in die E-Mail. Bitte die CSV-Datei anhängen.'

const newId = (now: Date) => `${now.toISOString()}-${Math.random().toString(36).slice(2, 8)}`

export function createRoom(name: string, now: Date): ValveSurveyRoom {
  return { id: newId(now), name: name.trim(), counts: {} }
}

/** Neues, leeres Aufmaß mit einem Raum ohne Namen, damit man sofort zählen kann */
export function createSurvey(toolId: string, now: Date): ValveSurvey {
  const stamp = now.toISOString()
  return { id: newId(now), toolId, project: '', rooms: [createRoom('', now)], createdAt: stamp, updatedAt: stamp }
}

function touch(survey: ValveSurvey, change: Partial<ValveSurvey>, now: Date): ValveSurvey {
  return { ...survey, ...change, updatedAt: now.toISOString() }
}

export function setProject(survey: ValveSurvey, project: string, now: Date): ValveSurvey {
  return touch(survey, { project }, now)
}

export function setNote(survey: ValveSurvey, note: string, now: Date): ValveSurvey {
  const { note: _old, ...rest } = survey
  return touch(rest, note.trim() ? { note } : {}, now)
}

export function addRoom(survey: ValveSurvey, name: string, now: Date): { survey: ValveSurvey; room: ValveSurveyRoom } {
  const room = createRoom(name, now)
  return { survey: touch(survey, { rooms: [...survey.rooms, room] }, now), room }
}

const mapRoom = (survey: ValveSurvey, roomId: string, change: (room: ValveSurveyRoom) => ValveSurveyRoom) =>
  survey.rooms.map((room) => (room.id === roomId ? change(room) : room))

export function renameRoom(survey: ValveSurvey, roomId: string, name: string, now: Date): ValveSurvey {
  return touch(survey, { rooms: mapRoom(survey, roomId, (room) => ({ ...room, name })) }, now)
}

/** Entfernt einen Raum mit seinen Zählungen; ein Aufmaß behält immer mindestens einen Raum */
export function removeRoom(survey: ValveSurvey, roomId: string, now: Date): ValveSurvey {
  const rooms = survey.rooms.filter((room) => room.id !== roomId)
  return touch(survey, { rooms: rooms.length > 0 ? rooms : [createRoom('', now)] }, now)
}

/** Für geladene Aufmaße: ohne Raum (z. B. beschädigter Speicher) bekommt es einen leeren, damit man zählen kann */
export function ensureRoom(survey: ValveSurvey, now: Date): ValveSurvey {
  return survey.rooms.length > 0 ? survey : { ...survey, rooms: [createRoom('', now)] }
}

export const countOf =(room: ValveSurveyRoom, typeKey: string) => room.counts[typeKey] ?? 0

/** Ganze Zahl von 0 bis MAX_COUNT; Unbrauchbares zählt als 0 */
export function clampCount(count: number): number {
  return Number.isFinite(count) ? Math.min(MAX_COUNT, Math.max(0, Math.trunc(count))) : 0
}

/** Setzt die Stückzahl; Typen ohne Stück werden nicht gespeichert */
export function setCount(survey: ValveSurvey, roomId: string, typeKey: string, count: number, now: Date): ValveSurvey {
  const next = clampCount(count)
  return touch(
    survey,
    {
      rooms: mapRoom(survey, roomId, (room) => {
        const { [typeKey]: _old, ...counts } = room.counts
        return { ...room, counts: next > 0 ? { ...counts, [typeKey]: next } : counts }
      }),
    },
    now,
  )
}

/** Stückzahl eines Raums über alle Typen */
export const roomPieces = (room: ValveSurveyRoom) => Object.values(room.counts).reduce((sum, count) => sum + count, 0)

export const roomLabel = (room: ValveSurveyRoom) => room.name.trim() || NO_ROOM
export const projectLabel = (survey: ValveSurvey) => survey.project.trim() || NO_PROJECT

/** Noch nichts eingetragen: solche Aufmaße werden nicht gespeichert */
export function isEmptySurvey(survey: ValveSurvey): boolean {
  return (
    survey.project.trim() === '' &&
    (survey.note ?? '').trim() === '' &&
    survey.rooms.length === 1 &&
    survey.rooms.every((room) => room.name.trim() === '' && roomPieces(room) === 0)
  )
}

/** Zuletzt bearbeitete zuerst */
export const sortSurveys = (surveys: readonly ValveSurvey[]) =>
  [...surveys].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

/** ISO-Zeitstempel → lokales Datum „07.11.2026“ */
export function formatSurveyDate(stamp: string): string {
  const date = new Date(stamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

export const surveyLabel = (survey: ValveSurvey) => `${projectLabel(survey)} (${formatSurveyDate(survey.createdAt)})`

export interface BillLine {
  type: ValveType
  count: number
}

export interface Bill {
  /** Nur Gruppen und Typen mit mindestens einem Stück */
  groups: { key: string; name: string; lines: BillLine[]; subtotal: number }[]
  /** Alle Summen aus dem Inhalt, auch mit 0 */
  totals: { key: string; name: string; count: number }[]
  /** Gezählte Stück, deren Typ es im Inhalt nicht mehr gibt */
  unknownPieces: number
}

/** Stückzahl je Ventiltyp über alle Räume */
export function typeCounts(survey: ValveSurvey): Map<string, number> {
  const counts = new Map<string, number>()
  for (const room of survey.rooms) {
    for (const [key, count] of Object.entries(room.counts)) counts.set(key, (counts.get(key) ?? 0) + count)
  }
  return counts
}

/** Stückliste: je Typ die Summe aller Räume, je Gruppe eine Zwischensumme, darunter die Summen des Inhalts */
export function surveyBill(tool: ValveSurveyTool, survey: ValveSurvey): Bill {
  const counts = typeCounts(survey)
  const known = new Set(valveTypes(tool).map((type) => type.key))
  const groups = tool.groups.flatMap((group) => {
    const lines = group.types.flatMap((type) => {
      const count = counts.get(type.key) ?? 0
      return count > 0 ? [{ type, count }] : []
    })
    return lines.length > 0
      ? [{ key: group.key, name: group.name, lines, subtotal: lines.reduce((sum, line) => sum + line.count, 0) }]
      : []
  })
  const totals = tool.totals.map((total) => ({
    key: total.key,
    name: total.name,
    count: valveTypes(tool)
      .filter((type) => type.counts.includes(total.key))
      .reduce((sum, type) => sum + (counts.get(type.key) ?? 0), 0),
  }))
  const unknownPieces = [...counts].reduce((sum, [key, count]) => sum + (known.has(key) ? 0 : count), 0)
  return { groups, totals, unknownPieces }
}

export const billIsEmpty = (bill: Bill) => bill.groups.length === 0

/** Räume mit mindestens einem Stück, Typen in der Reihenfolge des Inhalts */
export function roomLines(tool: ValveSurveyTool, survey: ValveSurvey): { room: ValveSurveyRoom; lines: BillLine[] }[] {
  return survey.rooms.flatMap((room) => {
    const lines = valveTypes(tool).flatMap((type) => {
      const count = countOf(room, type.key)
      return count > 0 ? [{ type, count }] : []
    })
    return lines.length > 0 ? [{ room, lines }] : []
  })
}

/** Die Aufteilung nach Räumen lohnt nur, wenn es mehr als einen Raum gibt oder der eine einen Namen hat */
export function showRoomBreakdown(tool: ValveSurveyTool, survey: ValveSurvey): boolean {
  const rooms = roomLines(tool, survey)
  return rooms.length > 1 || (rooms.length === 1 && rooms[0]!.room.name.trim() !== '')
}

const articleText = (type: ValveType) => (type.article ? ` – Art.-Nr. ${type.article}` : '')

/** Das Aufmaß als Text für die E-Mail; ohne Räume, wenn withRooms false ist */
export function surveyText(tool: ValveSurveyTool, survey: ValveSurvey, withRooms = true): string {
  const bill = surveyBill(tool, survey)
  const note = (survey.note ?? '').trim()
  const lines = [
    tool.title,
    `Bauvorhaben: ${projectLabel(survey)}`,
    `Aufmaß vom: ${formatSurveyDate(survey.createdAt)}`,
    ...(note ? [`Bemerkung: ${note}`] : []),
    '',
    `Stückliste (Ersatz ${tool.replacementName})`,
    ...(billIsEmpty(bill)
      ? ['Noch nichts gezählt.']
      : bill.groups.flatMap((group) => group.lines.map((line) => `${line.count} × ${line.type.label}${articleText(line.type)}`))),
    '',
    ...bill.totals.map((total) => `${total.name}: ${total.count}`),
  ]
  if (showRoomBreakdown(tool, survey)) {
    lines.push('', 'Aufteilung nach Räumen')
    if (withRooms) {
      for (const { room, lines: roomItems } of roomLines(tool, survey)) {
        lines.push(`${roomLabel(room)}: ${roomItems.map((line) => `${line.count} × ${line.type.label}`).join(', ')}`)
      }
    } else {
      lines.push(ROOMS_TOO_LONG)
    }
  }
  return lines.join('\r\n')
}

/** Eine oder mehrere Adressen, getrennt durch Komma, Semikolon oder Leerzeichen; undefined, wenn eine ungültig ist */
export function parseRecipients(text: string): string[] | undefined {
  const parts = text.split(/[\s,;]+/).filter((part) => part !== '')
  return parts.every((part) => /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(part)) ? parts : undefined
}

/** mailto-Adresse mit Stückliste im Text; ist sie zu lang, fehlt die Aufteilung nach Räumen */
export function surveyMailto(tool: ValveSurveyTool, survey: ValveSurvey, recipients: readonly string[]): string {
  const subject = `${tool.title}: ${projectLabel(survey)}`
  const mailto = (body: string) =>
    `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
  const full = mailto(surveyText(tool, survey))
  return full.length <= MAILTO_MAX_LENGTH ? full : mailto(surveyText(tool, survey, false))
}

/**
 * CSV für Excel in deutscher Einstellung: Kopf mit Bauvorhaben, Stückliste mit Zwischensummen je Gruppe,
 * die Summen und, wenn es Räume gibt, eine Zeile je Raum und Ventiltyp.
 */
export function surveyCsv(tool: ValveSurveyTool, survey: ValveSurvey): string {
  const bill = surveyBill(tool, survey)
  const note = (survey.note ?? '').trim()
  const lines = [
    csvText(tool.title),
    `Bauvorhaben;${csvText(projectLabel(survey))}`,
    `Aufmaß vom;${formatSurveyDate(survey.createdAt)}`,
    ...(note ? [`Bemerkung;${csvText(note)}`] : []),
    '',
    `Ventil;Art.-Nr. ${csvText(tool.replacementName)};Stück`,
    ...bill.groups.flatMap((group) => [
      ...group.lines.map((line) => `${csvText(line.type.label)};${csvText(line.type.article ?? '')};${line.count}`),
      `${csvText(`${group.name} gesamt`)};;${group.subtotal}`,
    ]),
    '',
    ...bill.totals.map((total) => `${csvText(total.name)};;${total.count}`),
  ]
  if (showRoomBreakdown(tool, survey)) {
    lines.push('', 'Raum;Ventil;Art.-Nr.;Stück')
    for (const { room, lines: roomItems } of roomLines(tool, survey)) {
      for (const line of roomItems) {
        lines.push(`${csvText(roomLabel(room))};${csvText(line.type.label)};${csvText(line.type.article ?? '')};${line.count}`)
      }
    }
  }
  return csvFile(lines)
}

/** z. B. „aufmass-thermostatventile-mueller-hauptstr-2026-11-07.csv“ */
export function surveyFileName(tool: ValveSurveyTool, survey: ValveSurvey): string {
  const slug = normalizeForSearch(survey.project)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  const date = formatSurveyDate(survey.createdAt).split('.').reverse().join('-')
  const toolName = tool.id.split('.').slice(1).join('-')
  return `${[toolName, slug, date].filter((part) => part !== '').join('-')}.csv`
}
