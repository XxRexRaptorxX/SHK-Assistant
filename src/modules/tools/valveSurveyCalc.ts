import { csvFile, csvText } from '../../lib/csv'
import type { ValveSurvey, ValveSurveyRoom } from '../../storage/db'
import {
  appendRoom,
  headerCsvLines,
  headerTextLines,
  isBlankHeader,
  mailtoUrl,
  newId,
  projectLabel,
  removeRoom as removeAnyRoom,
  ensureRoom as ensureAnyRoom,
  roomLabel,
  touch,
} from './surveyCommon'
import { valveTypes, type ValveSurveyTool, type ValveType } from './valveSurveyTool'

// Logik des Ventil-Aufmaßes, ohne Oberfläche und Speicher. Gemeinsames (Bauvorhaben, Räume, mailto) in surveyCommon.ts.

/** Höchste Stückzahl je Raum und Ventiltyp */
export const MAX_COUNT = 999
export const ROOMS_TOO_LONG = 'Die Aufteilung nach Räumen passt nicht in die E-Mail. Bitte die CSV-Datei anhängen.'

export function createRoom(name: string, now: Date): ValveSurveyRoom {
  return { id: newId(now), name: name.trim(), counts: {} }
}

/** Neues, leeres Aufmaß mit einem Raum ohne Namen, damit man sofort zählen kann */
export function createSurvey(toolId: string, now: Date): ValveSurvey {
  const stamp = now.toISOString()
  return { id: newId(now), toolId, project: '', rooms: [createRoom('', now)], createdAt: stamp, updatedAt: stamp }
}

export function addRoom(survey: ValveSurvey, name: string, now: Date): { survey: ValveSurvey; room: ValveSurveyRoom } {
  const room = createRoom(name, now)
  return { survey: appendRoom(survey, room, now), room }
}

export const removeRoom = (survey: ValveSurvey, roomId: string, now: Date) =>
  removeAnyRoom(survey, roomId, () => createRoom('', now), now)

export const ensureRoom = (survey: ValveSurvey, now: Date) => ensureAnyRoom(survey, () => createRoom('', now))

export const countOf = (room: ValveSurveyRoom, typeKey: string) => room.counts[typeKey] ?? 0

/** Ganze Zahl von 0 bis MAX_COUNT; Unbrauchbares zählt als 0 */
export function clampCount(count: number, max = MAX_COUNT): number {
  return Number.isFinite(count) ? Math.min(max, Math.max(0, Math.trunc(count))) : 0
}

/** Setzt die Stückzahl; Typen ohne Stück werden nicht gespeichert */
export function setCount(survey: ValveSurvey, roomId: string, typeKey: string, count: number, now: Date): ValveSurvey {
  const next = clampCount(count)
  return touch(
    survey,
    {
      rooms: survey.rooms.map((room) => {
        if (room.id !== roomId) return room
        const { [typeKey]: _old, ...counts } = room.counts
        return { ...room, counts: next > 0 ? { ...counts, [typeKey]: next } : counts }
      }),
    },
    now,
  )
}

/** Stückzahl eines Raums über alle Typen */
export const roomPieces = (room: ValveSurveyRoom) => Object.values(room.counts).reduce((sum, count) => sum + count, 0)

/** Noch nichts eingetragen: solche Aufmaße werden nicht gespeichert */
export const isEmptySurvey = (survey: ValveSurvey) => isBlankHeader(survey) && roomPieces(survey.rooms[0]!) === 0

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
  const lines = [
    ...headerTextLines(tool.title, survey),
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

/** mailto-Adresse mit Stückliste im Text; ist sie zu lang, fehlt die Aufteilung nach Räumen */
export function surveyMailto(tool: ValveSurveyTool, survey: ValveSurvey, recipients: readonly string[]): string {
  return mailtoUrl(recipients, `${tool.title}: ${projectLabel(survey)}`, [
    surveyText(tool, survey),
    surveyText(tool, survey, false),
  ])
}

/**
 * CSV für Excel in deutscher Einstellung: Kopf mit Bauvorhaben, Stückliste mit Zwischensummen je Gruppe,
 * die Summen und, wenn es Räume gibt, eine Zeile je Raum und Ventiltyp.
 */
export function surveyCsv(tool: ValveSurveyTool, survey: ValveSurvey): string {
  const bill = surveyBill(tool, survey)
  const lines = [
    ...headerCsvLines(tool.title, survey),
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
