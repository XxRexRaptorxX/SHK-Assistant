import { useId, useState } from 'react'
import { primaryButton, secondaryButton } from '../../components/buttons'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { math } from '../../lib/math'
import { parseDecimal } from '../../lib/number'
import { renderNode } from '../formulas/FormulaMath'
import { renderSymbol } from '../formulas/SymbolText'
import {
  changedParameters,
  comparePoints,
  curveExpressions,
  curveFormulaText,
  curveRefText,
  curveSegments,
  defaultSettings,
  fitCurve,
  flowAt,
  limitCrossing,
  pointsFromSettings,
  settingsFromPoints,
  rawFlow,
  roundToStep,
  symptomObservations,
  toRecommendation,
  type CurveObservation,
  type CurveParameterKey,
  type CurveRef,
  type CurveSettings,
  type FitResult,
  type HeatingCurveTool,
  type Recommendation,
} from './heatingCurveTool'

const decimalsOf = (step: number) => Math.max(0, -Math.floor(Math.log10(step)))

const format = (value: number, decimals = 0) =>
  value.toLocaleString('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })

/** Mit Vorzeichen, z. B. „+2,5“ oder „−1“ */
const signed = (value: number, decimals = 1) => {
  const rounded = Number(value.toFixed(decimals))
  if (rounded === 0) return format(0, decimals)
  return `${rounded > 0 ? '+' : '−'}${format(Math.abs(rounded), decimals)}`
}

function Source({ tool, refValue }: { tool: HeatingCurveTool; refValue: CurveRef | undefined }) {
  if (!refValue) return null
  return <p className="mt-1 text-sm text-muted">Quelle: {curveRefText(tool, refValue)}</p>
}

/** Anzeigenamen der Symbole im Rechenweg (Indizes mit „_“) */
const FORMULA_LABELS = new Map([
  ['RT', 'RT_soll'],
  ['Ni', 'Niveau'],
  ['Ne', 'Neigung'],
  ['D', 'D'],
  ['AT', 'AT'],
  ['fD', 'f(D)'],
])

type FormulaView = 'split' | 'full' | 'text'
const FORMULA_VIEWS: { key: FormulaView; label: string }[] = [
  { key: 'split', label: 'Aufgeteilt' },
  { key: 'full', label: 'Ausgeschrieben' },
  { key: 'text', label: 'Als Text' },
]

/**
 * Kennlinie in drei Darstellungen: aufgeteilt (passt aufs Handy), ausgeschrieben in einer Gleichung, oder als
 * einfacher Text zum Kopieren. Formelsatz wie im Lehrbuch: Hochzahlen hochgestellt, Malpunkte, Minuszeichen.
 */
function CurveFormula({ model, initialView = 'split' }: { model: HeatingCurveTool['model']; initialView?: FormulaView }) {
  const [view, setView] = useState<FormulaView>(initialView)
  const [copied, setCopied] = useState(false)
  const { flow, factor, difference, full } = curveExpressions(model)
  const text = curveFormulaText(model)
  const lines: [string, string][] =
    view === 'split'
      ? [
          ['VL', flow],
          ['f(D)', factor],
          ['D', difference],
        ]
      : [
          ['VL', full],
          ['D', difference],
        ]
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }
  return (
    <div className="mt-2">
      <div role="group" aria-label="Darstellung der Formel" className="grid grid-cols-3 gap-2">
        {FORMULA_VIEWS.map((candidate) => {
          const active = candidate.key === view
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setView(candidate.key)
                setCopied(false)
              }}
              className={`min-h-12 rounded-xl border-2 px-2 text-base font-semibold ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`}
            >
              {candidate.label}
            </button>
          )
        })}
      </div>
      {view === 'text' ? (
        <div className="mt-2 rounded-xl bg-raised p-3">
          <p className="font-mono text-base break-words select-all">{text}</p>
          <button type="button" onClick={copy} className={`${secondaryButton} mt-2`}>
            {copied ? '✓ Kopiert' : 'Kopieren'}
          </button>
        </div>
      ) : (
        <div className="mt-2 overflow-x-auto rounded-xl bg-raised px-2 py-2 text-base leading-loose sm:p-4 sm:text-xl" aria-label="Formel der Heizkurve">
          {lines.map(([left, right]) => (
            <p key={left} className="whitespace-nowrap">
              {renderSymbol(left)}
              <span className="mx-1">=</span>
              {renderNode(math.parse(right), FORMULA_LABELS)}
            </p>
          ))}
          {view === 'full' && <p className="text-sm text-muted sm:hidden">Zum Lesen seitlich wischen.</p>}
        </div>
      )}
    </div>
  )
}

/** Eingeklappte Erklärung unter einem Regler */
export function Help({ text, children }: { text: string; children?: React.ReactNode }) {
  return (
    <details className="mt-1">
      <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-muted">Was bewirkt das?</summary>
      <p className="text-sm">{text}</p>
      {children}
    </details>
  )
}

/** Zahl mit − und + (große Tasten für Handschuhe) und Eingabefeld */
export function Stepper({
  label,
  unit,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string
  unit: string
  value: number
  min: number
  max: number
  step: number
  onChange: (value: number) => void
}) {
  const id = useId()
  const [draft, setDraft] = useState<string | null>(null)
  const decimals = decimalsOf(step)
  const set = (next: number) => onChange(Math.min(max, Math.max(min, roundToStep(next, step))))
  const parsed = draft === null ? value : parseDecimal(draft)
  const invalid = draft !== null && (parsed === undefined || parsed < min || parsed > max)
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}
        {/* Die Einheit steht sichtbar im Feld; für Screenreader gehört sie zur Bezeichnung */}
        {unit && <span className="sr-only"> in {unit}</span>}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <button
          type="button"
          aria-label={`${label} verringern`}
          disabled={value <= min}
          onClick={() => {
            setDraft(null)
            set(value - step)
          }}
          className={`${secondaryButton} w-12 shrink-0 px-0 text-2xl`}
        >
          −
        </button>
        <div className="relative min-w-0 max-w-36 flex-1">
          <input
            id={id}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={draft ?? format(value, decimals)}
            aria-invalid={invalid}
            onChange={(event) => {
              setDraft(event.target.value)
              const next = parseDecimal(event.target.value)
              if (next !== undefined && next >= min && next <= max) onChange(next)
            }}
            onBlur={() => setDraft(null)}
            className={`${fieldBase} w-full ${unit ? 'pr-8 pl-1 text-right' : 'px-1 text-center'} ${invalid ? 'border-warn-ink outline-2 outline-warn' : ''}`}
          />
          {unit && (
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-sm text-muted">
              {unit}
            </span>
          )}
        </div>
        <button
          type="button"
          aria-label={`${label} erhöhen`}
          disabled={value >= max}
          onClick={() => {
            setDraft(null)
            set(value + step)
          }}
          className={`${secondaryButton} w-12 shrink-0 px-0 text-2xl`}
        >
          +
        </button>
      </div>
      {invalid && (
        <p className="mt-1 text-base font-semibold">
          Wert von {format(min, decimals)} bis {format(max, decimals)} eingeben
        </p>
      )}
    </div>
  )
}

