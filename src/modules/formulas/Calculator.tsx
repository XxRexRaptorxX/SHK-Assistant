import { useId, useMemo, useState } from 'react'
import { formatNumber, formatSignificant, parseDecimal } from '../../lib/number'
import { alternativeUnits } from '../units/alternatives'
import { formatAnyUnit } from '../units/labels'
import { evaluateFormula, FormulaError, rangeError, toMainUnit, type Quantity } from './engine'
import type { FormulaEntry, FormulaVariable } from './schema'

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
    return <span className="min-w-24 shrink-0 px-3 text-lg">{formatAnyUnit(value)}</span>
  }
  // Antippen öffnet die Auswahl; umgerechnet wird beim Rechnen über die Einheiten (mathjs)
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
          {formatAnyUnit(unit)}
        </option>
      ))}
    </select>
  )
}

/** Fehlermeldung für ein Eingabefeld, sonst undefined (leeres Feld ist kein Fehler) */
function fieldError(variable: FormulaVariable, raw: string, unit: string): string | undefined {
  if (raw.trim() === '') return undefined
  const value = parseDecimal(raw)
  if (value === undefined) return 'Keine gültige Zahl (Beispiel: 12,5)'
  const range = rangeError(variable, toMainUnit(variable, { value, unit }))
  return range ? `Der Wert ${range}.` : undefined
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
      const unit = units[variable.symbol] ?? variable.unit
      const value = parseDecimal(raw)
      if (value === undefined || fieldError(variable, raw, unit)) return { kind: 'invalid' }
      inputs[variable.symbol] = { value, unit }
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
          const error = fieldError(variable, raw, units[variable.symbol] ?? variable.unit)
          const invalid = error !== undefined
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
                  units={alternativeUnits(variable.unit, variable.units)}
                  value={units[variable.symbol] ?? variable.unit}
                  onChange={(unit) => setUnits({ ...units, [variable.symbol]: unit })}
                />
              </div>
              {invalid && (
                <p id={`${inputId}-error`} className="mt-1 text-base font-semibold">
                  {error}
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
            {calculation.kind === 'result'
              ? // Nachkommastellen gelten für die Haupteinheit; in anderen Einheiten gültige Stellen
                resultUnit === result.unit
                ? formatNumber(calculation.value, result.decimals)
                : formatSignificant(calculation.value)
              : '–'}
          </p>
          <UnitSelect
            id={`${idPrefix}-result-unit`}
            label={`Einheit für ${result.name}`}
            units={alternativeUnits(result.unit, result.units)}
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
