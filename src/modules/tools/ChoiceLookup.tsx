import { Fragment, useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { defaultBarSelection, sectionVisible, type ChoiceSection, type ChoiceTool } from './schema'
import { withUnit } from './TableLookup'

type ChoiceColumn = ChoiceSection['columns'][number]
type ChoiceOption = ChoiceSection['options'][number]
type ChoiceBar = ChoiceTool['bars'][number]

const card = 'mt-4 rounded-2xl border-2 border-accent bg-surface p-4'

/**
 * Auswahl-Tool: optional oben Leisten (z. B. Ausführung, dann Sanitärgegenstände/Zubehör), darunter
 * je sichtbarem Abschnitt eine Option wählen (Skala oder Dropdown), dazu deren Werte
 */
export function ChoiceLookup({
  tool,
  initialSelection = {},
  initialBars,
}: {
  tool: ChoiceTool
  /** Vorauswahl je Abschnitt, Index wie in tool.sections */
  initialSelection?: Record<number, string>
  /** Stellung der Leisten: Leisten-key → Options-key */
  initialBars?: Record<string, string>
}) {
  const [bars, setBars] = useState(() => ({ ...defaultBarSelection(tool), ...initialBars }))
  // Auswahl je Eingabe (z. B. „Sanitärgegenstand“), damit „WC“ beim Wechsel der Ausführung stehen bleibt
  const [labels, setLabels] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      Object.entries(initialSelection).map(([index, label]) => [tool.sections[Number(index)]!.inputName, label]),
    ),
  )
  return (
    <>
      {tool.bars.map((bar) => (
        <SelectionBar
          key={bar.key}
          bar={bar}
          selected={bars[bar.key]}
          onSelect={(option) => setBars({ ...bars, [bar.key]: option })}
        />
      ))}
      {tool.sections.map(
        (section) =>
          sectionVisible(section, bars) && (
            <ChoiceSectionView
              key={section.title}
              section={section}
              hideTitle={tool.bars.length > 0}
              selected={labels[section.inputName] ?? ''}
              onSelect={(label) => setLabels({ ...labels, [section.inputName]: label })}
            />
          ),
      )}
    </>
  )
}

