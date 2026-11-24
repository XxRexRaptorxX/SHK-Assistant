import { useId, useState } from 'react'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { fieldBase } from '../../components/surfaces'
import { math } from '../../lib/math'
import { createStoredState } from '../../lib/storedState'
import { formatUnit } from '../../lib/units'
import { formatNumber, parseDecimal } from '../../lib/number'
import { SelectionBar } from './ChoiceLookup'
import { formatRounded } from './RefrigerantLookup'
import {
  lookupSensor,
  sensorPoints,
  sensorTrend,
  type SensorLookup as Lookup,
  type SensorPoint,
  type SensorQuantity,
  type SensorTool,
  type SensorTrend,
} from './sensorTool'

// Zuletzt gewählter Fühler: Im Kundendienst ist es oft derselbe Gerätetyp wie beim letzten Mal.
export const SENSOR_STORAGE_KEY = 'shk-sensor'

const lastSensor = createStoredState<string>({
  key: SENSOR_STORAGE_KEY,
  read: () => {
    try {
      return globalThis.localStorage?.getItem(SENSOR_STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(SENSOR_STORAGE_KEY, value)
    } catch {
      // ohne Speicher gilt die Auswahl bis zum Neuladen
    }
  },
  fallback: '',
})

const TEMPERATURE_UNIT = '°C'
const card = 'rounded-2xl border-2 border-accent bg-surface p-4'

/** Rechenrichtung: Eingabe Temperatur oder gemessener Widerstand */
const MODES: { key: SensorQuantity; label: string; note: string }[] = [
  { key: 'temperature', label: 'Temperatur', note: '→ Widerstand' },
  { key: 'resistance', label: 'Widerstand', note: '→ Temperatur' },
]

/** Multiplikator der Eingabe: Messgeräte zeigen hohe Werte meist in kΩ */
type ResistanceScale = 'base' | 'kilo'

/** Temperatureinheit für Eingabe und Ergebnis (mathjs-Namen); die Tabelle bleibt in °C wie in der Quelle */
export type TemperatureUnit = 'degC' | 'degF' | 'K'
const TEMPERATURE_UNITS: TemperatureUnit[] = ['degC', 'degF', 'K']

/** Temperatur von einer Einheit in eine andere, über mathjs */
const convertTemperature = (value: number, from: TemperatureUnit, to: TemperatureUnit) =>
  from === to ? value : math.unit(value, from).toNumber(to)

const TREND_TEXT: Record<SensorTrend, { title: string; text: string }> = {
  rising: {
    title: 'Widerstand steigt mit der Temperatur',
    text: 'Wärmer = höherer Widerstand (positiver Temperaturkoeffizient, Kaltleiter).',
  },
  falling: {
    title: 'Widerstand sinkt mit steigender Temperatur',
    text: 'Wärmer = niedrigerer Widerstand (negativer Temperaturkoeffizient, Heißleiter).',
  },
}

/** Nachkommastellen der Tabellenwerte eines Fühlers, z. B. 1 bei 109,7 Ω */
const tableDecimals = (points: readonly SensorPoint[]) =>
  Math.max(...points.map((point) => (String(point.resistance).split('.')[1] ?? '').length))

type Calculation = { kind: 'empty' } | { kind: 'invalid' } | { kind: 'result'; lookup: Lookup }

/** toBase rechnet die Eingabe in die Tabelleneinheit um (Ω bzw. °C) */
function calculate(points: readonly SensorPoint[], given: SensorQuantity, raw: string, toBase: (value: number) => number): Calculation {
  if (raw.trim() === '') return { kind: 'empty' }
  const value = parseDecimal(raw)
  return value === undefined ? { kind: 'invalid' } : { kind: 'result', lookup: lookupSensor(points, given, toBase(value)) }
}

/** Fühler-Tool: Fühlertyp wählen, Temperatur oder Widerstand eingeben, darunter die ganze Kennlinie */
export function SensorLookup({
  tool,
  initialSensor,
  initialMode = 'temperature',
  initialValue = '',
  initialScale = 'base',
  initialTemperatureUnit = 'degC',
}: {
  tool: SensorTool
  /** Vorauswahl (Tests); sonst der zuletzt gewählte Fühler */
  initialSensor?: string
  initialMode?: SensorQuantity
  initialValue?: string
  initialScale?: ResistanceScale
  initialTemperatureUnit?: TemperatureUnit
}) {
  const idPrefix = useId()
  const stored = lastSensor.useValue()
  const [chosen, setChosen] = useState(initialSensor)
  const [mode, setMode] = useState<SensorQuantity>(initialMode)
  const [scale, setScale] = useState<ResistanceScale>(initialScale)
  const [temperatureUnit, setTemperatureUnit] = useState<TemperatureUnit>(initialTemperatureUnit)
  // Je Richtung eigene Eingabe, damit beim Umschalten kein Widerstand als Temperatur gelesen wird
  const [raw, setRaw] = useState<Record<SensorQuantity, string>>({
    temperature: initialMode === 'temperature' ? initialValue : '',
    resistance: initialMode === 'resistance' ? initialValue : '',
  })

  const name = chosen ?? stored
  const sensor = tool.sensors.find((candidate) => candidate.name === name)
  const points = sensor ? sensorPoints(tool, sensor) : []
  const unit = tool.resistanceUnit
  const kiloUnit = `k${unit}`
  const toBase =
    mode === 'resistance'
      ? (value: number) => (scale === 'kilo' ? value * 1000 : value)
      : (value: number) => convertTemperature(value, temperatureUnit, 'degC')
  const calculation = sensor ? calculate(points, mode, raw[mode], toBase) : { kind: 'empty' as const }
  const lookup = calculation.kind === 'result' ? calculation.lookup : undefined
  const highlighted =
    lookup?.kind === 'exact' ? [lookup.point] : lookup?.kind === 'interpolated' ? [lookup.lower, lookup.upper] : []
  const decimals = points.length > 0 ? tableDecimals(points) : 0
  const trend = points.length > 0 ? sensorTrend(points) : undefined

  const resistance = (value: number) => `${formatRounded(value, decimals)} ${unit}`
  /** Großer Widerstand zusätzlich in kΩ, wie ihn das Messgerät anzeigt */
  const resistanceWithKilo = (value: number) =>
    value >= 1000 ? `${resistance(value)} (${formatRounded(value / 1000, 2)} ${kiloUnit})` : resistance(value)
  const temperature = (value: number, places = 0) => `${formatRounded(value, places)} ${TEMPERATURE_UNIT}`
  /** Ergebnis in der gewählten Einheit, bei °F oder K zusätzlich in °C wie in der Tabelle */
  const chosenTemperature = (celsius: number) =>
    temperatureUnit === 'degC'
      ? temperature(celsius, 1)
      : `${formatRounded(convertTemperature(celsius, 'degC', temperatureUnit), 1)} ${formatUnit(temperatureUnit)} (${temperature(celsius, 1)})`
  const point = (entry: SensorPoint) => `${temperature(entry.temperature)} (${resistance(entry.resistance)})`
  const inputId = `${idPrefix}-value`
  const inputError = calculation.kind === 'invalid'

  const select = (next: string) => {
    setChosen(next)
    lastSensor.set(next)
  }

  return (
    <>
      <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
        <HeadingWithClear
          id={`${idPrefix}-heading`}
          onClear={() => setRaw({ temperature: '', resistance: '' })}
          disabled={raw.temperature === '' && raw.resistance === ''}
        >
          Nachschlagen
        </HeadingWithClear>

        <label htmlFor={`${idPrefix}-sensor`} className="mt-3 block font-semibold">
          Fühlertyp
        </label>
        <select
          id={`${idPrefix}-sensor`}
          value={sensor?.name ?? ''}
          onChange={(event) => select(event.target.value)}
          className={`${fieldBase} mt-1 w-full max-w-xs`}
        >
          <option value="" disabled>
            Fühler wählen …
          </option>
          {tool.sensors.map((candidate) => (
            <option key={candidate.name} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>
        {sensor?.equivalent && <p className="mt-1 text-base text-muted">Kennlinie wie bei: {sensor.equivalent}</p>}

        {trend && (
          <div className="mt-3 rounded-2xl border border-edge bg-raised p-3" data-trend={trend}>
            <p className="font-semibold">
              <span aria-hidden="true">{trend === 'rising' ? '↑ ' : '↓ '}</span>
              {TREND_TEXT[trend].title}
            </p>
            <p className="text-base">{TREND_TEXT[trend].text}</p>
          </div>
        )}

        <SelectionBar
          bar={{ key: 'mode', name: 'Eingabe', options: MODES }}
          selected={mode}
          onSelect={(key) => setMode(key as SensorQuantity)}
        />

        <label htmlFor={inputId} className="mt-4 block font-semibold">
          {mode === 'temperature' ? 'Temperatur' : 'Gemessener Widerstand'}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={inputId}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={raw[mode]}
            aria-invalid={inputError}
            onChange={(event) => setRaw({ ...raw, [mode]: event.target.value })}
            className={`${fieldBase} w-full max-w-40 ${inputError ? 'border-warn-ink outline-2 outline-warn' : ''}`}
          />
          {mode === 'temperature' ? (
            <select
              aria-label="Einheit der Temperatur"
              value={temperatureUnit}
              onChange={(event) => setTemperatureUnit(event.target.value as TemperatureUnit)}
              className={fieldBase}
            >
              {TEMPERATURE_UNITS.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {formatUnit(candidate)}
                </option>
              ))}
            </select>
          ) : (
            <select
              aria-label="Einheit des Widerstands"
              value={scale}
              onChange={(event) => setScale(event.target.value as ResistanceScale)}
              className={fieldBase}
            >
              <option value="base">{unit}</option>
              <option value="kilo">{kiloUnit}</option>
            </select>
          )}
        </div>
        {inputError && (
          <p className="mt-1 text-base font-semibold">Keine gültige Zahl (Beispiel: {mode === 'temperature' ? '20' : '1077,5'})</p>
        )}

        <div className={`mt-5 ${card}`} aria-live="polite">
          {!sensor ? (
            <p className="text-base text-muted">Fühler wählen.</p>
          ) : !lookup ? (
            <p className="text-base text-muted">{mode === 'temperature' ? 'Temperatur eingeben.' : 'Gemessenen Widerstand eingeben.'}</p>
          ) : lookup.kind === 'outOfRange' ? (
            <p className="font-semibold">
              Außerhalb der Tabelle. Für {sensor.name} reicht sie von {point(lookup.first)} bis {point(lookup.last)}.
            </p>
          ) : (
            <>
              <p className="font-semibold">{mode === 'temperature' ? 'Sollwiderstand' : 'Temperatur am Fühler'}</p>
              <p className="text-3xl font-bold">
                {lookup.kind === 'interpolated' && '≈ '}
                {mode === 'temperature' ? resistanceWithKilo(lookup.value) : chosenTemperature(lookup.value)}
              </p>
              <p className="text-base text-muted">
                {lookup.kind === 'exact'
                  ? 'Wert aus der Tabelle.'
                  : `Zwischen ${point(lookup.lower)} und ${point(lookup.upper)} linear gerechnet.`}
              </p>
            </>
          )}
        </div>
        {tool.tableNote && <p className="mt-2 text-base text-muted">{tool.tableNote}</p>}
      </section>

      {sensor && (
        <section className="mt-6" aria-labelledby={`${idPrefix}-table`}>
          <h2 id={`${idPrefix}-table`} className="text-xl font-bold">
            Alle Werte für {sensor.name}
          </h2>
          <div className="mt-3 overflow-x-auto rounded-2xl border border-edge bg-surface">
            <table className="w-full text-left text-base">
              <thead>
                <tr className="border-b border-edge">
                  <th scope="col" className="px-2 py-2">
                    Temperatur
                    <span className="block text-sm font-normal text-muted">{TEMPERATURE_UNIT}</span>
                  </th>
                  <th scope="col" className="px-2 py-2">
                    Widerstand
                    <span className="block text-sm font-normal text-muted">{unit}</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-edge">
                {points.map((entry) => {
                  const active = highlighted.includes(entry)
                  return (
                    <tr
                      key={entry.temperature}
                      className={active ? 'bg-raised font-semibold' : undefined}
                      aria-current={active ? 'true' : undefined}
                    >
                      <th scope="row" className="px-2 py-2 whitespace-nowrap">
                        {formatNumber(entry.temperature, 0)}
                      </th>
                      <td className="px-2 py-2">{formatNumber(entry.resistance, decimals)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </>
  )
}
