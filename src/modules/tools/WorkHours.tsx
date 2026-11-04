import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { dangerButton, primaryButton, secondaryButton } from '../../components/buttons'
import { ClockIcon, LocationIcon, PencilIcon, TrashIcon, WarningIcon } from '../../components/icons'
import { card, fieldBase } from '../../components/surfaces'
import { downloadTextFile } from '../../lib/download'
import { currentPosition, formatCoordinates, LocationError, reverseGeocode } from '../../lib/location'
import type { WorkEntry } from '../../storage/db'
import { deleteWorkEntry, listWorkEntries, saveWorkEntry } from '../../storage/workEntries'
import {
  addDays,
  AGREED_PERIODS,
  agreedTargets,
  appendAddress,
  balanceLabel,
  breakEntries,
  chainStart,
  clockFieldValue,
  createBreakEntry,
  createEntry,
  csvFileName,
  dayBalance,
  editedNote,
  editEntry,
  endMinuteFromDuration,
  entriesOfDay,
  entriesOfWeek,
  entryName,
  entryTimeRange,
  formatBalance,
  formatClock,
  formatDay,
  formatDayLong,
  formatHours,
  formatStamp,
  hasOverlaps,
  hoursByProject,
  hoursUntilNow,
  isBreak,
  isoDate,
  MAX_WEEK_MINUTES,
  minutesBetween,
  overlapNote,
  overlapsOf,
  overlapWarning,
  parseClock,
  parseHours,
  projectSuggestions,
  ROUNDING_STEPS,
  sumMinutes,
  totalMinutes,
  weekBalance,
  weekDays,
  weekLabel,
  weekStart,
  workHoursCsv,
  type AgreedPeriod,
  type AgreedTargets,
  type ChainStart,
  type EntryChanges,
  type HoursUntilNow,
  type RoundingStep,
} from './workHoursCalc'
import { updateWorkHoursSettings, useWorkHoursSettings } from './workHoursSettings'

const ROUNDING_LABELS: Record<RoundingStep, string> = { 0: 'Nicht runden', 15: 'Viertelstunde', 30: 'Halbe Stunde' }
const AGREED_PERIOD_LABELS: Record<AgreedPeriod, string> = { day: 'Pro Tag', week: 'Pro Woche' }
const ROUNDING_HINTS: Record<RoundingStep, string> = { 0: '', 15: ', auf Viertelstunden gerundet', 30: ', auf halbe Stunden gerundet' }
const SAVE_FAILED = 'Konnte auf diesem Gerät nicht gespeichert werden. Der Eintrag geht beim Schließen verloren.'
const TIMES_INVALID = 'Bitte Start und Ende angeben, das Ende nach dem Start. Über Mitternacht bitte zwei Einträge anlegen.'
const BREAK_INVALID = 'Bitte die Pausendauer als Zahl angeben, z. B. 0,25 oder 0:15, oder das Feld leer lassen.'
const HOURS_INVALID = 'Bitte die Stunden als Zahl angeben, z. B. 2,5 oder 2:30 (höchstens 24 Stunden).'
const DATE_INVALID = 'Bitte ein Datum wählen, das nicht in der Zukunft liegt.'
const PROJECT_MISSING = 'Bitte ein Bauvorhaben angeben.'

type Message = { kind: 'info' | 'error'; text: string }

/** Knopf nur mit Zeichen: quadratisch, aber so groß wie die übrigen Touch-Ziele */
const iconButton = `${secondaryButton} w-12 shrink-0 !px-0`

const START_SOURCES: Record<ChainStart['from'], string> = {
  last: 'letzte erfasste Zeit',
  regular: 'regulärer Arbeitsbeginn',
  entered: 'eingegebener Start',
}

const describeStart = (start: ChainStart) => `${formatClock(start.minute)} (${START_SOURCES[start.from]})`

/** Rückmeldung zum Knopf „Bis jetzt“ */
function nowMessage(result: HoursUntilNow): Message {
  switch (result.kind) {
    case 'ok': {
      const span = `${formatClock(result.start.minute)} bis ${formatClock(result.nowMinute)}`
      return {
        kind: 'info',
        text:
          result.minutes === result.rawMinutes
            ? `${span} sind ${formatHours(result.minutes)} h.`
            : `${span} sind ${formatHours(result.rawMinutes)} h, gerundet ${formatHours(result.minutes)} h.`,
      }
    }
    case 'notYet':
      return { kind: 'error', text: `Keine Zeit zu erfassen: Es zählt erst ab ${describeStart(result.start)}.` }
    case 'roundedToZero':
      return {
        kind: 'error',
        text: `Seit ${formatClock(result.start.minute)} sind es ${result.rawMinutes} Minuten, gerundet bleibt nichts übrig.`,
      }
  }
}

