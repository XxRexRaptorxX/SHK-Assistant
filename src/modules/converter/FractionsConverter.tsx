import { useId, useState } from 'react'
import { formatSignificant } from '../../lib/number'
import { useSettings } from '../../settings/settings'
import { ResultsTable, ValueInput } from './converterUi'
import { DENOMINATOR_LABELS, FRACTION_DENOMINATORS, inDenominator } from './fractions'
import { parseFraction } from './ratio'
import { formatFraction } from './RatioConverter'

interface FractionsConverterProps {
  initialValue?: string
  /** Unübliche Nenner aus dem Inhalt (rare) */
  rare?: readonly string[]
  /** Für Tests überschreibbar, sonst aus den Einstellungen */
  hideRareUnits?: boolean
}

export function FractionsConverter({ initialValue = '3/4', rare = [], hideRareUnits }: FractionsConverterProps) {
  const id = useId()
  const settings = useSettings()
  const hideRare = hideRareUnits ?? settings.hideRareUnits
  const denominators = FRACTION_DENOMINATORS.filter((d) => !(hideRare && rare.includes(d)))
  const [raw, setRaw] = useState(initialValue)
  const value = parseFraction(raw)
  const invalid = raw.trim() !== '' && value === undefined

  return (
    <section className="mt-2" aria-label="Brüche umrechnen">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Bruch oder Zahl
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2 [&>input]:flex-1">
        <ValueInput
          id={`${id}-value`}
          value={raw}
          onChange={setRaw}
          invalid={invalid}
          inputMode="text"
          hint="Beispiel: 3/4, 1 1/2 oder 0,75"
        />
      </div>
      <ResultsTable
        title="In anderen Nennern"
        rows={
          value === undefined
            ? []
            : [
                { key: 'reduced', value: formatFraction(value), label: 'Gekürzt', highlight: true },
                { key: 'decimal', value: formatSignificant(value), label: 'Dezimalzahl' },
                ...denominators.map((d) => ({
                  key: d,
                  value: inDenominator(value, Number(d)),
                  label: DENOMINATOR_LABELS[d],
                })),
              ]
        }
      />
      <p className="mt-2 text-base text-muted">
        „≈“: Mit diesem Nenner geht es nicht genau, gezeigt ist der nächste Bruch.
      </p>
    </section>
  )
}
