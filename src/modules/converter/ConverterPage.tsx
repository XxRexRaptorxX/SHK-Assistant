import { useId, useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { RichText } from '../../components/RichText'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { math } from '../../lib/math'
import { formatSignificant, parseDecimal } from '../../lib/number'
import { formatUnit } from '../../lib/units'
import { usePageTitle } from '../../lib/usePageTitle'
import { ensureCustomUnits, unverifiedUnitSymbols } from '../units/customUnits'
import { converterEntries, findConverter } from './converter'
import type { ConverterEntry } from './schema'

// Wird per React.lazy geladen, damit mathjs nicht im Start-Bundle landet.
ensureCustomUnits()

const BACK = { to: '/umrechner', label: 'Umrechner' }
const fieldClass = 'min-h-12 rounded-lg border-2 border-line bg-page px-3 text-lg'

export function convert(value: number, from: string, to: string): number {
  return math.unit(value, from).toNumber(to)
}

function unitLabel(unit: string): string {
  return unverifiedUnitSymbols.has(unit) ? `${formatUnit(unit)} (ungeprüft)` : formatUnit(unit)
}

export default function ConverterPage({ entries = converterEntries }: { entries?: ConverterEntry[] }) {
  const { slug } = useParams()
  const entry = findConverter(entries, slug)
  if (!entry) return <ConverterNotFound />
  return (
    <ContentPage
      entry={entry}
      title={entry.title}
      back={BACK}
      actions={<FavoriteButton id={entry.id} title={`Umrechner ${entry.title}`} />}
    >
      {entry.description && <RichText text={entry.description} />}
      <Converter key={entry.id} entry={entry} />
    </ContentPage>
  )
}

function UnitSelect({ id, label, units, value, onChange }: {
  id: string
  label: string
  units: string[]
  value: string
  onChange: (unit: string) => void
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${fieldClass} min-w-28 shrink-0`}
    >
      {units.map((unit) => (
        <option key={unit} value={unit}>
          {unitLabel(unit)}
        </option>
      ))}
    </select>
  )
}

export function Converter({ entry, initialValue = '1' }: { entry: ConverterEntry; initialValue?: string }) {
  const id = useId()
  const [raw, setRaw] = useState(initialValue)
  const [from, setFrom] = useState(entry.from)
  const [to, setTo] = useState(entry.to)
  const value = parseDecimal(raw)
  const invalid = raw.trim() !== '' && value === undefined

  const results = useMemo(
    () => (value === undefined ? [] : entry.units.map((unit) => ({ unit, value: convert(value, from, unit) }))),
    [entry.units, value, from],
  )
  const target = results.find((r) => r.unit === to)

  return (
    <section className="mt-2" aria-label="Umrechnen">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Wert
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={`${id}-value`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          aria-invalid={invalid}
          onChange={(event) => setRaw(event.target.value)}
          className={`${fieldClass} w-full min-w-0`}
        />
        <UnitSelect id={`${id}-from`} label="Von Einheit" units={entry.units} value={from} onChange={setFrom} />
      </div>
      {invalid && <p className="mt-1 text-base font-semibold">Keine gültige Zahl (Beispiel: 12,5)</p>}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setFrom(to)
            setTo(from)
          }}
          className="inline-flex min-h-12 items-center gap-2 rounded-lg border-2 border-line bg-surface px-4 font-bold"
        >
          <span aria-hidden="true">⇅</span> Tauschen
        </button>
        <UnitSelect id={`${id}-to`} label="Nach Einheit" units={entry.units} value={to} onChange={setTo} />
      </div>

      <p className="mt-4 rounded-xl border-2 border-accent bg-surface p-4 text-3xl font-bold break-all" aria-live="polite">
        {target ? `${formatSignificant(target.value)} ${formatUnit(to)}` : '–'}
      </p>

      {results.length > 0 && (
        <>
          <h2 className="mt-6 text-xl font-bold">In allen Einheiten</h2>
          <table className="mt-2 w-full border-y-2 border-line text-lg">
            <tbody className="divide-y-2 divide-line">
              {results.map((result) => (
                <tr key={result.unit} className={result.unit === from ? 'font-bold' : ''}>
                  <td className="py-2 pr-3 text-right tabular-nums">{formatSignificant(result.value)}</td>
                  <td className="py-2">{unitLabel(result.unit)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  )
}

function ConverterNotFound() {
  usePageTitle('Größe nicht gefunden')
  return (
    <>
      <BackLink to={BACK.to} label={BACK.label} />
      <h1 className="text-2xl font-bold">Größe nicht gefunden</h1>
      <p className="mt-2 text-muted">Diese Größe gibt es im Umrechner nicht (mehr).</p>
    </>
  )
}
