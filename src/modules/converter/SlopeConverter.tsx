import { useId, useState } from 'react'
import { formatSignificant, parseDecimal } from '../../lib/number'
import { ResultsTable, Select, ValueInput } from './converterUi'
import { ratioToSlope, SLOPE_FORMS, SLOPE_LABELS, slopeToRatio, type SlopeForm } from './slope'

const OPTIONS = SLOPE_FORMS.map((form) => ({ value: form, label: SLOPE_LABELS[form] }))

function formatSlope(value: number | undefined, form: SlopeForm): string {
  if (value === undefined) return '–'
  const text = formatSignificant(value, 5)
  return form === 'oneTo' ? `1 : ${text}` : text
}

export function SlopeConverter({ initialValue = '2', initialForm = 'percent' as SlopeForm }) {
  const id = useId()
  const [raw, setRaw] = useState(initialValue)
  const [form, setForm] = useState<SlopeForm>(initialForm)
  const value = parseDecimal(raw)
  const ratio = value === undefined ? undefined : slopeToRatio(value, form)
  const invalid = raw.trim() !== '' && ratio === undefined

  return (
    <section className="mt-2" aria-label="Steigung umrechnen">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Steigung
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2 [&>input]:flex-1">
        <ValueInput
          id={`${id}-value`}
          value={raw}
          onChange={setRaw}
          invalid={invalid}
          hint={form === 'degree' ? 'Winkel unter 90°' : form === 'oneTo' ? 'x ungleich 0' : 'Beispiel: 2,5'}
        />
        <Select id={`${id}-form`} label="Angabe als" options={OPTIONS} value={form} onChange={setForm} />
      </div>
      <ResultsTable
        title="Ergebnis"
        rows={
          ratio === undefined
            ? []
            : SLOPE_FORMS.map((target) => ({
                key: target,
                value: formatSlope(ratioToSlope(ratio, target), target),
                label: SLOPE_LABELS[target],
                highlight: target === form,
              }))
        }
      />
    </section>
  )
}
