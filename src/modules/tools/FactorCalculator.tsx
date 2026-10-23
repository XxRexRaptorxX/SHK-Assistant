import { useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { formatNumber, parseDecimal } from '../../lib/number'
import { computeFactorTool, type FactorTool } from './factorTool'
import { withUnit } from './TableLookup'

/** Faktor-Tool: Zahl eingeben, Varianten wählen, Ergebnisse mit dem jeweiligen Richtwert */
export function FactorCalculator({
  tool,
  initialInput = '',
  initialSelection,
}: {
  tool: FactorTool
  initialInput?: string
  initialSelection?: Record<string, string>
}) {
  const idPrefix = useId()
  const inputId = `${idPrefix}-input`
  const [raw, setRaw] = useState(initialInput)
  // Vorauswahl: jeweils die erste Option, damit gleich ein Ergebnis erscheint
  const [selection, setSelection] = useState<Record<string, string>>(
    () => initialSelection ?? Object.fromEntries(tool.choices.map((choice) => [choice.key, choice.options[0]!.key])),
  )

  const value = raw.trim() === '' ? undefined : parseDecimal(raw)
  const { min, max } = tool.input
  const error =
    raw.trim() !== '' && value === undefined
      ? 'Keine gültige Zahl (Beispiel: 4)'
      : value !== undefined && min !== undefined && value < min
        ? `Der Wert muss mindestens ${min} sein.`
        : value !== undefined && max !== undefined && value > max
          ? `Der Wert darf höchstens ${max} sein.`
          : undefined
  const results = value !== undefined && !error ? computeFactorTool(tool, value, selection) : undefined

  return (
    <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
      <h2 id={`${idPrefix}-heading`} className="text-xl font-bold">
        Rechner
      </h2>
      <label htmlFor={inputId} className="mt-3 block font-semibold">
        {tool.input.name}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={inputId}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={raw}
          aria-invalid={error !== undefined}
          onChange={(event) => setRaw(event.target.value)}
          className={`${fieldBase} w-full max-w-40 ${error ? 'border-warn-ink outline-2 outline-warn' : ''}`}
        />
        {tool.input.unit && <span className="text-lg">{tool.input.unit}</span>}
      </div>
      {error && <p className="mt-1 text-base font-semibold">{error}</p>}

      {tool.choices.map((choice) => (
        <div key={choice.key} className="mt-4">
          <p className="font-semibold">{choice.name}</p>
          <div role="group" aria-label={choice.name} className="mt-1 flex rounded-xl border-2 border-line bg-surface p-1">
            {choice.options.map((option) => {
              const active = selection[choice.key] === option.key
              return (
                <button
                  key={option.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelection({ ...selection, [choice.key]: option.key })}
                  className={`min-h-12 min-w-0 flex-1 rounded-lg px-2 text-base leading-tight font-semibold ${
                    active ? 'bg-accent text-accent-ink' : ''
                  }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </div>
      ))}

      <div className="mt-5 space-y-3 rounded-2xl border-2 border-accent bg-surface p-4" aria-live="polite">
        {tool.results.map((result) => {
          const computed = results?.[result.symbol]
          return (
            <div key={result.symbol}>
              <p className="font-semibold">{result.name}</p>
              <p className="text-3xl font-bold">
                {result.label ?? result.symbol} ={' '}
                {computed ? withUnit(formatNumber(computed.value, result.decimals), result.unit) : '–'}
              </p>
              {computed && <p className="text-base text-muted">{computed.rule}</p>}
            </div>
          )
        })}
        {!results && !error && <p className="text-base text-muted">{tool.input.name} eingeben.</p>}
      </div>
    </section>
  )
}
