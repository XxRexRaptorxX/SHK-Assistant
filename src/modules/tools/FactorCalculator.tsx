import { useId, useState } from 'react'
import { ClearInputsButton, HeadingWithClear } from '../../components/ClearInputsButton'
import { InfoIcon } from '../../components/icons'
import { renderSymbol } from '../formulas/SymbolText'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { formatResult, parseDecimal } from '../../lib/number'
import {
  availableOptions,
  computeFactorTool,
  normalizeSelection,
  visibleInputs,
  visibleResults,
  type FactorChoice,
  type FactorTool,
} from './factorTool'
import { withUnit } from './TableLookup'
import { FigureView } from '../figures/FigureView'

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
  // Ausgangszustand der Felder: leer bzw. Vorbelegung (z. B. λ = 0,035)
  const defaults = (): Record<string, string> =>
    Object.fromEntries(
      tool.inputs.map((input) => [input.symbol, input.default === undefined ? '' : defaultFormat.format(input.default)]),
    )
  const [raw, setRaw] = useState<Record<string, string>>(() => ({ ...defaults(), ...initialInputs }))
  const changed = tool.inputs.some((input) => (raw[input.symbol] ?? '') !== defaults()[input.symbol])
  // Vorauswahl (default oder erste angebotene Option), damit gleich ein Ergebnis erscheint
  const [selection, setSelection] = useState<Record<string, string>>(() =>
    normalizeSelection(
      tool,
      initialSelection ?? Object.fromEntries(tool.choices.map((choice) => [choice.key, choice.default ?? choice.options[0]!.key])),
    ),
  )

  const inputs = visibleInputs(tool, selection)
  const errors = Object.fromEntries(inputs.map((input) => [input.symbol, inputError(input, raw[input.symbol] ?? '')]))
  const values: Record<string, number> = {}
  for (const input of inputs) {
    const text = raw[input.symbol] ?? ''
    // Leeres optionales Feld: mit dem dafür vorgesehenen Wert rechnen
    const value = text.trim() === '' ? input.whenEmpty : parseDecimal(text)
    if (value !== undefined && !errors[input.symbol]) values[input.symbol] = value
  }
  const complete = inputs.every((input) => input.optional || values[input.symbol] !== undefined)
  const results = complete ? computeFactorTool(tool, values, selection) : undefined
  // Ergebnisse, deren Rechenweg aufgeklappt ist (nur bei rulesBehindInfo)
  const [openRules, setOpenRules] = useState<ReadonlySet<string>>(() => new Set())
  const toggleRule = (symbol: string) =>
    setOpenRules((current) => {
      const next = new Set(current)
      if (!next.delete(symbol)) next.add(symbol)
      return next
    })
  const select = (choice: FactorChoice, option: string) =>
    setSelection(normalizeSelection(tool, { ...selection, [choice.key]: option }))

  const renderChoice = (choice: FactorChoice) => {
    const options = availableOptions(choice, selection)
    // Auswahl ohne passende Optionen (z. B. nur für eine andere Variante) ausblenden
    if (options.length === 0) return null
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
  }

  return (
    <>
    {/* Skizze vor dem Rechner, damit man sieht, welche Maße gemeint sind */}
    <FigureView id={tool.figure} />
    <section className={tool.hideHeading ? undefined : 'mt-6'} aria-labelledby={`${idPrefix}-heading`}>
      {tool.hideHeading ? (
        // Ohne sichtbare Überschrift keine eigene Zeile: Der Löschen-Knopf steht im Ergebnisfeld
        <h2 id={`${idPrefix}-heading`} className="sr-only">
          Rechner
        </h2>
      ) : tool.inputs.length > 0 ? (
        <HeadingWithClear id={`${idPrefix}-heading`} onClear={() => setRaw(defaults())} disabled={!changed}>
          Rechner
        </HeadingWithClear>
      ) : (
        <h2 id={`${idPrefix}-heading`} className="text-xl font-bold">
          Rechner
        </h2>
      )}
      {tool.choices.filter((choice) => choice.top).map(renderChoice)}
      <div className={tool.inputs.length > 0 ? 'mt-3 space-y-4' : undefined}>
        {inputs.map((input) => {
          const inputId = `${idPrefix}-${input.symbol}`
          const error = errors[input.symbol]
          return (
            <div key={input.symbol}>
              <label htmlFor={inputId} className="block font-semibold">
                {input.name}
                {input.label && <span className="font-normal text-muted"> ({renderSymbol(input.label)})</span>}
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={raw[input.symbol] ?? ''}
                  placeholder={input.optional || input.whenEmpty !== undefined ? 'optional' : undefined}
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

      {tool.choices.filter((choice) => !choice.top).map(renderChoice)}

      <div className="mt-5 space-y-3 rounded-2xl border-2 border-accent bg-surface p-4" aria-live="polite">
        {visibleResults(tool, selection).map((result, index) => {
          const computed = results?.[result.symbol]
          const ruleId = `${idPrefix}-rule-${result.symbol}`
          const ruleOpen = openRules.has(result.symbol)
          return (
            <div key={result.symbol}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                  <p className="font-semibold">{result.name}</p>
                  {tool.rulesBehindInfo && computed && (
                    <button
                      type="button"
                      aria-label={`Rechenweg zu ${result.name}`}
                      aria-expanded={ruleOpen}
                      aria-controls={ruleId}
                      onClick={() => toggleRule(result.symbol)}
                      className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg print:hidden ${
                        ruleOpen ? 'bg-accent text-accent-ink' : 'text-muted'
                      }`}
                    >
                      <InfoIcon className="size-5" />
                    </button>
                  )}
                </div>
                {tool.hideHeading && index === 0 && <ClearInputsButton onClear={() => setRaw(defaults())} disabled={!changed} />}
              </div>
              {computed?.text !== undefined ? (
                <p className="text-2xl font-bold">{computed.text}</p>
              ) : (
                <p className="text-3xl font-bold">
                  {renderSymbol(result.label ?? result.symbol)} ={' '}
                  {computed ? withUnit(formatResult(computed.value, result.decimals), result.unit) : '–'}
                </p>
              )}
              {computed &&
                (tool.rulesBehindInfo ? (
                  // Zugeklappt nur beim Drucken sichtbar, damit der Ausdruck den Rechenweg behält
                  <p id={ruleId} className={`text-base text-muted ${ruleOpen ? '' : 'hidden print:block'}`}>
                    {renderSymbol(computed.rule)}
                  </p>
                ) : (
                  <p className="text-base text-muted">{renderSymbol(computed.rule)}</p>
                ))}
              {complete && !computed && result.whenMissing && <p className="text-base text-muted">{result.whenMissing}</p>}
            </div>
          )
        })}
        {!complete && <p className="text-base text-muted">Alle Werte eingeben.</p>}
      </div>
    </section>
    </>
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
  const panelId = useId()
  // Offene Erklärung (Options-key); der Info-Knopf wählt die Option nicht aus
  const [openInfo, setOpenInfo] = useState<string | undefined>()
  const shownInfo = options.find((option) => option.key === openInfo)?.info
  return (
    <div className="mt-4">
      <p className="font-semibold">{choice.name}</p>
      <div role="group" aria-label={choice.name} className="mt-1 flex rounded-xl border-2 border-line bg-surface p-1">
        {options.map((option) => {
          const active = selected === option.key
          return (
            <div key={option.key} className={`flex min-w-0 flex-1 rounded-lg ${active ? 'bg-accent text-accent-ink' : ''}`}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(option.key)}
                className={`min-h-12 min-w-0 flex-1 rounded-lg px-1 leading-tight font-semibold ${
                  options.length > 3 ? 'text-sm min-[400px]:text-base' : 'text-base'
                }`}
              >
                {option.label}
              </button>
              {option.info && (
                <button
                  type="button"
                  aria-label={`Info zu ${option.label}`}
                  aria-expanded={openInfo === option.key}
                  aria-controls={panelId}
                  onClick={() => setOpenInfo(openInfo === option.key ? undefined : option.key)}
                  className="inline-flex w-10 shrink-0 items-center justify-center rounded-lg print:hidden"
                >
                  <InfoIcon className="size-5" />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {shownInfo && (
        <div id={panelId} className="mt-2 rounded-xl border-2 border-line bg-surface p-3">
          <RichText text={shownInfo} />
        </div>
      )}
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