function ParameterControl({
  tool,
  name,
  settings,
  onChange,
}: {
  tool: HeatingCurveTool
  name: CurveParameterKey
  settings: CurveSettings
  onChange: (settings: CurveSettings) => void
}) {
  const parameter = tool.parameters[name]
  const value = settings[name]
  const optional = parameter.default === null
  const active = value !== null
  return (
    <div className="rounded-2xl border-2 border-line bg-surface p-3">
      {optional && (
        <label className="flex min-h-12 items-center gap-3 text-lg font-semibold">
          <input
            type="checkbox"
            checked={active}
            onChange={(event) =>
              onChange({ ...settings, [name]: event.target.checked ? (parameter.start ?? parameter.min) : null })
            }
            className="size-6"
          />
          {parameter.label}
        </label>
      )}
      {active && (
        <Stepper
          label={optional ? `${parameter.label}: Wert` : parameter.label}
          unit={parameter.unit}
          value={value}
          min={parameter.min}
          max={parameter.max}
          step={parameter.step}
          onChange={(next) => onChange({ ...settings, [name]: next })}
        />
      )}
      <Help text={parameter.text}>
        <Source tool={tool} refValue={parameter.ref} />
      </Help>
    </div>
  )
}

/** Beschriftung der Grenzlinien mit Hintergrund-Kontur, damit sie über Gitter und Kurve lesbar bleibt */
const LIMIT_LABEL = 'fill-ink stroke-surface text-[12px] font-bold'

// Diagramm: x = Außentemperatur, y = Vorlauf
const WIDTH = 360
const HEIGHT = 250
const PAD = { left: 38, right: 10, top: 12, bottom: 34 }

