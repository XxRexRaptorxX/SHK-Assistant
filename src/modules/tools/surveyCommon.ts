import { csvText } from '../../lib/csv'
import { normalizeForSearch } from '../../lib/text'

// Gemeinsame Logik der Aufmaß-Tools (Ventile, Heizkörper): Bauvorhaben mit Räumen, Datum, Dateiname,
// E-Mail-Empfänger und mailto. Ohne Oberfläche und Speicher. Änderungen liefern ein neues Aufmaß zurück.

/** Längste mailto-Adresse; manche Mailprogramme schneiden längere ab */
export const MAILTO_MAX_LENGTH = 1800
export const NO_PROJECT = 'Ohne Bauvorhaben'
export const NO_ROOM = 'Ohne Raumangabe'

export interface SurveyRoomBase {
  id: string
  /** Freitext, z. B. „Bad OG“; leer = ohne Raumangabe */
  name: string
}

export interface SurveyBase<R extends SurveyRoomBase = SurveyRoomBase> {
  id: string
  /** id des Tools, zu dem die Schlüssel im Aufmaß gehören */
  toolId: string
  /** Bauvorhaben als Freitext */
  project: string
  /** Freitext zum Aufmaß (fehlt, wenn leer) */
  note?: string
  rooms: R[]
  /** ISO-Zeitstempel */
  createdAt: string
  updatedAt: string
}

export const newId = (now: Date) => `${now.toISOString()}-${Math.random().toString(36).slice(2, 8)}`

export function touch<S extends SurveyBase>(survey: S, change: Partial<S>, now: Date): S {
  return { ...survey, ...change, updatedAt: now.toISOString() }
}

export function setProject<S extends SurveyBase>(survey: S, project: string, now: Date): S {
  return touch(survey, { project } as Partial<S>, now)
}

export function setNote<S extends SurveyBase>(survey: S, note: string, now: Date): S {
  const { note: _old, ...rest } = survey
  return touch(rest as S, (note.trim() ? { note } : {}) as Partial<S>, now)
}

export function renameRoom<S extends SurveyBase>(survey: S, roomId: string, name: string, now: Date): S {
  return touch(survey, { rooms: survey.rooms.map((room) => (room.id === roomId ? { ...room, name } : room)) } as Partial<S>, now)
}

/** Ersetzt einen Raum durch seinen neuen Stand */
export function updateRoom<S extends SurveyBase>(survey: S, room: S['rooms'][number], now: Date): S {
  return touch(survey, { rooms: survey.rooms.map((other) => (other.id === room.id ? room : other)) } as Partial<S>, now)
}

export function appendRoom<S extends SurveyBase>(survey: S, room: S['rooms'][number], now: Date): S {
  return touch(survey, { rooms: [...survey.rooms, room] } as Partial<S>, now)
}

/** Entfernt einen Raum mit seinem Inhalt; ein Aufmaß behält immer mindestens einen (dann leeren) Raum */
export function removeRoom<S extends SurveyBase>(survey: S, roomId: string, emptyRoom: () => S['rooms'][number], now: Date): S {
  const rooms = survey.rooms.filter((room) => room.id !== roomId)
  return touch(survey, { rooms: rooms.length > 0 ? rooms : [emptyRoom()] } as Partial<S>, now)
}

/** Für geladene Aufmaße: ohne Raum (z. B. beschädigter Speicher) bekommt es einen leeren, damit man weitermachen kann */
export function ensureRoom<S extends SurveyBase>(survey: S, emptyRoom: () => S['rooms'][number]): S {
  return survey.rooms.length > 0 ? survey : { ...survey, rooms: [emptyRoom()] }
}

/** Kopf ohne Eingaben: kein Bauvorhaben, keine Bemerkung, nur ein Raum ohne Namen */
export function isBlankHeader(survey: SurveyBase): boolean {
  return (
    survey.project.trim() === '' &&
    (survey.note ?? '').trim() === '' &&
    survey.rooms.length === 1 &&
    survey.rooms[0]!.name.trim() === ''
  )
}

export const roomLabel = (room: SurveyRoomBase) => room.name.trim() || NO_ROOM
export const projectLabel = (survey: SurveyBase) => survey.project.trim() || NO_PROJECT

/** Zuletzt bearbeitete zuerst */
export const sortSurveys = <S extends SurveyBase>(surveys: readonly S[]) =>
  [...surveys].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))

/** ISO-Zeitstempel → lokales Datum „07.11.2026“ */
export function formatSurveyDate(stamp: string): string {
  const date = new Date(stamp)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()}`
}

export const surveyLabel = (survey: SurveyBase) => `${projectLabel(survey)} (${formatSurveyDate(survey.createdAt)})`

/** Kopfzeilen für E-Mail und Text: Titel, Bauvorhaben, Datum, Bemerkung */
export function headerTextLines(title: string, survey: SurveyBase): string[] {
  const note = (survey.note ?? '').trim()
  return [
    title,
    `Bauvorhaben: ${projectLabel(survey)}`,
    `Aufmaß vom: ${formatSurveyDate(survey.createdAt)}`,
    ...(note ? [`Bemerkung: ${note}`] : []),
  ]
}

/** Kopfzeilen der CSV-Datei */
export function headerCsvLines(title: string, survey: SurveyBase): string[] {
  const note = (survey.note ?? '').trim()
  return [
    csvText(title),
    `Bauvorhaben;${csvText(projectLabel(survey))}`,
    `Aufmaß vom;${formatSurveyDate(survey.createdAt)}`,
    ...(note ? [`Bemerkung;${csvText(note)}`] : []),
  ]
}

/** Eine oder mehrere Adressen, getrennt durch Komma, Semikolon oder Leerzeichen; undefined, wenn eine ungültig ist */
export function parseRecipients(text: string): string[] | undefined {
  const parts = text.split(/[\s,;]+/).filter((part) => part !== '')
  return parts.every((part) => /^[A-Za-z0-9._+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/.test(part)) ? parts : undefined
}

/**
 * mailto-Adresse; bodies vom ausführlichsten zum kürzesten: Genommen wird der erste, der in MAILTO_MAX_LENGTH passt,
 * sonst der letzte.
 */
export function mailtoUrl(recipients: readonly string[], subject: string, bodies: readonly string[]): string {
  const urls = bodies.map(
    (body) => `mailto:${recipients.join(',')}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`,
  )
  return urls.find((url) => url.length <= MAILTO_MAX_LENGTH) ?? urls[urls.length - 1]!
}

/** z. B. „aufmass-heizkoerper-mueller-hauptstr-5-2026-11-07.csv“ */
export function surveyFileName(toolId: string, survey: SurveyBase): string {
  const slug = normalizeForSearch(survey.project)
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
    .replace(/-+$/, '')
  const date = formatSurveyDate(survey.createdAt).split('.').reverse().join('-')
  const toolName = toolId.split('.').slice(1).join('-')
  return `${[toolName, slug, date].filter((part) => part !== '').join('-')}.csv`
}
