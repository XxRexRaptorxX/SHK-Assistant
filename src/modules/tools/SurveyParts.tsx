import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { dangerButton, primaryButton, secondaryButton } from '../../components/buttons'
import { MailIcon, PencilIcon, ShareIcon, TrashIcon } from '../../components/icons'
import { card, chip, fieldBase } from '../../components/surfaces'
import { downloadTextFile } from '../../lib/download'
import { createStoredState } from '../../lib/storedState'
import {
  formatSurveyDate,
  parseRecipients,
  projectLabel,
  roomLabel,
  setNote,
  setProject,
  surveyLabel,
  type SurveyBase,
  type SurveyRoomBase,
} from './surveyCommon'

// Gemeinsame Bausteine der Aufmaß-Tools: Aufmaß wählen und anlegen, Räume, Zähler, Export/Druck/E-Mail.

export const SAVE_FAILED = 'Speichern auf dem Gerät hat nicht geklappt. Die Eingaben bleiben nur, bis die Seite geschlossen wird.'
const RECIPIENTS_INVALID = 'Bitte gültige E-Mail-Adressen eintragen, mehrere durch Komma getrennt.'

// Empfänger der E-Mail (z. B. Büro), für alle Aufmaß-Tools gleich: gilt nur für dieses Gerät, daher localStorage
export const SURVEY_RECIPIENTS_KEY = 'shk-survey-recipients'

export const recipientsState = createStoredState<string>({
  key: SURVEY_RECIPIENTS_KEY,
  read: () => {
    try {
      return globalThis.localStorage?.getItem(SURVEY_RECIPIENTS_KEY) ?? ''
    } catch {
      return ''
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(SURVEY_RECIPIENTS_KEY, value)
    } catch {
      // ohne Speicher gilt die Eingabe bis zum Neuladen
    }
  },
  fallback: '',
})

export const iconButton = `${secondaryButton} w-12 shrink-0 !px-0`
const countButton = `${secondaryButton} w-14 shrink-0 !px-0 text-2xl`

export function WarnText({ text }: { text: string }) {
  return <p className="mt-3 rounded-xl bg-warn p-2 font-semibold text-warn-ink">{text}</p>
}

interface SurveyStore<S> {
  list: (toolId: string) => Promise<S[]>
  save: (survey: S) => Promise<void>
  remove: (id: string) => Promise<void>
}

/**
 * Aufmaße aus dem Gerätespeicher. Ein neues, leeres Aufmaß bleibt nur in der Anzeige, bis etwas eingetragen ist;
 * schlägt das Speichern fehl, bleibt alles bis zum Schließen in der Anzeige.
 */
export function useSurveys<S extends SurveyBase>({
  toolId,
  store,
  create,
  isEmpty,
  ensureRoom,
  now,
  initialSurveys,
}: {
  toolId: string
  store: SurveyStore<S>
  create: (toolId: string, now: Date) => S
  isEmpty: (survey: S) => boolean
  ensureRoom: (survey: S, now: Date) => S
  now: () => Date
  initialSurveys?: S[]
}) {
  /** Ohne gespeicherte Aufmaße gibt es gleich ein leeres zum Loslegen; jedes hat mindestens einen Raum */
  const withDraft = (surveys: S[]) =>
    surveys.length > 0
      ? [...surveys].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((survey) => ensureRoom(survey, now()))
      : [create(toolId, now())]
  const [surveys, setSurveys] = useState<S[] | undefined>(() => (initialSurveys ? withDraft(initialSurveys) : undefined))
  const [saveFailed, setSaveFailed] = useState(false)
  const saved = useRef(new Set(initialSurveys?.map((survey) => survey.id)))

  useEffect(() => {
    if (initialSurveys) return
    let active = true
    store
      .list(toolId)
      .then((stored) => {
        if (!active) return
        saved.current = new Set(stored.map((survey) => survey.id))
        setSurveys(withDraft(stored))
      })
      .catch(() => {
        if (!active) return
        setSurveys([create(toolId, now())])
        setSaveFailed(true)
      })
    return () => {
      active = false
    }
    // Nur beim Öffnen laden; die Hilfsfunktionen sind bei jedem Rendern neu
  }, [initialSurveys, toolId])

  const update = (survey: S) => {
    setSurveys((current) => (current ?? []).map((other) => (other.id === survey.id ? survey : other)))
    if (isEmpty(survey) && !saved.current.has(survey.id)) return
    saved.current.add(survey.id)
    store.save(survey).catch(() => setSaveFailed(true))
  }
  const add = (survey: S) => setSurveys((current) => [survey, ...(current ?? [])])
  const remove = (id: string) => {
    setSurveys((current) => withDraft((current ?? []).filter((survey) => survey.id !== id)))
    if (!saved.current.delete(id)) return
    store.remove(id).catch(() => setSaveFailed(true))
  }
  return { surveys, saveFailed, update, add, remove }
}

