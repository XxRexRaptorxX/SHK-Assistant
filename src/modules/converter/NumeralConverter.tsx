import { useId, useState } from 'react'
import { useSettings } from '../../settings/settings'
import { ResultsTable, Select, ValueInput } from './converterUi'
import { formatNumeral, MAX_DIGITS, NUMERAL_LABELS, NUMERAL_SYSTEMS, parseNumeral, type NumeralSystem } from './numeral'

interface NumeralConverterProps {
  initialValue?: string
  initialSystem?: NumeralSystem
  /** Unübliche Systeme aus dem Inhalt (rare) */
  rare?: readonly string[]
  /** Für Tests überschreibbar, sonst aus den Einstellungen */
  hideRareUnits?: boolean
}

export function NumeralConverter({ initialValue = '255', initialSystem = 'dec', rare = [], hideRareUnits }: NumeralConverterProps) {
  const id = useId()
  const settings = useSettings()
  const hideRare = hideRareUnits ?? settings.hideRareUnits
  const systems = NUMERAL_SYSTEMS.filter((s) => !(hideRare && rare.includes(s)))
  const options = systems.map((s) => ({ value: s, label: NUMERAL_LABELS[s] }))
  const [raw, setRaw] = useState(initialValue)
  const [chosenSystem, setSystem] = useState<NumeralSystem>(initialSystem)
  const system = systems.includes(chosenSystem) ? chosenSystem : (systems[0] ?? 'dec')
  const value = parseNumeral(raw, system)
  const invalid = raw.trim() !== '' && value === undefined

  return (
    <section className="mt-2" aria-label="Zahlensysteme umrechnen">
      <label htmlFor={`${id}-value`} className="block font-semibold">
        Ganze Zahl
      </label>
      <div className="mt-1 flex flex-wrap items-center gap-2 [&>input]:flex-1">
        <ValueInput
          id={`${id}-value`}
          value={raw}
          onChange={setRaw}
          invalid={invalid}
          inputMode={system === 'dec' || system === 'oct' || system === 'bin' || system === 'ter' ? 'decimal' : 'text'}
          hint={`nur Ziffern des Systems, ganze Zahlen bis ${MAX_DIGITS} Stellen`}
        />
        <Select id={`${id}-system`} label="Zahlensystem" options={options} value={system} onChange={setSystem} />
      </div>
      <ResultsTable
        title="In allen Zahlensystemen"
        wrapValues
        rows={
          value === undefined
            ? []
            : systems.map((target) => ({
                key: target,
                value: formatNumeral(value, target),
                label: NUMERAL_LABELS[target],
                highlight: target === system,
              }))
        }
      />
    </section>
  )
}
