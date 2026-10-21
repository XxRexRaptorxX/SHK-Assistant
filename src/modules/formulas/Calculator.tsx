import { useId, useMemo, useState } from 'react'
import { formatNumber, parseDecimal } from '../../lib/number'
import { formatUnit } from '../../lib/units'
import { evaluateFormula, FormulaError, type Quantity } from './engine'
import type { FormulaEntry } from './schema'

type CalculationState =
  | { kind: 'incomplete' }
  | { kind: 'invalid' }
  | { kind: 'result'; value: number }
  | { kind: 'error'; message: string }

const fieldClass = 'min-h-12 rounded-lg border-2 border-line bg-page px-3 text-lg'

function UnitSelect({
  id,
  label,
  units,
  value,
  onChange,
}: {
  id: string
  label: string
  units: string[]
  value: string
  onChange: (unit: string) => void
}) {
  if (units.length <= 1) {
    // Gleiche Breite wie die Auswahlliste, damit alle Eingabefelder bündig sind
    return <span className="min-w-24 shrink-0 px-3 text-lg">{formatUnit(value)}</span>
  }
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={`${fieldClass} min-w-24 shrink-0`}
    >
      {units.map((unit) => (
        <option key={unit} value={unit}>
          {formatUnit(unit)}
        </option>
      ))}
    </select>
  )
}

export function Calculator({ formula }: { formula: FormulaEntry }) {
  const idPrefix = useId()
  const result = formula.result
  const [values, setValues] = useState<Record<string, string>>({})
  const [units, setUnits] = useState<Record<string, string>>(() =>
    Object.fromEntries(formula.variables.map((v) => [v.symbol, v.unit])),
  )
  const [resultUnit, setResultUnit] = useState(result?.unit ?? '')

  const calculation = useMemo((): CalculationState => {
    const inputs: Record<string, Quantity> = {}
    let incomplete = false
    for (const variable of formula.variables) {
      const raw = values[variable.symbol] ?? ''
      if (raw.trim() === '') {
        incomplete = true
        continue
      }
      const value = parseDecimal(raw)
      if (value === undefined) return { kind: 'invalid' }
      inputs[variable.symbol] = { value, unit: units[variable.symbol] ?? variable.unit }
    }
    if (incomplete) return { kind: 'incomplete' }
    try {
      const value = evaluateFormula(formula, inputs, resultUnit)
      if (!Number.isFinite(value)) return { kind: 'error', message: 'Mit diesen Werten nicht berechenbar.' }
      return { kind: 'result', value }
    } catch (error) {
      return {
        kind: 'error',
        message: error instanceof FormulaError ? error.message : 'Mit diesen Werten nicht berechenbar.',
      }
    }
  }, [formula, values, units, resultUnit])

  if (!result) return null
  const resultLabel = result.label ?? result.symbol

  return (
    <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
      <h2 id={`${idPrefix}-heading`} className="text-xl font-bold">
        Rechner
      </h2>
      <div className="mt-3 space-y-4">
        {formula.variables.map((variable) => {
          const inputId = `${idPrefix}-${variable.symbol}`
          const raw = values[variable.symbol] ?? ''
          const invalid = raw.trim() !== '' && parseDecimal(raw) === undefined
          return (
            <div key={variable.symbol}>
              <label htmlFor={inputId} className="block font-semibold">
                {variable.name} <span className="font-normal text-muted">({variable.label ?? variable.symbol})</span>
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={raw}
                  aria-invalid={invalid}
                  aria-describedby={invalid ? `${inputId}-error` : undefined}
                  onChange={(event) => setValues({ ...values, [variable.symbol]: event.target.value })}
                  className={`${fieldClass} w-full min-w-0 ${invalid ? 'border-warn-ink outline-2 outline-warn' : ''}`}
                />
                <UnitSelect
                  id={`${inputId}-unit`}
                  label={`Einheit für ${variable.name}`}
                  units={[variable.unit, ...variable.units]}
                  value={units[variable.symbol] ?? variable.unit}
                  onChange={(unit) => setUnits({ ...units, [variable.symbol]: unit })}
                />
              </div>
              {invalid && (
                <p id={`${inputId}-error`} className="mt-1 text-base font-semibold">
                  Keine gültige Zahl (Beispiel: 12,5)
                </p>
              )}
            </div>
          )
        })}
      </div>

      <div className="mt-5 rounded-xl border-2 border-accent bg-surface p-4" aria-live="polite">
        <p className="font-semibold">{result.name}</p>
        <div className="mt-1 flex flex-wrap items-center gap-2">
          <p className="text-3xl font-bold break-all">
            {resultLabel} ={' '}
            {calculation.kind === 'result' ? formatNumber(calculation.value, result.decimals) : '–'}
          </p>
          <UnitSelect
            id={`${idPrefix}-result-unit`}
            label={`Einheit für ${result.name}`}
            units={[result.unit, ...result.units]}
            value={resultUnit}
            onChange={setResultUnit}
          />
        </div>
        {calculation.kind === 'incomplete' && <p className="mt-1 text-base text-muted">Alle Werte eingeben.</p>}
        {calculation.kind === 'invalid' && <p className="mt-1 text-base font-semibold">Bitte Eingaben prüfen.</p>}
        {calculation.kind === 'error' && <p className="mt-1 text-base font-semibold">{calculation.message}</p>}
      </div>
    </section>
  )
}
