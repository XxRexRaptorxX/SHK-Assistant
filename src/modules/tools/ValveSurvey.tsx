import { useId, useState } from 'react'
import { card } from '../../components/surfaces'
import type { ValveSurvey as Survey } from '../../storage/db'
import { deleteValveSurvey, listValveSurveys, saveValveSurvey } from '../../storage/valveSurveys'
import { projectLabel, renameRoom, roomLabel, surveyFileName } from './surveyCommon'
import { Counter, PrintHeader, RoomBar, SAVE_FAILED, SharePanel, SurveyHeaderCard, useSurveys, WarnText } from './SurveyParts'
import {
  addRoom,
  billIsEmpty,
  countOf,
  createSurvey,
  ensureRoom,
  isEmptySurvey,
  MAX_COUNT,
  removeRoom,
  roomLines,
  roomPieces,
  setCount,
  showRoomBreakdown,
  surveyBill,
  surveyCsv,
  surveyMailto,
  surveyText,
} from './valveSurveyCalc'
import type { ValveSurveyTool } from './valveSurveyTool'

const store = { list: listValveSurveys, save: saveValveSurvey, remove: deleteValveSurvey }

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
  const id = useId()

  if (surveys === undefined) return <p className="mt-6 text-muted">Wird geladen …</p>

  const survey = surveys.find((candidate) => candidate.id === chosenId) ?? surveys[0]!
  const room = survey.rooms.find((candidate) => candidate.id === chosenRoomId) ?? survey.rooms[0]!

  const startNew = () => {
    // Ein noch leeres Aufmaß wird weiterverwendet statt ein zweites anzulegen
    const blank = surveys.find(isEmptySurvey)
    const next = blank ?? createSurvey(tool.id, clock())
    if (!blank) add(next)
    setChosenId(next.id)
    setChosenRoomId(undefined)
  }

  return (
    <section className="mt-6">
      <SurveyHeaderCard
        surveys={surveys}
        survey={survey}
        isEmpty={isEmptySurvey}
        now={clock}
        onSelect={(next) => {
          setChosenId(next)
          setChosenRoomId(undefined)
        }}
        onUpdate={update}
        onNew={startNew}
        onDelete={() => {
          remove(survey.id)
          setChosenId(undefined)
          setChosenRoomId(undefined)
        }}
      />

      {saveFailed && <WarnText text={SAVE_FAILED} />}

      <div className={`mt-4 p-4 print:hidden ${card}`}>
        <h2 className="text-xl font-bold">Ventile zählen</h2>
        <p className="mt-1 text-base text-muted">Raum wählen oder anlegen, dann je vorgefundenem Ventil auf + tippen.</p>
        <RoomBar
          key={survey.id}
          rooms={survey.rooms}
          room={room}
          pieces={roomPieces}
          piecesName="gezählten Stück"
          onSelect={setChosenRoomId}
          onAdd={(name) => {
            const added = addRoom(survey, name, clock())
            update(added.survey)
            setChosenRoomId(added.room.id)
          }}
          onRename={(name) => update(renameRoom(survey, room.id, name, clock()))}
          onRemove={() => {
            update(removeRoom(survey, room.id, clock()))
            setChosenRoomId(undefined)
          }}
        />

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
                    max={MAX_COUNT}
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

      <PrintHeader survey={survey} />

      <h2 className="mt-6 text-xl font-bold">Stückliste</h2>
      <BillTable tool={tool} survey={survey} />
      <RoomBreakdown tool={tool} survey={survey} />

      <SharePanel
        disabled={billIsEmpty(surveyBill(tool, survey))}
        title={`${tool.title}: ${projectLabel(survey)}`}
        fileName={surveyFileName(tool.id, survey)}
        csv={() => surveyCsv(tool, survey)}
        text={() => surveyText(tool, survey)}
        mailto={(recipients) => surveyMailto(tool, survey, recipients)}
        mailContent="die Stückliste"
      />

      <p className="mt-8 text-base print:hidden">{tool.closingNote}</p>
    </section>
  )
}
