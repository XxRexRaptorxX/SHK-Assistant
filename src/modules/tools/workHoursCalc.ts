import { csvFile, csvText } from '../../lib/csv'
import { parseDecimal } from '../../lib/number'
import type { WorkEntry } from '../../storage/db'

// Rechenlogik des Stundenzettels, ohne Oberfläche und Speicher.
//
// Die Einträge eines Tages bilden eine Kette: Jeder beginnt dort, wo der letzte endete, der erste beim regulären
// Arbeitsbeginn; das Ende ist Beginn + Stunden. Wird gerundet, endet der Eintrag zur gerundeten Zeit, die Differenz
// fällt also in den nächsten Eintrag und die Tagessumme läuft nicht davon.

/** Längste Dauer eines Eintrags in Minuten */
const MAX_ENTRY_MINUTES = 24 * 60
/** Größte Wochenstunden in Minuten: alle Stunden einer Woche */
export const MAX_WEEK_MINUTES = 7 * MAX_ENTRY_MINUTES
const DAY_MS = 86_400_000
const WEEKDAYS = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/** Rundung der über „Bis jetzt“ erfassten Stunden in Minuten; 0 = nicht runden */
export const ROUNDING_STEPS = [0, 15, 30] as const
export type RoundingStep = (typeof ROUNDING_STEPS)[number]

export interface WorkHoursSettings {
  /** Regulärer Arbeitsbeginn als "HH:MM" */
  regularStart: string
  roundingStep: RoundingStep
  /** Dauer des Pausen-Knopfs in Minuten */
  breakMinutes: number
  /** Worauf sich die vereinbarte Arbeitszeit bezieht */
  agreedPeriod: AgreedPeriod
  /** Vereinbarte Arbeitszeit je Tag in Minuten; 0 = nicht angegeben, dann gibt es keine Über- oder Minusstunden */
  dailyMinutes: number
  /** Vereinbarte Arbeitszeit je Woche in Minuten; 0 = nicht angegeben */
  weeklyMinutes: number
}

export const AGREED_PERIODS = ['day', 'week'] as const
export type AgreedPeriod = (typeof AGREED_PERIODS)[number]

export const DEFAULT_WORK_HOURS_SETTINGS: WorkHoursSettings = {
  regularStart: '07:00',
  roundingStep: 30,
  breakMinutes: 30,
  agreedPeriod: 'day',
  dailyMinutes: 0,
  weeklyMinutes: 0,
}

/** Sollzeit, mit der gerechnet wird: immer nur eine der beiden, die andere ist 0 */
export interface AgreedTargets {
  dailyMinutes: number
  weeklyMinutes: number
}

export const NO_TARGETS: AgreedTargets = { dailyMinutes: 0, weeklyMinutes: 0 }

/** Die Sollzeit der gewählten Art; die andere bleibt gespeichert, zählt aber nicht */
export const agreedTargets = (settings: WorkHoursSettings): AgreedTargets =>
  settings.agreedPeriod === 'week'
    ? { dailyMinutes: 0, weeklyMinutes: settings.weeklyMinutes }
    : { dailyMinutes: settings.dailyMinutes, weeklyMinutes: 0 }

const pad = (value: number) => String(value).padStart(2, '0')

/** Lokales Datum als "YYYY-MM-DD" */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

export const minuteOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes()

/** "07:30" → 450; undefined bei leerer oder ungültiger Uhrzeit */
export function parseClock(text: string): number | undefined {
  const match = /^(\d{1,2}):([0-5]\d)$/.exec(text.trim())
  if (!match) return undefined
  const hours = Number(match[1])
  return hours < 24 ? hours * 60 + Number(match[2]) : undefined
}

/** 450 → "07:30"; über Mitternacht hinaus mit Kennzeichen, z. B. "01:00 (+1)" */
export function formatClock(minute: number): string {
  const clock = `${pad(Math.floor(minute / 60) % 24)}:${pad(minute % 60)}`
  return minute >= 24 * 60 ? `${clock} (+1)` : clock
}