function CurveChart({
  tool,
  settings,
  base,
  readout,
  endOutdoor,
}: {
  tool: HeatingCurveTool
  settings: CurveSettings
  base: CurveSettings
  readout: number
  /** Gesetzt: Fußpunkt und Endpunkt als Punkte einzeichnen */
  endOutdoor?: number
}) {
  const { outdoorFrom, outdoorTo } = tool.chart
  const points = endOutdoor !== undefined ? pointsFromSettings(tool, settings, endOutdoor) : null
  const changed = changedParameters(base, settings).length > 0
  const current = curveSegments(tool.model, settings, outdoorFrom, outdoorTo)
  const baseline = changed ? curveSegments(tool.model, base, outdoorFrom, outdoorTo) : []
  const reduced = settings.reducedSetpoint !== null ? curveSegments(tool.model, settings, outdoorFrom, outdoorTo, true) : []
  // Grenzlinien sollen immer im Bild liegen
  const limits = [settings.maxFlow, settings.minFlow].filter((value): value is number => value !== null)
  const values = [...[current, baseline, reduced].flat(2).map((point) => point.flow), ...limits]
  const yMin = Math.min(20, Math.floor(Math.min(...values, 20) / 10) * 10)
  const yMax = Math.max(60, Math.ceil(Math.max(...values, 60) / 10) * 10)
  const x = (outdoor: number) => PAD.left + ((outdoor - outdoorFrom) / (outdoorTo - outdoorFrom)) * (WIDTH - PAD.left - PAD.right)
  const y = (flow: number) => HEIGHT - PAD.bottom - ((flow - yMin) / (yMax - yMin)) * (HEIGHT - PAD.top - PAD.bottom)
  const path = (segments: { outdoor: number; flow: number }[][]) =>
    segments
      .map((segment) => segment.map((point, index) => `${index === 0 ? 'M' : 'L'}${x(point.outdoor).toFixed(1)},${y(point.flow).toFixed(1)}`).join(''))
      .join('')
  const xTicks: number[] = []
  for (let tick = Math.ceil(outdoorFrom / 5) * 5; tick <= outdoorTo; tick += 5) xTicks.push(tick)
  const yTicks: number[] = []
  for (let tick = yMin; tick <= yMax; tick += 10) yTicks.push(tick)
  const readoutFlow = flowAt(tool.model, settings, readout).flow

  return (
    <svg
      viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      className="mt-3 w-full rounded-2xl border-2 border-line bg-surface"
      role="img"
      aria-label="Diagramm der Heizkurve: Vorlauftemperatur über der Außentemperatur"
    >
      {tool.bands.map((band) => (
        <g key={band.label}>
          <rect
            x={x(Math.max(band.from, outdoorFrom))}
            y={PAD.top}
            width={x(Math.min(band.to, outdoorTo)) - x(Math.max(band.from, outdoorFrom))}
            height={HEIGHT - PAD.top - PAD.bottom}
            className="fill-brand/15"
          />
          <text
            x={(x(Math.max(band.from, outdoorFrom)) + x(Math.min(band.to, outdoorTo))) / 2}
            y={PAD.top + 12}
            textAnchor="middle"
            className="fill-muted text-[12px]"
          >
            {band.label}
          </text>
        </g>
      ))}
      {yTicks.map((tick) => (
        <g key={`y${tick}`}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(tick)} y2={y(tick)} className="stroke-line" strokeWidth={0.5} />
          <text x={PAD.left - 4} y={y(tick) + 3} textAnchor="end" className="fill-ink text-[12px]">
            {tick}
          </text>
        </g>
      ))}
      {xTicks.map((tick) => (
        <g key={`x${tick}`}>
          <line x1={x(tick)} x2={x(tick)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-line" strokeWidth={0.5} />
          <text x={x(tick)} y={HEIGHT - PAD.bottom + 12} textAnchor="middle" className="fill-ink text-[12px]">
            {tick}
          </text>
        </g>
      ))}
      <text x={(PAD.left + WIDTH - PAD.right) / 2} y={HEIGHT - 4} textAnchor="middle" className="fill-ink text-[12px]">
        Außentemperatur in °C
      </text>
      <text x={10} y={HEIGHT / 2} textAnchor="middle" transform={`rotate(-90 10 ${HEIGHT / 2})`} className="fill-ink text-[12px]">
        Vorlauf in °C
      </text>
      {settings.maxFlow !== null && settings.maxFlow <= yMax && (
        <g>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(settings.maxFlow)} y2={y(settings.maxFlow)} className="stroke-warn-ink" strokeWidth={2} strokeDasharray="6 3" />
          <text x={PAD.left + 4} y={y(settings.maxFlow) - 6} textAnchor="start" className={LIMIT_LABEL} strokeWidth={4} paintOrder="stroke">
            Max. {format(settings.maxFlow)} °C
          </text>
        </g>
      )}
      {settings.minFlow !== null && settings.minFlow >= yMin && (
        <g>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y(settings.minFlow)} y2={y(settings.minFlow)} className="stroke-warn-ink" strokeWidth={2} strokeDasharray="6 3" />
          <text x={PAD.left + 4} y={y(settings.minFlow) + 15} textAnchor="start" className={LIMIT_LABEL} strokeWidth={4} paintOrder="stroke">
            Min. {format(settings.minFlow)} °C
          </text>
        </g>
      )}
      {settings.heatingLimit !== null && settings.heatingLimit >= outdoorFrom && settings.heatingLimit <= outdoorTo && (
        <g>
          <line x1={x(settings.heatingLimit)} x2={x(settings.heatingLimit)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-warn-ink" strokeWidth={2} strokeDasharray="2 3" />
          <text
            x={x(settings.heatingLimit) - 5}
            y={PAD.top + 4}
            textAnchor="end"
            transform={`rotate(-90 ${x(settings.heatingLimit) - 5} ${PAD.top + 4})`}
            className={LIMIT_LABEL}
            strokeWidth={4}
            paintOrder="stroke"
          >
            Heizgrenze {format(settings.heatingLimit)} °C
          </text>
        </g>
      )}
      {baseline.length > 0 && <path d={path(baseline)} fill="none" className="stroke-muted" strokeWidth={2} strokeDasharray="6 4" />}
      {reduced.length > 0 && <path d={path(reduced)} fill="none" className="stroke-brand" strokeWidth={2} strokeDasharray="1 3" strokeLinecap="round" />}
      <path d={path(current)} fill="none" className="stroke-accent" strokeWidth={3.5} strokeLinejoin="round" />
      {points &&
        endOutdoor !== undefined &&
        [
          { outdoor: tool.twoPoint.footOutdoor, flow: points.foot, label: 'Fußpunkt', anchor: 'end' as const },
          { outdoor: endOutdoor, flow: points.end, label: 'Endpunkt', anchor: 'start' as const },
        ]
          .filter((point) => point.outdoor >= outdoorFrom && point.outdoor <= outdoorTo && point.flow >= yMin && point.flow <= yMax)
          .map((point) => (
            <g key={point.label}>
              <circle cx={x(point.outdoor)} cy={y(point.flow)} r={7} className="fill-surface stroke-accent" strokeWidth={3} />
              <text
                x={x(point.outdoor) + (point.anchor === 'start' ? 10 : -10)}
                y={y(point.flow) - 10}
                textAnchor={point.anchor}
                className="fill-ink text-[12px] font-bold"
              >
                {point.label} {format(point.flow)} °C
              </text>
            </g>
          ))}
      <line x1={x(readout)} x2={x(readout)} y1={PAD.top} y2={HEIGHT - PAD.bottom} className="stroke-ink" strokeWidth={1} />
      {readoutFlow !== null && <circle cx={x(readout)} cy={y(readoutFlow)} r={5} className="fill-accent stroke-ink" strokeWidth={1.5} />}
    </svg>
  )
}

function Legend({
  showBase,
  showReduced,
  showLimits,
  showHeatingLimit,
}: {
  showBase: boolean
  showReduced: boolean
  showLimits: boolean
  showHeatingLimit: boolean
}) {
  const item = (dash: string, className: string, width: number, label: string) => (
    <li className="flex items-center gap-2">
      <svg width="32" height="10" aria-hidden="true">
        <line x1="0" x2="32" y1="5" y2="5" className={className} strokeWidth={width} strokeDasharray={dash} strokeLinecap="round" />
      </svg>
      {label}
    </li>
  )
  return (
    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-base">
      {item('', 'stroke-accent', 3.5, 'Neue Einstellung')}
      {showBase && item('6 4', 'stroke-muted', 2, 'Ausgang')}
      {showReduced && item('1 3', 'stroke-brand', 2, 'Absenkbetrieb')}
      {showLimits && item('6 3', 'stroke-warn-ink', 2, 'Max./Min.-Begrenzung')}
      {showHeatingLimit && item('2 3', 'stroke-warn-ink', 2, 'Heizgrenze')}
    </ul>
  )
}

function flowText(result: { flow: number | null; limitedBy: 'max' | 'min' | null }) {
  if (result.flow === null) return 'aus'
  const suffix = result.limitedBy === 'max' ? ' (begrenzt)' : result.limitedBy === 'min' ? ' (Minimum)' : ''
  return `${format(result.flow)} °C${suffix}`
}