/** Einträge aus dem Gerätespeicher; schlägt das Speichern fehl, bleiben sie bis zum Schließen in der Anzeige */
function useWorkEntries(initialEntries?: WorkEntry[]) {
  const [entries, setEntries] = useState<WorkEntry[] | undefined>(initialEntries)
  const [saveFailed, setSaveFailed] = useState(false)

  useEffect(() => {
    if (initialEntries) return
    let active = true
    listWorkEntries()
      .then((stored) => {
        if (active) setEntries(stored)
      })
      .catch(() => {
        if (!active) return
        setEntries([])
        setSaveFailed(true)
      })
    return () => {
      active = false
    }
  }, [initialEntries])

  /** Neu oder bearbeitet: Gleiche id ersetzt den alten Stand */
  const save = (entry: WorkEntry) => {
    setEntries((current) => [...(current ?? []).filter((other) => other.id !== entry.id), entry])
    saveWorkEntry(entry).catch(() => setSaveFailed(true))
  }
  const remove = (id: string) => {
    setEntries((current) => current?.filter((entry) => entry.id !== id))
    deleteWorkEntry(id).catch(() => setSaveFailed(true))
  }
  return { entries, saveFailed, save, remove }
}

/** Warnung, die nichts blockiert: Überschneidungen dürfen gespeichert werden, sollen aber auffallen */
function OverlapText({ overlaps }: { overlaps: WorkEntry[] }) {
  if (overlaps.length === 0) return null
  return (
    <p className="mt-2 flex items-start gap-2 rounded-xl bg-warn p-2 text-base font-semibold text-warn-ink [overflow-wrap:anywhere]">
      <WarningIcon className="size-5 shrink-0" />
      <span className="min-w-0">{overlapWarning(overlaps)}</span>
    </p>
  )
}

function ErrorText({ text }: { text: string }) {
  return <p className="mt-3 rounded-xl bg-warn p-2 font-semibold text-warn-ink">{text}</p>
}

/**
 * Eingabefeld fürs Bauvorhaben. Frühere Bauvorhaben liegen als Liste über dem Formular und erscheinen nur, solange
 * das Feld in Benutzung ist, damit sie nichts verschieben und keinen Platz belegen.
 */
