import { useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { formatNumber, parseDecimal } from '../../lib/number'
import { computeFactorTool, type FactorTool } from './factorTool'
import { withUnit } from './TableLookup'

type Choice = FactorTool['choices'][number]

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
  // Vorauswahl (default oder erste Option), damit gleich ein Ergebnis erscheint
  const [selection, setSelection] = useState<Record<string, string>>(
    () =>
      initialSelection ??
      Object.fromEntries(tool.choices.map((choice) => [choice.key, choice.default ?? choice.options[0]!.key])),
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
  const select = (choice: Choice, option: string) => setSelection({ ...selection, [choice.key]: option })

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

      {tool.choices.map((choice) =>
        choice.display === 'dropdown' ? (
          <ChoiceDropdown
            key={choice.key}
            id={`${idPrefix}-${choice.key}`}
            choice={choice}
            selected={selection[choice.key]}
            onSelect={(option) => select(choice, option)}
          />
        ) : (
          <ChoiceBar
            key={choice.key}
            choice={choice}
            selected={selection[choice.key]}
            onSelect={(option) => select(choice, option)}
          />
        ),
      )}

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

/** Wenige kurze Optionen als Knöpfe nebeneinander */
function ChoiceBar({
  choice,
  selected,
  onSelect,
}: {
  choice: Choice
  selected: string | undefined
  onSelect: (option: string) => void
}) {
  return (
    <div className="mt-4">
      <p className="font-semibold">{choice.name}</p>
      <div role="group" aria-label={choice.name} className="mt-1 flex rounded-xl border-2 border-line bg-surface p-1">
        {choice.options.map((option) => {
          const active = selected === option.key
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.key)}
              className={`min-h-12 min-w-0 flex-1 rounded-lg px-1 leading-tight font-semibold ${
                choice.options.length > 3 ? 'text-sm min-[400px]:text-base' : 'text-base'
              } ${active ? 'bg-accent text-accent-ink' : ''}`}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Viele Optionen als Auswahlliste */
function ChoiceDropdown({
  id,
  choice,
  selected,
  onSelect,
}: {
  id: string
  choice: Choice
  selected: string | undefined
  onSelect: (option: string) => void
}) {
  return (
    <div className="mt-4">
      <label htmlFor={id} className="block font-semibold">
        {choice.name}
      </label>
      <select
        id={id}
        value={selected}
        onChange={(event) => onSelect(event.target.value)}
        className={`${fieldBase} mt-1 w-full`}
      >
        {choice.options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
