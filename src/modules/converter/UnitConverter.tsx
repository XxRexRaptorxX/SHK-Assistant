import { useId, useMemo, useState } from 'react'
import { asTargetUnit, math } from '../../lib/math'
import { formatSignificant, parseDecimal } from '../../lib/number'
import { unverifiedUnitSymbols } from '../units/customUnits'
import { formatAnyUnit } from '../units/labels'
import { isKnownUnit } from '../units/registry'
import { useSettings } from '../../settings/settings'
import { displayName, fieldClass, ResultsTable, Select, ValueInput } from './converterUi'
import type { ConverterEntry } from './schema'

export function convert(value: number, from: string, to: string): number {
  return math.unit(value, from).toNumber(asTargetUnit(to))
}

function unitLabel(unit: string): string {
  const isUnverified = unit.match(/[A-Za-z_]\w*/g)?.some((name) => unverifiedUnitSymbols.has(name))
  return isUnverified ? `${formatAnyUnit(unit)} (ungeprüft)` : formatAnyUnit(unit)
}

/** Umrechnung zwischen Einheiten einer Größe. Zusatzeinheiten müssen registriert sein. */
export function UnitConverter({
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
  // Angekündigte Zusatzeinheiten ohne Definition fehlen noch; unübliche ggf. ausgeblendet
  const available = useMemo(
    () => entry.units.filter((unit) => isKnownUnit(unit) && !(hideRare && entry.rare.includes(unit))),
    [entry.units, entry.rare, hideRare],
  )
  const missing = entry.units.filter((unit) => !isKnownUnit(unit))
  const fallbackFrom = available.includes(entry.from) ? entry.from : (available[0] ?? '')
  const fallbackTo = available.includes(entry.to) && entry.to !== fallbackFrom
    ? entry.to
    : (available.find((unit) => unit !== fallbackFrom) ?? '')

  const [raw, setRaw] = useState(initialValue)
  const [chosenFrom, setFrom] = useState(fallbackFrom)
  const [chosenTo, setTo] = useState(fallbackTo)
  // Wird eine gewählte Einheit ausgeblendet (Einstellung), auf die Voreinstellung zurückfallen
  const from = available.includes(chosenFrom) ? chosenFrom : fallbackFrom
  const to = available.includes(chosenTo) ? chosenTo : fallbackTo
  const parsed = parseDecimal(raw)
  const belowMin = parsed !== undefined && entry.min !== undefined && parsed < entry.min
  const value = belowMin ? undefined : parsed
  const empty = raw.trim() === ''
  const invalid = !empty && value === undefined
  const hint = belowMin ? (entry.min === 0 ? 'keine negativen Werte' : `mindestens ${entry.min}`) : undefined

  const results = useMemo(
    () =>
      value === undefined || available.length < 2
        ? []
        : available.map((unit) => ({ unit, value: convert(value, from, unit) })),
    [available, value, from],
  )
  const target = results.find((result) => result.unit === to)
  const options = available.map((unit) => ({ value: unit, label: unitLabel(unit) }))
  const missingNote = missing.length > 0 && (
    <p className="mt-4 text-base text-muted">
      Noch ohne Definition (Inhalt fehlt): {missing.map(formatAnyUnit).join(', ')}
    </p>
  )

  if (available.length < 2) {
    return (
      <>
        <p className="mt-2 font-semibold">Für diese Größe sind noch nicht genug Einheiten hinterlegt.</p>
        {missingNote}
      </>
    )
  }

  return (
    <section className="mt-2" aria-label="Umrechnen">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Wert
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2 [&>input]:flex-1">
        <ValueInput id={`${id}-value`} value={raw} onChange={setRaw} invalid={invalid} hint={hint} />
        <Select id={`${id}-from`} label="Von Einheit" options={options} value={from} onChange={setFrom} />
      </div>
      {empty && <p className="mt-1 text-base text-muted">Bitte einen Wert eingeben.</p>}

      <div className="mt-3 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            setFrom(to)
            setTo(from)
          }}
          className={`${fieldClass} inline-flex items-center gap-2 bg-surface font-bold`}
        >
          <span aria-hidden="true">⇅</span> Tauschen
        </button>
        <Select id={`${id}-to`} label="Nach Einheit" options={options} value={to} onChange={setTo} />
      </div>

      <p className="mt-4 rounded-2xl border-2 border-accent bg-surface p-4 text-3xl font-bold break-all" aria-live="polite">
        {target ? `${formatSignificant(target.value)} ${formatAnyUnit(to)}` : '–'}
      </p>

      <ResultsTable
        title="In allen Einheiten"
        rows={results.map((result) => ({
          key: result.unit,
          value: formatSignificant(result.value),
          label: unitLabel(result.unit),
          name: displayName(entry.names, result.unit, formatAnyUnit(result.unit), showNames),
          highlight: result.unit === from,
        }))}
      />
      {missingNote}
    </section>
  )
}