/** Was die Änderung bewirkt: Vergleich an typischen Außentemperaturen und Erklärung */
function EffectSection({ tool, base, settings }: { tool: HeatingCurveTool; base: CurveSettings; settings: CurveSettings }) {
  const changed = changedParameters(base, settings)
  const rows = comparePoints(tool, base, settings)
  const sentences: string[] = []
  const withDelta = rows.filter((row) => row.delta !== null)
  if (changed.length > 0 && withDelta.length >= 2) {
    const coldest = withDelta[0]!
    const mildest = withDelta[withDelta.length - 1]!
    const cold = coldest.delta!
    const mild = mildest.delta!
    const word = (delta: number) => (delta > 0 ? 'höher' : 'niedriger')
    if (Math.abs(cold) < 0.5 && Math.abs(mild) < 0.5) {
      sentences.push('Der Vorlauf ändert sich an den Vergleichspunkten praktisch nicht.')
    } else if (Math.sign(cold) !== Math.sign(mild) && Math.abs(cold) >= 0.5 && Math.abs(mild) >= 0.5) {
      sentences.push(
        `Die Kurve dreht sich: Bei ${format(coldest.outdoor)} °C (${coldest.label}) liegt der Vorlauf ${format(Math.abs(cold), 1)} K ${word(cold)}, bei ${format(mildest.outdoor)} °C (${mildest.label}) ${format(Math.abs(mild), 1)} K ${word(mild)}.`,
      )
    } else if (Math.abs(cold - mild) <= 1) {
      sentences.push(`Der Vorlauf ändert sich gleichmäßig um etwa ${signed((cold + mild) / 2)} K – bei Kälte wie in der Übergangszeit.`)
    } else if (Math.abs(cold) > Math.abs(mild)) {
      sentences.push(
        `Die Änderung wirkt vor allem bei Kälte: ${signed(cold)} K bei ${format(coldest.outdoor)} °C, aber nur ${signed(mild)} K bei ${format(mildest.outdoor)} °C.`,
      )
    } else {
      sentences.push(
        `Die Änderung wirkt vor allem in der Übergangszeit: ${signed(mild)} K bei ${format(mildest.outdoor)} °C, aber nur ${signed(cold)} K bei ${format(coldest.outdoor)} °C.`,
      )
    }
  }
  if (changed.includes('heatingLimit')) {
    const before = base.heatingLimit
    const after = settings.heatingLimit
    if (after === null) sentences.push('Ohne Heizgrenze bleibt der Heizbetrieb auch bei milden Außentemperaturen an.')
    else if (before === null) sentences.push(`Über ${format(after)} °C Außentemperatur schaltet der Heizbetrieb jetzt ab.`)
    else
      sentences.push(
        `Der Heizbetrieb endet jetzt bei ${format(after)} °C statt ${format(before)} °C – die Heizung läuft ${after > before ? 'länger' : 'kürzer'} in die Übergangszeit hinein.`,
      )
  }
  const { outdoorFrom, outdoorTo } = tool.chart
  if (settings.maxFlow !== null) {
    const crossing = limitCrossing(tool.model, settings, settings.maxFlow, outdoorFrom, outdoorTo)
    sentences.push(
      crossing === null
        ? `Die Maximalbegrenzung ${format(settings.maxFlow)} °C ${rawFlow(tool.model, settings.neigung, settings.niveau, settings.roomSetpoint, outdoorFrom) > settings.maxFlow ? 'greift im ganzen Bereich' : 'greift zwischen ' + format(outdoorFrom) + ' und ' + format(outdoorTo) + ' °C nicht'}.`
        : `Die Maximalbegrenzung ${format(settings.maxFlow)} °C greift unter etwa ${format(crossing)} °C Außentemperatur: Wird es kälter, steigt der Vorlauf nicht weiter.`,
    )
  }
  if (settings.minFlow !== null) {
    const crossing = limitCrossing(tool.model, settings, settings.minFlow, outdoorFrom, outdoorTo)
    sentences.push(
      crossing === null
        ? `Die Minimalbegrenzung ${format(settings.minFlow)} °C ${rawFlow(tool.model, settings.neigung, settings.niveau, settings.roomSetpoint, outdoorTo) < settings.minFlow ? 'greift im ganzen Bereich' : 'greift zwischen ' + format(outdoorFrom) + ' und ' + format(outdoorTo) + ' °C nicht'}.`
        : `Die Minimalbegrenzung ${format(settings.minFlow)} °C greift über etwa ${format(crossing)} °C Außentemperatur und hebt dort den Vorlauf an.`,
    )
  }
  if (settings.reducedSetpoint !== null) {
    const point = tool.comparePoints[Math.floor(tool.comparePoints.length / 2)]!
    const normal = flowAt(tool.model, settings, point.outdoor)
    const reduced = flowAt(tool.model, settings, point.outdoor, true)
    if (normal.flow !== null && reduced.flow !== null) {
      sentences.push(
        `Im reduzierten Betrieb (Raumsoll ${format(settings.reducedSetpoint, 1)} °C) liegt der Vorlauf bei ${format(point.outdoor)} °C bei ${format(reduced.flow)} °C statt ${format(normal.flow)} °C.`,
      )
    }
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Was bewirkt die Änderung?</h2>
      {changed.length === 0 && (
        <p className="mt-2 text-base text-muted">Gleich wie die Ausgangseinstellung. Ändere oben einen Wert, dann steht hier die Wirkung.</p>
      )}
      <div className="mt-3 overflow-x-auto rounded-2xl border-2 border-line bg-surface">
        <table className="w-full text-left text-base">
          <thead>
            <tr className="border-b-2 border-line">
              <th className="p-2">Außen</th>
              <th className="p-2">Ausgang</th>
              <th className="p-2">Neu</th>
              <th className="p-2">Raum (geschätzt)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-b border-line last:border-0">
                <th scope="row" className="p-2 font-semibold">
                  {row.label}
                  <span className="block text-sm font-normal text-muted">{format(row.outdoor)} °C</span>
                </th>
                <td className="p-2">{flowText(row.before)}</td>
                <td className="p-2 font-bold">
                  {flowText(row.after)}
                  {row.delta !== null && Math.abs(row.delta) >= 0.05 && <span className="block text-sm font-normal">{signed(row.delta)} K</span>}
                </td>
                <td className="p-2">{row.roomDelta === null ? '–' : `${signed(row.roomDelta)} K`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {sentences.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {sentences.map((sentence) => (
            <li key={sentence} className="rounded-xl border-2 border-accent bg-surface p-3 text-base">
              {sentence}
            </li>
          ))}
        </ul>
      )}
      <p className="mt-2 text-sm text-muted">Raum (geschätzt): gilt, wenn die Ausgangskurve zum Gebäude gepasst hat.</p>
    </section>
  )
}