/** Stunden aus dem Eingabefeld ("2,5", "2.5" oder "2:30") in Minuten; undefined, wenn nicht nutzbar */
export function parseHours(text: string, maxMinutes = MAX_ENTRY_MINUTES): number | undefined {
  const clock = /^(\d{1,3}):([0-5]\d)$/.exec(text.trim())
  const minutes = clock ? Number(clock[1]) * 60 + Number(clock[2]) : Math.round((parseDecimal(text) ?? NaN) * 60)
  return minutes > 0 && minutes <= maxMinutes ? minutes : undefined
}

/** 150 → "2,5": höchstens zwei Nachkommastellen, parseHours liest daraus wieder dieselben Minuten */
export function formatHours(minutes: number): string {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 }).format(minutes / 60)
}

export function roundMinutes(minutes: number, step: RoundingStep): number {
  return step === 0 ? minutes : Math.round(minutes / step) * step
}

export interface ChainStart {
  minute: number
  /** Woher der Beginn stammt: letzte erfasste Zeit des Tages, regulärer Arbeitsbeginn oder von Hand eingegeben */
  from: 'last' | 'regular' | 'entered'
}

/** Wert für ein Uhrzeit-Feld: "07:30" ohne das Kennzeichen für den Folgetag */
export const clockFieldValue = (minute: number) => formatClock(minute % (24 * 60)).slice(0, 5)

/** Wo der nächste Eintrag dieses Tages beginnt; Pausen zählen mit, sie schieben den Beginn also nach hinten */
export function chainStart(entries: readonly WorkEntry[], date: string, regularStart: string): ChainStart {
  const ends = entries.flatMap((entry) =>
    entry.date === date && entry.startMinute !== undefined ? [entry.startMinute + entry.minutes] : [],
  )
  if (ends.length > 0) return { minute: Math.max(...ends), from: 'last' }
  const regular = parseClock(regularStart) ?? parseClock(DEFAULT_WORK_HOURS_SETTINGS.regularStart)!
  return { minute: regular, from: 'regular' }
}

export type HoursUntilNow =
  | { kind: 'ok'; minutes: number; rawMinutes: number; start: ChainStart; nowMinute: number }
  /** Der Beginn liegt nicht vor der aktuellen Uhrzeit */
  | { kind: 'notYet'; start: ChainStart }
  /** Gerundet bleibt nichts übrig */
  | { kind: 'roundedToZero'; rawMinutes: number; start: ChainStart }

/**
 * Aktuelle Uhrzeit minus regulärer Beginn oder letzte erfasste Zeit, gerundet nach der Einstellung.
 * Mit enteredStart zählt stattdessen die von Hand eingegebene Startzeit.
 */
export function hoursUntilNow(
  entries: readonly WorkEntry[],
  now: Date,
  settings: WorkHoursSettings,
  enteredStart?: number,
): HoursUntilNow {
  const start: ChainStart =
    enteredStart === undefined ? chainStart(entries, isoDate(now), settings.regularStart) : { minute: enteredStart, from: 'entered' }
  const nowMinute = minuteOfDay(now)
  const rawMinutes = nowMinute - start.minute
  if (rawMinutes <= 0) return { kind: 'notYet', start }
  const minutes = roundMinutes(rawMinutes, settings.roundingStep)
  if (minutes === 0) return { kind: 'roundedToZero', rawMinutes, start }
  return { kind: 'ok', minutes, rawMinutes, start, nowMinute }
}

/**
 * Ende für das Feld „Ende“: Beginn plus gerundete Dauer. Das Feld kann nur Uhrzeiten desselben Tages,
 * deshalb endet ein Aufrunden kurz vor Mitternacht um 23:59.
 */
export const endMinuteFromDuration = (startMinute: number, minutes: number) => Math.min(startMinute + minutes, 24 * 60 - 1)

/** Dauer zwischen Start- und Endzeit; undefined, wenn eine Uhrzeit fehlt oder das Ende nicht nach dem Beginn liegt */
export function minutesBetween(start: string, end: string): number | undefined {
  const from = parseClock(start)
  const to = parseClock(end)
  return from !== undefined && to !== undefined && to > from ? to - from : undefined
}