/** Leiste über den Abschnitten; jede Schaltfläche mit Namen und optional kleiner zweiter Zeile */
function SelectionBar({
  bar,
  selected,
  onSelect,
}: {
  bar: ChoiceBar
  selected: string | undefined
  onSelect: (key: string) => void
}) {
  return (
    <div className="mt-6">
      <p className="font-semibold">{bar.name}</p>
      <div role="group" aria-label={bar.name} className="mt-1 flex rounded-xl border-2 border-line bg-surface p-1">
        {bar.options.map((option) => {
          const active = option.key === selected
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.key)}
              className={`flex min-h-14 min-w-0 flex-1 flex-col items-center justify-center rounded-lg px-1 text-center leading-tight ${
                active ? 'bg-accent text-accent-ink' : ''
              }`}
            >
              <span className="text-sm font-bold min-[400px]:text-base">{option.label}</span>
              {option.note && <span className={`text-xs ${active ? '' : 'text-muted'}`}>{option.note}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Spalten in Gruppen; Spalten ohne Gruppe stehen in einer Gruppe ohne Überschrift */
function groupColumns(columns: ChoiceColumn[]): { group: string; columns: ChoiceColumn[] }[] {
  const groups: { group: string; columns: ChoiceColumn[] }[] = []
  for (const column of columns) {
    const group = column.group ?? ''
    const last = groups.at(-1)
    if (last && last.group === group) last.columns.push(column)
    else groups.push({ group, columns: [column] })
  }
  return groups
}

/** Werte eines Blocks; eine Spalte mit subheading beginnt einen Unterabschnitt mit eigener Zwischenüberschrift */
function BlockValues({ columns, option }: { columns: ChoiceColumn[]; option: ChoiceOption }) {
  const parts: { heading?: string; columns: ChoiceColumn[] }[] = []
  for (const column of columns) {
    if (column.subheading || parts.length === 0) parts.push({ heading: column.subheading, columns: [column] })
    else parts.at(-1)!.columns.push(column)
  }
  return parts.map((part, index) => (
    <Fragment key={index}>
      {part.heading && <h4 className="mt-4 text-lg font-bold text-accent">{part.heading}</h4>}
      <ValueList columns={part.columns} option={option} />
    </Fragment>
  ))
}

function ValueList({ columns, option }: { columns: ChoiceColumn[]; option: ChoiceOption }) {
  return (
    <dl className="mt-2 space-y-1">
      {columns.map((column) => (
        <div
          key={column.key}
          className={`flex flex-wrap items-baseline gap-x-3 ${column.hideName || column.valueFirst ? '' : 'justify-between'}`}
        >
          <dt className={column.hideName ? 'sr-only' : 'text-base text-muted'}>{column.name}</dt>
          {/* Bei valueFirst steht der Wert per CSS vorn; im HTML bleibt dt vor dd */}
          <dd className={`${column.unit ? 'text-2xl font-bold' : 'text-lg font-semibold'} ${column.valueFirst ? 'order-first' : ''}`}>
            {column.label && `${column.label} = `}
            {withUnit(option.values[column.key]!, column.unit)}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function ChoiceSectionView({
  section,
  hideTitle,
  selected,
  onSelect,
}: {
  section: ChoiceSection
  /** Bei Leisten sagt die Stellung schon, welcher Abschnitt das ist: Titel nur für Screenreader */
  hideTitle: boolean
  selected: string
  onSelect: (label: string) => void
}) {
  const idPrefix = useId()
  const option = section.options.find((candidate) => candidate.label === selected)
  const grouped = section.columns.some((column) => column.group !== undefined)

  return (
    <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
      <h2 id={`${idPrefix}-heading`} className={hideTitle ? 'sr-only' : 'text-xl font-bold'}>
        {section.title}
      </h2>
      {section.display === 'scale' ? (
        <ScaleBar section={section} selected={selected} onSelect={onSelect} />
      ) : (
        <>
          <label htmlFor={`${idPrefix}-select`} className="sr-only">
            {section.inputName}
          </label>
          <select
            id={`${idPrefix}-select`}
            value={option ? selected : ''}
            onChange={(event) => onSelect(event.target.value)}
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

      <div aria-live="polite">
        {!option ? (
          <div className={card}>
            <p className="text-base text-muted">
              {section.inputName} {section.display === 'scale' ? 'in der Leiste antippen' : 'wählen'}.
            </p>
          </div>
        ) : grouped ? (
          // Je Gruppe ein eigener Block, z. B. Montagehöhen, Bewegungsflächen, Abstandsmaße
          <>
            {option.note && <p className="mt-3 text-base text-muted">{option.note}</p>}
            {groupColumns(section.columns.filter((column) => column.key in option.values)).map(({ group, columns }) => (
              <div key={group} className={card}>
                {group && (
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <h3 className="text-lg font-bold text-accent">{group}</h3>
                    {section.groupNotes[group] && <span className="text-base text-muted">{section.groupNotes[group]}</span>}
                  </div>
                )}
                <BlockValues columns={columns} option={option} />
              </div>
            ))}
          </>
        ) : (
          <div className={card}>
            {/* Bei der Skala als Überschrift der Zusatz (z. B. „Frostschutz“), sonst die Stufe selbst */}
            <p className="font-semibold">{section.display === 'scale' ? option.note || option.label : option.label}</p>
            {section.display !== 'scale' && option.note && <p className="text-base text-muted">{option.note}</p>}
            <ValueList columns={section.columns.filter((column) => column.key in option.values)} option={option} />
          </div>
        )}
      </div>
    </section>
  )
}

/** Skala wie auf dem Thermostatkopf: Stufen nebeneinander auf einem Verlauf von kalt nach warm */
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
      <div
        role="group"
        aria-label={section.inputName}
        className="flex rounded-xl border-2 border-line bg-linear-to-r from-[var(--scale-cold)] to-[var(--scale-hot)] p-1 text-white"
      >
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
                active ? 'bg-surface text-ink shadow-md' : ''
              }`}
            >
              <span className="text-base font-bold whitespace-nowrap">{candidate.label}</span>
              <span className={`text-xs tabular-nums ${active ? 'text-muted' : 'text-white/90'}`}>
                {(candidate.values[preview.key] ?? '').replace(/^ca\.\s*/, '')}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