export function ProjectInput({
  id,
  value,
  onChange,
  suggestions,
  initialOpen = false,
  children,
}: {
  id: string
  value: string
  onChange: (value: string) => void
  suggestions: string[]
  /** Liste schon offen (Tests) */
  initialOpen?: boolean
  /** Weitere Knöpfe rechts neben dem Feld */
  children?: ReactNode
}) {
  const [open, setOpen] = useState(initialOpen)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const inside = (target: EventTarget | null) =>
    target instanceof Node && (input.current?.contains(target) === true || list.current?.contains(target) === true)

  // Tippen daneben schließt die Liste; iOS nimmt dem Feld dabei nicht immer den Fokus
  useEffect(() => {
    if (!open) return
    const closeOutside = (event: PointerEvent) => {
      if (!inside(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', closeOutside)
    return () => document.removeEventListener('pointerdown', closeOutside)
  }, [open])

  return (
    <div
      className="relative mt-1 flex gap-2"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false)
      }}
      onBlur={(event) => {
        // Nur beim Weitergehen per Tastatur; beim Antippen eines Vorschlags ist relatedTarget oft leer
        if (event.relatedTarget && !inside(event.relatedTarget)) setOpen(false)
      }}
    >
      <input
        ref={input}
        id={id}
        type="text"
        value={value}
        onChange={(event) => {
          onChange(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        className={`${fieldBase} w-full min-w-0 flex-1`}
      />
      {children}
      {open && suggestions.length > 0 && (
        <ul
          ref={list}
          aria-label="Frühere Bauvorhaben"
          className="absolute inset-x-0 top-full z-20 mt-1 max-h-52 divide-y divide-edge overflow-y-auto rounded-xl border-2 border-line bg-surface shadow-xl shadow-black/40"
        >
          {suggestions.map((suggestion) => (
            <li key={suggestion}>
              <button
                type="button"
                onClick={() => {
                  onChange(suggestion)
                  setOpen(false)
                  input.current?.blur()
                }}
                className="min-h-12 w-full px-3 py-2 text-left font-semibold [overflow-wrap:anywhere]"
              >
                {suggestion}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Auswahl aus wenigen Möglichkeiten, nebeneinander in gleich breiten Knöpfen */
function ChoiceBar<T extends string | number>({
  name,
  options,
  labels,
  value,
  onChange,
}: {
  name: string
  options: readonly T[]
  labels: Record<T, string>
  value: T
  onChange: (value: T) => void
}) {
  return (
    <div role="radiogroup" aria-label={name} className={`mt-1 grid gap-2 ${options.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`}>
      {options.map((option) => (
        <button
          key={option}
          type="button"
          role="radio"
          aria-checked={option === value}
          onClick={() => onChange(option)}
          className={`min-h-12 rounded-xl border-2 px-1 text-base font-semibold ${
            option === value ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
          }`}
        >
          {labels[option]}
        </button>
      ))}
    </div>
  )
}

/** Einstellungen: Unvollständige Eingaben bleiben im Feld stehen, gespeichert wird nur Gültiges; beim Verlassen zählt das Gespeicherte */
function SettingsPanel() {
  const id = useId()
  const settings = useWorkHoursSettings()
  const [startDraft, setStartDraft] = useState<string>()
  const [breakDraft, setBreakDraft] = useState<string>()
  const [agreedDraft, setAgreedDraft] = useState<string>()
  const weekly = settings.agreedPeriod === 'week'
  const agreedMinutes = weekly ? settings.weeklyMinutes : settings.dailyMinutes

  return (
    <details className="mt-3 print:hidden">
      <summary className="min-h-12 cursor-pointer py-3 font-semibold text-accent">Einstellungen</summary>
      <div className={`p-4 ${card}`}>
        <label htmlFor={`${id}-start`} className="block font-semibold">
          Regulärer Arbeitsbeginn
        </label>
        <input
          id={`${id}-start`}
          type="time"
          value={startDraft ?? settings.regularStart}
          onChange={(event) => {
            const value = event.target.value
            setStartDraft(value)
            if (parseClock(value) !== undefined) updateWorkHoursSettings({ regularStart: value })
          }}
          onBlur={() => setStartDraft(undefined)}
          className={`${fieldBase} mt-1 w-full`}
        />

        <label htmlFor={`${id}-break`} className="mt-4 block font-semibold">
          Standard-Pausendauer in Stunden
        </label>
        <input
          id={`${id}-break`}
          type="text"
          inputMode="decimal"
          value={breakDraft ?? formatHours(settings.breakMinutes)}
          onChange={(event) => {
            const value = event.target.value
            setBreakDraft(value)
            const minutes = parseHours(value)
            if (minutes !== undefined) updateWorkHoursSettings({ breakMinutes: minutes })
          }}
          onBlur={() => setBreakDraft(undefined)}
          autoComplete="off"
          className={`${fieldBase} mt-1 w-full`}
        />

        <p className="mt-4 font-semibold">Vereinbarte Arbeitszeit</p>
        <ChoiceBar
          name="Vereinbarte Arbeitszeit gilt"
          options={AGREED_PERIODS}
          labels={AGREED_PERIOD_LABELS}
          value={settings.agreedPeriod}
          onChange={(agreedPeriod) => {
            setAgreedDraft(undefined)
            updateWorkHoursSettings({ agreedPeriod })
          }}
        />
        <label htmlFor={`${id}-agreed`} className="mt-3 block font-semibold">
          {weekly ? 'Vereinbarte Wochenstunden' : 'Vereinbarte Tagesstunden'}
        </label>
        <input
          id={`${id}-agreed`}
          type="text"
          inputMode="decimal"
          placeholder={weekly ? 'z. B. 40' : 'z. B. 8'}
          value={agreedDraft ?? (agreedMinutes > 0 ? formatHours(agreedMinutes) : '')}
          onChange={(event) => {
            const value = event.target.value
            setAgreedDraft(value)
            // Leer schaltet die Anzeige der Über- und Minusstunden ab
            const minutes = value.trim() === '' ? 0 : parseHours(value, weekly ? MAX_WEEK_MINUTES : undefined)
            if (minutes !== undefined) updateWorkHoursSettings(weekly ? { weeklyMinutes: minutes } : { dailyMinutes: minutes })
          }}
          onBlur={() => setAgreedDraft(undefined)}
          autoComplete="off"
          className={`${fieldBase} mt-1 w-full`}
        />
        <p className="mt-1 text-base text-muted">
          {weekly
            ? 'Damit erscheinen Über- und Minusstunden für die ganze Woche. Leer lassen, wenn du das nicht brauchst.'
            : 'Damit erscheinen Über- und Minusstunden je Tag. Leer lassen, wenn du das nicht brauchst.'}
        </p>

        <p className="mt-4 font-semibold">Stunden aus „Bis jetzt“ runden</p>
        <ChoiceBar
          name="Runden auf"
          options={ROUNDING_STEPS}
          labels={ROUNDING_LABELS}
          value={settings.roundingStep}
          onChange={(roundingStep) => updateWorkHoursSettings({ roundingStep })}
        />
        <p className="mt-1 text-base text-muted">
          Gerundet wird zum nächsten Wert. Der Rest zählt beim nächsten Eintrag mit. Von Hand eingetragene Stunden bleiben, wie sie sind.
        </p>
      </div>
    </details>
  )
}

/** Mehrzeiliges Feld für die optionale Notiz; die Stunden bleiben davon unberührt */
function NoteField({ id, value, onChange }: { id: string; value: string; onChange: (value: string) => void }) {
  return (
    <>
      <label htmlFor={id} className="mt-3 block font-semibold">
        Notiz <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id={id}
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete="off"
        className={`${fieldBase} mt-1 block w-full py-2`}
      />
    </>
  )
}

/** Eintrag bearbeiten: Bauvorhaben (nicht bei Pausen), Datum, Beginn, Stunden und Notiz */
function EntryEditForm({
  entry,
  allEntries,
  today,
  onSave,
  onCancel,
}: {
  entry: WorkEntry
  allEntries: WorkEntry[]
  today: string
  onSave: (changes: EntryChanges) => void
  onCancel: () => void
}) {
  const id = useId()
  const [project, setProject] = useState(entry.project)
  const [date, setDate] = useState(entry.date)
  const [start, setStart] = useState(entry.startMinute === undefined ? '' : clockFieldValue(entry.startMinute))
  const [hours, setHours] = useState(formatHours(entry.minutes))
  const [note, setNote] = useState(entry.note ?? '')
  const [error, setError] = useState<string>()
  const enteredMinutes = parseHours(hours)

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (!entry.isBreak && !project.trim()) return setError(PROJECT_MISSING)
    if (!date || date > today) return setError(DATE_INVALID)
    const startMinute = parseClock(start)
    if (startMinute === undefined) return setError('Bitte den Beginn als Uhrzeit angeben.')
    const minutes = parseHours(hours)
    if (minutes === undefined) return setError(HOURS_INVALID)
    onSave({ project, date, startMinute, minutes, note })
  }

  return (
    <form onSubmit={submit} noValidate className="mt-2 print:hidden">
      {!entry.isBreak && (
        <>
          <label htmlFor={`${id}-project`} className="block font-semibold">
            Bauvorhaben
          </label>
          <input
            id={`${id}-project`}
            type="text"
            value={project}
            onChange={(event) => setProject(event.target.value)}
            autoComplete="off"
            className={`${fieldBase} mt-1 mb-3 w-full`}
          />
        </>
      )}
      <label htmlFor={`${id}-date`} className="block font-semibold">
        Datum
      </label>
      <input
        id={`${id}-date`}
        type="date"
        value={date}
        max={today}
        onChange={(event) => setDate(event.target.value)}
        className={`${fieldBase} mt-1 w-full`}
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div>
          <label htmlFor={`${id}-start`} className="block font-semibold">
            Beginn
          </label>
          <input
            id={`${id}-start`}
            type="time"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className={`${fieldBase} mt-1 w-full`}
          />
        </div>
        <div>
          <label htmlFor={`${id}-hours`} className="block font-semibold">
            Stunden
          </label>
          <input
            id={`${id}-hours`}
            type="text"
            inputMode="decimal"
            value={hours}
            onChange={(event) => setHours(event.target.value)}
            autoComplete="off"
            className={`${fieldBase} mt-1 w-full`}
          />
        </div>
      </div>
      {enteredMinutes !== undefined && (
        <OverlapText overlaps={overlapsOf(allEntries, { id: entry.id, date, startMinute: parseClock(start), minutes: enteredMinutes })} />
      )}
      <NoteField id={`${id}-note`} value={note} onChange={setNote} />
      {error && <ErrorText text={error} />}
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className={primaryButton}>
          Speichern
        </button>
        <button type="button" className={secondaryButton} onClick={onCancel}>
          Abbrechen
        </button>
      </div>
    </form>
  )
}

/** Eine Zeile der Liste; die Fußzeile nennt Erfassung und, falls bearbeitet, die letzte Änderung */
function EntryRow({
  entry,
  overlaps,
  allEntries,
  today,
  onEdit,
  onDelete,
}: {
  entry: WorkEntry
  /** Einträge, mit denen er sich überschneidet */
  overlaps: WorkEntry[]
  allEntries: WorkEntry[]
  today: string
  onEdit: (changes: EntryChanges) => void
  onDelete: () => void
}) {
  const [mode, setMode] = useState<'view' | 'edit' | 'confirmDelete'>('view')
  const range = entryTimeRange(entry)
  const name = entryName(entry)
  const label = `${name}, ${formatDay(entry.date)}, ${formatHours(entry.minutes)} ${entry.minutes === 60 ? 'Stunde' : 'Stunden'}`
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className={`text-lg font-bold [overflow-wrap:anywhere] ${entry.isBreak ? 'text-muted' : ''}`}>{name}</p>
        <p className="shrink-0 text-lg font-bold">{formatHours(entry.minutes)} h</p>
      </div>
      {range && <p>{range}</p>}
      {entry.note && <p className="whitespace-pre-wrap [overflow-wrap:anywhere]">{entry.note}</p>}
      <p className="text-sm text-muted">Erfasst {formatStamp(entry.recordedAt, entry.date)}</p>
      {entry.editedAt && <p className="text-sm font-semibold">Bearbeitet {formatStamp(entry.editedAt, entry.date)}</p>}
      <OverlapText overlaps={overlaps} />

      {mode === 'edit' ? (
        <EntryEditForm
          entry={entry}
          allEntries={allEntries}
          today={today}
          onCancel={() => setMode('view')}
          onSave={(changes) => {
            onEdit(changes)
            setMode('view')
          }}
        />
      ) : (
        <div className="mt-2 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            className={iconButton}
            aria-label={`${label} bearbeiten`}
            title="Bearbeiten"
            onClick={() => setMode('edit')}
          >
            <PencilIcon className="size-6" />
          </button>
          <button
            type="button"
            className={iconButton}
            aria-label={`${label} löschen`}
            title="Löschen"
            onClick={() => setMode('confirmDelete')}
          >
            <TrashIcon className="size-6 text-red-600 dark:text-red-400" />
          </button>
        </div>
      )}
      {mode === 'confirmDelete' && (
        <div className="mt-2 flex flex-wrap items-center gap-2 print:hidden">
          <span>Diesen Eintrag löschen?</span>
          <button type="button" className={dangerButton} onClick={onDelete}>
            Ja, löschen
          </button>
          <button type="button" className={secondaryButton} onClick={() => setMode('view')}>
            Abbrechen
          </button>
        </div>
      )}
    </li>
  )
}

/** Über- oder Minusstunden: Vorzeichen und Farbe, damit es nicht allein an der Farbe hängt */
const balanceColor = (minutes: number) => (minutes > 0 ? 'text-green-700 dark:text-green-400' : 'text-red-600 dark:text-red-400')

/** Die Einträge eines Tages in zeitlicher Reihenfolge, Pausen dazwischen, darunter die Summe */
export function DayCard({
  entries,
  allEntries,
  dailyMinutes,
  today,
  onEdit,
  onDelete,
}: {
  entries: WorkEntry[]
  allEntries: WorkEntry[]
  dailyMinutes: number
  today: string
  onEdit: (entry: WorkEntry, changes: EntryChanges) => void
  onDelete: (id: string) => void
}) {
  const balance = dayBalance(entries, dailyMinutes)
  return (
    <article className={`mt-3 p-4 ${card}`}>
      <ul className="divide-y divide-edge">
        {entries.map((entry) => (
          <EntryRow
            key={entry.id}
            entry={entry}
            overlaps={overlapsOf(entries, entry)}
            allEntries={allEntries}
            today={today}
            onEdit={(changes) => onEdit(entry, changes)}
            onDelete={() => onDelete(entry.id)}
          />
        ))}
      </ul>
      <p className="mt-3 flex items-baseline justify-between gap-3 border-t-2 border-line pt-3 text-xl font-bold">
        <span>Summe{entries.some(isBreak) && ' ohne Pausen'}</span>
        <span>{formatHours(totalMinutes(entries))} h</span>
      </p>
      {balance ? (
        <p className={`mt-1 flex items-baseline justify-between gap-3 text-lg font-bold ${balanceColor(balance)}`}>
          <span>{balanceLabel(balance)}</span>
          <span>{formatBalance(balance)}</span>
        </p>
      ) : null}
    </article>
  )
}

/** Zurück und vor, dazwischen was gerade gezeigt wird; gilt für Tag und Woche */
function PeriodNav({
  label,
  hint,
  previousLabel,
  nextLabel,
  atEnd,
  onPrevious,
  onNext,
}: {
  label: string
  hint?: string | undefined
  previousLabel: string
  nextLabel: string
  atEnd: boolean
  onPrevious: () => void
  onNext: () => void
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-2">
      <button type="button" aria-label={previousLabel} className={`${secondaryButton} shrink-0 print:hidden`} onClick={onPrevious}>
        ←
      </button>
      <p className="text-center font-semibold">
        {label}
        {hint && <span className="block text-base font-normal text-muted print:hidden">{hint}</span>}
      </p>
      <button
        type="button"
        aria-label={nextLabel}
        className={`${secondaryButton} shrink-0 print:hidden`}
        disabled={atEnd}
        onClick={onNext}
      >
        →
      </button>
    </div>
  )
}

/** Montag bis Sonntag mit den Stunden je Tag, Wochensumme und Stunden je Bauvorhaben; ein Tag führt zu seinen Einträgen */
export function WeekOverview({
  week,
  entries,
  targets,
  selectedDay,
  today,
  onSelectDay,
}: {
  week: string
  entries: WorkEntry[]
  targets: AgreedTargets
  selectedDay: string
  today: string
  onSelectDay: (day: string) => void
}) {
  const projects = hoursByProject(entries)
  const breaks = breakEntries(entries)
  const note = editedNote(entries)
  const overlap = overlapNote(entries)
  const balanceOfWeek = weekBalance(entries, week, targets)
  return (
    <>
      <ul className={`mt-3 divide-y divide-edge overflow-hidden ${card}`}>
        {weekDays(week).map((day) => {
          const dayEntries = entriesOfDay(entries, day)
          const minutes = totalMinutes(dayEntries)
          // Bei Wochenstunden gibt es kein Soll je Tag, also auch keine Über- oder Minusstunden je Tag
          const balance = dayBalance(dayEntries, targets.dailyMinutes)
          const selected = day === selectedDay
          return (
            <li key={day}>
              <button
                type="button"
                aria-current={selected ? 'date' : undefined}
                disabled={day > today}
                onClick={() => onSelectDay(day)}
                className={`flex min-h-12 w-full items-center justify-between gap-3 border-l-4 px-3 text-left disabled:opacity-40 ${
                  selected ? 'border-accent font-bold print:border-transparent print:font-normal' : 'border-transparent'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span>{formatDay(day)}</span>
                  {hasOverlaps(dayEntries) && (
                    <span title="Zeiten überschneiden sich">
                      <WarningIcon className="size-5" />
                      <span className="sr-only">Zeiten überschneiden sich</span>
                    </span>
                  )}
                </span>
                <span className="flex items-baseline gap-3">
                  {balance ? (
                    <span className={`text-base font-semibold ${balanceColor(balance)}`}>
                      <span className="sr-only">{balanceLabel(balance)} </span>
                      {formatBalance(balance)}
                    </span>
                  ) : null}
                  <span className={minutes > 0 ? 'font-semibold' : 'text-muted'}>{minutes > 0 ? `${formatHours(minutes)} h` : '–'}</span>
                </span>
              </button>
            </li>
          )
        })}
        <li className="flex items-baseline justify-between gap-3 border-t-2 border-line px-4 py-3 text-xl font-bold">
          <span>Gesamt{breaks.length > 0 && ' ohne Pausen'}</span>
          <span>{formatHours(totalMinutes(entries))} h</span>
        </li>
        {balanceOfWeek ? (
          <li className={`flex items-baseline justify-between gap-3 px-4 py-3 text-lg font-bold ${balanceColor(balanceOfWeek)}`}>
            <span>{balanceLabel(balanceOfWeek)} der Woche</span>
            <span>{formatBalance(balanceOfWeek)}</span>
          </li>
        ) : null}
      </ul>

      {entries.length > 0 && (
        <div className={`mt-3 p-4 ${card}`}>
          <h3 className="text-lg font-bold">Je Bauvorhaben</h3>
          <ul className="mt-1">
            {projects.map((group) => (
              <li key={group.project.toLocaleLowerCase('de')} className="flex items-baseline justify-between gap-3 py-1">
                <span className="[overflow-wrap:anywhere]">{group.project}</span>
                <span className="shrink-0 font-semibold">{formatHours(group.minutes)} h</span>
              </li>
            ))}
            {breaks.length > 0 && (
              <li className="flex items-baseline justify-between gap-3 py-1 text-muted">
                <span>Pausen, nicht in Gesamt</span>
                <span className="shrink-0">{formatHours(sumMinutes(breaks))} h</span>
              </li>
            )}
          </ul>
          {note && <p className="mt-2 border-t border-edge pt-2 text-base">{note}</p>}
          {overlap && <p className="mt-2 border-t border-edge pt-2 text-base font-semibold">{overlap}</p>}
        </div>
      )}
    </>
  )
}

/** Stundenzettel: Bauvorhaben und Stunden eintragen, darunter die Einträge eines Tages, die Woche im Überblick und der Export */
export function WorkHours({
  closingNote,
  initialEntries,
  now: fixedNow,
  initialByTimes = false,
}: {
  closingNote: string
  initialEntries?: WorkEntry[]
  now?: Date
  /** Start- und Endzeit schon eingeblendet (Tests) */
  initialByTimes?: boolean
}) {
  const clock = () => fixedNow ?? new Date()
  const today = isoDate(clock())
  const settings = useWorkHoursSettings()
  const targets = agreedTargets(settings)
  const { entries, saveFailed, save, remove } = useWorkEntries(initialEntries)
  const [project, setProject] = useState('')
  const [hours, setHours] = useState('')
  /** Start- und Endzeit statt Stunden eingeben */
  const [byTimes, setByTimes] = useState(initialByTimes)
  /** Von Hand gesetzter Start; ohne Eingabe gilt das Ende der Kette des gewählten Tages */
  const [startDraft, setStartDraft] = useState<string>()
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  /** Dauer nur für die nächste Pause; leer = Standarddauer aus den Einstellungen */
  const [breakText, setBreakText] = useState('')
  /** Abweichendes Datum; ohne Wahl gilt immer das heutige, auch wenn die App über Nacht offen bleibt */
  const [chosenDate, setChosenDate] = useState<string>()
  /** Gezeigter Tag; ohne Wahl der heutige */
  const [chosenDay, setChosenDay] = useState<string>()
  const [message, setMessage] = useState<Message>()
  const [locating, setLocating] = useState(false)
  const dayHeading = useRef<HTMLHeadingElement>(null)
  const id = useId()

  const date = chosenDate ?? today
  const day = chosenDay ?? today
  const currentWeek = weekStart(today)
  const week = weekStart(day)
  const all = entries ?? []
  const weekEntries = entriesOfWeek(all, week)
  const dayEntries = entriesOfDay(all, day)
  const suggestions = projectSuggestions(all, project)
  const todayStart = chainStart(all, today, settings.regularStart)
  const start = startDraft ?? clockFieldValue(chainStart(all, date, settings.regularStart).minute)
  const breakDuration = breakText.trim() === '' ? settings.breakMinutes : parseHours(breakText)

  // Heute bleibt „ungewählt“ und wandert mit dem Datum weiter, wenn die App über Nacht offen bleibt
  const showDay = (next: string) => setChosenDay(next >= today ? undefined : next)

  /** Nach dem Eintragen: den Tag des Eintrags zeigen und das Datum wieder auf heute stellen */
  const afterSaving = () => {
    showDay(date)
    setChosenDate(undefined)
  }

  const fillUntilNow = () => {
    // Ein von Hand gesetzter Start zählt; sonst der Beginn von heute, auch wenn gerade ein anderer Tag gewählt ist
    const entered = byTimes && startDraft !== undefined ? parseClock(startDraft) : undefined
    const result = hoursUntilNow(all, clock(), settings, entered)
    // „Bis jetzt“ gilt immer für heute
    setChosenDate(undefined)
    if (result.kind === 'ok') {
      if (byTimes) {
        setStartDraft(clockFieldValue(result.start.minute))
        setEnd(clockFieldValue(endMinuteFromDuration(result.start.minute, result.minutes)))
      } else {
        setHours(formatHours(result.minutes))
      }
    }
    setMessage(nowMessage(result))
  }

  const fillAddress = async () => {
    setLocating(true)
    setMessage(undefined)
    try {
      const position = await currentPosition()
      const address = await reverseGeocode(position)
      setProject((current) => appendAddress(current, address ?? formatCoordinates(position)))
      setMessage(
        address
          ? { kind: 'info', text: 'Adresse eingefügt. GPS ist nicht hausnummerngenau, bitte kurz prüfen.' }
          : { kind: 'info', text: 'Keine Adresse gefunden, vielleicht fehlt das Internet. Die Koordinaten sind eingefügt.' },
      )
    } catch (error) {
      setMessage({
        kind: 'error',
        text:
          error instanceof LocationError && error.reason === 'denied'
            ? 'Der Standort ist nicht freigegeben. Bitte im Browser oder in der App-Berechtigung erlauben.'
            : 'Der Standort konnte nicht bestimmt werden.',
      })
    } finally {
      setLocating(false)
    }
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const fail = (text: string) => setMessage({ kind: 'error', text })
    if (!project.trim()) return fail(PROJECT_MISSING)
    if (date > today) return fail(DATE_INVALID)
    const minutes = byTimes ? minutesBetween(start, end) : parseHours(hours)
    if (minutes === undefined) return fail(byTimes ? TIMES_INVALID : HOURS_INVALID)

    const entry = createEntry(
      { project, date, minutes, note, ...(byTimes ? { startMinute: parseClock(start)! } : {}) },
      all,
      settings.regularStart,
      clock(),
    )
    save(entry)
    setProject('')
    setHours('')
    setStartDraft(undefined)
    setEnd('')
    setNote('')
    afterSaving()
    setMessage({ kind: 'info', text: `Eingetragen: ${entry.project}, ${formatHours(minutes)} h.` })
  }

  const addBreak = () => {
    if (date > today) return setMessage({ kind: 'error', text: DATE_INVALID })
    if (breakDuration === undefined) return setMessage({ kind: 'error', text: BREAK_INVALID })
    const entry = createBreakEntry({ date, minutes: breakDuration }, all, settings.regularStart, clock())
    save(entry)
    setBreakText('')
    afterSaving()
    setMessage({ kind: 'info', text: `Pause eingetragen: ${formatDay(date)}, ${entryTimeRange(entry)}.` })
  }

  const editExisting = (entry: WorkEntry, changes: EntryChanges) => {
    const edited = editEntry(entry, changes, clock())
    if (edited === entry) return
    save(edited)
    // Wurde er auf einen anderen Tag verschoben, dorthin mitgehen
    if (edited.date !== entry.date) showDay(edited.date)
  }

  return (
    <section className="mt-6">
      <form onSubmit={submit} noValidate className={`p-4 print:hidden ${card}`}>
        <h2 className="text-xl font-bold">Eintragen</h2>

        <label htmlFor={`${id}-project`} className="mt-3 block font-semibold">
          Bauvorhaben
        </label>
        <ProjectInput id={`${id}-project`} value={project} onChange={setProject} suggestions={suggestions}>
          <button
            type="button"
            className={`${secondaryButton} shrink-0`}
            aria-label="Adresse per GPS anfügen"
            disabled={locating}
            onClick={() => void fillAddress()}
          >
            <LocationIcon className="size-5" />
            {locating ? 'Sucht …' : 'GPS'}
          </button>
        </ProjectInput>

        <label htmlFor={`${id}-date`} className="mt-3 block font-semibold">
          Datum
        </label>
        <input
          id={`${id}-date`}
          type="date"
          value={date}
          max={today}
          onChange={(event) => setChosenDate(event.target.value || undefined)}
          className={`${fieldBase} mt-1 w-full`}
        />

        {byTimes ? (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label htmlFor={`${id}-from`} className="block font-semibold">
                Start
              </label>
              <input
                id={`${id}-from`}
                type="time"
                value={start}
                onChange={(event) => setStartDraft(event.target.value)}
                className={`${fieldBase} mt-1 w-full`}
              />
            </div>
            <div>
              <label htmlFor={`${id}-to`} className="block font-semibold">
                Ende
              </label>
              <input
                id={`${id}-to`}
                type="time"
                value={end}
                onChange={(event) => setEnd(event.target.value)}
                className={`${fieldBase} mt-1 w-full`}
              />
            </div>
          </div>
        ) : (
          <label htmlFor={`${id}-hours`} className="mt-3 block font-semibold">
            Arbeitsstunden
          </label>
        )}
        {byTimes && minutesBetween(start, end) !== undefined && (
          <OverlapText
            overlaps={overlapsOf(all, { date, startMinute: parseClock(start), minutes: minutesBetween(start, end)! })}
          />
        )}
        <div className="mt-1 flex gap-2">
          {byTimes ? (
            <div className="min-w-0 flex-1 self-center text-base font-semibold">
              {minutesBetween(start, end) !== undefined && `= ${formatHours(minutesBetween(start, end)!)} h`}
            </div>
          ) : (
            <input
              id={`${id}-hours`}
              type="text"
              inputMode="decimal"
              placeholder="z. B. 2,5"
              value={hours}
              onChange={(event) => setHours(event.target.value)}
              autoComplete="off"
              className={`${fieldBase} w-full min-w-0 flex-1`}
            />
          )}
          <button type="button" className={`${secondaryButton} shrink-0`} onClick={fillUntilNow}>
            Bis jetzt
          </button>
          <button
            type="button"
            className={`${iconButton} ${byTimes ? '!border-accent !bg-accent !text-accent-ink' : ''}`}
            aria-pressed={byTimes}
            aria-label="Start- und Endzeit statt Stunden eingeben"
            title="Start- und Endzeit statt Stunden eingeben"
            onClick={() => {
              setByTimes(!byTimes)
              setMessage(undefined)
            }}
          >
            <ClockIcon className="size-6" />
          </button>
        </div>
        <p className="mt-1 text-base text-muted">
          {byTimes ? (
            <>„Bis jetzt“ trägt die aktuelle Uhrzeit als Ende ein{ROUNDING_HINTS[settings.roundingStep]}.</>
          ) : (
            <>
              „Bis jetzt“ zählt heute ab {describeStart(todayStart)}
              {ROUNDING_HINTS[settings.roundingStep]}.
            </>
          )}
        </p>

        <NoteField id={`${id}-note`} value={note} onChange={setNote} />

        <button type="submit" className={`${primaryButton} mt-3 w-full`} disabled={entries === undefined}>
          Eintragen
        </button>

        <label htmlFor={`${id}-break-now`} className="mt-4 block font-semibold">
          Pausendauer
        </label>
        <div className="mt-1 flex gap-2">
          <input
            id={`${id}-break-now`}
            type="text"
            inputMode="decimal"
            placeholder={formatHours(settings.breakMinutes)}
            value={breakText}
            onChange={(event) => setBreakText(event.target.value)}
            autoComplete="off"
            className={`${fieldBase} w-full min-w-0 flex-1`}
          />
          <button type="button" className={`${secondaryButton} shrink-0`} disabled={entries === undefined} onClick={addBreak}>
            {breakDuration === undefined ? 'Pause' : `Pause ${formatHours(breakDuration)} h`}
          </button>
        </div>
        <p className="mt-1 text-base text-muted">
          Die Pause beginnt am Ende des letzten Eintrags. Damit die Uhrzeiten stimmen, vorher die Stunden eintragen.
        </p>

        <div aria-live="polite">
          {message &&
            (message.kind === 'error' ? <ErrorText text={message.text} /> : <p className="mt-3 font-semibold">{message.text}</p>)}
        </div>
      </form>

      <SettingsPanel />

      {saveFailed && <ErrorText text={SAVE_FAILED} />}

      <div className="print:hidden">
        <h2 ref={dayHeading} className="mt-6 scroll-mt-24 text-xl font-bold">
          Stundeneinträge
        </h2>
        <PeriodNav
          label={formatDayLong(day)}
          hint={day === today ? 'Heute' : undefined}
          previousLabel="Tag davor"
          nextLabel="Tag danach"
          atEnd={day >= today}
          onPrevious={() => showDay(addDays(day, -1))}
          onNext={() => showDay(addDays(day, 1))}
        />
        {entries === undefined ? (
          <p className="mt-3 text-muted">Wird geladen …</p>
        ) : dayEntries.length === 0 ? (
          <p className="mt-3 text-muted">An diesem Tag ist noch nichts eingetragen.</p>
        ) : (
          <DayCard entries={dayEntries} allEntries={all} dailyMinutes={targets.dailyMinutes} today={today} onEdit={editExisting} onDelete={remove} />
        )}
      </div>

      {/* Auf Papier zählt die ganze Woche: dort stehen alle Tage mit Einträgen statt nur des gewählten */}
      <div className="hidden print:block">
        <h2 className="text-xl font-bold">Stundeneinträge</h2>
        {weekDays(week).map((printedDay) => {
          const printed = entriesOfDay(weekEntries, printedDay)
          if (printed.length === 0) return null
          return (
            <section key={printedDay} className="mt-3 break-inside-avoid">
              <h3 className="font-bold">{formatDayLong(printedDay)}</h3>
              <DayCard entries={printed} allEntries={all} dailyMinutes={targets.dailyMinutes} today={today} onEdit={editExisting} onDelete={remove} />
            </section>
          )
        })}
      </div>

      <h2 className="mt-6 text-xl font-bold">Wochenübersicht</h2>
      <PeriodNav
        label={weekLabel(week)}
        hint={week === currentWeek ? 'Diese Woche' : undefined}
        previousLabel="Woche davor"
        nextLabel="Woche danach"
        atEnd={week >= currentWeek}
        onPrevious={() => showDay(addDays(day, -7))}
        onNext={() => showDay(addDays(day, 7))}
      />
      <WeekOverview
        week={week}
        entries={weekEntries}
        targets={targets}
        selectedDay={day}
        today={today}
        onSelectDay={(selected) => {
          showDay(selected)
          dayHeading.current?.scrollIntoView({ block: 'start' })
        }}
      />
      {weekEntries.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2 print:hidden">
          <button
            type="button"
            className={primaryButton}
            onClick={() => downloadTextFile(csvFileName(week), workHoursCsv(all, week, targets), 'text/csv;charset=utf-8')}
          >
            Für Excel exportieren (CSV)
          </button>
          <button type="button" className={secondaryButton} onClick={() => window.print()}>
            Drucken oder PDF
          </button>
        </div>
      )}
      <p className="mt-8 text-base print:hidden">{closingNote}</p>
    </section>
  )
}
