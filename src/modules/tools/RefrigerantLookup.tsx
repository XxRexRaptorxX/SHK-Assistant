import { useId, useState } from 'react'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { fieldBase } from '../../components/surfaces'
import { createStoredState } from '../../lib/storedState'
import { formatNumber, parseDecimal } from '../../lib/number'
import { SelectionBar } from './ChoiceLookup'
import { lookupTable, tablePoints, type Quantity, type RefrigerantTool, type TableLookup, type TablePoint } from './refrigerantTool'

// Zuletzt gewähltes Kältemittel: Auf der Baustelle ist es meist dasselbe wie beim letzten Mal.
export const REFRIGERANT_STORAGE_KEY = 'shk-refrigerant'

const lastRefrigerant = createStoredState<string>({
  key: REFRIGERANT_STORAGE_KEY,
  read: () => {
    try {
      return globalThis.localStorage?.getItem(REFRIGERANT_STORAGE_KEY) ?? ''
    } catch {
      return ''
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(REFRIGERANT_STORAGE_KEY, value)
    } catch {
      // ohne Speicher gilt die Auswahl bis zum Neuladen
    }
  },
  fallback: '',
})

const TEMPERATURE_UNIT = '°C'
const card = 'rounded-2xl border-2 border-accent bg-surface p-4'

/** Rechenrichtung: Eingabe Druck (abgelesen am Manometer) oder Temperatur */
const MODES: { key: Quantity; label: string; note: string }[] = [
  { key: 'pressure', label: 'Druck', note: '→ Temperatur' },
  { key: 'temperature', label: 'Temperatur', note: '→ Druck' },
]

/** Gerundete Zahl ohne „-0,0“, wenn ein kleiner negativer Wert auf null fällt */
export const formatRounded = (value: number, decimals: number) => formatNumber(Number(value.toFixed(decimals)) || 0, decimals)

type Calculation =
  | { kind: 'empty' }
  | { kind: 'invalid' }
  | { kind: 'result'; lookup: TableLookup }

function calculate(points: readonly TablePoint[], given: Quantity, raw: string): Calculation {
  if (raw.trim() === '') return { kind: 'empty' }
  const value = parseDecimal(raw)
  return value === undefined ? { kind: 'invalid' } : { kind: 'result', lookup: lookupTable(points, given, value) }
}

/** Kältemittel-Tool: Kältemittel wählen, Druck oder Temperatur eingeben, darunter die ganze Tabelle */
export function RefrigerantLookup({
  tool,
  initialRefrigerant,
  initialMode = 'pressure',
  initialValue = '',
}: {
  tool: RefrigerantTool
  /** Vorauswahl (Tests); sonst das zuletzt gewählte Kältemittel */
  initialRefrigerant?: string
  initialMode?: Quantity
  initialValue?: string
}) {
  const idPrefix = useId()
  const stored = lastRefrigerant.useValue()
  const [chosen, setChosen] = useState(initialRefrigerant)
  const [mode, setMode] = useState<Quantity>(initialMode)
  // Je Richtung eigene Eingabe, damit beim Umschalten kein Druck als Temperatur gelesen wird
  const [raw, setRaw] = useState<Record<Quantity, string>>({
    pressure: initialMode === 'pressure' ? initialValue : '',
    temperature: initialMode === 'temperature' ? initialValue : '',
  })

  const name = chosen ?? stored
  const refrigerant = tool.refrigerants.find((candidate) => candidate.name === name)
  const points = refrigerant ? tablePoints(tool, refrigerant) : []
  const calculation = refrigerant ? calculate(points, mode, raw[mode]) : { kind: 'empty' as const }
  const lookup = calculation.kind === 'result' ? calculation.lookup : undefined
  const highlighted =
    lookup?.kind === 'exact' ? [lookup.point] : lookup?.kind === 'interpolated' ? [lookup.lower, lookup.upper] : []

  const pressure = (value: number) => `${formatRounded(value, 2)} ${tool.pressureUnit}`
  const temperature = (value: number, decimals = 0) => `${formatRounded(value, decimals)} ${TEMPERATURE_UNIT}`
  const point = (entry: TablePoint) => `${temperature(entry.temperature)} (${pressure(entry.pressure)})`
  const inputId = `${idPrefix}-value`
  const inputError = calculation.kind === 'invalid'

  const select = (next: string) => {
    setChosen(next)
    lastRefrigerant.set(next)
  }

  return (
    <>
      <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
        <HeadingWithClear
          id={`${idPrefix}-heading`}
          onClear={() => setRaw({ pressure: '', temperature: '' })}
          disabled={raw.pressure === '' && raw.temperature === ''}
        >
          Nachschlagen
        </HeadingWithClear>

        <label htmlFor={`${idPrefix}-refrigerant`} className="mt-3 block font-semibold">
          Kältemittel
        </label>
        <select
          id={`${idPrefix}-refrigerant`}
          value={refrigerant?.name ?? ''}
          onChange={(event) => select(event.target.value)}
          className={`${fieldBase} mt-1 w-full max-w-xs`}
        >
          <option value="" disabled>
            Kältemittel wählen …
          </option>
          {tool.refrigerants.map((candidate) => (
            <option key={candidate.name} value={candidate.name}>
              {candidate.name}
            </option>
          ))}
        </select>

        <SelectionBar bar={{ key: 'mode', name: 'Eingabe', options: MODES }} selected={mode} onSelect={(key) => setMode(key as Quantity)} />

        <label htmlFor={inputId} className="mt-4 block font-semibold">
          {mode === 'pressure' ? tool.pressureName : 'Temperatur'}
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
          <span className="text-lg">{mode === 'pressure' ? tool.pressureUnit : TEMPERATURE_UNIT}</span>
        </div>
        {inputError && <p className="mt-1 text-base font-semibold">Keine gültige Zahl (Beispiel: {mode === 'pressure' ? '4,5' : '-10'})</p>}

        <div className={`mt-5 ${card}`} aria-live="polite">
          {!refrigerant ? (
            <p className="text-base text-muted">Kältemittel wählen.</p>
          ) : !lookup ? (
            <p className="text-base text-muted">{mode === 'pressure' ? `${tool.pressureName} eingeben.` : 'Temperatur eingeben.'}</p>
          ) : lookup.kind === 'outOfRange' ? (
            <p className="font-semibold">
              Außerhalb der Tabelle. Für {refrigerant.name} reicht sie von {point(lookup.first)} bis {point(lookup.last)}.
            </p>
          ) : (
            <>
              <p className="font-semibold">
                {mode === 'pressure' ? 'Sättigungstemperatur' : `Sättigungsdruck (${tool.pressureName})`}
              </p>
              <p className="text-3xl font-bold">
                {lookup.kind === 'interpolated' && '≈ '}
                {mode === 'pressure' ? temperature(lookup.value, 1) : pressure(lookup.value)}
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

      {refrigerant && (
        <section className="mt-6" aria-labelledby={`${idPrefix}-table`}>
          <h2 id={`${idPrefix}-table`} className="text-xl font-bold">
            Alle Werte für {refrigerant.name}
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
                    {tool.pressureName}
                    <span className="block text-sm font-normal text-muted">{tool.pressureUnit}</span>
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
                      <td className="px-2 py-2">{formatNumber(entry.pressure, 2)}</td>
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
