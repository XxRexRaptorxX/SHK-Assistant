import { useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import type { ChoiceSection, ChoiceTool } from './schema'
import { withUnit } from './TableLookup'

/** Auswahl-Tool: je Abschnitt eine Option wählen (Skala oder Dropdown), dazu deren Werte */
export function ChoiceLookup({ tool, initialSelection = {} }: { tool: ChoiceTool; initialSelection?: Record<number, string> }) {
  return (
    <>
      {tool.sections.map((section, index) => (
        <ChoiceSectionView key={section.title} section={section} initialLabel={initialSelection[index]} />
      ))}
    </>
  )
}

function ChoiceSectionView({ section, initialLabel }: { section: ChoiceSection; initialLabel?: string }) {
  const idPrefix = useId()
  const [selected, setSelected] = useState(initialLabel ?? '')
  const option = section.options.find((candidate) => candidate.label === selected)

  return (
    <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
      <h2 id={`${idPrefix}-heading`} className="text-xl font-bold">
        {section.title}
      </h2>
      {section.display === 'scale' ? (
        <ScaleBar section={section} selected={selected} onSelect={setSelected} />
      ) : (
        <>
          <label htmlFor={`${idPrefix}-select`} className="sr-only">
            {section.inputName}
          </label>
          <select
            id={`${idPrefix}-select`}
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className={`${fieldBase} mt-3 w-full`}
          >
            <option value="" disabled>
              {section.inputName} wählen …
            </option>
            {section.options.map((candidate) => (
              <option key={candidate.label} value={candidate.label}>
                {candidate.label}
              </option>
            ))}
          </select>
        </>
      )}

      <div className="mt-4 rounded-2xl border-2 border-accent bg-surface p-4" aria-live="polite">
        {option ? (
          <>
            {/* Bei der Skala als Überschrift der Zusatz (z. B. „Frostschutz“), sonst die Stufe selbst */}
            <p className="font-semibold">{section.display === 'scale' ? option.note || option.label : option.label}</p>
            {section.display !== 'scale' && option.note && <p className="text-base text-muted">{option.note}</p>}
            <dl className="mt-2 space-y-1">
              {section.columns.map((column) => (
                <div key={column.key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="text-base text-muted">{column.name}</dt>
                  <dd className={column.unit ? 'text-2xl font-bold' : 'text-lg font-semibold'}>
                    {column.label && `${column.label} = `}
                    {withUnit(option.values[column.key] ?? '–', column.unit)}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-base text-muted">
            {section.inputName} {section.display === 'scale' ? 'in der Leiste antippen' : 'wählen'}.
          </p>
        )}
      </div>
    </section>
  )
}

/** Skala wie auf dem Thermostatkopf: Stufen nebeneinander, darunter ein Verlauf von kalt nach warm */
function ScaleBar({
  section,
  selected,
  onSelect,
}: {
  section: ChoiceSection
  selected: string
  onSelect: (label: string) => void
}) {
  // Erste Spalte als Kurzinfo unter jeder Stufe, z. B. die Temperatur
  const preview = section.columns[0]!
  return (
    <div className="mt-3">
      <div role="group" aria-label={section.inputName} className="flex rounded-xl border-2 border-line bg-surface p-1">
        {section.options.map((candidate) => {
          const active = candidate.label === selected
          return (
            <button
              key={candidate.label}
              type="button"
              aria-pressed={active}
              aria-label={[candidate.label, candidate.note].filter(Boolean).join(', ')}
              onClick={() => onSelect(candidate.label)}
              className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-lg leading-tight ${
                active ? 'bg-accent text-accent-ink' : ''
              }`}
            >
              <span className="text-base font-bold whitespace-nowrap">{candidate.label}</span>
              <span className={`text-xs tabular-nums ${active ? '' : 'text-muted'}`}>
                {(candidate.values[preview.key] ?? '').replace(/^ca\.\s*/, '')}
              </span>
            </button>
          )
        })}
      </div>
      <div
        aria-hidden="true"
        className="mx-1 mt-1.5 h-1.5 rounded-full bg-linear-to-r from-[var(--fig-cold)] to-[var(--fig-hot)]"
      />
    </div>
  )
}