/** Löschen mit Rückfrage an derselben Stelle, ohne Dialogfenster */
export function ConfirmDelete({ label, question, onConfirm }: { label: string; question: string; onConfirm: () => void }) {
  const [asking, setAsking] = useState(false)
  if (!asking) {
    return (
      <button type="button" className={iconButton} aria-label={label} title={label} onClick={() => setAsking(true)}>
        <TrashIcon className="size-6 text-red-600 dark:text-red-400" />
      </button>
    )
  }
  return (
    <div className="flex w-full flex-wrap items-center gap-2 rounded-xl bg-warn p-2 text-warn-ink">
      <span className="min-w-0 flex-1 font-semibold">{question}</span>
      <button
        type="button"
        className={dangerButton}
        onClick={() => {
          setAsking(false)
          onConfirm()
        }}
      >
        Löschen
      </button>
      <button type="button" className={secondaryButton} onClick={() => setAsking(false)}>
        Abbrechen
      </button>
    </div>
  )
}

/** Stückzahl mit großen Knöpfen für Handschuhe; das Feld in der Mitte nimmt auch größere Zahlen direkt */
export function Counter({
  id,
  label,
  value,
  onChange,
  min = 0,
  max,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
  min?: number
  max: number
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={countButton}
        aria-label={`${label}: eins weniger`}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
      >
        −
      </button>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        aria-label={`${label}: Anzahl`}
        value={value === 0 ? '' : String(value)}
        placeholder="0"
        onChange={(event) => onChange(Number(event.target.value.replace(/\D/g, '') || '0'))}
        onFocus={(event) => event.target.select()}
        autoComplete="off"
        className={`${fieldBase} w-16 px-1 text-center font-bold tabular-nums`}
      />
      <button
        type="button"
        className={countButton}
        aria-label={`${label}: eins mehr`}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

/** Kopf: gespeicherte Aufmaße, Bauvorhaben, Bemerkung, neues Aufmaß und Löschen */
export function SurveyHeaderCard<S extends SurveyBase>({
  surveys,
  survey,
  isEmpty,
  now,
  onSelect,
  onUpdate,
  onNew,
  onDelete,
}: {
  surveys: S[]
  survey: S
  isEmpty: (survey: S) => boolean
  now: () => Date
  onSelect: (id: string) => void
  onUpdate: (survey: S) => void
  onNew: () => void
  onDelete: () => void
}) {
  const id = useId()
  return (
    <div className={`p-4 print:hidden ${card}`}>
      <h2 className="text-xl font-bold">Aufmaß</h2>
      {surveys.length > 1 && (
        <>
          <label htmlFor={`${id}-survey`} className="mt-3 block font-semibold">
            Gespeicherte Aufmaße
          </label>
          <select
            id={`${id}-survey`}
            value={survey.id}
            onChange={(event) => onSelect(event.target.value)}
            className={`${fieldBase} mt-1 w-full`}
          >
            {surveys.map((candidate) => (
              <option key={candidate.id} value={candidate.id}>
                {isEmpty(candidate) ? 'Neues Aufmaß' : surveyLabel(candidate)}
              </option>
            ))}
          </select>
        </>
      )}

      <label htmlFor={`${id}-project`} className="mt-3 block font-semibold">
        Bauvorhaben
      </label>
      <input
        id={`${id}-project`}
        type="text"
        value={survey.project}
        placeholder="z. B. Müller, Hauptstraße 5"
        onChange={(event) => onUpdate(setProject(survey, event.target.value, now()))}
        autoComplete="off"
        className={`${fieldBase} mt-1 w-full`}
      />

      <label htmlFor={`${id}-note`} className="mt-3 block font-semibold">
        Bemerkung <span className="font-normal text-muted">(optional)</span>
      </label>
      <textarea
        id={`${id}-note`}
        rows={2}
        value={survey.note ?? ''}
        onChange={(event) => onUpdate(setNote(survey, event.target.value, now()))}
        autoComplete="off"
        className={`${fieldBase} mt-1 block w-full py-2`}
      />
      <p className="mt-1 text-base text-muted">Angelegt am {formatSurveyDate(survey.createdAt)}.</p>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className={`${secondaryButton} flex-1`} onClick={onNew}>
          Neues Aufmaß
        </button>
        {!isEmpty(survey) && (
          <ConfirmDelete
            key={survey.id}
            label="Aufmaß löschen"
            question={`Aufmaß „${projectLabel(survey)}“ mit allen Räumen löschen?`}
            onConfirm={onDelete}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Räume als Knöpfe mit Anzahl, neuer Raum, Umbenennen und Löschen des gewählten Raums.
 * Ein einzelner Raum ohne Namen und ohne Inhalt bekommt beim Anlegen einfach den Namen, statt leer stehen zu bleiben.
 */
export function RoomBar<R extends SurveyRoomBase>({
  rooms,
  room,
  pieces,
  piecesName,
  onSelect,
  onAdd,
  onRename,
  onRemove,
}: {
  rooms: R[]
  room: R
  /** Inhalt eines Raums, z. B. gezählte Ventile */
  pieces: (room: R) => number
  /** Wofür die Zahl steht, z. B. „gezählten Stück“ */
  piecesName: string
  onSelect: (id: string) => void
  onAdd: (name: string) => void
  onRename: (name: string) => void
  onRemove: () => void
}) {
  const [newRoom, setNewRoom] = useState<string>()
  const [renaming, setRenaming] = useState(false)
  const id = useId()

  const submit = (event: FormEvent) => {
    event.preventDefault()
    if (newRoom === undefined) return
    if (rooms.length === 1 && room.name.trim() === '' && pieces(room) === 0) onRename(newRoom.trim())
    else onAdd(newRoom)
    setNewRoom(undefined)
  }

  return (
    <>
      <div role="group" aria-label="Räume" className="mt-3 flex flex-wrap gap-2">
        {rooms.map((candidate) => {
          const selected = candidate.id === room.id
          return (
            <button
              key={candidate.id}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onSelect(candidate.id)
                setRenaming(false)
              }}
              className={`${secondaryButton} max-w-full ${selected ? '!border-accent !bg-accent !text-accent-ink' : ''}`}
            >
              <span className="min-w-0 truncate">{roomLabel(candidate)}</span>
              <span className={`${chip} !px-2 !py-0 tabular-nums`}>{pieces(candidate)}</span>
            </button>
          )
        })}
        {newRoom === undefined && (
          <button type="button" className={secondaryButton} onClick={() => setNewRoom('')}>
            + Raum
          </button>
        )}
      </div>

      {newRoom !== undefined && (
        <form onSubmit={submit} noValidate className="mt-3">
          <label htmlFor={`${id}-new-room`} className="block font-semibold">
            Neuer Raum
          </label>
          <div className="mt-1 flex gap-2">
            <input
              id={`${id}-new-room`}
              type="text"
              value={newRoom}
              placeholder="z. B. Bad OG"
              onChange={(event) => setNewRoom(event.target.value)}
              autoComplete="off"
              autoFocus
              className={`${fieldBase} w-full min-w-0 flex-1`}
            />
            <button type="submit" className={`${primaryButton} shrink-0`}>
              Anlegen
            </button>
            <button type="button" className={`${secondaryButton} shrink-0`} onClick={() => setNewRoom(undefined)}>
              Abbrechen
            </button>
          </div>
        </form>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-edge pt-3">
        {renaming ? (
          <>
            <label htmlFor={`${id}-room-name`} className="sr-only">
              Raumname
            </label>
            <input
              id={`${id}-room-name`}
              type="text"
              value={room.name}
              placeholder={roomLabel(room)}
              onChange={(event) => onRename(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') setRenaming(false)
              }}
              autoComplete="off"
              autoFocus
              className={`${fieldBase} min-w-0 flex-1`}
            />
            <button type="button" className={`${primaryButton} shrink-0`} onClick={() => setRenaming(false)}>
              Fertig
            </button>
          </>
        ) : (
          <>
            <h3 className="min-w-0 flex-1 text-lg font-bold [overflow-wrap:anywhere]">{roomLabel(room)}</h3>
            <button
              type="button"
              className={iconButton}
              aria-label="Raum umbenennen"
              title="Raum umbenennen"
              onClick={() => setRenaming(true)}
            >
              <PencilIcon className="size-6" />
            </button>
            {(rooms.length > 1 || pieces(room) > 0 || room.name.trim() !== '') && (
              <ConfirmDelete
                key={room.id}
                label="Raum löschen"
                question={`Raum „${roomLabel(room)}“ mit ${pieces(room)} ${piecesName} löschen?`}
                onConfirm={onRemove}
              />
            )}
          </>
        )}
      </div>
    </>
  )
}

/** Kopf nur auf dem Ausdruck; am Bildschirm steht das im Formular */
export function PrintHeader({ survey }: { survey: SurveyBase }) {
  return (
    <div className="hidden print:block">
      <p>
        <strong>Bauvorhaben:</strong> {projectLabel(survey)}
      </p>
      <p>
        <strong>Aufmaß vom:</strong> {formatSurveyDate(survey.createdAt)}
      </p>
      {survey.note?.trim() && (
        <p className="whitespace-pre-line">
          <strong>Bemerkung:</strong> {survey.note.trim()}
        </p>
      )}
    </div>
  )
}

/** Export als CSV, Drucken, E-Mail über das eigene Mailprogramm und, wo möglich, Teilen als Datei */
export function SharePanel({
  disabled,
  title,
  fileName,
  csv,
  text,
  mailto,
  mailContent,
}: {
  /** Noch nichts eingetragen */
  disabled: boolean
  /** Titel beim Teilen, z. B. „Aufmaß Heizkörper: Müller“ */
  title: string
  fileName: string
  csv: () => string
  text: () => string
  mailto: (recipients: string[]) => string
  /** Was in der E-Mail steht, z. B. „die Stückliste“ */
  mailContent: string
}) {
  const recipientsText = recipientsState.useValue()
  const [shareFailed, setShareFailed] = useState(false)
  const id = useId()
  const recipients = parseRecipients(recipientsText)
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'test.csv', { type: 'text/csv' })] })

  const share = async () => {
    setShareFailed(false)
    const file = new File([csv()], fileName, { type: 'text/csv' })
    try {
      await navigator.share({ files: [file], title, text: text() })
    } catch (error) {
      // Abbrechen durch den Nutzer ist kein Fehler
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareFailed(true)
    }
  }

  return (
    <div className={`mt-6 p-4 print:hidden ${card}`}>
      <h2 className="text-xl font-bold">Weitergeben</h2>
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          className={primaryButton}
          disabled={disabled}
          onClick={() => downloadTextFile(fileName, csv(), 'text/csv;charset=utf-8')}
        >
          Für Excel exportieren (CSV)
        </button>
        <button type="button" className={secondaryButton} disabled={disabled} onClick={() => window.print()}>
          Drucken oder PDF
        </button>
      </div>

      {/* E-Mail-Knopf zuerst, darunter die (optionale) Empfängeradresse */}
      <div className="mt-3 flex flex-wrap gap-2">
        {disabled || recipients === undefined ? (
          <button type="button" className={primaryButton} disabled>
            <MailIcon className="size-6" />
            Per E-Mail senden
          </button>
        ) : (
          <a href={mailto(recipients)} className={primaryButton}>
            <MailIcon className="size-6" />
            Per E-Mail senden
          </a>
        )}
        {canShareFiles && (
          <button type="button" className={secondaryButton} disabled={disabled} onClick={() => void share()}>
            <ShareIcon className="size-6" />
            Als Datei teilen
          </button>
        )}
      </div>
      <p className="mt-2 text-base text-muted">
        Die E-Mail enthält {mailContent} als Text und öffnet sich im Mailprogramm.
        {canShareFiles && ' „Als Datei teilen“ hängt die CSV-Datei an, z. B. in der Mail-App.'}
      </p>
      {shareFailed && <WarnText text="Teilen hat nicht geklappt." />}

      <label htmlFor={`${id}-recipients`} className="mt-4 block font-semibold">
        E-Mail an <span className="font-normal text-muted">(optional, bleibt auf diesem Gerät gespeichert)</span>
      </label>
      <input
        id={`${id}-recipients`}
        type="text"
        inputMode="email"
        value={recipientsText}
        placeholder="z. B. buero@firma.de"
        onChange={(event) => recipientsState.set(event.target.value)}
        autoComplete="email"
        aria-invalid={recipients === undefined}
        className={`${fieldBase} mt-1 w-full`}
      />
      {recipients === undefined && <WarnText text={RECIPIENTS_INVALID} />}
    </div>
  )
}
