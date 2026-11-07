import { useEffect, useId, useRef, useState, type FormEvent } from 'react'
import { dangerButton, primaryButton, secondaryButton } from '../../components/buttons'
import { MailIcon, PencilIcon, ShareIcon, TrashIcon } from '../../components/icons'
import { card, chip, fieldBase } from '../../components/surfaces'
import { downloadTextFile } from '../../lib/download'
import { createStoredState } from '../../lib/storedState'
import type { ValveSurvey as Survey } from '../../storage/db'
import { deleteValveSurvey, listValveSurveys, saveValveSurvey } from '../../storage/valveSurveys'
import {
  addRoom,
  billIsEmpty,
  countOf,
  createSurvey,
  ensureRoom,
  formatSurveyDate,
  isEmptySurvey,
  MAX_COUNT,
  parseRecipients,
  projectLabel,
  removeRoom,
  renameRoom,
  roomLabel,
  roomLines,
  roomPieces,
  setCount,
  setNote,
  setProject,
  showRoomBreakdown,
  sortSurveys,
  surveyBill,
  surveyCsv,
  surveyFileName,
  surveyLabel,
  surveyMailto,
  surveyText,
} from './valveSurveyCalc'
import type { ValveSurveyTool } from './valveSurveyTool'

const SAVE_FAILED = 'Speichern auf dem Gerät hat nicht geklappt. Die Eingaben bleiben nur, bis die Seite geschlossen wird.'
const RECIPIENTS_INVALID = 'Bitte gültige E-Mail-Adressen eintragen, mehrere durch Komma getrennt.'

// Empfänger der E-Mail (z. B. Büro): gilt nur für dieses Gerät, daher localStorage wie die übrigen Einstellungen
export const VALVE_SURVEY_RECIPIENTS_KEY = 'shk-valve-survey-recipients'

const recipientsState = createStoredState<string>({
  key: VALVE_SURVEY_RECIPIENTS_KEY,
  read: () => {
    try {
      return globalThis.localStorage?.getItem(VALVE_SURVEY_RECIPIENTS_KEY) ?? ''
    } catch {
      return ''
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(VALVE_SURVEY_RECIPIENTS_KEY, value)
    } catch {
      // ohne Speicher gilt die Eingabe bis zum Neuladen
    }
  },
  fallback: '',
})

const iconButton = `${secondaryButton} w-12 shrink-0 !px-0`
const countButton = `${secondaryButton} w-14 shrink-0 !px-0 text-2xl`

/**
 * Aufmaße aus dem Gerätespeicher. Ein neues, leeres Aufmaß bleibt nur in der Anzeige, bis etwas eingetragen ist;
 * schlägt das Speichern fehl, bleibt alles bis zum Schließen in der Anzeige.
 */
function useValveSurveys(toolId: string, now: () => Date, initialSurveys?: Survey[]) {
  const [surveys, setSurveys] = useState<Survey[] | undefined>(() =>
    initialSurveys ? withDraft(sortSurveys(initialSurveys), toolId, now()) : undefined,
  )
  const [saveFailed, setSaveFailed] = useState(false)
  const saved = useRef(new Set(initialSurveys?.map((survey) => survey.id)))

  useEffect(() => {
    if (initialSurveys) return
    let active = true
    listValveSurveys(toolId)
      .then((stored) => {
        if (!active) return
        saved.current = new Set(stored.map((survey) => survey.id))
        setSurveys(withDraft(sortSurveys(stored), toolId, now()))
      })
      .catch(() => {
        if (!active) return
        setSurveys([createSurvey(toolId, now())])
        setSaveFailed(true)
      })
    return () => {
      active = false
    }
    // now ist bei jedem Rendern neu, soll das Laden aber nicht wiederholen
  }, [initialSurveys, toolId])

  const update = (survey: Survey) => {
    setSurveys((current) => (current ?? []).map((other) => (other.id === survey.id ? survey : other)))
    if (isEmptySurvey(survey) && !saved.current.has(survey.id)) return
    saved.current.add(survey.id)
    saveValveSurvey(survey).catch(() => setSaveFailed(true))
  }
  const add = (survey: Survey) => setSurveys((current) => [survey, ...(current ?? [])])
  const remove = (id: string) => {
    setSurveys((current) => withDraft((current ?? []).filter((survey) => survey.id !== id), toolId, now()))
    if (!saved.current.delete(id)) return
    deleteValveSurvey(id).catch(() => setSaveFailed(true))
  }
  return { surveys, saveFailed, update, add, remove }
}

