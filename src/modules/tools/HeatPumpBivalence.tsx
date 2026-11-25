import { useId, useState } from 'react'
import { secondaryButton } from '../../components/buttons'
import { LocationIcon } from '../../components/icons'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { parseDecimal } from '../../lib/number'
import { Help, Stepper } from './HeatingCurveSimulator'
import {
  capacityAt,
  coverageAt,
  evaluateBivalence,
  heatPumpRefText,
  loadAt,
  sortedPoints,
  typicalRange,
  type BivalenceInputs,
  type BivalenceResult,
  type CapacityPoint,
  type HeatPumpRef,
  type HeatPumpTool,
} from './heatPumpTool'

const format = (value: number, decimals = 0) =>
  value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
const percent = (value: number) => `${format(value * 100)} %`
const signed = (value: number, decimals = 1) => {
  const rounded = Number(value.toFixed(decimals))
  if (rounded === 0) return format(0, decimals)
  return `${rounded > 0 ? '+' : '−'}${format(Math.abs(rounded), decimals)}`
}

function Source({ tool, refValue }: { tool: HeatPumpTool; refValue: HeatPumpRef | undefined }) {
  if (!refValue) return null
  return <p className="mt-1 text-sm text-muted">Quelle: {heatPumpRefText(tool, refValue)}</p>
}

type PointRow = [string, string]
const MAX_POINTS = 5

function readPoints(rows: readonly PointRow[]): { points: CapacityPoint[]; invalid: boolean } {
  const points: CapacityPoint[] = []
  let invalid = false
  for (const [outdoor, power] of rows) {
    if (outdoor.trim() === '' && power.trim() === '') continue
    const a = parseDecimal(outdoor)
    const b = parseDecimal(power)
    if (a === undefined || b === undefined || b < 0) invalid = true
    else points.push({ outdoor: a, power: b })
  }
  return { points: sortedPoints(points), invalid }
}

// Diagramm: x = Außentemperatur, y = Leistung in kW
const WIDTH = 360
const HEIGHT = 250
const PAD = { left: 38, right: 10, top: 14, bottom: 34 }
const LABEL = 'fill-ink stroke-surface text-[12px] font-bold'

