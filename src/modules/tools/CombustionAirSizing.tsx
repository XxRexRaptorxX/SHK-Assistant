import { useId, useRef, useState } from 'react'
import { secondaryButton } from '../../components/buttons'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { math } from '../../lib/math'
import { formatNumber, parseDecimal } from '../../lib/number'
import { UnitSelect } from '../formulas/Calculator'
import { alternativeUnits } from '../units/alternatives'
import { formatAnyUnit } from '../units/labels'
import { SelectionBar } from './ChoiceLookup'
import {
  checkCompound,
  checkOpenings,
  combustionAirRefText,
  compoundRequirement,
  openingArea,
  openingRequirement,
  volumeFlowRequirement,
  type CombustionAirRef,
  type CombustionAirRegulation,
  type CombustionAirTool,
  type CompoundRoom,
  type OpeningRequirement,
  type OpeningShape,
  type RoomStatus,
} from './combustionAirTool'
import { Help } from './HeatingCurveSimulator'

const resultCard = 'rounded-2xl border-2 border-accent bg-surface p-4'
const rowCard = 'rounded-2xl border-2 border-line bg-surface p-3'
const warning = 'mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink'
const removeButton = 'inline-flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-line text-xl font-bold'

const cm2 = (value: number) => `${formatNumber(value, value < 10 ? 1 : 0)} cm²`
const m3 = (value: number) => `${formatNumber(value, 1)} m³`

// Rechen-Einheiten: Eingaben in anderen Einheiten werden darauf umgerechnet
const OPENING_LENGTH = 'cm'
const OPENING_AREA = 'cm^2'
const ROOM_LENGTH = 'm'
const ROOM_VOLUME = 'm^3'

/** Zahl aus einem Feld: leer = undefined, error = keine gültige Zahl > 0 */
function readPositive(input: string): { value: number | undefined; error: boolean } {
  if (input.trim() === '') return { value: undefined, error: false }
  const value = parseDecimal(input)
  return value === undefined || value <= 0 ? { value: undefined, error: true } : { value, error: false }
}

/** Wie readPositive, aber umgerechnet von der gewählten Einheit in die Rechen-Einheit */
function readIn(input: string, unit: string, target: string): number | undefined {
  const { value } = readPositive(input)
  return value === undefined ? undefined : unit === target ? value : math.unit(value, unit).toNumber(target)
}

function Source({ tool, refValue }: { tool: CombustionAirTool; refValue: CombustionAirRef | undefined }) {
  if (!refValue) return null
  return <p className="mt-1 text-sm text-muted">Quelle: {combustionAirRefText(tool, refValue)}</p>
}