/** Ohne gespeicherte Aufmaße gibt es gleich ein leeres zum Loslegen; jedes hat mindestens einen Raum */
const withDraft = (surveys: Survey[], toolId: string, now: Date) =>
  surveys.length > 0 ? surveys.map((survey) => ensureRoom(survey, now)) : [createSurvey(toolId, now)]

/** Löschen mit Rückfrage an derselben Stelle, ohne Dialogfenster */
function ConfirmDelete({ label, question, onConfirm }: { label: string; question: string; onConfirm: () => void }) {
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
function Counter({
  id,
  label,
  value,
  onChange,
}: {
  id: string
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex shrink-0 items-center gap-1">
      <button
        type="button"
        className={countButton}
        aria-label={`${label}: eins weniger`}
        disabled={value === 0}
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
        disabled={value >= MAX_COUNT}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  )
}

/** Stückliste wie in der Excel-Vorlage: Typen mit Artikelnummer, Zwischensumme je Gruppe, darunter die Summen */
export function BillTable({ tool, survey }: { tool: ValveSurveyTool; survey: Survey }) {
  const bill = surveyBill(tool, survey)
  return (
    <>
      {billIsEmpty(bill) ? (
        <p className="mt-3 text-muted">Noch nichts gezählt.</p>
      ) : (
        <table className={`mt-3 w-full border-separate border-spacing-0 overflow-hidden text-left ${card}`}>
          <thead>
            <tr>
              <th className="px-3 py-2">Ventil</th>
              <th className="px-3 py-2">
                Art.-Nr. <span className="font-normal text-muted">{tool.replacementName}</span>
              </th>
              <th className="px-3 py-2 text-right">Stück</th>
            </tr>
          </thead>
          {bill.groups.map((group) => (
            <tbody key={group.key} className="break-inside-avoid">
              {group.lines.map((line) => (
                <tr key={line.type.key}>
                  <td className="border-t border-edge px-3 py-2">{line.type.label}</td>
                  <td className="border-t border-edge px-3 py-2 tabular-nums">{line.type.article ?? '–'}</td>
                  <td className="border-t border-edge px-3 py-2 text-right font-bold tabular-nums">{line.count}</td>
                </tr>
              ))}
              <tr className="text-muted">
                <td colSpan={2} className="border-t border-edge px-3 py-1 text-base">
                  {group.name} gesamt
                </td>
                <td className="border-t border-edge px-3 py-1 text-right text-base tabular-nums">{group.subtotal}</td>
              </tr>
            </tbody>
          ))}
        </table>
      )}
      <dl className={`mt-3 divide-y divide-edge ${card}`}>
        {bill.totals.map((total) => (
          <div key={total.key} className="flex items-baseline justify-between gap-3 px-3 py-2">
            <dt className="font-semibold">{total.name}</dt>
            <dd className="text-xl font-bold tabular-nums">{total.count}</dd>
          </div>
        ))}
      </dl>
      {bill.unknownPieces > 0 && (
        <p className="mt-3 rounded-xl bg-warn p-2 font-semibold text-warn-ink">
          {bill.unknownPieces} gezählte Stück gehören zu einem Ventiltyp, den es im Tool nicht mehr gibt. Sie fehlen in
          der Stückliste.
        </p>
      )}
    </>
  )
}

function RoomBreakdown({ tool, survey }: { tool: ValveSurveyTool; survey: Survey }) {
  if (!showRoomBreakdown(tool, survey)) return null
  return (
    <>
      <h2 className="mt-6 text-xl font-bold">Aufteilung nach Räumen</h2>
      <ul className={`mt-3 divide-y divide-edge ${card}`}>
        {roomLines(tool, survey).map(({ room, lines }) => (
          <li key={room.id} className="break-inside-avoid px-3 py-2">
            <span className="font-semibold [overflow-wrap:anywhere]">{roomLabel(room)}</span>
            <span className="block text-base">
              {lines.map((line) => `${line.count} × ${line.type.label}`).join(', ')}
            </span>
          </li>
        ))}
      </ul>
    </>
  )
}

export function ValveSurvey({
  tool,
  initialSurveys,
  now: fixedNow,
}: {
  tool: ValveSurveyTool
  /** Statt des Gerätespeichers (Tests) */
  initialSurveys?: Survey[]
  now?: Date
}) {
  const clock = () => fixedNow ?? new Date()
  const { surveys, saveFailed, update, add, remove } = useValveSurveys(tool.id, clock, initialSurveys)
  const [chosenId, setChosenId] = useState<string>()
  const [chosenRoomId, setChosenRoomId] = useState<string>()
  const [newRoom, setNewRoom] = useState<string>()
  const [renaming, setRenaming] = useState(false)
  const [shareFailed, setShareFailed] = useState(false)
  const recipientsText = recipientsState.useValue()
  const id = useId()

  if (surveys === undefined) return <p className="mt-6 text-muted">Wird geladen …</p>

  const survey = surveys.find((candidate) => candidate.id === chosenId) ?? surveys[0]!
  const room = survey.rooms.find((candidate) => candidate.id === chosenRoomId) ?? survey.rooms[0]!
  const recipients = parseRecipients(recipientsText)
  const empty = billIsEmpty(surveyBill(tool, survey))
  const canShareFiles =
    typeof navigator !== 'undefined' &&
    typeof navigator.canShare === 'function' &&
    navigator.canShare({ files: [new File([''], 'test.csv', { type: 'text/csv' })] })

  const startNew = () => {
    // Ein noch leeres Aufmaß wird weiterverwendet statt ein zweites anzulegen
    const blank = surveys.find(isEmptySurvey)
    const next = blank ?? createSurvey(tool.id, clock())
    if (!blank) add(next)
    setChosenId(next.id)
    setChosenRoomId(undefined)
    setRenaming(false)
  }

  const submitRoom = (event: FormEvent) => {
    event.preventDefault()
    if (newRoom === undefined) return
    // Der erste Raum ohne Namen und ohne Zählung bekommt einfach den Namen, statt leer stehen zu bleiben
    if (survey.rooms.length === 1 && room.name.trim() === '' && roomPieces(room) === 0) {
      update(renameRoom(survey, room.id, newRoom.trim(), clock()))
    } else {
      const added = addRoom(survey, newRoom, clock())
      update(added.survey)
      setChosenRoomId(added.room.id)
    }
    setNewRoom(undefined)
  }

  const share = async () => {
    setShareFailed(false)
    const file = new File([surveyCsv(tool, survey)], surveyFileName(tool, survey), { type: 'text/csv' })
    try {
      await navigator.share({ files: [file], title: `${tool.title}: ${projectLabel(survey)}`, text: surveyText(tool, survey) })
    } catch (error) {
      // Abbrechen durch den Nutzer ist kein Fehler
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareFailed(true)
    }
  }

  return (
    <section className="mt-6">
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
              onChange={(event) => {
                setChosenId(event.target.value)
                setChosenRoomId(undefined)
                setRenaming(false)
              }}
              className={`${fieldBase} mt-1 w-full`}
            >
              {surveys.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {isEmptySurvey(candidate) ? 'Neues Aufmaß' : surveyLabel(candidate)}
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
          onChange={(event) => update(setProject(survey, event.target.value, clock()))}
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
          onChange={(event) => update(setNote(survey, event.target.value, clock()))}
          autoComplete="off"
          className={`${fieldBase} mt-1 block w-full py-2`}
        />
        <p className="mt-1 text-base text-muted">Angelegt am {formatSurveyDate(survey.createdAt)}.</p>

        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className={`${secondaryButton} flex-1`} onClick={startNew}>
            Neues Aufmaß
          </button>
          {!isEmptySurvey(survey) && (
            <ConfirmDelete
              key={survey.id}
              label="Aufmaß löschen"
              question={`Aufmaß „${projectLabel(survey)}“ mit allen Räumen löschen?`}
              onConfirm={() => {
                remove(survey.id)
                setChosenId(undefined)
                setChosenRoomId(undefined)
              }}
            />
          )}
        </div>
      </div>

      {saveFailed && <p className="mt-3 rounded-xl bg-warn p-2 font-semibold text-warn-ink">{SAVE_FAILED}</p>}

      <div className={`mt-4 p-4 print:hidden ${card}`}>
        <h2 className="text-xl font-bold">Ventile zählen</h2>
        <p className="mt-1 text-base text-muted">Raum wählen oder anlegen, dann je vorgefundenem Ventil auf + tippen.</p>
        <div role="group" aria-label="Räume" className="mt-3 flex flex-wrap gap-2">
          {survey.rooms.map((candidate) => {
            const selected = candidate.id === room.id
            return (
              <button
                key={candidate.id}
                type="button"
                aria-pressed={selected}
                onClick={() => {
                  setChosenRoomId(candidate.id)
                  setRenaming(false)
                }}
                className={`${secondaryButton} max-w-full ${selected ? '!border-accent !bg-accent !text-accent-ink' : ''}`}
              >
                <span className="min-w-0 truncate">{roomLabel(candidate)}</span>
                <span className={`${chip} !px-2 !py-0 tabular-nums`}>{roomPieces(candidate)}</span>
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
          <form onSubmit={submitRoom} noValidate className="mt-3">
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
                onChange={(event) => update(renameRoom(survey, room.id, event.target.value, clock()))}
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
              {(survey.rooms.length > 1 || roomPieces(room) > 0 || room.name.trim() !== '') && (
                <ConfirmDelete
                  key={room.id}
                  label="Raum löschen"
                  question={`Raum „${roomLabel(room)}“ mit ${roomPieces(room)} gezählten Stück löschen?`}
                  onConfirm={() => {
                    update(removeRoom(survey, room.id, clock()))
                    setChosenRoomId(undefined)
                  }}
                />
              )}
            </>
          )}
        </div>

        {tool.groups.map((group) => (
          <fieldset key={group.key} className="mt-4">
            <legend className="font-bold text-muted">{group.name}</legend>
            <ul className="mt-1 divide-y divide-edge">
              {group.types.map((type) => (
                <li key={type.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-2">
                  <label htmlFor={`${id}-${type.key}`} className="min-w-0 flex-1">
                    <span className="block font-semibold">{type.label}</span>
                    {(type.article || type.note) && (
                      <span className="block text-base text-muted">
                        {[type.article && `Art.-Nr. ${type.article}`, type.note].filter(Boolean).join(' · ')}
                      </span>
                    )}
                  </label>
                  <Counter
                    id={`${id}-${type.key}`}
                    label={type.label}
                    value={countOf(room, type.key)}
                    onChange={(value) => update(setCount(survey, room.id, type.key, value, clock()))}
                  />
                </li>
              ))}
            </ul>
          </fieldset>
        ))}
        <p className="mt-2 text-base text-muted" aria-live="polite">
          {roomLabel(room)}: {roomPieces(room)} Stück gezählt.
        </p>
      </div>

      {/* Kopf nur auf dem Ausdruck; am Bildschirm steht das im Formular */}
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

      <h2 className="mt-6 text-xl font-bold">Stückliste</h2>
      <BillTable tool={tool} survey={survey} />
      <RoomBreakdown tool={tool} survey={survey} />

      <div className={`mt-6 p-4 print:hidden ${card}`}>
        <h2 className="text-xl font-bold">Weitergeben</h2>
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            className={primaryButton}
            disabled={empty}
            onClick={() => downloadTextFile(surveyFileName(tool, survey), surveyCsv(tool, survey), 'text/csv;charset=utf-8')}
          >
            Für Excel exportieren (CSV)
          </button>
          <button type="button" className={secondaryButton} disabled={empty} onClick={() => window.print()}>
            Drucken oder PDF
          </button>
        </div>

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
        {recipients === undefined && (
          <p className="mt-2 rounded-xl bg-warn p-2 font-semibold text-warn-ink">{RECIPIENTS_INVALID}</p>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          {empty || recipients === undefined ? (
            <button type="button" className={primaryButton} disabled>
              <MailIcon className="size-6" />
              Per E-Mail senden
            </button>
          ) : (
            <a href={surveyMailto(tool, survey, recipients)} className={primaryButton}>
              <MailIcon className="size-6" />
              Per E-Mail senden
            </a>
          )}
          {canShareFiles && (
            <button type="button" className={secondaryButton} disabled={empty} onClick={() => void share()}>
              <ShareIcon className="size-6" />
              Als Datei teilen
            </button>
          )}
        </div>
        <p className="mt-2 text-base text-muted">
          Die E-Mail enthält die Stückliste als Text und öffnet sich im Mailprogramm.
          {canShareFiles && ' „Als Datei teilen“ hängt die CSV-Datei an, z. B. in der Mail-App.'}
        </p>
        {shareFailed && <p className="mt-2 rounded-xl bg-warn p-2 font-semibold text-warn-ink">Teilen hat nicht geklappt.</p>}
      </div>

      <p className="mt-8 text-base print:hidden">{tool.closingNote}</p>
    </section>
  )
}
