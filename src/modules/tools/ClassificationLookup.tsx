import { useId, useState } from 'react'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { parseDecimal } from '../../lib/number'
import { SelectionBar } from './ChoiceLookup'
import {
  classify,
  computeValue,
  findRegulation,
  INPUT_UNITS,
  limitFor,
  rulesFor,
  type ClassificationResult,
  type ClassificationRule,
  type ClassificationTool,
} from './classificationTool'

const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
const format = (value: number) => numberFormat.format(value)

const BINDING_LABELS: Record<ClassificationRule['binding'], { label: string; className: string }> = {
  pflicht: { label: 'Vorschrift', className: 'bg-accent text-accent-ink' },
  empfehlung: { label: 'Empfehlung', className: 'border-2 border-line bg-raised text-ink' },
}

/** Einstufung: über oder bis zur Grenze, mit Grenze und Anteil daran */
function ResultCard({ result, quantity, regulationLabel }: { result: ClassificationResult; quantity: number; regulationLabel: string }) {
  const { limit, overLimit, overMax } = result
  const unit = limit.unit
  const share = Math.min(quantity / limit.above, 1)
  const scope = limit.scope ? ` ${limit.scope}` : ''
  return (
    <div className={`mt-6 rounded-2xl border-2 p-4 ${overLimit ? 'border-warn-ink bg-warn text-warn-ink' : 'border-accent bg-surface'}`}>
      <p className="font-semibold">Einstufung nach {regulationLabel}</p>
      <p className="mt-1 text-2xl font-bold">{overLimit ? limit.aboveLabel : limit.belowLabel}</p>
      <p className="mt-1 text-base">
        {format(quantity)} {unit} {overLimit ? 'liegt über' : 'liegt nicht über'} der Grenze von {format(limit.above)} {unit}
        {scope}.{!overLimit && ` Noch ${format(limit.above - quantity)} ${unit} bis zur Grenze.`}
      </p>
      <div aria-hidden="true" className="mt-2 h-4 overflow-hidden rounded-full border-2 border-line bg-raised">
        <div className={`h-full ${overLimit ? 'bg-warn-ink' : 'bg-accent'}`} style={{ width: `${share * 100}%` }} />
      </div>
      {overMax && limit.max && (
        <p className="mt-3 text-lg font-bold">
          Mehr als {format(limit.max.value)} {unit}: {limit.max.text}
        </p>
      )}
      <p className={`mt-2 text-sm ${overLimit ? '' : 'text-muted'}`}>Quelle: {limit.source}</p>
    </div>
  )
}

