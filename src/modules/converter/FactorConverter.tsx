import { useId, useState } from 'react'
import { formatSignificant, parseDecimal } from '../../lib/number'
import { useSettings } from '../../settings/settings'
import { displayName, FromToSelects, ResultsTable, ValueInput } from './converterUi'
import type { ConverterEntry, ConverterFactor } from './schema'

/** Richtwerte: wenige gültige Stellen, um keine falsche Genauigkeit vorzutäuschen; exakte Verhältnisse voll */
const APPROXIMATE_DIGITS = 3
const EXACT_DIGITS = 6

export function convertByFactors(value: number, from: ConverterFactor, to: ConverterFactor): number {
  return (value / from.value) * to.value
}

/** Umrechnung über Richtwert-Faktoren aus dem Inhalt (ohne mathjs-Einheiten) */
export function FactorConverter({
  entry,
  initialValue = '1',
  hideRareUnits,
  showUnitNames,
}: {
  entry: ConverterEntry
  initialValue?: string
  /** Für Tests überschreibbar, sonst aus den Einstellungen */
  hideRareUnits?: boolean
  showUnitNames?: boolean
}) {
  const id = useId()
  const settings = useSettings()
  const hideRare = hideRareUnits ?? settings.hideRareUnits
  const showNames = showUnitNames ?? settings.showUnitNames
  const factors = entry.factors.filter((factor) => !(hideRare && entry.rare.includes(factor.key)))
  const byKey = new Map(factors.map((factor) => [factor.key, factor]))
  const [raw, setRaw] = useState(initialValue)
  const [chosenFrom, setFromKey] = useState(entry.from)
  const [chosenTo, setToKey] = useState(entry.to)
  // Ausgeblendete Auswahl auf die erste bzw. zweite verbleibende Größe zurücksetzen
  const fromKey = byKey.has(chosenFrom) ? chosenFrom : (factors[0]?.key ?? '')
  const toKey = byKey.has(chosenTo) ? chosenTo : (factors.find((f) => f.key !== fromKey)?.key ?? '')
  const from = byKey.get(fromKey)
  const to = byKey.get(toKey)

  const parsed = parseDecimal(raw)
  const belowMin = parsed !== undefined && entry.min !== undefined && parsed < entry.min
  const value = belowMin ? undefined : parsed
  const empty = raw.trim() === ''
  const invalid = !empty && value === undefined
  const hint = belowMin ? (entry.min === 0 ? 'keine negativen Werte' : `mindestens ${entry.min}`) : undefined
  const options = factors.map((factor) => ({ value: factor.key, label: factor.label }))
  const format = (n: number) =>
    entry.approximate ? `≈ ${formatSignificant(n, APPROXIMATE_DIGITS)}` : formatSignificant(n, EXACT_DIGITS)

  return (
    <section className="mt-2" aria-label="Umrechnen">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Menge
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2 [&>input]:flex-1">
        <ValueInput id={`${id}-value`} value={raw} onChange={setRaw} invalid={invalid} hint={hint} />
      </div>
      {empty && <p className="mt-1 text-base text-muted">Bitte eine Menge eingeben.</p>}
      <FromToSelects
        id={id}
        options={options}
        from={fromKey}
        to={toKey}
        onFromChange={setFromKey}
        onToChange={setToKey}
      />

      <p className="mt-4 rounded-2xl border-2 border-accent bg-surface p-4 text-3xl font-bold break-words" aria-live="polite">
        {value !== undefined && from && to
          ? `${format(convertByFactors(value, from, to))} ${to.label}`
          : '–'}
      </p>

      <ResultsTable
        title={entry.approximate ? 'In allen Maßen (Richtwerte)' : 'In allen Maßen'}
        rows={
          value === undefined || !from
            ? []
            : factors.map((factor) => ({
                key: factor.key,
                value: format(convertByFactors(value, from, factor)),
                label: factor.label,
                name: displayName(entry.names, factor.key, factor.label, showNames),
                highlight: factor.key === fromKey,
              }))
        }
      />
    </section>
  )
}