const FIT_ERRORS: Record<Extract<FitResult, { ok: false }>['reason'], string> = {
  samePoint: 'Die beiden Punkte liegen zu dicht beieinander. Zwei deutlich verschiedene Außentemperaturen eingeben.',
  noSlope: 'Bei dieser Außentemperatur wirkt die Neigung kaum. Eine kältere Außentemperatur wählen oder das Niveau ändern.',
  tooMany: 'Höchstens zwei Punkte.',
  none: 'Werte eingeben.',
}

/** Empfehlung mit Kontrolle an den Punkten und Übernehmen-Knopf */
function RecommendationCard({
  tool,
  settings,
  title,
  fit,
  observations,
  onApply,
  endOutdoor,
}: {
  tool: HeatingCurveTool
  settings: CurveSettings
  title: string
  fit: FitResult
  observations: readonly CurveObservation[]
  onApply: (recommendation: Recommendation) => void
  /** Gesetzt: Einstellart Fußpunkt/Endpunkt, Empfehlung als Punkte zeigen */
  endOutdoor?: number
}) {
  if (!fit.ok) return <p className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink">{FIT_ERRORS[fit.reason]}</p>
  // Zwei Punkte: Niveau nach dem Runden der Neigung neu anpassen
  const recommendation = toRecommendation(tool, fit, observations.length === 2 ? observations : [])
  const next = { ...settings, neigung: recommendation.neigung, niveau: recommendation.niveau }
  const neigungDecimals = decimalsOf(tool.parameters.neigung.step)
  const same = recommendation.neigung === settings.neigung && recommendation.niveau === settings.niveau
  const pointsNow = endOutdoor !== undefined ? pointsFromSettings(tool, settings, endOutdoor) : null
  const pointsNext = endOutdoor !== undefined ? pointsFromSettings(tool, next, endOutdoor) : null
  return (
    <div className="mt-3 rounded-2xl border-2 border-accent bg-surface p-4">
      <h4 className="text-lg font-bold">{title}</h4>
      {pointsNow && pointsNext ? (
        <dl className="mt-2 grid grid-cols-2 gap-3">
          <div>
            <dt className="text-base">Fußpunkt</dt>
            <dd className="text-2xl font-bold">{format(pointsNext.foot)} °C</dd>
            <dd className="text-sm text-muted">jetzt {format(pointsNow.foot)} °C</dd>
          </div>
          <div>
            <dt className="text-base">Endpunkt ({format(endOutdoor!)} °C)</dt>
            <dd className="text-2xl font-bold">{format(pointsNext.end)} °C</dd>
            <dd className="text-sm text-muted">jetzt {format(pointsNow.end)} °C</dd>
          </div>
        </dl>
      ) : (
      <dl className="mt-2 grid grid-cols-2 gap-3">
        <div>
          <dt className="text-base">Neigung</dt>
          <dd className="text-2xl font-bold">{format(recommendation.neigung, neigungDecimals)}</dd>
          <dd className="text-sm text-muted">jetzt {format(settings.neigung, neigungDecimals)}</dd>
        </div>
        <div>
          <dt className="text-base">Niveau</dt>
          <dd className="text-2xl font-bold">{signed(recommendation.niveau, 0)} K</dd>
          <dd className="text-sm text-muted">jetzt {signed(settings.niveau, 0)} K</dd>
        </div>
      </dl>
      )}
      {recommendation.outOfRange && (
        <p className="mt-2 rounded-xl border-2 border-warn-ink bg-warn p-2 text-base font-semibold text-warn-ink">
          Errechnet: Neigung {format(recommendation.exactNeigung, 2)}, Niveau {format(recommendation.exactNiveau, 1)} K – außerhalb des
          Einstellbereichs, auf die Grenze gesetzt. Eingaben prüfen; oft liegt die Ursache woanders (Abgleich, Heizfläche, Wärmeerzeuger).
        </p>
      )}
      <ul className="mt-2 text-base">
        {observations.map((observation) => {
          const rounded = rawFlow(tool.model, next.neigung, next.niveau, settings.roomSetpoint, observation.outdoor)
          const exact = rawFlow(tool.model, fit.neigung, fit.niveau, settings.roomSetpoint, observation.outdoor)
          return (
            <li key={`${observation.outdoor}-${observation.room}`}>
              Bei {format(observation.outdoor)} °C: Vorlauf {format(rounded, 1)} °C
              {Math.abs(rounded - exact) >= 0.5 && (
                <span className="text-muted"> (genau gerechnet {format(exact, 1)} °C, Rest durch Einstellschritte)</span>
              )}
            </li>
          )
        })}
      </ul>
      {same ? (
        <p className="mt-3 text-base">Entspricht der jetzigen Einstellung.</p>
      ) : (
        <button type="button" onClick={() => onApply(recommendation)} className={`${primaryButton} mt-3 w-full sm:w-auto`}>
          Übernehmen und Wirkung zeigen
        </button>
      )}
    </div>
  )
}

/** Zeile mit zwei Zahlenfeldern (Außentemperatur + Wert) */
function PointRow({
  index,
  secondLabel,
  value,
  onChange,
}: {
  index: number
  secondLabel: string
  value: [string, string]
  onChange: (value: [string, string]) => void
}) {
  const id = useId()
  return (
    <fieldset className="mt-3 rounded-xl border-2 border-line p-3">
      <legend className="px-1 font-semibold">Punkt {index + 1}{index === 1 ? ' (optional)' : ''}</legend>
      <div className="flex flex-wrap gap-4">
        <div>
          <label htmlFor={`${id}-outdoor`} className="block text-base">
            Außentemperatur
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${id}-outdoor`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={value[0]}
              onChange={(event) => onChange([event.target.value, value[1]])}
              className={`${fieldBase} w-24`}
            />
            <span className="text-lg">°C</span>
          </div>
        </div>
        <div>
          <label htmlFor={`${id}-value`} className="block text-base">
            {secondLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${id}-value`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={value[1]}
              onChange={(event) => onChange([value[0], event.target.value])}
              className={`${fieldBase} w-24`}
            />
            <span className="text-lg">°C</span>
          </div>
        </div>
      </div>
    </fieldset>
  )
}

type FinderMode = 'symptom' | 'measurement' | 'target'
const FINDER_MODES: { key: FinderMode; label: string }[] = [
  { key: 'symptom', label: 'Problem beschreiben' },
  { key: 'measurement', label: 'Messung eintragen' },
  { key: 'target', label: 'Wunsch-Vorlauf' },
]

