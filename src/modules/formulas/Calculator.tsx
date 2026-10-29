import { useId, useMemo, useState } from 'react'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { EqualsIcon, WorkingIcon } from '../../components/icons'
import { updateSettings, useSettings } from '../../settings/settings'
import { formatNumber, formatSignificant, parseDecimal } from '../../lib/number'
import { alternativeUnits } from '../units/alternatives'
import { formatAnyUnit } from '../units/labels'
import { evaluateFormula, FormulaError, rangeError, toMainUnit, type Quantity } from './engine'
import { constantSubstitution, FormulaMath, quantitySubstitution, type Substitution } from './FormulaMath'
import type { FormulaEntry, FormulaVariable } from './schema'
import { fieldBase } from '../../components/surfaces'
import { MaterialPicker } from '../materials/MaterialPicker'
import { presetInput, presetsFor } from '../materials/materials'

type CalculationState =
  | { kind: 'incomplete' }
  | { kind: 'invalid' }
  | { kind: 'result'; value: number }
  | { kind: 'error'; message: string }

const fieldClass = fieldBase

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

const defaultFormat = new Intl.NumberFormat('de-DE', { useGrouping: false, maximumSignificantDigits: 10 })

/** Eingesetzte Werte für den Rechenweg: gültige Eingaben in der Haupteinheit, Konstanten mit Zahlenwert */
function substitutionsFor(
  formula: FormulaEntry,
  values: Record<string, string>,
  units: Record<string, string>,
): Map<string, Substitution> {
  const substitutions = new Map<string, Substitution>()
  for (const constant of formula.constants) {
    const substitution = constantSubstitution(constant.value)
    if (substitution) substitutions.set(constant.symbol, substitution)
  }
  for (const variable of formula.variables) {
    const raw = values[variable.symbol] ?? ''
    const unit = units[variable.symbol] ?? variable.unit
    const value = parseDecimal(raw)
    if (value === undefined || fieldError(variable, raw, unit)) continue
    // Die Formel rechnet in den Haupteinheiten, daher auch so eingesetzt
    substitutions.set(variable.symbol, quantitySubstitution(toMainUnit(variable, { value, unit }), variable.unit))
  }
  return substitutions
}