function BivalenceChart({
  inputs,
  points,
  result,
}: {
  inputs: BivalenceInputs
  points: CapacityPoint[]
  result: BivalenceResult | null
}) {
  const from = Math.floor((inputs.designOutdoor - 4) / 5) * 5
  const to = inputs.heatingLimit + 2
  const capacities = points.length >= 2 ? [from, to].map((outdoor) => capacityAt(points, outdoor)!.power) : []
  const yMax = Math.max(5, Math.ceil((Math.max(inputs.heatLoad * 1.15, ...capacities, ...points.map((point) => point.power)) + 0.5) / 2) * 2)
  const x = (outdoor: number) => PAD.left + ((outdoor - from) / (to - from)) * (WIDTH - PAD.left - PAD.right)
  const y = (power: number) => HEIGHT - PAD.bottom - (Math.min(power, yMax) / yMax) * (HEIGHT - PAD.top - PAD.bottom)
  const step = 0.5
  const samples: number[] = []
  for (let outdoor = from; outdoor <= to + 1e-9; outdoor += step) samples.push(outdoor)
  const line = (values: [number, number][]) => values.map(([a, b], index) => `${index === 0 ? 'M' : 'L'}${x(a).toFixed(1)},${y(b).toFixed(1)}`).join('')
  const load = line(samples.map((outdoor) => [outdoor, loadAt(inputs, outdoor)]))
  const offBelow = result?.heatPumpOffBelow ?? null
  const heatPumpOn = (outdoor: number) => offBelow === null || outdoor >= offBelow
  const inRange = points.length >= 2 ? [points[0]!.outdoor, points[points.length - 1]!.outdoor] : null
  const capacityPath = (filter: (outdoor: number) => boolean) =>
    points.length >= 2 ? line(samples.filter((outdoor) => heatPumpOn(outdoor) && filter(outdoor)).map((outdoor) => [outdoor, capacityAt(points, outdoor)!.power])) : ''
  const inside = capacityPath((outdoor) => inRange !== null && outdoor >= inRange[0]! - 1e-9 && outdoor <= inRange[1]! + 1e-9)
  const outside = capacityPath(() => true)
  // Fläche: Anteil des zweiten Erzeugers zwischen Heizlast und Wärmepumpe, von der Norm-AT bis zum Bivalenzpunkt
  const bivalence = result?.bivalence ?? null
  const gapSamples = bivalence === null ? [] : samples.filter((outdoor) => outdoor >= inputs.designOutdoor - 1e-9 && outdoor <= bivalence)
  if (bivalence !== null) gapSamples.push(bivalence)
  const lower = (outdoor: number) => (heatPumpOn(outdoor) && points.length >= 2 ? Math.min(capacityAt(points, outdoor)!.power, loadAt(inputs, outdoor)) : 0)
  const gap =
    gapSamples.length > 1
      ? `${line(gapSamples.map((outdoor) => [outdoor, loadAt(inputs, outdoor)]))}${[...gapSamples]
          .reverse()
          .map((outdoor) => `L${x(outdoor).toFixed(1)},${y(lower(outdoor)).toFixed(1)}`)
          .join('')}Z`
      : ''
  const xTicks: number[] = []
  for (let tick = Math.ceil(from / 5) * 5; tick <= to; tick += 5) xTicks.push(tick)
  const yStep = yMax > 20 ? 5 : 2
  const yTicks: number[] = []
  for (let tick = 0; tick <= yMax; tick += yStep) yTicks.push(tick)

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="mt-3 w-full rounded-2xl border-2 border-line bg-surface" role="img" aria-label="Diagramm: Heizlast des Gebäudes und Heizleistung der Wärmepumpe über der Außentemperatur">
      {yTicks.map((tick) => (
        <g key={`y${tick}`}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth={0.5} />
          <text x={PAD.left - 4} y={y(tick) + 4} textAnchor="end" className="fill-ink text-[12px]">
            {tick}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={`x${tick}`}>
          <line x1={x(tick)} x2={x(tick)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-line" strokeWidth={0.5} />
          <text x={x(tick)} y={HEIGHT - PAD.bottom + 14} textAnchor="middle" className="fill-ink text-[12px]">
            {tick}
          </text>
        </g>
      ))}
      <text x={(PAD.left + WIDTH - PAD.right) / 2} y={HEIGHT - 3} textAnchor="middle" className="fill-ink text-[12px]">
        Außentemperatur in °C
      </text>
      <text x={11} y={HEIGHT / 2} textAnchor="middle" transform={`rotate(-90 11 ${HEIGHT / 2})`} className="fill-ink text-[12px]">
        Leistung in kW
      </text>
      {gap && <path d={gap} className="fill-warn/60" />}
      {outside && <path d={outside} fill="none" className="stroke-brand" strokeWidth={2} strokeDasharray="4 4" />}
      {inside && <path d={inside} fill="none" className="stroke-brand" strokeWidth={3.5} />}
      <path d={load} fill="none" className="stroke-accent" strokeWidth={3.5} />
      {points.map((point) => (
        <circle key={point.outdoor} cx={x(point.outdoor)} cy={y(point.power)} r={4} className="fill-brand stroke-ink" strokeWidth={1} />
      ))}
      {offBelow !== null && offBelow > from && (
        <line x1={x(offBelow)} x2={x(offBelow)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-warn-ink" strokeWidth={2} strokeDasharray="2 3" />
      )}
      <circle cx={x(inputs.designOutdoor)} cy={y(inputs.heatLoad)} r={5} className="fill-accent stroke-ink" strokeWidth={1.5} />
      <text x={x(inputs.designOutdoor) + 8} y={y(inputs.heatLoad) - 6} className={LABEL} strokeWidth={4} paintOrder="stroke">
        Norm-Heizlast {format(inputs.heatLoad, 1)} kW
      </text>
      {bivalence !== null && (
        <g>
          <circle cx={x(bivalence)} cy={y(loadAt(inputs, bivalence))} r={7} className="fill-surface stroke-ink" strokeWidth={3} />
          <text x={x(bivalence) + 10} y={y(loadAt(inputs, bivalence)) - 8} className={LABEL} strokeWidth={4} paintOrder="stroke">
            Bivalenzpunkt {format(bivalence, 1)} °C
          </text>
        </g>
      )}
    </svg>
  )
}

function Legend({ showGap }: { showGap: boolean }) {
  const item = (dash: string, className: string, width: number, label: string) => (
    <li className="flex items-center gap-2">
      <svg width="32" height="10" aria-hidden="true">
        <line x1="0" x2="32" y1="5" y2="5" className={className} strokeWidth={width} strokeDasharray={dash} />
      </svg>
      {label}
    </li>
  )
  return (
    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-base">
      {item('', 'stroke-accent', 3.5, 'Heizlast Gebäude')}
      {item('', 'stroke-brand', 3.5, 'Wärmepumpe (Datenblatt)')}
      {item('4 4', 'stroke-brand', 2, 'verlängert')}
      {showGap && (
        <li className="flex items-center gap-2">
          <span aria-hidden="true" className="inline-block h-3 w-8 rounded-sm bg-warn/60" />
          zweiter Erzeuger
        </li>
      )}
    </ul>
  )
}

interface Snapshot {
  inputs: BivalenceInputs
  rows: PointRow[]
  modeKey: string
}

/** Wärmepumpe: Heizlastgerade, Datenblattleistung, Bivalenzpunkt, Betriebsweise und Deckungsanteil */
export function HeatPumpBivalence({
  tool,
  initialRows,
  initialMode,
  initialInputs = {},
  initialProblem = '',
}: {
  tool: HeatPumpTool
  /** Vorgaben (Tests) */
  initialRows?: PointRow[]
  initialMode?: string
  initialInputs?: Partial<BivalenceInputs>
  initialProblem?: string
}) {
  const [problemKey, setProblemKey] = useState(initialProblem)
  const problem = tool.problems.find((candidate) => candidate.key === problemKey)
  const defaults: BivalenceInputs = {
    heatLoad: tool.inputs.heatLoad.default,
    designOutdoor: tool.inputs.designOutdoor.default,
    heatingLimit: tool.inputs.heatingLimit.default,
    lowerLimit: tool.inputs.lowerLimit.default,
  }
  const [inputs, setInputs] = useState<BivalenceInputs>({ ...defaults, ...initialInputs })
  const exampleRows = tool.examplePoints.map((point): PointRow => [format(point.outdoor), String(point.power).replace('.', ',')])
  const [rows, setRows] = useState<PointRow[]>(initialRows ?? exampleRows)
  const [modeKey, setModeKey] = useState(initialMode ?? tool.defaultMode)
  const showsExample = JSON.stringify(rows) === JSON.stringify(exampleRows)
  const [base, setBase] = useState<Snapshot | null>(null)
  const idPrefix = useId()
  const mode = tool.modes.find((candidate) => candidate.key === modeKey) ?? tool.modes[0]!
  const { points, invalid } = readPoints(rows)
  const result = evaluateBivalence(tool, mode, inputs, points)
  const range = typicalRange(tool, inputs.designOutdoor)
  const table = result?.bivalence != null ? coverageAt(tool, result.bivalence) : null

  const baseResult = (() => {
    if (!base) return null
    const baseMode = tool.modes.find((candidate) => candidate.key === base.modeKey) ?? mode
    return evaluateBivalence(tool, baseMode, base.inputs, readPoints(base.rows).points)
  })()
  const changes: string[] = []
  if (base && baseResult && result) {
    const before = baseResult.bivalence
    const after = result.bivalence
    if (before !== after) {
      if (before === null || after === null) {
        changes.push(after === null ? 'Die Wärmepumpe reicht jetzt bis zur Norm-Außentemperatur, es gibt keinen Bivalenzpunkt mehr.' : `Jetzt gibt es einen Bivalenzpunkt bei ${format(after, 1)} °C.`)
      } else if (Math.abs(after - before) >= 0.1) {
        changes.push(
          `Bivalenzpunkt ${format(before, 1)} → ${format(after, 1)} °C: Die Wärmepumpe heizt ${after < before ? 'länger' : 'kürzer'} allein, der zweite Erzeuger springt ${after < before ? 'erst bei tieferen' : 'schon bei höheren'} Außentemperaturen an.`,
        )
      }
    }
    if (Math.abs(result.secondAtDesign - baseResult.secondAtDesign) >= 0.05) {
      changes.push(`Zweiter Erzeuger bei Norm-Außentemperatur: ${format(baseResult.secondAtDesign, 1)} → ${format(result.secondAtDesign, 1)} kW.`)
    }
    if (result.coverage !== null && baseResult.coverage !== null && Math.abs(result.coverage - baseResult.coverage) >= 0.005) {
      changes.push(`Deckungsanteil der Wärmepumpe: ${percent(baseResult.coverage)} → ${percent(result.coverage)} (${signed((result.coverage - baseResult.coverage) * 100, 0)} Prozentpunkte).`)
    }
    if (changes.length === 0) changes.push('Keine nennenswerte Änderung gegenüber dem Ausgang.')
  }

  const inputControl = (name: 'heatLoad' | 'designOutdoor' | 'heatingLimit' | 'lowerLimit') => {
    const input = tool.inputs[name]
    const value = inputs[name] ?? input.default
    return (
      // Teilraster: Regler, „Was bewirkt das?“ und Link liegen in allen Kacheln auf gleicher Höhe
      <div className="row-span-3 grid grid-rows-subgrid content-start gap-y-0 rounded-2xl border-2 border-line bg-surface p-3">
        <Stepper
          label={input.label}
          unit={input.unit}
          value={value}
          min={input.min}
          max={input.max}
          step={input.step}
          onChange={(next) => setInputs({ ...inputs, [name]: next })}
        />
        <Help text={input.text}>
          <Source tool={tool} refValue={input.ref} />
          {input.lookup && (
            <>
              <p className="mt-2 text-sm">{input.lookup.text}</p>
              <Source tool={tool} refValue={input.lookup.ref} />
            </>
          )}
        </Help>
        {input.lookup && (
          <a
            href={input.lookup.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold underline decoration-accent decoration-2 underline-offset-4"
          >
            <LocationIcon className="size-4 shrink-0" />
            {input.lookup.label}
            <span className="sr-only"> (öffnet externe Seite)</span>
          </a>
        )}
      </div>
    )
  }

  return (
    <section>
      <h2 className="mt-6 text-xl font-bold">Diagramm</h2>
      <BivalenceChart inputs={inputs} points={points} result={result} />
      <Legend showGap={result?.bivalence != null && mode.secondGenerator} />

      <section className="mt-4" aria-live="polite">
        <h2 className="text-xl font-bold">
          Ergebnis <span className="text-base font-semibold text-muted">· {mode.label}</span>
        </h2>
        {!result ? (
          <p className="mt-2 text-base text-muted">Mindestens zwei Datenblattpunkte eingeben, dann erscheinen Bivalenzpunkt und Anteile.</p>
        ) : (
          <div className="mt-3 rounded-2xl border-2 border-accent bg-surface p-4">
            <dl className="grid gap-3 sm:grid-cols-3">
              <div>
                <dt className="text-base">Bivalenzpunkt</dt>
                <dd className="text-2xl font-bold">{result.bivalence === null ? 'keiner' : `${format(result.bivalence, 1)} °C`}</dd>
                <dd className="text-sm text-muted">
                  üblich bei Norm-AT {format(range.designOutdoor)} °C: {format(range.from)} bis {format(range.to)} °C
                </dd>
              </div>
              <div>
                <dt className="text-base">Wärmepumpe bei {format(inputs.designOutdoor)} °C</dt>
                <dd className="text-2xl font-bold">{result.heatPumpAtDesign === null ? 'aus' : `${format(result.heatPumpAtDesign, 1)} kW`}</dd>
              </div>
              <div>
                <dt className="text-base">{mode.secondGenerator ? 'Zweiter Erzeuger bei Norm-AT' : 'Zweiter Erzeuger'}</dt>
                <dd className="text-2xl font-bold">{mode.secondGenerator ? `${format(result.secondAtDesign, 1)} kW` : 'keiner'}</dd>
              </div>
            </dl>
            <div className="mt-3 border-t-2 border-line pt-3">
              <p className="text-base">
                Deckungsanteil der Wärmepumpe an der Jahresheizarbeit:{' '}
                <strong className="text-xl">
                  {result.coverage !== null ? percent(result.coverage) : mode.coverage && result.bivalence !== null ? 'außerhalb der Tabelle (−10 bis +5 °C)' : '–'}
                </strong>
              </p>
              {mode.coverageNote && <p className="text-sm">{mode.coverageNote}</p>}
              {mode.coverage && <Source tool={tool} refValue={tool.coverage.ref} />}
            </div>
            {result.monovalentGap !== null && (
              <p className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink">
                Monovalent reicht diese Wärmepumpe nicht: Bei Norm-Außentemperatur fehlen {format(result.monovalentGap, 1)} kW.
              </p>
            )}
            {result.extrapolated && (
              <p className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink">
                Das Ergebnis liegt außerhalb der eingetragenen Datenblattpunkte; die Leistung ist dort nur verlängert. Einen Punkt bei tieferer
                Außentemperatur eintragen.
              </p>
            )}
          </div>
        )}
      </section>

      <h2 className="mt-8 text-xl font-bold">Gebäude</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-3 sm:gap-y-0">
        {inputControl('heatLoad')}
        {inputControl('designOutdoor')}
        {inputControl('heatingLimit')}
      </div>

      <h2 className="mt-8 text-xl font-bold">Wärmepumpe: Heizleistung laut Datenblatt</h2>
      <p className="mt-1 text-base">{tool.capacityText}</p>
      <Source tool={tool} refValue={tool.capacityRef} />
      {showsExample && (
        <div className="mt-2 flex flex-wrap items-center gap-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-warn-ink">
          <p className="flex-1 text-base font-semibold">{tool.examplePointsNote}</p>
          <button
            type="button"
            onClick={() => setRows(exampleRows.map((): PointRow => ['', '']))}
            className="min-h-12 rounded-xl border-2 border-warn-ink bg-surface px-4 font-bold text-ink"
          >
            Felder leeren
          </button>
        </div>
      )}
      <div className="mt-2 space-y-2">
        {rows.map((row, index) => (
          <fieldset key={index} className="flex flex-wrap items-end gap-3 rounded-xl border-2 border-line p-3">
            <legend className="px-1 font-semibold">Punkt {index + 1}</legend>
            <div>
              <label htmlFor={`${idPrefix}-${index}-outdoor`} className="block text-base">
                Außentemperatur
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`${idPrefix}-${index}-outdoor`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={row[0]}
                  onChange={(event) => setRows(rows.map((current, i) => (i === index ? [event.target.value, current[1]] : current)))}
                  className={`${fieldBase} w-24`}
                />
                <span className="text-lg">°C</span>
              </div>
            </div>
            <div>
              <label htmlFor={`${idPrefix}-${index}-power`} className="block text-base">
                Heizleistung
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={`${idPrefix}-${index}-power`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={row[1]}
                  onChange={(event) => setRows(rows.map((current, i) => (i === index ? [current[0], event.target.value] : current)))}
                  className={`${fieldBase} w-24`}
                />
                <span className="text-lg">kW</span>
              </div>
            </div>
            {rows.length > 2 && (
              <button type="button" onClick={() => setRows(rows.filter((_, i) => i !== index))} className={`${secondaryButton} ml-auto`} aria-label={`Punkt ${index + 1} entfernen`}>
                Entfernen
              </button>
            )}
          </fieldset>
        ))}
      </div>
      {rows.length < MAX_POINTS && (
        <button type="button" onClick={() => setRows([...rows, ['', '']])} className={`${secondaryButton} mt-2`}>
          Punkt hinzufügen
        </button>
      )}
      {invalid && <p className="mt-2 text-base font-semibold">Zahlen eingeben, z. B. −7 und 6,4.</p>}

      <h2 className="mt-8 text-xl font-bold">Betriebsweise</h2>
      <div role="group" aria-label="Betriebsweise" className="mt-2 grid gap-2 sm:grid-cols-2">
        {tool.modes.map((candidate) => {
          const active = candidate.key === mode.key
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={active}
              onClick={() => setModeKey(candidate.key)}
              className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left font-semibold ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`}
            >
              <span aria-hidden="true">{active ? '✓ ' : ''}</span>
              {candidate.label}
            </button>
          )
        })}
      </div>
      <p className="mt-2 text-base">{mode.text}</p>
      <Source tool={tool} refValue={mode.ref} />
      {mode.heatPumpOffBelow === 'lowerLimit' && <div className="mt-3 sm:w-1/2">{inputControl('lowerLimit')}</div>}

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!result} onClick={() => setBase({ inputs, rows, modeKey: mode.key })} className={secondaryButton}>
          Als Ausgang merken
        </button>
        <button
          type="button"
          disabled={!base}
          onClick={() => {
            if (!base) return
            setInputs(base.inputs)
            setRows(base.rows)
            setModeKey(base.modeKey)
          }}
          className={secondaryButton}
        >
          Zurück zum Ausgang
        </button>
      </div>
      {base && (
        <section className="mt-4">
          <h2 className="text-xl font-bold">Was bewirkt die Änderung?</h2>
          <ul className="mt-2 space-y-2">
            {changes.map((change) => (
              <li key={change} className="rounded-xl border-2 border-accent bg-surface p-3 text-base">
                {change}
              </li>
            ))}
          </ul>
        </section>
      )}

      {tool.problems.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Was ist das Problem?</h2>
          <div role="group" aria-label="Problem" className="mt-2 grid gap-2 sm:grid-cols-2">
            {tool.problems.map((candidate) => {
              const active = candidate.key === problem?.key
              return (
                <button
                  key={candidate.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setProblemKey(active ? '' : candidate.key)}
                  className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left font-semibold ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`}
                >
                  <span aria-hidden="true">{active ? '✓ ' : ''}</span>
                  {candidate.label}
                </button>
              )
            })}
          </div>
          {problem && (
            <div aria-live="polite" className="mt-4 rounded-xl border-2 border-line bg-surface p-3">
              <p className="font-semibold">Regel</p>
              <p className="text-base">{problem.text}</p>
              {problem.bivalence !== 'keep' && (
                <p className="mt-1 text-base font-semibold">Bivalenzpunkt {problem.bivalence === 'up' ? 'höher (wärmer)' : 'tiefer (kälter)'} wählen</p>
              )}
              <Source tool={tool} refValue={problem.ref} />
              {result && (
                <p className="mt-2 border-t-2 border-line pt-2 text-base">
                  Jetzt im Tool: Bivalenzpunkt {result.bivalence === null ? 'keiner' : `${format(result.bivalence, 1)} °C`}, üblich bei Norm-AT{' '}
                  {format(range.designOutdoor)} °C: {format(range.from)} bis {format(range.to)} °C.
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {tool.infos.length > 0 && (
        <details className="mt-8 rounded-2xl border-2 border-line bg-surface px-4">
          <summary className="min-h-14 cursor-pointer py-3 text-lg font-bold">Wichtig bei der Auslegung</summary>
          <ul className="space-y-2 pb-4">
            {tool.infos.map((info) => (
              <li key={info.title} className="rounded-xl border-2 border-line bg-surface p-3">
                <p className="font-semibold">{info.title}</p>
                <p className="text-base">{info.text}</p>
                <Source tool={tool} refValue={info.ref} />
              </li>
            ))}
          </ul>
        </details>
      )}

      <details className="mt-3 rounded-2xl border-2 border-line bg-surface px-4">
        <summary className="min-h-14 cursor-pointer py-3 text-lg font-bold">Rechenweg und Tabelle</summary>
        <div className="pb-4">
          <p className="text-base">{tool.methodText}</p>
          <Source tool={tool} refValue={tool.methodRef} />
          <h3 className="mt-4 font-bold">{tool.coverage.title}</h3>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b-2 border-line">
                  <th className="p-2">Bivalenzpunkt</th>
                  <th className="p-2">Leistungsanteil</th>
                  <th className="p-2">parallel</th>
                  <th className="p-2">alternativ</th>
                </tr>
              </thead>
              <tbody>
                {tool.coverage.rows.map((row) => {
                  const near = result?.bivalence != null && Math.abs(row.bivalence - result.bivalence) < 0.5
                  return (
                    <tr key={row.bivalence} className={`border-b border-line ${near ? 'bg-accent text-accent-ink font-bold' : ''}`}>
                      <td className="p-2">{format(row.bivalence)} °C</td>
                      <td className="p-2">{format(row.powerShare, 2)}</td>
                      <td className="p-2">{format(row.parallel, 2)}</td>
                      <td className="p-2">{format(row.alternative, 2)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {table && <p className="mt-2 text-sm">Zwischen zwei Zeilen rechnet das Tool linear.</p>}
          <Source tool={tool} refValue={tool.coverage.ref} />
          <p className="mt-3 text-sm">{tool.typicalRanges.text}</p>
          <Source tool={tool} refValue={tool.typicalRanges.ref} />
        </div>
      </details>

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
