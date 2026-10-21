import { useId, useState } from 'react'
import { formatSignificant } from '../../lib/number'
import { ResultsTable, Select, ValueInput } from './converterUi'
import { RATIO_FORMS, RATIO_LABELS, toDecimal, toFraction, type RatioForm } from './ratio'

const OPTIONS = RATIO_FORMS.map((form) => ({ value: form, label: RATIO_LABELS[form] }))

/** "3/4", "≈ 1/3", bei unechten Brüchen mit gemischter Schreibweise: "3/2 = 1 1/2" */
export function formatFraction(value: number): string {
  const { numerator, denominator, exact } = toFraction(value)
  const prefix = exact ? '' : '≈ '
  if (denominator === 1) return `${prefix}${numerator}`
  const base = `${prefix}${numerator}/${denominator}`
  const whole = Math.trunc(numerator / denominator)
  if (whole === 0) return base
  const rest = Math.abs(numerator % denominator)
  return `${base} = ${whole} ${rest}/${denominator}`
}

function formatAs(value: number, form: RatioForm): string {
  switch (form) {
    case 'percent':
      return `${formatSignificant(value * 100)} %`
    case 'permille':
      return `${formatSignificant(value * 1000)} ‰`
    case 'decimal':
      return formatSignificant(value)
    case 'fraction':
      return formatFraction(value)
  }
}

export function RatioConverter({ initialValue = '75', initialForm = 'percent' as RatioForm }) {
  const id = useId()
  const [raw, setRaw] = useState(initialValue)
  const [form, setForm] = useState<RatioForm>(initialForm)
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
        <Select id={`${id}-form`} label="Angabe als" options={OPTIONS} value={form} onChange={setForm} />
      </div>
      <ResultsTable
        title="Ergebnis"
        rows={
          value === undefined
            ? []
            : RATIO_FORMS.map((target) => ({
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