/** Zahlenfeld mit Einheiten-Auswahl wie im Formelrechner; units[0] bzw. mainUnit ist die Rechen-Einheit */
function NumberField({
  id,
  label,
  mainUnit,
  unit,
  onUnitChange,
  value,
  onChange,
  placeholder,
  width = 'w-24',
}: {
  id: string
  label: string
  /** Rechen-Einheit; daraus die wählbaren Einheiten */
  mainUnit: string
  /** Gewählte Einheit */
  unit: string
  onUnitChange: (unit: string) => void
  value: string
  onChange: (value: string) => void
  placeholder?: string
  width?: string
}) {
  const { error } = readPositive(value)
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}
        <span className="sr-only"> in {formatAnyUnit(unit)}</span>
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={placeholder}
          value={value}
          aria-invalid={error}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldBase} ${width} ${error ? 'border-warn-ink outline-2 outline-warn' : ''}`}
        />
        <UnitSelect
          id={`${id}-unit`}
          label={`Einheit für ${label}`}
          units={alternativeUnits(mainUnit)}
          value={unit}
          onChange={onUnitChange}
        />
      </div>
    </div>
  )
}

interface OpeningRow {
  key: string
  shape: OpeningShape
  a: string
  b: string
  /** Einheit für Breite, Höhe und Durchmesser */
  lengthUnit: string
  /** Einheit, wenn der Querschnitt direkt eingetragen wird */
  areaUnit: string
}

interface RoomRow {
  key: string
  name: string
  mode: 'dims' | 'volume'
  length: string
  width: string
  height: string
  volume: string
  lengthUnit: string
  volumeUnit: string
  toOutside: boolean
  connected: boolean
}

type Method = 'openings' | 'compound'

interface State {
  regulation: string
  power: string
  powerUnit: string
  method: Method
  openings: OpeningRow[]
  rooms: RoomRow[]
}

const SHAPES: { key: OpeningShape; label: string }[] = [
  { key: 'rect', label: 'Rechteckig (B × H)' },
  { key: 'round', label: 'Rund (Ø)' },
  { key: 'area', label: 'Querschnitt bekannt' },
]

const newOpening = (key: string): OpeningRow => ({
  key,
  shape: 'rect',
  a: '',
  b: '',
  lengthUnit: OPENING_LENGTH,
  areaUnit: OPENING_AREA,
})
const newRoom = (key: string, name = ''): RoomRow => ({
  key,
  name,
  mode: 'dims',
  length: '',
  width: '',
  height: '',
  volume: '',
  lengthUnit: ROOM_LENGTH,
  volumeUnit: ROOM_VOLUME,
  toOutside: true,
  connected: true,
})

export function initialCombustionAirState(tool: CombustionAirTool): State {
  return {
    regulation: tool.regulations[0]!.key,
    power: '',
    powerUnit: tool.power.unit,
    method: 'openings',
    openings: [newOpening('opening0')],
    rooms: [newRoom('room0', 'Aufstellraum')],
  }
}

/** Lichter Querschnitt einer Öffnung in cm²; undefined = unvollständig oder ungültig */
function rowArea(row: OpeningRow): number | undefined {
  if (row.shape === 'area') return readIn(row.a, row.areaUnit, OPENING_AREA)
  const a = readIn(row.a, row.lengthUnit, OPENING_LENGTH)
  if (a === undefined) return undefined
  if (row.shape === 'round') return openingArea('round', a)
  const b = readIn(row.b, row.lengthUnit, OPENING_LENGTH)
  return b === undefined ? undefined : openingArea('rect', a, b)
}

function roomVolume(row: RoomRow): number | undefined {
  if (row.mode === 'volume') return readIn(row.volume, row.volumeUnit, ROOM_VOLUME)
  const [l, w, h] = [row.length, row.width, row.height].map((value) => readIn(value, row.lengthUnit, ROOM_LENGTH))
  return l === undefined || w === undefined || h === undefined ? undefined : l * w * h
}

/** Verbrennungsluft-Tool: Nennleistung eingeben, Anforderungen sehen, Öffnungen oder Verbund prüfen */
export function CombustionAirSizing({ tool, initial }: { tool: CombustionAirTool; initial?: Partial<State> }) {
  const idPrefix = useId()
  const [state, setState] = useState<State>(() => ({ ...initialCombustionAirState(tool), ...initial }))
  const nextKey = useRef(1)
  const update = (patch: Partial<State>) => setState((current) => ({ ...current, ...patch }))

  const regulation = tool.regulations.find((candidate) => candidate.key === state.regulation) ?? tool.regulations[0]!
  const power = readPositive(state.power)
  const powerInMain = readIn(state.power, state.powerUnit, tool.power.unit)
  const powerValue = powerInMain !== undefined && powerInMain <= tool.power.max ? powerInMain : undefined
  const method: Method = state.method === 'compound' && regulation.compound ? 'compound' : 'openings'

  const pristine = JSON.stringify(state) === JSON.stringify({ ...initialCombustionAirState(tool), regulation: state.regulation })

  return (
    <>
      <SelectionBar
        bar={{
          key: 'regulation',
          name: 'Regelwerk',
          options: tool.regulations.map((candidate) => ({ key: candidate.key, label: candidate.label, note: candidate.note })),
        }}
        selected={regulation.key}
        onSelect={(key) => update({ regulation: key })}
      />

      <section className="mt-6" aria-labelledby={`${idPrefix}-power`}>
        <HeadingWithClear
          id={`${idPrefix}-power`}
          onClear={() => setState({ ...initialCombustionAirState(tool), regulation: state.regulation })}
          disabled={pristine}
        >
          Feuerstätten
        </HeadingWithClear>
        <div className="mt-3">
          <NumberField
            id={`${idPrefix}-power-input`}
            label={tool.power.label}
            mainUnit={tool.power.unit}
            unit={state.powerUnit}
            onUnitChange={(powerUnit) => update({ powerUnit })}
            value={state.power}
            placeholder="z. B. 24"
            width="w-32"
            onChange={(value) => update({ power: value })}
          />
          {power.error && <p className="mt-2 font-semibold">Zahl größer 0 eingeben (Beispiel: 24)</p>}
          {powerInMain !== undefined && powerInMain > tool.power.max && (
            <p className="mt-2 font-semibold">
              Höchstens {formatNumber(tool.power.max, 0)} {formatAnyUnit(tool.power.unit)}.
            </p>
          )}
          {powerValue !== undefined && state.powerUnit !== tool.power.unit && (
            <p className="mt-2 text-base text-muted">
              = {formatNumber(powerValue, 1)} {formatAnyUnit(tool.power.unit)}
            </p>
          )}
          <Help text={tool.power.text}>
            <Source tool={tool} refValue={tool.power.ref} />
          </Help>
        </div>
      </section>

      <section className="mt-6" aria-labelledby={`${idPrefix}-requirements`}>
        <h2 id={`${idPrefix}-requirements`} className="text-xl font-bold">
          Anforderungen
        </h2>
        {powerValue === undefined ? (
          <p className="mt-2 text-base text-muted">Nennleistung eingeben.</p>
        ) : (
          <Requirements tool={tool} regulation={regulation} power={powerValue} />
        )}
      </section>

      {powerValue !== undefined && (
        <section className="mt-8" aria-labelledby={`${idPrefix}-check`}>
          <h2 id={`${idPrefix}-check`} className="text-xl font-bold">
            Lösung prüfen
          </h2>
          {regulation.compound && (
            <SelectionBar
              bar={{
                key: 'method',
                name: 'Nachweis über',
                options: [
                  { key: 'openings', label: 'Öffnung ins Freie', note: '' },
                  { key: 'compound', label: 'Rauminhalt / Verbund', note: '' },
                ],
              }}
              selected={method}
              onSelect={(key) => update({ method: key as Method })}
            />
          )}
          {method === 'openings' ? (
            <OpeningCheckView
              requirement={openingRequirement(regulation, powerValue)}
              rows={state.openings}
              onChange={(openings) => update({ openings })}
              newKey={() => `opening${nextKey.current++}`}
            />
          ) : (
            <CompoundCheckView
              regulation={regulation}
              power={powerValue}
              rows={state.rooms}
              onChange={(rooms) => update({ rooms })}
              newKey={() => `room${nextKey.current++}`}
            />
          )}
        </section>
      )}

      {regulation.notes.map((note) => (
        <section key={note.title} className="mt-6">
          <h2 className="text-xl font-bold">{note.title}</h2>
          <p className="mt-2 text-base">{note.text}</p>
          <Source tool={tool} refValue={note.ref} />
        </section>
      ))}

      <div className="mt-6 text-base text-muted">
        <RichText text={tool.closingNote} />
      </div>
    </>
  )
}

function Requirements({ tool, regulation, power }: { tool: CombustionAirTool; regulation: CombustionAirRegulation; power: number }) {
  const opening = openingRequirement(regulation, power)
  const flow = volumeFlowRequirement(regulation, power)
  const compound = compoundRequirement(regulation, power)
  return (
    <div className={`mt-3 ${resultCard}`} aria-live="polite">
      <p className="font-semibold">Öffnung ins Freie (lichter Querschnitt)</p>
      {opening.kind === 'small' ? (
        <>
          <p className="text-3xl font-bold">mind. {cm2(opening.single)}</p>
          <p className="text-base">oder zwei Öffnungen mit je mind. {cm2(opening.pairEach)}</p>
        </>
      ) : (
        <>
          <p className="text-3xl font-bold">mind. {cm2(opening.area)}</p>
          <p className="text-base">auf höchstens {opening.maxOpenings} Öffnungen oder Leitungen verteilt</p>
        </>
      )}
      <Help text={opening.kind === 'small' ? regulation.opening.text : regulation.opening.overText}>
        <Source tool={tool} refValue={opening.kind === 'small' ? regulation.opening.ref : regulation.opening.overRef} />
      </Help>

      <p className="mt-4 font-semibold">Rauminhalt / Verbrennungsluftverbund</p>
      {compound.kind === 'volume' ? (
        <>
          <p className="text-3xl font-bold">mind. {m3(compound.volume)}</p>
          <p className="text-base">
            Räume mit Verbindung zum Freien, untereinander über Öffnungen mit je mind. {cm2(regulation.compound!.openingMin)}
          </p>
        </>
      ) : compound.kind === 'overLimit' ? (
        <p className="text-base font-semibold">
          Nicht zulässig: nur bis {formatNumber(compound.upTo, 0)} kW Nennleistung insgesamt.
        </p>
      ) : (
        <p className="text-base">{regulation.compoundMissing}</p>
      )}
      {regulation.compound && (
        <Help text={regulation.compound.text}>
          <Source tool={tool} refValue={regulation.compound.ref} />
        </Help>
      )}

      {flow !== undefined && (
        <>
          <p className="mt-4 font-semibold">Oder: verfügbarer Volumenstrom</p>
          <p className="text-3xl font-bold">mind. {formatNumber(flow, 1)} m³/h</p>
          <Help text={regulation.volumeFlow!.text}>
            <Source tool={tool} refValue={regulation.volumeFlow!.ref} />
          </Help>
        </>
      )}
      {regulation.otherProof && (
        <>
          <p className="mt-4 font-semibold">Oder: anderer Nachweis</p>
          <p className="text-base">{regulation.otherProof.text}</p>
          <Source tool={tool} refValue={regulation.otherProof.ref} />
        </>
      )}
    </div>
  )
}

function OpeningCheckView({
  requirement,
  rows,
  onChange,
  newKey,
}: {
  requirement: OpeningRequirement
  rows: OpeningRow[]
  onChange: (rows: OpeningRow[]) => void
  newKey: () => string
}) {
  const idPrefix = useId()
  const visible = rows.slice(0, requirement.maxOpenings)
  const areas = visible.map(rowArea)
  const complete = areas.every((area) => area !== undefined) && areas.length > 0
  const check = complete ? checkOpenings(requirement, areas as number[]) : undefined
  const updateRow = (key: string, patch: Partial<OpeningRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  return (
    <>
      <p className="mt-2 text-base text-muted">Lichten Querschnitt eintragen, also bei Gittern die freie Fläche.</p>
      <ul className="mt-3 space-y-3">
        {visible.map((row, index) => {
          const id = `${idPrefix}-${row.key}`
          const area = areas[index]
          return (
            <li key={row.key} className={rowCard}>
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${id}-shape`} className="block font-semibold">
                    Öffnung {index + 1}
                  </label>
                  <select
                    id={`${id}-shape`}
                    value={row.shape}
                    onChange={(event) => updateRow(row.key, { shape: event.target.value as OpeningShape })}
                    className={`${fieldBase} mt-1 w-full`}
                  >
                    {SHAPES.map((shape) => (
                      <option key={shape.key} value={shape.key}>
                        {shape.label}
                      </option>
                    ))}
                  </select>
                </div>
                {rows.length > 1 && (
                  <button
                    type="button"
                    aria-label={`Öffnung ${index + 1} entfernen`}
                    onClick={() => onChange(rows.filter((candidate) => candidate.key !== row.key))}
                    className={removeButton}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
                {row.shape === 'area' ? (
                  <NumberField
                    id={`${id}-a`}
                    label="Lichter Querschnitt"
                    mainUnit={OPENING_AREA}
                    unit={row.areaUnit}
                    onUnitChange={(areaUnit) => updateRow(row.key, { areaUnit })}
                    value={row.a}
                    width="w-28"
                    onChange={(a) => updateRow(row.key, { a })}
                  />
                ) : (
                  (row.shape === 'rect'
                    ? [
                        { field: 'a', label: 'Breite' },
                        { field: 'b', label: 'Höhe' },
                      ]
                    : [{ field: 'a', label: 'Durchmesser' }]
                  ).map(({ field, label }) => (
                    <NumberField
                      key={field}
                      id={`${id}-${field}`}
                      label={label}
                      mainUnit={OPENING_LENGTH}
                      unit={row.lengthUnit}
                      onUnitChange={(lengthUnit) => updateRow(row.key, { lengthUnit })}
                      value={row[field as 'a' | 'b']}
                      onChange={(value) => updateRow(row.key, { [field]: value })}
                    />
                  ))
                )}
              </div>
              {area !== undefined && row.shape !== 'area' && <p className="mt-2 text-base">= {cm2(area)}</p>}
            </li>
          )
        })}
      </ul>
      {rows.length < requirement.maxOpenings && (
        <button type="button" className={`${secondaryButton} mt-3`} onClick={() => onChange([...rows, newOpening(newKey())])}>
          <span aria-hidden="true">+</span> Zweite Öffnung
        </button>
      )}

      <div className={`mt-4 ${resultCard}`} aria-live="polite">
        {!check ? (
          <p className="text-base text-muted">Maße aller Öffnungen eingeben.</p>
        ) : (
          <>
            <p className="font-semibold">Lichter Querschnitt {visible.length > 1 ? 'zusammen' : ''}</p>
            <p className="text-3xl font-bold">{cm2(check.total)}</p>
            {check.kind === 'ok' ? (
              <p className="mt-2 text-base font-semibold">Reicht aus.</p>
            ) : check.kind === 'missing' ? (
              <p className={warning}>Zu klein: Es fehlen {cm2(check.missing)}.</p>
            ) : check.kind === 'tooSmall' && requirement.kind === 'small' ? (
              <p className={warning}>
                Zu klein: Nötig ist eine Öffnung mit mind. {cm2(requirement.single)} oder zwei Öffnungen mit je mind.{' '}
                {cm2(requirement.pairEach)}.
              </p>
            ) : (
              <p className={warning}>Zu viele Öffnungen: höchstens {requirement.maxOpenings}.</p>
            )}
          </>
        )}
      </div>
    </>
  )
}

