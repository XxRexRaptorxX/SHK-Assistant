import { useId, useState } from 'react'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { fieldBase } from '../../components/surfaces'
import { createStoredState } from '../../lib/storedState'
import { formatNumber, parseDecimal } from '../../lib/number'
import { SelectionBar } from './ChoiceLookup'
import { RefrigerantSelect } from './RefrigerantSelect'
import {
  lookupTable,
  refrigerantProperties,
  tablePoints,
  type Quantity,
  type PropertyRow,
  type Refrigerant,
  type RefrigerantTool,
  type TableLookup,
  type TablePoint,
} from './refrigerantTool'

// Zuletzt gewähltes Kältemittel: Auf der Baustelle ist es meist dasselbe wie beim letzten Mal.
export const REFRIGERANT_STORAGE_KEY = 'shk-refrigerant'

/** Auch vom Hochdruckschalter-Tool genutzt */
export const lastRefrigerant = createStoredState<string>({
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

/** Eine Zeile; lange Erläuterungen öffnet der i-Knopf neben dem Wert */
function PropertyItem({ row }: { row: PropertyRow }) {
  const [open, setOpen] = useState(false)
  const infoId = useId()
  return (
    <div className="py-2.5 sm:flex sm:gap-4">
      <dt className="text-base text-muted sm:w-56 sm:shrink-0 sm:pt-0.5">{row.label}</dt>
      <dd className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className={`text-lg font-semibold ${row.warn || row.missing ? 'rounded-md bg-warn px-2 py-0.5 text-warn-ink' : ''}`}>
            {row.value}
          </span>
          {row.info && (
            <button
              type="button"
              aria-expanded={open}
              aria-controls={infoId}
              aria-label={`Erläuterung zu „${row.label}“ ${open ? 'ausblenden' : 'anzeigen'}`}
              onClick={() => setOpen(!open)}
              className={`-my-2 flex size-12 shrink-0 items-center justify-center rounded-full hover:bg-raised ${open ? 'bg-raised' : ''}`}
            >
              <span aria-hidden="true" className="flex size-7 items-center justify-center rounded-full border-2 border-current font-serif text-base font-bold italic">
                i
              </span>
            </button>
          )}
        </div>
        {row.detail && <span className="mt-1 block text-base text-muted">{row.detail}</span>}
        {row.info && open && (
          <p id={infoId} className="mt-2 rounded-xl bg-raised p-3 text-base">
            {row.info}
          </p>
        )}
      </dd>
    </div>
  )
}

function PropertyList({ rows }: { rows: readonly PropertyRow[] }) {
  return (
    <dl className="divide-y divide-edge">
      {rows.map((row) => (
        <PropertyItem key={row.label} row={row} />
      ))}
    </dl>
  )
}

/** Wichtige Eigenschaften des gewählten Kältemittels; weitere Stoffdaten auf Knopfdruck */
function RefrigerantProperties({ tool, refrigerant }: { tool: RefrigerantTool; refrigerant: Refrigerant }) {
  const [expanded, setExpanded] = useState(false)
  const extendedId = useId()
  const { basic, extended } = refrigerantProperties(tool, refrigerant, formatNumber)
  if (basic.length === 0 || !tool.properties) return null
  return (
    <div className="mt-4 rounded-2xl border border-edge bg-surface p-4" aria-label={`Eigenschaften von ${refrigerant.name}`} role="group">
      <p className="font-semibold">Eigenschaften von {refrigerant.name}</p>
      <div className="mt-1">
        <PropertyList rows={basic} />
      </div>
      {extended.length > 0 && (
        <>
          <button
            type="button"
            aria-expanded={expanded}
            aria-controls={extendedId}
            onClick={() => setExpanded(!expanded)}
            className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl border-2 border-line px-4 font-semibold hover:bg-raised"
          >
            {expanded ? 'Weniger anzeigen' : 'Alle Stoffdaten anzeigen'}
            <svg viewBox="0 0 24 24" aria-hidden="true" className={`size-6 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}>
              <path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          {expanded && (
            <div id={extendedId} className="mt-2">
              <PropertyList rows={extended} />
            </div>
          )}
        </>
      )}
      {tool.properties.note && <p className="mt-3 text-base text-muted">{tool.properties.note}</p>}
      <details className="mt-2">
        <summary className="min-h-12 cursor-pointer py-3 text-base font-semibold">Quellen der Eigenschaften</summary>
        <p className="text-sm break-words text-muted">{tool.properties.source}</p>
      </details>
    </div>
  )
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

        <p className="mt-3 font-semibold">Kältemittel</p>
        <RefrigerantSelect label="Kältemittel" refrigerants={tool.refrigerants} value={refrigerant?.name ?? ''} onChange={select} />
        {refrigerant && <RefrigerantProperties tool={tool} refrigerant={refrigerant} />}

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