/** Baut den Eintrag; ohne eigene Startzeit hängt er sich an die Kette seines Tages an */
export function createEntry(
  input: { project: string; date: string; minutes: number; note?: string; startMinute?: number },
  entries: readonly WorkEntry[],
  regularStart: string,
  now: Date,
): WorkEntry {
  const recordedAt = now.toISOString()
  const note = input.note?.trim()
  return {
    id: `${recordedAt}-${Math.random().toString(36).slice(2, 8)}`,
    project: input.project.trim(),
    date: input.date,
    startMinute: input.startMinute ?? chainStart(entries, input.date, regularStart).minute,
    minutes: input.minutes,
    recordedAt,
    ...(note ? { note } : {}),
  }
}

/** Hängt die Adresse an das Bauvorhaben an; steht sie schon drin, bleibt der Text, wie er ist */
export function appendAddress(project: string, address: string): string {
  const text = project.trim()
  if (!text) return address
  return projectKey(text).includes(projectKey(address)) ? text : `${text}, ${address}`
}

/**
 * Baut eine Pause: Sie beginnt am Ende der Kette und schiebt den nächsten Eintrag um ihre Dauer nach hinten.
 * Sie zählt nicht zur Arbeitszeit.
 */
export function createBreakEntry(
  input: { date: string; minutes: number },
  entries: readonly WorkEntry[],
  regularStart: string,
  now: Date,
): WorkEntry {
  return { ...createEntry({ ...input, project: '' }, entries, regularStart, now), isBreak: true }
}

export const isBreak = (entry: WorkEntry) => entry.isBreak === true

export interface EntryChanges {
  project: string
  date: string
  startMinute: number
  minutes: number
  /** Leer = keine Notiz */
  note: string
}

/** Übernimmt Änderungen und vermerkt sie; ohne echte Änderung bleibt der Eintrag unverändert und unvermerkt */
export function editEntry(entry: WorkEntry, changes: EntryChanges, now: Date): WorkEntry {
  const project = changes.project.trim()
  const note = changes.note.trim()
  const unchanged =
    project === entry.project &&
    changes.date === entry.date &&
    changes.startMinute === entry.startMinute &&
    changes.minutes === entry.minutes &&
    note === (entry.note ?? '')
  if (unchanged) return entry
  const { note: _oldNote, ...rest } = entry
  const { note: _newNote, ...fields } = changes
  return { ...rest, ...fields, project, editedAt: now.toISOString(), ...(note ? { note } : {}) }
}

/** Name in Listen und Hinweisen */
export const entryName = (entry: WorkEntry) => (isBreak(entry) ? 'Pause' : entry.project)

/**
 * Einträge desselben Tages, die sich zeitlich mit dem Kandidaten überschneiden. Pausen zählen mit. Berühren sich zwei nur
 * (einer endet um 10:00, der andere beginnt um 10:00), ist das keine Überschneidung. Einträge ohne Uhrzeit bleiben außen vor.
 */
export function overlapsOf(
  entries: readonly WorkEntry[],
  candidate: { id?: string; date: string; startMinute?: number | undefined; minutes: number },
): WorkEntry[] {
  const start = candidate.startMinute
  if (start === undefined) return []
  const end = start + candidate.minutes
  return entries
    .filter(
      (entry) =>
        entry.id !== candidate.id &&
        entry.date === candidate.date &&
        entry.startMinute !== undefined &&
        entry.startMinute < end &&
        start < entry.startMinute + entry.minutes,
    )
    .sort(chronological)
}

/** Warnung am Eintrag, z. B. „Überschneidet sich mit Müller (09:30–12:30).“ */
export function overlapWarning(overlaps: readonly WorkEntry[]): string {
  return `Überschneidet sich mit ${overlaps.map((entry) => `${entryName(entry)} (${entryTimeRange(entry)})`).join(', ')}.`
}

/** Tage, an denen sich Einträge überschneiden */
export const hasOverlaps = (dayEntries: readonly WorkEntry[]) => dayEntries.some((entry) => overlapsOf(dayEntries, entry).length > 0)

/** Hinweis für die Fußzeile von Liste und Export; undefined, wenn sich nichts überschneidet */
export function overlapNote(entries: readonly WorkEntry[]): string | undefined {
  const count = entries.filter((entry) => overlapsOf(entries, entry).length > 0).length
  return count === 0 ? undefined : `${count} Einträge überschneiden sich zeitlich, die Stunden zählen dann doppelt.`
}