type PointRows = [[string, string], [string, string]]
const EMPTY_ROWS: PointRows = [
  ['', ''],
  ['', ''],
]

function readRows(rows: PointRows): { pairs: [number, number][]; incomplete: boolean } {
  const pairs: [number, number][] = []
  let incomplete = false
  for (const [first, second] of rows) {
    if (first.trim() === '' && second.trim() === '') continue
    const a = parseDecimal(first)
    const b = parseDecimal(second)
    if (a === undefined || b === undefined) incomplete = true
    else pairs.push([a, b])
  }
  return { pairs, incomplete }
}

/** Einstellung finden: aus Problem, Messung oder Wunsch-Vorlauf Neigung und Niveau zurückrechnen */
function FinderSection({
  tool,
  settings,
  onApply,
  initialMode,
  initialSymptom,
  initialDeviation,
  initialRows,
  endOutdoor,
}: {
  tool: HeatingCurveTool
  settings: CurveSettings
  onApply: (recommendation: Recommendation) => void
  initialMode: FinderMode
  initialSymptom: string
  initialDeviation: number
  initialRows: PointRows
  /** Gesetzt: Einstellart Fußpunkt/Endpunkt; „Wunsch-Vorlauf“ entfällt, weil man die Punkte oben direkt einstellt */
  endOutdoor?: number
}) {
  const [chosenMode, setMode] = useState<FinderMode>(initialMode)
  const modes = endOutdoor === undefined ? FINDER_MODES : FINDER_MODES.filter((candidate) => candidate.key !== 'target')
  const mode = modes.some((candidate) => candidate.key === chosenMode) ? chosenMode : modes[0]!.key
  const [symptomKey, setSymptomKey] = useState(initialSymptom)
  const [deviation, setDeviation] = useState(initialDeviation)
  const [measurementRows, setMeasurementRows] = useState<PointRows>(initialMode === 'measurement' ? initialRows : EMPTY_ROWS)
  const [targetRows, setTargetRows] = useState<PointRows>(initialMode === 'target' ? initialRows : EMPTY_ROWS)
  const symptom = tool.symptoms.find((candidate) => candidate.key === symptomKey)
  const neigungLabel = (direction: 'up' | 'down' | 'keep') => (direction === 'up' ? 'erhöhen' : direction === 'down' ? 'senken' : '')

  const pointResults = (rows: PointRows, toObservation: (outdoor: number, value: number) => CurveObservation | string) => {
    const { pairs, incomplete } = readRows(rows)
    if (incomplete) return <p className="mt-3 text-base font-semibold">Zahlen eingeben (z. B. −5 oder 21,5).</p>
    if (pairs.length === 0) return <p className="mt-3 text-base text-muted">Mindestens einen Punkt eingeben.</p>
    const observations: CurveObservation[] = []
    for (const [outdoor, value] of pairs) {
      const observation = toObservation(outdoor, value)
      if (typeof observation === 'string') return <p className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink">{observation}</p>
      observations.push(observation)
    }
    if (observations.length === 2) {
      return (
        <RecommendationCard
          tool={tool}
          settings={settings}
          title="Empfehlung: Neigung und Niveau"
          fit={fitCurve(tool.model, observations, settings, 'both')}
          observations={observations}
          onApply={onApply}
          endOutdoor={endOutdoor}
        />
      )
    }
    return (
      <>
        <p className="mt-3 text-base">Mit einem Punkt lässt sich nur ein Wert bestimmen – zwei Möglichkeiten:</p>
        <RecommendationCard
          tool={tool}
          settings={settings}
          title="Nur Niveau ändern"
          fit={fitCurve(tool.model, observations, settings, 'niveau')}
          observations={observations}
          onApply={onApply}
          endOutdoor={endOutdoor}
        />
        <RecommendationCard
          tool={tool}
          settings={settings}
          title="Nur Neigung ändern"
          fit={fitCurve(tool.model, observations, settings, 'neigung')}
          observations={observations}
          onApply={onApply}
          endOutdoor={endOutdoor}
        />
        <p className="mt-2 text-sm text-muted">
          Faustregel: liegt der Punkt in der Übergangszeit, eher das Niveau ändern; liegt er bei Kälte, eher die Neigung. Ein zweiter Punkt
          legt beide Werte fest.
        </p>
      </>
    )
  }

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Einstellung finden</h2>
      <p className="mt-1 text-base">Ausgangspunkt ist die Einstellung oben. Die Empfehlung lässt sich übernehmen, dann zeigt das Tool die Wirkung.</p>
      <div role="group" aria-label="Art der Eingabe" className="mt-3 grid gap-2 sm:grid-cols-3">
        {modes.map((candidate) => {
          const active = candidate.key === mode
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={active}
              onClick={() => setMode(candidate.key)}
              className={`min-h-14 rounded-xl border-2 px-3 py-2 font-semibold ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`}
            >
              <span aria-hidden="true">{active ? '✓ ' : ''}</span>
              {candidate.label}
            </button>
          )
        })}
      </div>

      <div aria-live="polite">
        {mode === 'symptom' && (
          <div className="mt-4">
            <p className="font-semibold">Was ist das Problem?</p>
            <div role="group" aria-label="Problem" className="mt-2 grid gap-2 sm:grid-cols-2">
              {tool.symptoms.map((candidate) => {
                const active = candidate.key === symptomKey
                return (
                  <button
                    key={candidate.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setSymptomKey(candidate.key)}
                    className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left font-semibold ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`}
                  >
                    <span aria-hidden="true">{active ? '✓ ' : ''}</span>
                    {candidate.label}
                  </button>
                )
              })}
            </div>
            {symptom && (
              <>
                <div className="mt-4 rounded-xl border-2 border-line bg-surface p-3">
                  <p className="font-semibold">Regel</p>
                  <p className="text-base">{symptom.text}</p>
                  <p className="mt-1 text-base">
                    {[
                      symptom.neigung !== 'keep' ? `Neigung ${neigungLabel(symptom.neigung)}` : '',
                      symptom.niveau !== 'keep' ? `Niveau ${neigungLabel(symptom.niveau)}` : '',
                    ]
                      .filter(Boolean)
                      .join(', ')}
                  </p>
                  <Source tool={tool} refValue={symptom.ref} />
                </div>
                <div className="mt-4">
                  <Stepper
                    label={`Wie viel zu ${symptom.cold + symptom.transition < 0 ? 'kalt' : 'warm'}?`}
                    unit="K"
                    value={deviation}
                    min={0.5}
                    max={5}
                    step={0.5}
                    onChange={setDeviation}
                  />
                </div>
                <RecommendationCard
                  tool={tool}
                  settings={settings}
                  title="Errechnete Einstellung"
                  fit={fitCurve(tool.model, symptomObservations(tool, settings, symptom, deviation), settings, 'both')}
                  observations={symptomObservations(tool, settings, symptom, deviation)}
                  onApply={onApply}
          endOutdoor={endOutdoor}
                />
                <p className="mt-2 text-sm text-muted">{tool.symptomPoints.text}</p>
              </>
            )}
          </div>
        )}

        {mode === 'measurement' && (
          <div className="mt-4">
            <p className="text-base">
              Bei geöffneten Thermostatventilen gemessen, mit der Einstellung oben. Ziel ist das Raumsoll ({format(settings.roomSetpoint, 1)} °C).
              Außentemperatur so, wie der Regler sie anzeigt.
            </p>
            {measurementRows.map((row, index) => (
              <PointRow
                key={index}
                index={index}
                secondLabel="Raumtemperatur gemessen"
                value={row}
                onChange={(value) =>
                  setMeasurementRows((rows) => (index === 0 ? [value, rows[1]] : [rows[0], value]) as PointRows)
                }
              />
            ))}
            {pointResults(measurementRows, (outdoor, room) => {
              const delivered = flowAt(tool.model, settings, outdoor)
              if (delivered.flow === null) return `Bei ${format(outdoor)} °C ist der Heizbetrieb laut Heizgrenze aus – keine Aussage möglich.`
              return { outdoor, flow: delivered.flow, room }
            })}
            <Source tool={tool} refValue={tool.model.fitExamples[0]?.ref ?? tool.model.ref} />
          </div>
        )}

        {mode === 'target' && (
          <div className="mt-4">
            <p className="text-base">
              Gewünschten Vorlauf bei einer oder zwei Außentemperaturen eingeben, z. B. Fußpunkt und Auslegungspunkt aus den Unterlagen der
              Anlage. Raumsoll bleibt {format(settings.roomSetpoint, 1)} °C.
            </p>
            {targetRows.map((row, index) => (
              <PointRow
                key={index}
                index={index}
                secondLabel="Vorlauf gewünscht"
                value={row}
                onChange={(value) => setTargetRows((rows) => (index === 0 ? [value, rows[1]] : [rows[0], value]) as PointRows)}
              />
            ))}
            {pointResults(targetRows, (outdoor, flow) => ({ outdoor, flow, room: settings.roomSetpoint }))}
          </div>
        )}
      </div>
    </section>
  )
}

/** Einstellart: Neigung/Niveau oder Fußpunkt/Endpunkt; beide stellen dieselbe Kurve dar */
type SettingMode = 'slope' | 'points'
const SETTING_MODES: { key: SettingMode; label: string }[] = [
  { key: 'slope', label: 'Neigung / Niveau' },
  { key: 'points', label: 'Fußpunkt / Endpunkt' },
]

/** Heizkurve simulieren: Diagramm, Einstellung, Wirkung, Einstellung finden, Hinweise */
export function HeatingCurveSimulator({
  tool,
  initialSettings = {},
  initialBase = {},
  initialMode = 'symptom',
  initialSymptom = '',
  initialDeviation = 1,
  initialRows = EMPTY_ROWS,
  initialSettingMode = 'slope',
}: {
  tool: HeatingCurveTool
  initialSettingMode?: SettingMode
  /** Vorgaben (Tests) */
  initialSettings?: Partial<CurveSettings>
  initialBase?: Partial<CurveSettings>
  initialMode?: FinderMode
  initialSymptom?: string
  initialDeviation?: number
  initialRows?: PointRows
}) {
  const [base, setBase] = useState<CurveSettings>(() => ({ ...defaultSettings(tool), ...initialBase }))
  const [settings, setSettings] = useState<CurveSettings>(() => ({ ...defaultSettings(tool), ...initialBase, ...initialSettings }))
  const comparePoint = tool.comparePoints[Math.floor(tool.comparePoints.length / 2)]!
  const [readout, setReadout] = useState(comparePoint.outdoor)
  const readoutId = useId()
  const changed = changedParameters(base, settings).length > 0
  const now = flowAt(tool.model, settings, readout)
  const before = flowAt(tool.model, base, readout)
  const reduced = settings.reducedSetpoint !== null ? flowAt(tool.model, settings, readout, true) : null
  const { outdoorFrom, outdoorTo } = tool.chart
  const mainParameters: CurveParameterKey[] = ['neigung', 'niveau', 'roomSetpoint']
  const extraParameters: CurveParameterKey[] = ['reducedSetpoint', 'maxFlow', 'minFlow', 'heatingLimit']
  const [settingMode, setSettingMode] = useState<SettingMode>(initialSettingMode)
  const [endOutdoor, setEndOutdoor] = useState(tool.twoPoint.endOutdoor.default)
  const [pointWarning, setPointWarning] = useState('')
  const usePoints = settingMode === 'points'
  const points = pointsFromSettings(tool, settings, endOutdoor)
  const { twoPoint } = tool
  /** Fußpunkt oder Endpunkt geändert: Neigung und Niveau so, dass die Kurve durch beide Punkte geht */
  const setPoints = (foot: number, end: number) => {
    const fit = settingsFromPoints(tool, settings, foot, end, endOutdoor)
    const { neigung, niveau } = tool.parameters
    if (!fit.ok || fit.neigung < neigung.min || fit.neigung > neigung.max || fit.niveau < niveau.min || fit.niveau > niveau.max) {
      setPointWarning('Mit diesen Punkten liegt die Kurve außerhalb des Einstellbereichs. Der Endpunkt muss deutlich über dem Fußpunkt liegen.')
      return
    }
    setPointWarning('')
    setSettings({ ...settings, neigung: fit.neigung, niveau: fit.niveau })
  }

  return (
    <section>

      <h2 className="mt-6 text-xl font-bold">Heizkurve</h2>
      <CurveChart tool={tool} settings={settings} base={base} readout={readout} endOutdoor={usePoints ? endOutdoor : undefined} />
      <Legend
        showBase={changed}
        showReduced={settings.reducedSetpoint !== null}
        showLimits={settings.maxFlow !== null || settings.minFlow !== null}
        showHeatingLimit={settings.heatingLimit !== null}
      />

      <div className="mt-4">
        <label htmlFor={readoutId} className="block font-semibold">
          Ablesen bei {format(readout)} °C Außentemperatur
        </label>
        <input
          id={readoutId}
          type="range"
          min={outdoorFrom}
          max={outdoorTo}
          step={1}
          value={readout}
          onChange={(event) => setReadout(Number(event.target.value))}
          className="mt-2 h-10 w-full accent-accent"
        />
        <p className="text-lg" aria-live="polite">
          Vorlauf: <strong>{flowText(now)}</strong>
          {changed && <span> (Ausgang {flowText(before)})</span>}
          {reduced && <span>, reduziert {flowText(reduced)}</span>}
        </p>
        {!usePoints && (
          <p className="text-base text-muted">
            Entspricht Fußpunkt {format(points.foot)} °C (bei {format(twoPoint.footOutdoor)} °C) und Endpunkt {format(points.end)} °C (bei{' '}
            {format(endOutdoor)} °C)
          </p>
        )}
      </div>

      <h2 className="mt-8 text-xl font-bold">Einstellung</h2>
      <div role="group" aria-label="Einstellart" className="mt-3 grid grid-cols-2 gap-2">
        {SETTING_MODES.map((candidate) => {
          const active = candidate.key === settingMode
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setSettingMode(candidate.key)
                setPointWarning('')
              }}
              className={`min-h-14 rounded-xl border-2 px-3 py-2 font-semibold ${active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'}`}
            >
              <span aria-hidden="true">{active ? '✓ ' : ''}</span>
              {candidate.label}
            </button>
          )
        })}
      </div>
      {usePoints ? (
        <>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border-2 border-line bg-surface p-3">
              <Stepper
                label={twoPoint.foot.label}
                unit="°C"
                value={roundToStep(points.foot, twoPoint.foot.step)}
                min={twoPoint.foot.min}
                max={twoPoint.foot.max}
                step={twoPoint.foot.step}
                onChange={(foot) => setPoints(foot, points.end)}
              />
              <Help text={twoPoint.foot.text} />
            </div>
            <div className="rounded-2xl border-2 border-line bg-surface p-3">
              <Stepper
                label={twoPoint.end.label}
                unit="°C"
                value={roundToStep(points.end, twoPoint.end.step)}
                min={twoPoint.end.min}
                max={twoPoint.end.max}
                step={twoPoint.end.step}
                onChange={(end) => setPoints(points.foot, end)}
              />
              <Help text={twoPoint.end.text} />
              <div className="mt-3">
                <Stepper
                  label={twoPoint.endOutdoor.label}
                  unit="°C"
                  value={endOutdoor}
                  min={twoPoint.endOutdoor.min}
                  max={twoPoint.endOutdoor.max}
                  step={twoPoint.endOutdoor.step}
                  onChange={setEndOutdoor}
                />
                <Help text={twoPoint.endOutdoor.text} />
              </div>
            </div>
            <ParameterControl tool={tool} name="roomSetpoint" settings={settings} onChange={setSettings} />
          </div>
          {pointWarning && (
            <p className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink" role="alert">
              {pointWarning}
            </p>
          )}
          <p className="mt-2 text-base text-muted">
            Entspricht Neigung {format(settings.neigung, 2)} und Niveau {signed(settings.niveau)} K.
          </p>
          <details className="mt-1">
            <summary className="min-h-10 cursor-pointer py-2 text-sm font-semibold text-muted">Wie rechnet das Tool?</summary>
            <p className="text-sm">{twoPoint.text}</p>
            <Source tool={tool} refValue={twoPoint.ref} />
          </details>
        </>
      ) : (
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {mainParameters.map((name) => (
            <ParameterControl key={name} tool={tool} name={name} settings={settings} onChange={setSettings} />
          ))}
        </div>
      )}
      <details className="mt-3 rounded-2xl border-2 border-line bg-surface px-4" open={extraParameters.some((name) => settings[name] !== null)}>
        <summary className="min-h-14 cursor-pointer py-3 text-lg font-bold">Absenkung, Begrenzung, Heizgrenze</summary>
        <div className="grid gap-3 pb-4 sm:grid-cols-2">
          {extraParameters.map((name) => (
            <ParameterControl key={name} tool={tool} name={name} settings={settings} onChange={setSettings} />
          ))}
        </div>
      </details>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" disabled={!changed} onClick={() => setBase(settings)} className={secondaryButton}>
          Als Ausgang merken
        </button>
        <button type="button" disabled={!changed} onClick={() => setSettings(base)} className={secondaryButton}>
          Zurück zum Ausgang
        </button>
      </div>

      <EffectSection tool={tool} base={base} settings={settings} />

      <FinderSection
        tool={tool}
        settings={settings}
        onApply={(recommendation) => {
          // Die Wirkung zeigt dann den Schritt von der bisherigen zur empfohlenen Einstellung
          setBase(settings)
          setSettings({ ...settings, neigung: recommendation.neigung, niveau: recommendation.niveau })
        }}
        initialMode={initialMode}
        initialSymptom={initialSymptom}
        initialDeviation={initialDeviation}
        initialRows={initialRows}
        endOutdoor={usePoints ? endOutdoor : undefined}
      />

      {tool.infos.length > 0 && (
        <details className="mt-8 rounded-2xl border-2 border-line bg-surface px-4">
          <summary className="min-h-14 cursor-pointer py-3 text-lg font-bold">Wichtig beim Einstellen</summary>
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
        <summary className="min-h-14 cursor-pointer py-3 text-lg font-bold">Rechenweg</summary>
        <div className="pb-4">
          <p className="font-semibold">{tool.model.name}</p>
          <CurveFormula model={tool.model} />
          <p className="mt-2 text-base">{renderSymbol(tool.model.text)}</p>
          <Source tool={tool} refValue={tool.model.ref} />
        </div>
      </details>

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
