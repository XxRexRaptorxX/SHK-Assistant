import { useId, useState } from 'react'
import { formatSignificant, parseDecimal } from '../../lib/number'
import { fieldClass, ResultsTable, Select, ValueInput } from './converterUi'
import type { ConverterEntry, ConverterFactor } from './schema'

/** Richtwerte: wenige gültige Stellen, um keine falsche Genauigkeit vorzutäuschen */
const DIGITS = 3

export function convertByFactors(value: number, from: ConverterFactor, to: ConverterFactor): number {
  return (value / from.value) * to.value
}

/** Umrechnung über Richtwert-Faktoren aus dem Inhalt (ohne mathjs-Einheiten) */
export function FactorConverter({ entry, initialValue = '1' }: { entry: ConverterEntry; initialValue?: string }) {
  const id = useId()
  const byKey = new Map(entry.factors.map((factor) => [factor.key, factor]))
  const [raw, setRaw] = useState(initialValue)
  const [fromKey, setFromKey] = useState(entry.from)
  const [toKey, setToKey] = useState(entry.to)
  const from = byKey.get(fromKey)
  const to = byKey.get(toKey)

  const parsed = parseDecimal(raw)
  const belowMin = parsed !== undefined && entry.min !== undefined && parsed < entry.min
  const value = belowMin ? undefined : parsed
  const empty = raw.trim() === ''
  const invalid = !empty && value === undefined
  const hint = belowMin ? (entry.min === 0 ? 'keine negativen Werte' : `mindestens ${entry.min}`) : undefined
  const options = entry.factors.map((factor) => ({ value: factor.key, label: factor.label }))

  return (
    <section className="mt-2" aria-label="Umrechnen">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Menge
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2 [&>input]:flex-1">
        <ValueInput id={`${id}-value`} value={raw} onChange={setRaw} invalid={invalid} hint={hint} />
      </div>
      {empty && <p className="mt-1 text-base text-muted">Bitte eine Menge eingeben.</p>}
      <div className="mt-3">
        <Select id={`${id}-from`} label="Von" options={options} value={fromKey} onChange={setFromKey} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => {
            setFromKey(toKey)
            setToKey(fromKey)
          }}
          className={`${fieldClass} inline-flex items-center gap-2 bg-surface font-bold`}
        >
          <span aria-hidden="true">⇅</span> Tauschen
        </button>
        <Select id={`${id}-to`} label="Nach" options={options} value={toKey} onChange={setToKey} />
      </div>

      <p className="mt-4 rounded-xl border-2 border-accent bg-surface p-4 text-3xl font-bold break-words" aria-live="polite">
        {value !== undefined && from && to
          ? `≈ ${formatSignificant(convertByFactors(value, from, to), DIGITS)} ${to.label}`
          : '–'}
      </p>

      <ResultsTable
        title="In allen Maßen (Richtwerte)"
        rows={
          value === undefined || !from
            ? []
            : entry.factors.map((factor) => ({
                key: factor.key,
                value: `≈ ${formatSignificant(convertByFactors(value, from, factor), DIGITS)}`,
                label: factor.label,
                highlight: factor.key === fromKey,
              }))
        }
      />
    </section>
  )
}