const STATUS_TEXT: Record<RoomStatus, string> = {
  counted: 'Zählt mit',
  noOutside: 'Zählt nicht: keine Verbindung zum Freien',
  notConnected: 'Zählt nicht: keine Öffnung zum Verbund',
  noVolume: 'Rauminhalt fehlt',
}

function CompoundCheckView({
  regulation,
  power,
  rows,
  onChange,
  newKey,
}: {
  regulation: CombustionAirRegulation
  power: number
  rows: RoomRow[]
  onChange: (rows: RoomRow[]) => void
  newKey: () => string
}) {
  const idPrefix = useId()
  const requirement = compoundRequirement(regulation, power)
  if (requirement.kind !== 'volume') {
    return (
      <p className={warning}>
        {requirement.kind === 'overLimit'
          ? `Rauminhalt und Verbund sind nur bis ${formatNumber(requirement.upTo, 0)} kW zulässig. Öffnung ins Freie wählen.`
          : regulation.compoundMissing}
      </p>
    )
  }
  const openingMin = regulation.compound!.openingMin
  const rooms: CompoundRoom[] = rows.map((row) => ({ volume: roomVolume(row), toOutside: row.toOutside, connected: row.connected }))
  const check = checkCompound(requirement.volume, rooms)
  const updateRow = (key: string, patch: Partial<RoomRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)))

  return (
    <>
      <p className="mt-2 text-base text-muted">
        Der erste Raum ist der Aufstellraum. Weitere Räume zählen mit, wenn sie eine Tür ins Freie oder ein Fenster haben, das sich
        öffnen lässt, und über eine Öffnung mit mind. {cm2(openingMin)} verbunden sind.
      </p>
      <ul className="mt-3 space-y-3">
        {rows.map((row, index) => {
          const id = `${idPrefix}-${row.key}`
          const volume = rooms[index]!.volume
          const status = check.statuses[index]!
          return (
            <li key={row.key} className={rowCard}>
              <div className="flex items-end gap-3">
                <div className="min-w-0 flex-1">
                  <label htmlFor={`${id}-name`} className="block font-semibold">
                    {index === 0 ? 'Aufstellraum' : `Raum ${index + 1}`}
                  </label>
                  <input
                    id={`${id}-name`}
                    type="text"
                    autoComplete="off"
                    placeholder={index === 0 ? 'z. B. Hauswirtschaftsraum' : 'z. B. Flur'}
                    value={row.name}
                    onChange={(event) => updateRow(row.key, { name: event.target.value })}
                    className={`${fieldBase} mt-1 w-full`}
                  />
                </div>
                {index > 0 && (
                  <button
                    type="button"
                    aria-label={`Raum ${index + 1} entfernen`}
                    onClick={() => onChange(rows.filter((candidate) => candidate.key !== row.key))}
                    className={removeButton}
                  >
                    <span aria-hidden="true">✕</span>
                  </button>
                )}
              </div>
              <div className="mt-3">
                <label htmlFor={`${id}-mode`} className="sr-only">
                  Eingabe des Rauminhalts
                </label>
                <select
                  id={`${id}-mode`}
                  value={row.mode}
                  onChange={(event) => updateRow(row.key, { mode: event.target.value as RoomRow['mode'] })}
                  className={`${fieldBase} w-full`}
                >
                  <option value="dims">Länge × Breite × Höhe</option>
                  <option value="volume">Rauminhalt bekannt</option>
                </select>
              </div>
              <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
                {row.mode === 'dims' ? (
                  (
                    [
                      { field: 'length', label: 'Länge' },
                      { field: 'width', label: 'Breite' },
                      { field: 'height', label: 'Höhe' },
                    ] as const
                  ).map(({ field, label }) => (
                    <NumberField
                      key={field}
                      id={`${id}-${field}`}
                      label={label}
                      mainUnit={ROOM_LENGTH}
                      unit={row.lengthUnit}
                      onUnitChange={(lengthUnit) => updateRow(row.key, { lengthUnit })}
                      value={row[field]}
                      onChange={(value) => updateRow(row.key, { [field]: value })}
                    />
                  ))
                ) : (
                  <NumberField
                    id={`${id}-v`}
                    label="Rauminhalt"
                    mainUnit={ROOM_VOLUME}
                    unit={row.volumeUnit}
                    onUnitChange={(volumeUnit) => updateRow(row.key, { volumeUnit })}
                    value={row.volume}
                    width="w-28"
                    onChange={(volume) => updateRow(row.key, { volume })}
                  />
                )}
              </div>
              <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  checked={row.toOutside}
                  onChange={(event) => updateRow(row.key, { toOutside: event.target.checked })}
                  className="size-6 shrink-0 accent-current"
                />
                Tür ins Freie oder Fenster, das sich öffnen lässt
              </label>
              {index > 0 && (
                <label className="flex min-h-12 cursor-pointer items-center gap-3 font-semibold">
                  <input
                    type="checkbox"
                    checked={row.connected}
                    onChange={(event) => updateRow(row.key, { connected: event.target.checked })}
                    className="size-6 shrink-0 accent-current"
                  />
                  Verbrennungsluftöffnung mind. {cm2(openingMin)} zum Verbund
                </label>
              )}
              <p className={`mt-1 text-base ${status === 'counted' ? 'font-semibold' : 'text-muted'}`}>
                {volume !== undefined && `${m3(volume)} · `}
                {STATUS_TEXT[status]}
              </p>
            </li>
          )
        })}
      </ul>
      <button type="button" className={`${secondaryButton} mt-3`} onClick={() => onChange([...rows, newRoom(newKey())])}>
        <span aria-hidden="true">+</span> Raum zum Verbund
      </button>

      <div className={`mt-4 ${resultCard}`} aria-live="polite">
        <p className="font-semibold">Angerechneter Rauminhalt</p>
        <p className="text-3xl font-bold">
          {m3(check.counted)} <span className="text-xl font-semibold text-muted">von mind. {m3(check.required)}</span>
        </p>
        {check.ok ? (
          <p className="mt-2 text-base font-semibold">Reicht aus.</p>
        ) : (
          <p className={warning}>Zu klein: Es fehlen {m3(check.required - check.counted)}.</p>
        )}
      </div>
    </>
  )
}
