import { useId, useState, type FormEvent } from 'react'
import { primaryButton, secondaryButton } from '../../components/buttons'
import { PencilIcon } from '../../components/icons'
import { card, fieldBase } from '../../components/surfaces'
import type { RadiatorEntry, RadiatorSurvey as Survey } from '../../storage/db'
import { deleteRadiatorSurvey, listRadiatorSurveys, saveRadiatorSurvey } from '../../storage/radiatorSurveys'
import {
  addRadiator,
  addRoom,
  createSurvey,
  draftFromRadiator,
  cleanValue,
  draftIssues,
  EMPTY_DRAFT,
  ensureRoom,
  isEmptySurvey,
  MAX_RADIATORS,
  radiatorLine,
  radiatorName,
  radiatorSummary,
  removeRadiator,
  removeRoom,
  replaceRadiator,
  roomRadiators,
  roomsWithRadiators,
  surveyCsv,
  surveyMailto,
  surveyText,
  type RadiatorDraft,
} from './radiatorSurveyCalc'
import { dimensionFields, type DimensionField, type RadiatorSurveyTool } from './radiatorSurveyTool'
import { projectLabel, renameRoom, roomLabel, surveyFileName } from './surveyCommon'
import {
  ConfirmDelete,
  Counter,
  iconButton,
  PrintHeader,
  RoomBar,
  SAVE_FAILED,
  SharePanel,
  SurveyHeaderCard,
  useSurveys,
  WarnText,
} from './SurveyParts'

const store = { list: listRadiatorSurveys, save: saveRadiatorSurvey, remove: deleteRadiatorSurvey }

/** Bis zu so vielen Auswahlwerten stehen sie als Knöpfe nebeneinander, darüber als Auswahlliste */
const BUTTON_LIMIT = 8
const OTHER = '__other'

const selectedButton = '!border-accent !bg-accent !text-accent-ink'

/**
 * Ein Maß: ohne Auswahlwerte ein Eingabefeld, mit wenigen Werten Knöpfe, mit vielen eine Auswahlliste.
 * „Anderes Maß“ blendet zusätzlich ein Eingabefeld ein, wenn der Inhalt das erlaubt.
 */
function DimensionInput({ field, value, onChange }: { field: DimensionField; value: string; onChange: (value: string) => void }) {
  const id = useId()
  const cleaned = cleanValue(field, value)
  const inOptions = cleaned !== undefined && field.options.includes(cleaned)
  const [other, setOther] = useState(value.trim() !== '' && !inOptions)
  const label = (
    <>
      {field.label}
      {field.unit && <span className="font-normal"> in {field.unit}</span>}
      {!field.required && <span className="font-normal text-muted"> (optional)</span>}
    </>
  )
  const textInput = (
    <input
      id={`${id}-input`}
      type="text"
      inputMode={field.numeric ? 'numeric' : 'text'}
      aria-label={field.options.length > 0 ? `${field.label}: anderes Maß` : undefined}
      value={value}
      placeholder={field.unit || (field.numeric ? 'Zahl' : '')}
      onChange={(event) => onChange(event.target.value)}
      autoComplete="off"
      className={`${fieldBase} mt-1 w-full`}
    />
  )

  if (field.options.length === 0) {
    return (
      <div className="mt-3">
        <label htmlFor={`${id}-input`} className="block font-semibold">
          {label}
        </label>
        {textInput}
      </div>
    )
  }

  if (field.options.length <= BUTTON_LIMIT) {
    return (
      <div className="mt-3">
        <p id={`${id}-label`} className="font-semibold">
          {label}
        </p>
        <div role="group" aria-labelledby={`${id}-label`} className="mt-1 flex flex-wrap gap-2">
          {field.options.map((option) => {
            const selected = !other && cleaned === option
            return (
              <button
                key={option}
                type="button"
                aria-pressed={selected}
                className={`${secondaryButton} min-w-16 tabular-nums ${selected ? selectedButton : ''}`}
                onClick={() => {
                  setOther(false)
                  // Nochmal tippen nimmt die Wahl zurück
                  onChange(selected ? '' : option)
                }}
              >
                {option}
              </button>
            )
          })}
          {field.allowOther && (
            <button
              type="button"
              aria-pressed={other}
              className={`${secondaryButton} ${other ? selectedButton : ''}`}
              onClick={() => {
                setOther(true)
                onChange('')
              }}
            >
              Anderes Maß
            </button>
          )}
        </div>
        {field.allowOther && other && textInput}
      </div>
    )
  }

  return (
    <div className="mt-3">
      <label htmlFor={`${id}-select`} className="block font-semibold">
        {label}
      </label>
      <select
        id={`${id}-select`}
        value={other ? OTHER : inOptions ? cleaned : ''}
        onChange={(event) => {
          const next = event.target.value
          setOther(next === OTHER)
          onChange(next === OTHER ? '' : next)
        }}
        className={`${fieldBase} mt-1 w-full`}
      >
        <option value="">– wählen –</option>
        {field.options.map((option) => (
          <option key={option} value={option}>
            {option}
            {field.unit && ` ${field.unit}`}
          </option>
        ))}
        {field.allowOther && <option value={OTHER}>Anderes Maß …</option>}
      </select>
      {field.allowOther && other && textInput}
    </div>
  )
}

