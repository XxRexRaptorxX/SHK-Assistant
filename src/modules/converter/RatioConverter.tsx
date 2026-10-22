import { useId, useState } from 'react'
import { formatSignificant } from '../../lib/number'
import { useSettings } from '../../settings/settings'
import { ResultsTable, Select, ValueInput } from './converterUi'
import {
  RATIO_FORMS,
  RATIO_LABELS,
  RATIO_SCALE,
  RATIO_SYMBOLS,
  formatFractionParts,
  toDecimal,
  toFraction,
  type RatioForm,
} from './ratio'

/** "3/4", "≈ 1/3", bei unechten Brüchen mit gemischter Schreibweise: "3/2 = 1 1/2" */
export function formatFraction(value: number): string {
  const { numerator, denominator, exact } = toFraction(value)
  return formatFractionParts(numerator, denominator, exact)
}

function formatAs(value: number, form: RatioForm): string {
  if (form === 'fraction') return formatFraction(value)
  const symbol = RATIO_SYMBOLS[form]
  const number = formatSignificant(value * RATIO_SCALE[form])
  return symbol ? `${number} ${symbol}` : number
}

interface RatioConverterProps {
  initialValue?: string
  initialForm?: RatioForm
  /** Unübliche Formen aus dem Inhalt (rare) */
  rare?: readonly string[]
  /** Für Tests überschreibbar, sonst aus den Einstellungen */
  hideRareUnits?: boolean
}

export function RatioConverter({ initialValue = '75', initialForm = 'percent', rare = [], hideRareUnits }: RatioConverterProps) {
  const id = useId()
  const settings = useSettings()
  const hideRare = hideRareUnits ?? settings.hideRareUnits
  const forms = RATIO_FORMS.filter((f) => !(hideRare && rare.includes(f)))
  const options = forms.map((f) => ({ value: f, label: RATIO_LABELS[f] }))
  const [raw, setRaw] = useState(initialValue)
  const [chosenForm, setForm] = useState<RatioForm>(initialForm)
  const form = forms.includes(chosenForm) ? chosenForm : (forms[0] ?? 'percent')
  const value = toDecimal(raw, form)
  const invalid = raw.trim() !== '' && value === undefined

  return (
    <section className="mt-2" aria-label="Prozent, Dezimalzahl und Bruch umrechnen">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Wert
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2 [&>input]:flex-1">
        <ValueInput
          id={`${id}-value`}
          value={raw}
          onChange={setRaw}
          invalid={invalid}
          inputMode={form === 'fraction' ? 'text' : 'decimal'}
          hint={form === 'fraction' ? 'Beispiel: 3/4 oder 1 1/2' : 'Beispiel: 12,5'}
        />
        <Select id={`${id}-form`} label="Angabe als" options={options} value={form} onChange={setForm} />
      </div>
      <ResultsTable
        title="Ergebnis"
        rows={
          value === undefined
            ? []
            : forms.map((target) => ({
                key: target,
                value: formatAs(value, target),
                label: RATIO_LABELS[target],
                highlight: target === form,
              }))
        }
      />
    </section>
  )
}