export function Calculator({
  formula,
  showWorking: showWorkingOverride,
}: {
  formula: FormulaEntry
  /** Für Tests; sonst gilt die Einstellung */
  showWorking?: boolean
}) {
  const idPrefix = useId()
  const settings = useSettings()
  // Ohne hinterlegte Formel gibt es keinen Rechenweg
  const canShowWorking = formula.expression !== ''
  const working = canShowWorking && (showWorkingOverride ?? settings.showWorking)
  const result = formula.result
  // Ausgangszustand: leere Felder bzw. Vorbelegung, Einheiten wie in der Formel
  const initialValues = (): Record<string, string> =>
    Object.fromEntries(
      formula.variables.flatMap((v) => (v.default === undefined ? [] : [[v.symbol, defaultFormat.format(v.default)]])),
    )
  const initialUnits = (): Record<string, string> => Object.fromEntries(formula.variables.map((v) => [v.symbol, v.unit]))
  const [values, setValues] = useState<Record<string, string>>(initialValues)
  const [units, setUnits] = useState<Record<string, string>>(initialUnits)
  const [resultUnit, setResultUnit] = useState(result?.unit ?? '')
  const changed =
    formula.variables.some((v) => (values[v.symbol] ?? '') !== (initialValues()[v.symbol] ?? '') || units[v.symbol] !== v.unit) ||
    resultUnit !== (result?.unit ?? '')
  const clear = () => {
    setValues(initialValues())
    setUnits(initialUnits())
    setResultUnit(result?.unit ?? '')
  }

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
  const resultText =
    calculation.kind === 'result'
      ? // Nachkommastellen gelten für die Haupteinheit; in anderen Einheiten gültige Stellen
        resultUnit === result.unit
        ? formatNumber(calculation.value, result.decimals)
        : formatSignificant(calculation.value)
      : '–'
  const resultUnitSelect = (
    <UnitSelect
      id={`${idPrefix}-result-unit`}
      label={`Einheit für ${result.name}`}
      units={alternativeUnits(result.unit, result.units)}
      value={resultUnit}
      onChange={setResultUnit}
    />
  )
  const toggleLabel = working ? 'Nur Ergebnis anzeigen' : 'Rechenweg anzeigen'
  const ToggleIcon = working ? EqualsIcon : WorkingIcon

  return (
    <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
      <HeadingWithClear id={`${idPrefix}-heading`} onClear={clear} disabled={!changed}>
        Rechner
      </HeadingWithClear>
      <div className="mt-3 space-y-4">
        {formula.variables.map((variable) => {
          const inputId = `${idPrefix}-${variable.symbol}`
          const raw = values[variable.symbol] ?? ''
          const currentUnit = units[variable.symbol] ?? variable.unit
          const availableUnits = alternativeUnits(variable.unit, variable.units)
          const error = fieldError(variable, raw, currentUnit)
          const invalid = error !== undefined
          const presets = presetsFor(variable)
          const input = (
            <input
              id={inputId}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={raw}
              aria-invalid={invalid}
              aria-describedby={invalid ? `${inputId}-error` : undefined}
              onChange={(event) => setValues({ ...values, [variable.symbol]: event.target.value })}
              className={`${fieldClass} w-full min-w-0 ${presets.length > 0 ? 'pr-12' : ''} ${invalid ? 'border-warn-ink outline-2 outline-warn' : ''}`}
            />
          )
          return (
            <div key={variable.symbol}>
              <label htmlFor={inputId} className="block font-semibold">
                {variable.name} <span className="font-normal text-muted">({variable.label ?? variable.symbol})</span>
              </label>
              <div className="mt-1 flex items-center gap-2">
                {presets.length > 0 ? (
                  <MaterialPicker
                    label={variable.name}
                    presets={presets}
                    onPick={(preset) => {
                      const picked = presetInput(preset, currentUnit, availableUnits)
                      setValues({ ...values, [variable.symbol]: picked.text })
                      setUnits({ ...units, [variable.symbol]: picked.unit })
                    }}
                  >
                    {input}
                  </MaterialPicker>
                ) : (
                  input
                )}
                <UnitSelect
                  id={`${inputId}-unit`}
                  label={`Einheit für ${variable.name}`}
                  units={availableUnits}
                  value={currentUnit}
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

      <div className="mt-5 rounded-2xl border-2 border-accent bg-surface p-4" aria-live="polite">
        <div className="flex items-start justify-between gap-3">
          <p className="pt-2 font-semibold">{result.name}</p>
          {canShowWorking && (
            <button
              type="button"
              aria-label={toggleLabel}
              aria-pressed={working}
              title={toggleLabel}
              onClick={() => updateSettings({ showWorking: !working })}
              className="flex size-11 shrink-0 items-center justify-center rounded-full border border-edge bg-raised text-muted print:hidden"
            >
              <ToggleIcon className="size-6" />
            </button>
          )}
        </div>
        {working ? (
          // Rechenweg: Formel mit eingesetzten Zahlen, dahinter das Ergebnis
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-2xl">
            <p className="max-w-full overflow-x-auto py-1">
              {resultLabel} = <FormulaMath formula={formula} substitutions={substitutionsFor(formula, values, units)} />{' '}
              =
            </p>
            <div className="flex items-center gap-2">
              <p className="font-bold">{resultText}</p>
              {resultUnitSelect}
            </div>
          </div>
        ) : (
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-3xl font-bold break-all">
              {resultLabel} = {resultText}
            </p>
            {resultUnitSelect}
          </div>
        )}
        {calculation.kind === 'incomplete' && <p className="mt-1 text-base text-muted">Alle Werte eingeben.</p>}
        {calculation.kind === 'invalid' && <p className="mt-1 text-base font-semibold">Bitte Eingaben prüfen.</p>}
        {calculation.kind === 'error' && <p className="mt-1 text-base font-semibold">{calculation.message}</p>}
      </div>
    </section>
  )
}