/** Eingabe eines Heizkörpers: Das Modell bestimmt die Maße; Thermostat, Anzahl und Notiz wahlweise */
function RadiatorForm({
  tool,
  initial,
  editing,
  onSubmit,
  onCancel,
}: {
  tool: RadiatorSurveyTool
  initial: RadiatorDraft
  editing: boolean
  onSubmit: (draft: RadiatorDraft) => void
  onCancel?: () => void
}) {
  const [draft, setDraft] = useState(initial)
  const [issues, setIssues] = useState<string[]>([])
  /** Zählt hoch, damit die Maß-Felder nach dem Hinzufügen frisch beginnen */
  const [round, setRound] = useState(0)
  const id = useId()
  const fields = dimensionFields(tool, draft.model || undefined)
  const change = (next: Partial<RadiatorDraft>) => {
    setDraft((current) => ({ ...current, ...next }))
    setIssues([])
  }

  const submit = (event: FormEvent) => {
    event.preventDefault()
    const problems = draftIssues(tool, draft)
    if (problems.length > 0) return setIssues(problems)
    onSubmit(draft)
    if (editing) return
    // Nächster Heizkörper: Modell, Thermostat und Text-Maße (z. B. Bauart) bleiben stehen, oft sind mehrere gleich
    const kept = tool.dimensions.filter((dimension) => !dimension.numeric).map((dimension) => dimension.key)
    setDraft({
      ...EMPTY_DRAFT,
      model: draft.model,
      thermostat: draft.thermostat,
      values: Object.fromEntries(Object.entries(draft.values).filter(([key]) => kept.includes(key))),
    })
    setRound((current) => current + 1)
  }

  return (
    <form onSubmit={submit} noValidate className="mt-4 border-t border-edge pt-3">
      <h4 className="text-lg font-bold">{editing ? 'Heizkörper ändern' : 'Heizkörper hinzufügen'}</h4>

      <label htmlFor={`${id}-model`} className="mt-3 block font-semibold">
        Modell <span className="font-normal text-muted">(bestimmt die Maße)</span>
      </label>
      <select
        id={`${id}-model`}
        value={draft.model}
        onChange={(event) => change({ model: event.target.value })}
        className={`${fieldBase} mt-1 w-full`}
      >
        <option value="">– ohne Angabe –</option>
        {tool.models.map((model) => (
          <option key={model.key} value={model.key}>
            {model.label}
          </option>
        ))}
      </select>

      {fields.map((field) => (
        <DimensionInput
          key={`${draft.model}-${field.key}-${round}`}
          field={field}
          value={draft.values[field.key] ?? ''}
          onChange={(value) => change({ values: { ...draft.values, [field.key]: value } })}
        />
      ))}

      <label htmlFor={`${id}-thermostat`} className="mt-3 block font-semibold">
        Thermostat <span className="font-normal text-muted">(optional)</span>
      </label>
      <select
        id={`${id}-thermostat`}
        value={draft.thermostat}
        onChange={(event) => change({ thermostat: event.target.value })}
        className={`${fieldBase} mt-1 w-full`}
      >
        <option value="">– ohne Angabe –</option>
        {tool.thermostats.map((thermostat) => (
          <option key={thermostat.key} value={thermostat.key}>
            {thermostat.label}
          </option>
        ))}
      </select>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <label htmlFor={`${id}-count`} className="font-semibold">
          Anzahl gleicher Heizkörper
        </label>
        <Counter id={`${id}-count`} label="Heizkörper" value={draft.count} min={1} max={MAX_RADIATORS} onChange={(count) => change({ count })} />
      </div>

      <label htmlFor={`${id}-note`} className="mt-3 block font-semibold">
        Notiz <span className="font-normal text-muted">(optional)</span>
      </label>
      <input
        id={`${id}-note`}
        type="text"
        value={draft.note}
        placeholder="z. B. unter Fenster, Anschluss rechts"
        onChange={(event) => change({ note: event.target.value })}
        autoComplete="off"
        className={`${fieldBase} mt-1 w-full`}
      />

      <div aria-live="polite">{issues.length > 0 && <WarnText text={issues.join(' ')} />}</div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className={`${primaryButton} flex-1`}>
          {editing ? 'Speichern' : 'Hinzufügen'}
        </button>
        {onCancel && (
          <button type="button" className={secondaryButton} onClick={onCancel}>
            Abbrechen
          </button>
        )}
      </div>
    </form>
  )
}

