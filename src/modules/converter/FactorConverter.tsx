import { useId, useState } from 'react'
import { InfoIcon } from '../../components/icons'
import { formatSignificant, parseDecimal } from '../../lib/number'
import { useSettings } from '../../settings/settings'
import { ConversionInputs, displayName, RareUnitsToggle, ResultsTable } from './converterUi'
import type { ConverterEntry, ConverterFactor } from './schema'
import { lexiconPathFor } from '../lexicon/termLinks'

/** Richtwerte: wenige gültige Stellen, um keine falsche Genauigkeit vorzutäuschen; exakte Verhältnisse voll */
const APPROXIMATE_DIGITS = 3
const EXACT_DIGITS = 6

/** Bezugsmengen, die eine Einheit dieser Größe ausmacht, z. B. 1 l Heizöl = 10 kWh */
export function baseAmount(factor: ConverterFactor): number {
  return (factor.per ?? 1) / factor.value
}

export function convertByFactors(value: number, from: ConverterFactor, to: ConverterFactor): number {
  // Ohne „per“ (= 1) genau wie bisher (value / from.value) * to.value, damit exakte Verhältnisse exakt bleiben
  return (((value / from.value) * (from.per ?? 1)) / (to.per ?? 1)) * to.value
}

/** Umrechnung über Richtwert-Faktoren aus dem Inhalt (ohne mathjs-Einheiten) */
export function FactorConverter({
  entry,
  initialValue = '1',
  hideRareUnits,
  showUnitNames,
}: {
  entry: ConverterEntry
  initialValue?: string
  /** Für Tests überschreibbar, sonst aus den Einstellungen */
  hideRareUnits?: boolean
  showUnitNames?: boolean
}) {
  const id = useId()
  const settings = useSettings()
  const hideRare = hideRareUnits ?? settings.hideRareUnits
  const showNames = showUnitNames ?? settings.showUnitNames
  const factors = entry.factors.filter((factor) => !(hideRare && entry.rare.includes(factor.key)))
  const byKey = new Map(factors.map((factor) => [factor.key, factor]))
  const [raw, setRaw] = useState(initialValue)
  const [chosenFrom, setFromKey] = useState(entry.from)
  const [chosenTo, setToKey] = useState(entry.to)
  // Ausgeblendete Auswahl auf die erste bzw. zweite verbleibende Größe zurücksetzen
  const fromKey = byKey.has(chosenFrom) ? chosenFrom : (factors[0]?.key ?? '')
  const toKey = byKey.has(chosenTo) ? chosenTo : (factors.find((f) => f.key !== fromKey)?.key ?? '')
  const from = byKey.get(fromKey)
  const to = byKey.get(toKey)

  const parsed = parseDecimal(raw)
  const belowMin = parsed !== undefined && entry.min !== undefined && parsed < entry.min
  const value = belowMin ? undefined : parsed
  const empty = raw.trim() === ''
  const invalid = !empty && value === undefined
  const hint = belowMin ? (entry.min === 0 ? 'keine negativen Werte' : `mindestens ${entry.min}`) : undefined
  const options = factors.map((factor) => ({ value: factor.key, label: factor.label }))
  const format = (n: number) =>
    entry.approximate ? `≈ ${formatSignificant(n, APPROXIMATE_DIGITS)}` : formatSignificant(n, EXACT_DIGITS)

  return (
    <section className="mt-2" aria-label="Umrechnen">
      <ConversionInputs
        id={id}
        raw={raw}
        onRawChange={setRaw}
        invalid={invalid}
        hint={hint}
        emptyHint="Bitte eine Menge eingeben."
        result={value !== undefined && from && to ? format(convertByFactors(value, from, to)) : '–'}
        options={options}
        from={fromKey}
        to={toKey}
        onFromChange={setFromKey}
        onToChange={setToKey}
      />


      <ResultsTable
        title={entry.approximate ? 'In allen Maßen (Richtwerte)' : 'In allen Maßen'}
        action={entry.rare.length > 0 && <RareUnitsToggle hidden={hideRare} />}
        rows={
          value === undefined || !from
            ? []
            : factors.map((factor) => ({
                key: factor.key,
                value: format(convertByFactors(value, from, factor)),
                label: factor.label,
                name: displayName(entry.names, factor.key, factor.label, showNames),
                href: lexiconPathFor([entry.names[factor.key], factor.label]),
                highlight: factor.key === fromKey,
              }))
        }
      />

      {entry.base && <BaseOverview entry={entry} />}
    </section>
  )
}

/** Übersicht „1 Größe = … Bezugsgröße“ je Gruppe, Quelle hinter einem i-Knopf (z. B. Heizwerte der Energieträger) */
function BaseOverview({ entry }: { entry: ConverterEntry }) {
  const base = entry.factors.find((factor) => factor.key === entry.base)
  if (!base) return null
  const groups: { name: string; factors: ConverterFactor[] }[] = []
  for (const factor of entry.factors) {
    if (factor.key === base.key) continue
    const name = factor.group ?? ''
    const group = groups.find((candidate) => candidate.name === name)
    if (group) group.factors.push(factor)
    else groups.push({ name, factors: [factor] })
  }
  return (
    <section className="mt-6" aria-labelledby={`overview-${entry.id}`}>
      <h2 id={`overview-${entry.id}`} className="text-xl font-bold">
        1 Einheit in {base.label}
      </h2>
      <div className="mt-2 space-y-3">
        {groups.map((group) => (
          <section
            key={group.name}
            aria-label={group.name || 'Weitere'}
            className="rounded-2xl border border-edge bg-surface"
          >
            {group.name && <h3 className="border-b border-edge px-3 py-2 font-bold">{group.name}</h3>}
            <ul className="divide-y divide-edge">
              {group.factors.map((factor) => (
                <BaseRow key={factor.key} entry={entry} factor={factor} base={base} />
              ))}
            </ul>
          </section>
        ))}
      </div>
    </section>
  )
}

function BaseRow({ entry, factor, base }: { entry: ConverterEntry; factor: ConverterFactor; base: ConverterFactor }) {
  const [open, setOpen] = useState(false)
  const noteId = `${entry.id}-${factor.key}-source`
  const name = entry.names[factor.key] ?? factor.label
  return (
    <li className="px-3 py-1">
      <div className="flex items-center gap-2">
        <p className="min-w-0 flex-1">
          <span className="font-semibold">1 {factor.label}</span>
          <span className="block text-sm text-muted">{[name, factor.note].filter(Boolean).join(' · ')}</span>
        </p>
        <p className="text-lg font-bold whitespace-nowrap tabular-nums">
          {formatSignificant(convertByFactors(1, factor, base), 4)} {base.label}
        </p>
        {factor.source && (
          <button
            type="button"
            aria-label={`Quelle ${name}`}
            aria-expanded={open}
            aria-controls={noteId}
            onClick={() => setOpen(!open)}
            className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg print:hidden ${open ? 'bg-accent text-accent-ink' : 'text-muted'}`}
          >
            <InfoIcon className="size-5" />
          </button>
        )}
      </div>
      {open && factor.source && (
        <p id={noteId} className="pb-2 text-sm text-muted [overflow-wrap:anywhere]">
          {factor.source}
        </p>
      )}
    </li>
  )
}