/** Hinweis für die Fußzeile von Liste und Export; undefined, wenn nichts bearbeitet wurde */
export function editedNote(entries: readonly WorkEntry[]): string | undefined {
  const count = entries.filter((entry) => entry.editedAt !== undefined).length
  if (count === 0) return undefined
  return count === 1 ? '1 Eintrag wurde nachträglich bearbeitet.' : `${count} Einträge wurden nachträglich bearbeitet.`
}

const utcTime = (iso: string) => {
  const [year, month, day] = iso.split('-').map(Number)
  return Date.UTC(year!, month! - 1, day!)
}

export const addDays = (iso: string, days: number) => new Date(utcTime(iso) + days * DAY_MS).toISOString().slice(0, 10)

/** Montag der Woche, in der das Datum liegt */
export function weekStart(iso: string): string {
  return addDays(iso, -((new Date(utcTime(iso)).getUTCDay() + 6) % 7))
}

/** Kalenderwoche nach ISO 8601: Sie zählt zu dem Jahr, in dem ihr Donnerstag liegt */
export function isoWeek(monday: string): { year: number; week: number } {
  const thursday = addDays(monday, 3)
  const year = Number(thursday.slice(0, 4))
  return { year, week: Math.floor((utcTime(thursday) - Date.UTC(year, 0, 1)) / DAY_MS / 7) + 1 }
}

const dayMonth = (iso: string) => `${iso.slice(8, 10)}.${iso.slice(5, 7)}.`

/** z. B. "KW 45 · 02.11. – 08.11.2026" */
export function weekLabel(monday: string): string {
  const sunday = addDays(monday, 6)
  return `KW ${isoWeek(monday).week} · ${dayMonth(monday)} – ${dayMonth(sunday)}${sunday.slice(0, 4)}`
}

/** z. B. "Mo 02.11." */
export function formatDay(iso: string): string {
  return `${WEEKDAYS[new Date(utcTime(iso)).getUTCDay()]} ${dayMonth(iso)}`
}