/** Zusammenfassung: gleiche Heizkörper über alle Räume, Thermostate und Gesamtzahl */
export function SummaryTables({ tool, survey }: { tool: RadiatorSurveyTool; survey: Survey }) {
  const summary = radiatorSummary(tool, survey)
  if (summary.total === 0) return <p className="mt-3 text-muted">Noch keine Heizkörper eingetragen.</p>
  return (
    <>
      <h3 className="mt-4 text-lg font-bold">Heizkörper je Raum</h3>
      <ul className={`mt-2 divide-y divide-edge ${card}`}>
        {roomsWithRadiators(survey).map((room) => (
          <li key={room.id} className="break-inside-avoid px-3 py-2">
            <span className="font-semibold [overflow-wrap:anywhere]">{roomLabel(room)}</span>
            {room.radiators.map((radiator) => (
              <span key={radiator.id} className="block text-base [overflow-wrap:anywhere]">
                {radiatorLine(tool, radiator)}
              </span>
            ))}
          </li>
        ))}
      </ul>

      <h3 className="mt-4 text-lg font-bold">Gleiche Heizkörper zusammengefasst</h3>
      <ul className={`mt-2 divide-y divide-edge ${card}`}>
        {summary.sizes.map((size) => (
          <li key={JSON.stringify(size)} className="flex break-inside-avoid items-baseline gap-3 px-3 py-2">
            <span className="w-12 shrink-0 text-right font-bold tabular-nums">{size.count} ×</span>
            <span className="min-w-0 [overflow-wrap:anywhere]">{radiatorName(tool, size)}</span>
          </li>
        ))}
      </ul>

      {summary.thermostats.length > 0 && (
        <>
          <h3 className="mt-4 text-lg font-bold">Thermostate</h3>
          <ul className={`mt-2 divide-y divide-edge ${card}`}>
            {summary.thermostats.map((thermostat) => (
              <li key={thermostat.key} className="flex items-baseline gap-3 px-3 py-2">
                <span className="w-12 shrink-0 text-right font-bold tabular-nums">{thermostat.count} ×</span>
                <span className="min-w-0">{thermostat.label}</span>
              </li>
            ))}
            {summary.withoutThermostat > 0 && (
              <li className="flex items-baseline gap-3 px-3 py-2 text-muted">
                <span className="w-12 shrink-0 text-right font-bold tabular-nums">{summary.withoutThermostat} ×</span>
                <span>ohne Angabe</span>
              </li>
            )}
          </ul>
        </>
      )}

      <dl className={`mt-3 ${card}`}>
        <div className="flex items-baseline justify-between gap-3 px-3 py-2">
          <dt className="font-semibold">Heizkörper gesamt</dt>
          <dd className="text-xl font-bold tabular-nums">{summary.total}</dd>
        </div>
      </dl>
    </>
  )
}