function RuleCard({ rule, quantity, unit }: { rule: ClassificationRule; quantity: number; unit: string }) {
  const binding = BINDING_LABELS[rule.binding]
  return (
    <li className="rounded-2xl border-2 border-line bg-surface p-4">
      <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
        <h4 className="text-lg font-bold">{rule.title}</h4>
        <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${binding.className}`}>{binding.label}</span>
      </div>
      {rule.condition && <p className="mt-1 text-base font-semibold">Gilt, wenn: {rule.condition}</p>}
      <div className="mt-1 text-base">
        <RichText text={rule.text} />
      </div>
      {rule.computed && (
        <p className="mt-3 rounded-xl border-2 border-accent px-3 py-2 text-lg">
          {rule.computed.label} bei {format(quantity)} {unit}:{' '}
          <strong className="whitespace-nowrap">
            {format(computeValue(rule.computed, quantity))} {rule.computed.unit}
          </strong>
        </p>
      )}
      <p className="mt-2 text-sm text-muted">Quelle: {rule.source}</p>
    </li>
  )
}

/** Einstufungs-Tool: Regelwerk, Brennstoff und Menge wählen; Einstufung und Vorschriften nach Thema */
export function ClassificationLookup({
  tool,
  initialRegulation,
  initialFuel = '',
  initialAmount = '',
}: {
  tool: ClassificationTool
  /** Vorauswahlen (Tests) */
  initialRegulation?: string
  initialFuel?: string
  initialAmount?: string
}) {
  const idPrefix = useId()
  const [regulationKey, setRegulationKey] = useState(initialRegulation ?? tool.regulations[0]!.key)
  const [fuelKey, setFuelKey] = useState(initialFuel)
  const [amount, setAmount] = useState(initialAmount)
  const [inputUnit, setInputUnit] = useState('')

  const regulation = findRegulation(tool, regulationKey) ?? tool.regulations[0]!
  const limit = limitFor(tool, regulation.key, fuelKey)
  const units = limit ? INPUT_UNITS[limit.unit] : []
  const unit = units.find((candidate) => candidate.label === inputUnit) ?? units[0]

  // Wechselt die Einheit des Regelwerks (z. B. Pellets kg ↔ l), passt die alte Zahl nicht mehr
  const resetIfUnitChanges = (nextRegulation: string, nextFuel: string) => {
    const next = limitFor(tool, nextRegulation, nextFuel)
    if (!limit || !next || next.unit !== limit.unit) {
      setAmount('')
      setInputUnit('')
    }
  }
  const selectRegulation = (key: string) => {
    resetIfUnitChanges(key, fuelKey)
    setRegulationKey(key)
  }
  const selectFuel = (key: string) => {
    if (key !== fuelKey) resetIfUnitChanges(regulation.key, key)
    setFuelKey(key)
  }

  const parsed = amount.trim() === '' ? undefined : parseDecimal(amount)
  const amountError = amount.trim() !== '' && (parsed === undefined || parsed <= 0) ? 'Zahl größer 0 eingeben' : undefined
  const quantity = parsed !== undefined && parsed > 0 && unit ? parsed * unit.factor : undefined
  const result = quantity !== undefined ? classify(tool, regulation.key, fuelKey, quantity) : undefined
  const rules = quantity !== undefined ? rulesFor(tool, regulation.key, fuelKey, quantity) : []
  const topics = tool.topics
    .map((topic) => ({ topic, rules: rules.filter((rule) => rule.topic === topic.key) }))
    .filter((group) => group.rules.length > 0)

  return (
    <section>
      <SelectionBar
        bar={{
          key: 'regulation',
          name: 'Regelwerk',
          options: tool.regulations.map((candidate) => ({ key: candidate.key, label: candidate.label, note: '' })),
        }}
        selected={regulation.key}
        onSelect={selectRegulation}
      />
      {regulation.note && <p className="mt-2 text-base text-muted">{regulation.note}</p>}

      <h2 className="mt-6 text-xl font-bold">{tool.fuelsLabel}</h2>
      <div role="group" aria-label={tool.fuelsLabel} className="mt-2 grid gap-2 sm:grid-cols-2">
        {tool.fuels.map((fuel) => {
          const active = fuel.key === fuelKey
          return (
            <button
              key={fuel.key}
              type="button"
              aria-pressed={active}
              onClick={() => selectFuel(fuel.key)}
              className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left ${
                active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
              }`}
            >
              <span className="block font-semibold">
                {/* Häkchen, damit der Zustand nicht nur an der Farbe hängt */}
                <span aria-hidden="true">{active ? '✓ ' : ''}</span>
                {fuel.name}
              </span>
              {fuel.note && <span className={`block text-sm ${active ? '' : 'text-muted'}`}>{fuel.note}</span>}
            </button>
          )
        })}
      </div>

      {limit && unit && (
        <div className="mt-6">
          <label htmlFor={`${idPrefix}-amount`} className="block font-semibold">
            {tool.quantityLabel}
          </label>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <input
              id={`${idPrefix}-amount`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={amount}
              aria-invalid={amountError !== undefined}
              aria-describedby={limit.hint ? `${idPrefix}-hint` : undefined}
              onChange={(event) => setAmount(event.target.value)}
              className={`${fieldBase} w-36 ${amountError ? 'border-warn-ink outline-2 outline-warn' : ''}`}
            />
            {units.length > 1 ? (
              <div role="group" aria-label="Einheit" className="flex rounded-xl border-2 border-line bg-surface p-1">
                {units.map((candidate) => (
                  <button
                    key={candidate.label}
                    type="button"
                    aria-pressed={candidate.label === unit.label}
                    onClick={() => setInputUnit(candidate.label)}
                    className={`min-h-12 min-w-14 rounded-lg px-3 text-lg font-bold ${
                      candidate.label === unit.label ? 'bg-accent text-accent-ink' : ''
                    }`}
                  >
                    {candidate.label}
                  </button>
                ))}
              </div>
            ) : (
              <span className="text-lg">{unit.label}</span>
            )}
          </div>
          {amountError && <p className="mt-1 text-base font-semibold">{amountError}</p>}
          {limit.hint && (
            <p id={`${idPrefix}-hint`} className="mt-2 text-sm text-muted">
              {limit.hint}
            </p>
          )}
        </div>
      )}
      {fuelKey && !limit && (
        <p className="mt-6 text-base font-semibold">Für diese Auswahl nennt {regulation.label} keine Grenze.</p>
      )}

      <div aria-live="polite">
        {!fuelKey ? (
          <p className="mt-6 text-base text-muted">{tool.fuelsLabel} wählen.</p>
        ) : limit && result && quantity !== undefined ? (
          <>
            <ResultCard result={result} quantity={quantity} regulationLabel={regulation.label} />
            <h2 className="mt-8 text-xl font-bold">Was einzuhalten ist</h2>
            {topics.map(({ topic, rules: topicRules }) => (
              <section key={topic.key} className="mt-4">
                <h3 className="text-lg font-bold">{topic.label}</h3>
                <ul className="mt-2 space-y-3">
                  {topicRules.map((rule) => (
                    <RuleCard key={rule.key} rule={rule} quantity={quantity} unit={limit.unit} />
                  ))}
                </ul>
              </section>
            ))}
          </>
        ) : (
          limit && <p className="mt-4 text-base text-muted">{tool.quantityLabel} eingeben.</p>
        )}
      </div>

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
