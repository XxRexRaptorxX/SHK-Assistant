import { useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { formatNumber, parseDecimal } from '../../lib/number'
import {
  availableOptions,
  computeFactorTool,
  normalizeSelection,
  type FactorChoice,
  type FactorTool,
} from './factorTool'
import { withUnit } from './TableLookup'

type Input = FactorTool['inputs'][number]

const defaultFormat = new Intl.NumberFormat('de-DE', { useGrouping: false, maximumSignificantDigits: 10 })

function inputError(input: Input, raw: string): string | undefined {
  if (raw.trim() === '') return undefined
  const value = parseDecimal(raw)
  if (value === undefined) return 'Keine gültige Zahl (Beispiel: 4)'
  if (input.min !== undefined && value < input.min) return `Der Wert muss mindestens ${input.min} sein.`
  if (input.max !== undefined && value > input.max) return `Der Wert darf höchstens ${input.max} sein.`
  return undefined
}

/** Faktor-Tool: Zahlen eingeben, Varianten wählen, Ergebnisse mit dem jeweiligen Richtwert */
export function FactorCalculator({
  tool,
  initialInputs = {},
  initialSelection,
}: {
  tool: FactorTool
  /** Eingaben je Symbol als Text, z. B. { n: '4' } */
  initialInputs?: Record<string, string>
  initialSelection?: Record<string, string>
}) {
  const idPrefix = useId()
  const [raw, setRaw] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      tool.inputs.map((input) => [
        input.symbol,
        initialInputs[input.symbol] ?? (input.default === undefined ? '' : defaultFormat.format(input.default)),
      ]),
    ),
  )
  // Vorauswahl (default oder erste angebotene Option), damit gleich ein Ergebnis erscheint
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    normalizeSelection(
      tool,
      initialSelection ?? Object.fromEntries(tool.choices.map((choice) => [choice.key, choice.default ?? choice.options[0]!.key])),
    ),
  )

  const errors = Object.fromEntries(tool.inputs.map((input) => [input.symbol, inputError(input, raw[input.symbol] ?? '')]))
  const values: Record<string, number> = {}
  for (const input of tool.inputs) {
    const text = raw[input.symbol] ?? ''
    // Leeres optionales Feld: mit dem dafür vorgesehenen Wert rechnen
    const value = text.trim() === '' ? input.whenEmpty : parseDecimal(text)
    if (value !== undefined && !errors[input.symbol]) values[input.symbol] = value
  }
  const complete = tool.inputs.every((input) => values[input.symbol] !== undefined)
  const results = complete ? computeFactorTool(tool, values, selection) : undefined
  const select = (choice: FactorChoice, option: string) =>
    setSelection(normalizeSelection(tool, { ...selection, [choice.key]: option }))

  return (
    <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
      <h2 id={`${idPrefix}-heading`} className="text-xl font-bold">
        Rechner
      </h2>
      <div className={tool.inputs.length > 0 ? 'mt-3 space-y-4' : undefined}>
        {tool.inputs.map((input) => {
          const inputId = `${idPrefix}-${input.symbol}`
          const error = errors[input.symbol]
          return (
            <div key={input.symbol}>
              <label htmlFor={inputId} className="block font-semibold">
                {input.name}
                {input.label && <span className="font-normal text-muted"> ({input.label})</span>}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={raw[input.symbol] ?? ''}
                  placeholder={input.whenEmpty !== undefined ? 'optional' : undefined}
                  aria-invalid={error !== undefined}
                  onChange={(event) => setRaw({ ...raw, [input.symbol]: event.target.value })}
                  className={`${fieldBase} w-full max-w-40 ${error ? 'border-warn-ink outline-2 outline-warn' : ''}`}
                />
                {input.unit && <span className="text-lg">{input.unit}</span>}
              </div>
              {error && <p className="mt-1 text-base font-semibold">{error}</p>}
            </div>
          )
        })}
      </div>

      {tool.choices.map((choice) => {
        const options = availableOptions(choice, selection)
        return choice.display === 'dropdown' ? (
          <ChoiceDropdown
            key={choice.key}
            id={`${idPrefix}-${choice.key}`}
            choice={choice}
            options={options}
            selected={selection[choice.key]}
            onSelect={(option) => select(choice, option)}
          />
        ) : (
          <ChoiceBar
            key={choice.key}
            choice={choice}
            options={options}
            selected={selection[choice.key]}
            onSelect={(option) => select(choice, option)}
          />
        )
      })}

      <div className="mt-5 space-y-3 rounded-2xl border-2 border-accent bg-surface p-4" aria-live="polite">
        {tool.results.map((result) => {
          const computed = results?.[result.symbol]
          return (
            <div key={result.symbol}>
              <p className="font-semibold">{result.name}</p>
              {computed?.text !== undefined ? (
                <p className="text-2xl font-bold">{computed.text}</p>
              ) : (
                <p className="text-3xl font-bold">
                  {result.label ?? result.symbol} ={' '}
                  {computed ? withUnit(formatNumber(computed.value, result.decimals), result.unit) : '–'}
                </p>
              )}
              {computed && <p className="text-base text-muted">{computed.rule}</p>}
            </div>
          )
        })}
        {!complete && <p className="text-base text-muted">Alle Werte eingeben.</p>}
      </div>
    </section>
  )
}

type Option = FactorChoice['options'][number]

/** Wenige kurze Optionen als Knöpfe nebeneinander */
function ChoiceBar({
  choice,
  options,
  selected,
  onSelect,
}: {
  choice: FactorChoice
  options: Option[]
  selected: string | undefined
  onSelect: (option: string) => void
}) {
  return (
    <div className="mt-4">
      <p className="font-semibold">{choice.name}</p>
      <div role="group" aria-label={choice.name} className="mt-1 flex rounded-xl border-2 border-line bg-surface p-1">
        {options.map((option) => {
          const active = selected === option.key
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.key)}
              className={`min-h-12 min-w-0 flex-1 rounded-lg px-1 leading-tight font-semibold ${
                options.length > 3 ? 'text-sm min-[400px]:text-base' : 'text-base'
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
  options,
  selected,
  onSelect,
}: {
  id: string
  choice: FactorChoice
  options: Option[]
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
        {options.map((option) => (
          <option key={option.key} value={option.key}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}