export function RadiatorSurvey({
  tool,
  initialSurveys,
  now: fixedNow,
  initialDraft = EMPTY_DRAFT,
}: {
  tool: RadiatorSurveyTool
  /** Statt des Gerätespeichers (Tests) */
  initialSurveys?: Survey[]
  now?: Date
  /** Vorbelegtes Formular für neue Heizkörper (Tests) */
  initialDraft?: RadiatorDraft
}) {
  const clock = () => fixedNow ?? new Date()
  const { surveys, saveFailed, update, add, remove } = useSurveys({
    toolId: tool.id,
    store,
    create: createSurvey,
    isEmpty: isEmptySurvey,
    ensureRoom,
    now: clock,
    initialSurveys,
  })
  const [chosenId, setChosenId] = useState<string>()
  const [chosenRoomId, setChosenRoomId] = useState<string>()
  const [editingId, setEditingId] = useState<string>()
  const [message, setMessage] = useState<string>()

  if (surveys === undefined) return <p className="mt-6 text-muted">Wird geladen …</p>

  const survey = surveys.find((candidate) => candidate.id === chosenId) ?? surveys[0]!
  const room = survey.rooms.find((candidate) => candidate.id === chosenRoomId) ?? survey.rooms[0]!
  const editing = room.radiators.find((radiator) => radiator.id === editingId)

  const chooseRoom = (roomId: string | undefined) => {
    setChosenRoomId(roomId)
    setEditingId(undefined)
    setMessage(undefined)
  }

  const startNew = () => {
    // Ein noch leeres Aufmaß wird weiterverwendet statt ein zweites anzulegen
    const blank = surveys.find(isEmptySurvey)
    const next = blank ?? createSurvey(tool.id, clock())
    if (!blank) add(next)
    setChosenId(next.id)
    chooseRoom(undefined)
  }

  const saveRadiator = (draft: RadiatorDraft) => {
    if (editing) {
      update(replaceRadiator(tool, survey, room.id, editing.id, draft, clock()))
      setEditingId(undefined)
      setMessage('Heizkörper geändert.')
    } else {
      const next = addRadiator(tool, survey, room.id, draft, clock())
      update(next)
      const added = next.rooms.find((candidate) => candidate.id === room.id)!.radiators.at(-1)!
      setMessage(`Hinzugefügt in ${roomLabel(room)}: ${radiatorLine(tool, added)}`)
    }
  }

  const radiatorRow = (radiator: RadiatorEntry) => (
    <li key={radiator.id} className="flex flex-wrap items-center gap-2 py-2">
      <span className={`min-w-0 flex-1 [overflow-wrap:anywhere] ${radiator.id === editingId ? 'font-bold text-accent' : ''}`}>
        {radiatorLine(tool, radiator)}
      </span>
      <button
        type="button"
        className={iconButton}
        aria-label="Heizkörper ändern"
        title="Heizkörper ändern"
        onClick={() => {
          setEditingId(radiator.id)
          setMessage(undefined)
        }}
      >
        <PencilIcon className="size-6" />
      </button>
      <ConfirmDelete
        label="Heizkörper löschen"
        question={`${radiatorName(tool, radiator)} löschen?`}
        onConfirm={() => {
          update(removeRadiator(survey, room.id, radiator.id, clock()))
          if (editingId === radiator.id) setEditingId(undefined)
          setMessage(undefined)
        }}
      />
    </li>
  )

  return (
    <section className="mt-6">
      <SurveyHeaderCard
        surveys={surveys}
        survey={survey}
        isEmpty={isEmptySurvey}
        now={clock}
        onSelect={(next) => {
          setChosenId(next)
          chooseRoom(undefined)
        }}
        onUpdate={update}
        onNew={startNew}
        onDelete={() => {
          remove(survey.id)
          setChosenId(undefined)
          chooseRoom(undefined)
        }}
      />

      {saveFailed && <WarnText text={SAVE_FAILED} />}

      <div className={`mt-4 p-4 print:hidden ${card}`}>
        <h2 className="text-xl font-bold">Heizkörper erfassen</h2>
        <p className="mt-1 text-base text-muted">Raum wählen oder anlegen, dann die Heizkörper darin eintragen.</p>
        {tool.todo && <p className="mt-1 text-base text-muted">{tool.todo}</p>}
        <RoomBar
          key={survey.id}
          rooms={survey.rooms}
          room={room}
          pieces={roomRadiators}
          piecesName="Heizkörpern"
          onSelect={chooseRoom}
          onAdd={(name) => {
            const added = addRoom(survey, name, clock())
            update(added.survey)
            chooseRoom(added.room.id)
          }}
          onRename={(name) => update(renameRoom(survey, room.id, name, clock()))}
          onRemove={() => {
            update(removeRoom(survey, room.id, clock()))
            chooseRoom(undefined)
          }}
        />

        {room.radiators.length === 0 ? (
          <p className="mt-3 text-muted">In diesem Raum ist noch kein Heizkörper eingetragen.</p>
        ) : (
          <ul aria-label={`Heizkörper in ${roomLabel(room)}`} className="mt-2 divide-y divide-edge">
            {room.radiators.map(radiatorRow)}
          </ul>
        )}

        <RadiatorForm
          key={`${survey.id}-${room.id}-${editing?.id ?? 'new'}`}
          tool={tool}
          initial={editing ? draftFromRadiator(editing) : initialDraft}
          editing={editing !== undefined}
          onSubmit={saveRadiator}
          onCancel={editing ? () => setEditingId(undefined) : undefined}
        />
        <p className="mt-2 font-semibold [overflow-wrap:anywhere]" aria-live="polite">
          {message}
        </p>
      </div>

      <PrintHeader survey={survey} />

      <h2 className="mt-6 text-xl font-bold">Übersicht</h2>
      <SummaryTables tool={tool} survey={survey} />

      <SharePanel
        disabled={radiatorSummary(tool, survey).total === 0}
        title={`${tool.title}: ${projectLabel(survey)}`}
        fileName={surveyFileName(tool.id, survey)}
        csv={() => surveyCsv(tool, survey)}
        text={() => surveyText(tool, survey)}
        mailto={(recipients) => surveyMailto(tool, survey, recipients)}
        mailContent="die Heizkörper je Raum"
      />

      <p className="mt-8 text-base print:hidden">{tool.closingNote}</p>
    </section>
  )
}