/** Zeitstempel der Erfassung in Ortszeit, z. B. "02.11.2026 12:07" */
export function formatRecordedAt(recordedAt: string): string {
  const date = new Date(recordedAt)
  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${formatClock(minuteOfDay(date))}`
}

/** Von–bis eines Eintrags, z. B. "07:00–12:00"; undefined, wenn er ohne Uhrzeit erfasst wurde */
export function entryTimeRange(entry: WorkEntry): string | undefined {
  if (entry.startMinute === undefined) return undefined
  return `${formatClock(entry.startMinute)}–${formatClock(entry.startMinute + entry.minutes)}`
}

export function entriesOfWeek(entries: readonly WorkEntry[], monday: string): WorkEntry[] {
  const sunday = addDays(monday, 6)
  return entries.filter((entry) => entry.date >= monday && entry.date <= sunday)
}

/** Einträge und Pausen eines Tages in zeitlicher Reihenfolge */
export const entriesOfDay = (entries: readonly WorkEntry[], date: string) =>
  entries.filter((entry) => entry.date === date).sort(chronological)

/** Die sieben Tage einer Woche, Montag bis Sonntag */
export const weekDays = (monday: string) => Array.from({ length: 7 }, (_, index) => addDays(monday, index))

/** z. B. "Mi 04.11.2026" */
export const formatDayLong = (iso: string) => `${formatDay(iso)}${iso.slice(0, 4)}`

/**
 * Zeitstempel in der Tagesansicht: Dort steht das Datum schon oben, also reicht „um 12:07“.
 * Wurde ein Eintrag an einem anderen Tag erfasst oder bearbeitet, bleibt das Datum dabei, sonst ginge diese Angabe verloren.
 */
export function formatStamp(stamp: string, entryDate: string): string {
  const date = new Date(stamp)
  return isoDate(date) === entryDate ? `um ${formatClock(minuteOfDay(date))}` : `am ${formatRecordedAt(stamp)}`
}

/** Nach Tag, dann Beginn; Einträge ohne Uhrzeit stehen am Ende des Tages */
function chronological(a: WorkEntry, b: WorkEntry): number {
  return (
    a.date.localeCompare(b.date) ||
    (a.startMinute ?? MAX_ENTRY_MINUTES * 2) - (b.startMinute ?? MAX_ENTRY_MINUTES * 2) ||
    a.recordedAt.localeCompare(b.recordedAt)
  )
}

/** „Müller “ und „müller“ sind dasselbe Bauvorhaben */
const projectKey = (project: string) => project.trim().toLocaleLowerCase('de')

export interface ProjectHours {
  /** Schreibweise des letzten Eintrags */
  project: string
  minutes: number
  entries: WorkEntry[]
}

/** Stunden je Bauvorhaben, das zuerst bearbeitete zuerst */
export function hoursByProject(entries: readonly WorkEntry[]): ProjectHours[] {
  const groups = new Map<string, ProjectHours>()
  for (const entry of entries.filter((candidate) => !isBreak(candidate)).sort(chronological)) {
    const key = projectKey(entry.project)
    const group = groups.get(key)
    if (group) {
      group.project = entry.project
      group.minutes += entry.minutes
      group.entries.push(entry)
    } else {
      groups.set(key, { project: entry.project, minutes: entry.minutes, entries: [entry] })
    }
  }
  return [...groups.values()]
}

/** Pausen in zeitlicher Reihenfolge */
export const breakEntries = (entries: readonly WorkEntry[]) => entries.filter(isBreak).sort(chronological)

export const sumMinutes = (entries: readonly WorkEntry[]) => entries.reduce((sum, entry) => sum + entry.minutes, 0)

/** Arbeitszeit ohne Pausen */
export const totalMinutes = (entries: readonly WorkEntry[]) => sumMinutes(entries.filter((entry) => !isBreak(entry)))

/**
 * Über- (positiv) oder Minusstunden (negativ) eines Tages in Minuten. Tage ohne Arbeitszeit zählen nicht als Minus,
 * sie können auch frei sein. undefined, wenn keine Tagesstunden vereinbart sind oder nicht gearbeitet wurde.
 */
export function dayBalance(dayEntries: readonly WorkEntry[], dailyMinutes: number): number | undefined {
  const worked = totalMinutes(dayEntries)
  return dailyMinutes > 0 && worked > 0 ? worked - dailyMinutes : undefined
}

/**
 * Über- und Minusstunden einer Woche: bei Wochenstunden Arbeitszeit minus Soll, bei Tagesstunden die Summe der Tage.
 * undefined, wenn keine Sollzeit vereinbart ist oder in der Woche nicht gearbeitet wurde.
 */
export function weekBalance(entries: readonly WorkEntry[], monday: string, targets: AgreedTargets): number | undefined {
  const week = entriesOfWeek(entries, monday)
  if (targets.weeklyMinutes > 0) {
    const worked = totalMinutes(week)
    return worked > 0 ? worked - targets.weeklyMinutes : undefined
  }
  const balances = weekDays(monday).flatMap((day) => dayBalance(entriesOfDay(week, day), targets.dailyMinutes) ?? [])
  return balances.length > 0 ? balances.reduce((sum, balance) => sum + balance, 0) : undefined
}

/** z. B. "+0,5 h" oder "−1 h" */
export const formatBalance = (minutes: number) => `${minutes > 0 ? '+' : '−'}${formatHours(Math.abs(minutes))} h`

/** Passende Bezeichnung zum Vorzeichen */
export const balanceLabel = (minutes: number) => (minutes > 0 ? 'Überstunden' : 'Minusstunden')

/** Frühere Bauvorhaben passend zur Eingabe, das zuletzt genutzte zuerst; ohne das schon vollständig eingegebene */
export function projectSuggestions(entries: readonly WorkEntry[], query: string, limit = 6): string[] {
  const typed = projectKey(query)
  const seen = new Set<string>()
  const suggestions: string[] = []
  const worked = entries.filter((entry) => !isBreak(entry))
  for (const entry of worked.sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))) {
    const key = projectKey(entry.project)
    if (seen.has(key)) continue
    seen.add(key)
    if (key !== typed && key.includes(typed)) suggestions.push(entry.project)
  }
  return suggestions.slice(0, limit)
}

/**
 * Die Woche als CSV für Excel in deutscher Einstellung: Semikolon, Dezimalkomma, BOM für die Umlaute.
 * Oben die Summe je Bauvorhaben, darunter die einzelnen Einträge mit Zeitstempeln, am Ende der Hinweis auf Bearbeitungen.
 */
export function workHoursCsv(entries: readonly WorkEntry[], monday: string, targets: AgreedTargets = NO_TARGETS): string {
  const week = entriesOfWeek(entries, monday)
  const balance = weekBalance(week, monday, targets)
  const groups = hoursByProject(week)
  const breaks = breakEntries(week)
  const note = editedNote(week)
  const overlap = overlapNote(week)
  const row = (name: string, entry: WorkEntry) => {
    const start = entry.startMinute
    return [
      csvText(name),
      `${entry.date.slice(8, 10)}.${entry.date.slice(5, 7)}.${entry.date.slice(0, 4)}`,
      start === undefined ? '' : formatClock(start),
      start === undefined ? '' : formatClock(start + entry.minutes),
      formatHours(entry.minutes),
      csvText(entry.note ?? ''),
      formatRecordedAt(entry.recordedAt),
      entry.editedAt === undefined ? '' : formatRecordedAt(entry.editedAt),
    ].join(';')
  }
  const lines = [
    `Stundenzettel;${weekLabel(monday)}`,
    '',
    'Bauvorhaben;Stunden',
    ...groups.map((group) => `${csvText(group.project)};${formatHours(group.minutes)}`),
    `Gesamt;${formatHours(totalMinutes(week))}`,
    ...(breaks.length > 0 ? [`Pausen (nicht in Gesamt);${formatHours(sumMinutes(breaks))}`] : []),
    // Als reine Zahl mit normalem Minus, damit Excel damit rechnen kann
    ...(balance ? [`Über-/Minusstunden;${balance > 0 ? '+' : '-'}${formatHours(Math.abs(balance))}`] : []),
    '',
    'Bauvorhaben;Datum;Von;Bis;Stunden;Notiz;Erfasst am;Bearbeitet am',
    ...groups.flatMap((group) => group.entries.map((entry) => row(entry.project, entry))),
    ...breaks.map((entry) => row(entryName(entry), entry)),
    ...(note || overlap ? [''] : []),
    ...(note ? [`Hinweis;${note}`] : []),
    ...(overlap ? [`Hinweis;${overlap}`] : []),
  ]
  return csvFile(lines)
}

/** z. B. "stundenzettel-2026-KW45.csv" */
export function csvFileName(monday: string): string {
  const { year, week } = isoWeek(monday)
  return `stundenzettel-${year}-KW${pad(week)}.csv`
}

/** Liest gespeicherte Einstellungen; Unbekanntes oder Kaputtes fällt auf die Standardwerte zurück. */
export function parseWorkHoursSettings(raw: string | null): WorkHoursSettings {
  try {
    const data: unknown = raw ? JSON.parse(raw) : {}
    const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
    const { regularStart, roundingStep, breakMinutes, agreedPeriod, dailyMinutes, weeklyMinutes } = record
    const minutesUpTo = (value: unknown, max: number) =>
      typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= max ? value : 0
    return {
      agreedPeriod: AGREED_PERIODS.find((period) => period === agreedPeriod) ?? DEFAULT_WORK_HOURS_SETTINGS.agreedPeriod,
      dailyMinutes: minutesUpTo(dailyMinutes, MAX_ENTRY_MINUTES),
      weeklyMinutes: minutesUpTo(weeklyMinutes, MAX_WEEK_MINUTES),
      breakMinutes:
        typeof breakMinutes === 'number' && Number.isInteger(breakMinutes) && breakMinutes > 0 && breakMinutes <= MAX_ENTRY_MINUTES
          ? breakMinutes
          : DEFAULT_WORK_HOURS_SETTINGS.breakMinutes,
      regularStart:
        typeof regularStart === 'string' && parseClock(regularStart) !== undefined
          ? regularStart
          : DEFAULT_WORK_HOURS_SETTINGS.regularStart,
      roundingStep: ROUNDING_STEPS.find((step) => step === roundingStep) ?? DEFAULT_WORK_HOURS_SETTINGS.roundingStep,
    }
  } catch {
    return DEFAULT_WORK_HOURS_SETTINGS
  }
}
