import { useId, useRef, useState } from 'react'
import { secondaryButton } from '../../components/buttons'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { parseDecimal } from '../../lib/number'
import {
  categoryOf,
  findSubstance,
  rulesForLoad,
  summarizeLoad,
  type HazmatPointsTool,
  type HazmatSubstance,
  type HazmatUnit,
  type LoadItem,
} from './hazmatPointsTool'

/** Eine Zeile der Ladung: Anzahl × Menge je Gebinde eines Stoffs, Eingaben als Text */
export interface LoadLine {
  substance: string
  count: string
  size: string
}

interface KeyedLine extends LoadLine {
  id: number
}

// Ohne Tausenderpunkt, damit „1000 Punkte“ wie der Name der Regel aussieht
const numberFormat = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2, useGrouping: false })
const format = (value: number) => numberFormat.format(value)

const withUnit = (value: number, unit: HazmatUnit) => `${format(value)} ${unit}`

/** Gesamtmenge einer Zeile oder Fehlermeldung; leer = noch nichts eingegeben */
function lineQuantity(line: LoadLine, substance: HazmatSubstance): { quantity?: number; countError?: string; sizeError?: string } {
  const count = line.count.trim() === '' ? undefined : parseDecimal(line.count)
  const countError =
    line.count.trim() === ''
      ? undefined
      : count === undefined || !Number.isInteger(count) || count < 1
        ? 'Ganze Zahl ab 1 eingeben (Beispiel: 2)'
        : undefined
  if (substance.unit === 'Stk.') return { quantity: countError || count === undefined ? undefined : count, countError }
  const size = line.size.trim() === '' ? undefined : parseDecimal(line.size)
  const sizeError = line.size.trim() !== '' && (size === undefined || size <= 0) ? 'Menge größer 0 eingeben (Beispiel: 11)' : undefined
  const quantity = count !== undefined && size !== undefined && !countError && !sizeError ? count * size : undefined
  return { quantity, countError, sizeError }
}

/** Auswahl der Gefahrgüter: je Gruppe Knöpfe zum Ein- und Ausschalten, mehrere gleichzeitig */
function SubstancePicker({
  tool,
  selected,
  onToggle,
}: {
  tool: HazmatPointsTool
  selected: ReadonlySet<string>
  onToggle: (substance: HazmatSubstance) => void
}) {
  return (
    <>
      {tool.groups.map((group) => (
        <div key={group.key} className="mt-4">
          <h3 className="text-lg font-semibold">{group.label}</h3>
          <div role="group" aria-label={group.label} className="mt-1 grid gap-2 sm:grid-cols-2">
            {tool.substances
              .filter((substance) => substance.group === group.key)
              .map((substance) => {
                const active = selected.has(substance.key)
                return (
                  <button
                    key={substance.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => onToggle(substance)}
                    className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left ${
                      active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
                    }`}
                  >
                    <span className="block font-semibold">
                      {/* Häkchen, damit der Zustand nicht nur an der Farbe hängt */}
                      <span aria-hidden="true">{active ? '✓ ' : ''}</span>
                      {substance.name}
                    </span>
                    <span className={`block text-sm ${active ? '' : 'text-muted'}`}>
                      {substance.un ? `UN ${substance.un} · ` : ''}Kategorie {substance.transportCategory}
                    </span>
                  </button>
                )
              })}
          </div>
        </div>
      ))}
    </>
  )
}

function LineCard({
  tool,
  line,
  onChange,
  onRemove,
  onAddSize,
}: {
  tool: HazmatPointsTool
  line: KeyedLine
  onChange: (patch: Partial<LoadLine>) => void
  onRemove: () => void
  onAddSize: () => void
}) {
  const idPrefix = useId()
  const substance = findSubstance(tool, line.substance)!
  const { factor } = categoryOf(tool, substance.transportCategory)
  const { quantity, countError, sizeError } = lineQuantity(line, substance)
  const pieces = substance.unit === 'Stk.'
  const sizeValue = parseDecimal(line.size)
  return (
    <article className="mt-3 rounded-2xl border-2 border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-lg font-bold">{substance.name}</h3>
          <p className="text-sm text-muted">
            {substance.un ? `UN ${substance.un} · ` : ''}
            {substance.officialName} · {substance.classInfo}
          </p>
          <p className="mt-1 text-sm font-semibold">
            Beförderungskategorie {substance.transportCategory}
            {factor === null ? ' · keine Freistellung' : ` · Faktor ${format(factor)}`}
          </p>
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${substance.name} entfernen`}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-line text-xl font-bold print:hidden"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
        <div>
          <label htmlFor={`${idPrefix}-count`} className="block font-semibold">
            Anzahl
          </label>
          <input
            id={`${idPrefix}-count`}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            value={line.count}
            aria-invalid={countError !== undefined}
            onChange={(event) => onChange({ count: event.target.value })}
            className={`${fieldBase} mt-1 w-24 ${countError ? 'border-warn-ink outline-2 outline-warn' : ''}`}
          />
        </div>
        {!pieces && (
          <div>
            <label htmlFor={`${idPrefix}-size`} className="block font-semibold">
              Menge je Gebinde
            </label>
            <div className="mt-1 flex items-center gap-2">
              <input
                id={`${idPrefix}-size`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                value={line.size}
                aria-invalid={sizeError !== undefined}
                aria-describedby={`${idPrefix}-basis`}
                onChange={(event) => onChange({ size: event.target.value })}
                className={`${fieldBase} w-28 ${sizeError ? 'border-warn-ink outline-2 outline-warn' : ''}`}
              />
              <span className="text-lg">{substance.unit}</span>
            </div>
          </div>
        )}
      </div>
      {countError && <p className="mt-1 text-base font-semibold">{countError}</p>}
      {sizeError && <p className="mt-1 text-base font-semibold">{sizeError}</p>}
      <p id={`${idPrefix}-basis`} className="mt-2 text-sm text-muted">
        Zählt: {substance.quantityBasis}
      </p>
      {substance.sizes.length > 0 && (
        <div role="group" aria-label={`Gebindegrößen ${substance.name}`} className="mt-2 flex flex-wrap gap-2 print:hidden">
          {substance.sizes.map((size) => (
            <button
              key={size}
              type="button"
              aria-pressed={sizeValue === size}
              onClick={() => onChange({ size: format(size) })}
              className={`min-h-12 rounded-xl border-2 px-3 font-semibold ${
                sizeValue === size ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
              }`}
            >
              {withUnit(size, substance.unit)}
            </button>
          ))}
        </div>
      )}
      {substance.note && <p className="mt-2 text-sm">{substance.note}</p>}

      <p className="mt-3 text-lg font-semibold" aria-live="polite">
        {quantity === undefined
          ? pieces
            ? 'Anzahl eingeben'
            : 'Anzahl und Menge eingeben'
          : factor === null
            ? `${withUnit(quantity, substance.unit)}: Kategorie 0, keine Freistellung`
            : pieces
              ? `${format(quantity)} Stück × ${format(factor)} = ${format(quantity * factor)} Punkte`
              : `${line.count.trim()} × ${withUnit(sizeValue!, substance.unit)} = ${withUnit(quantity, substance.unit)} × ${format(factor)} = ${format(quantity * factor)} Punkte`}
      </p>
      {!pieces && (
        <button type="button" onClick={onAddSize} className={`${secondaryButton} mt-3 print:hidden`}>
          <span aria-hidden="true">+</span> Weitere Gebindegröße
        </button>
      )}
    </article>
  )
}

/** Summe, Ampel zur Grenze und die Mengen je Kategorie für das Beförderungspapier */
function ResultCard({ tool, items, incomplete }: { tool: HazmatPointsTool; items: LoadItem[]; incomplete: boolean }) {
  const summary = summarizeLoad(tool, items)
  const { total, exempt, hasCategoryZero } = summary
  const empty = summary.positions.length === 0
  const share = Math.min(total / tool.limit, 1)
  const quantities = (values: Partial<Record<HazmatUnit, number>>) =>
    (Object.entries(values) as [HazmatUnit, number][]).map(([unit, value]) => withUnit(value, unit)).join(' + ')
  return (
    <div
      aria-live="polite"
      className={`mt-6 rounded-2xl border-2 p-4 ${exempt || empty ? 'border-accent bg-surface' : 'border-warn-ink bg-warn text-warn-ink'}`}
    >
      <p className="font-semibold">Punktsumme ({tool.edition}, 1.1.3.6)</p>
      <p className="text-4xl font-bold">
        {format(total)} <span className="text-xl font-semibold">von {format(tool.limit)} Punkten</span>
      </p>
      <div aria-hidden="true" className="mt-2 h-4 overflow-hidden rounded-full border-2 border-line bg-raised">
        <div className={`h-full ${exempt ? 'bg-accent' : 'bg-warn-ink'}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p className="mt-3 text-lg font-bold">
        {empty
          ? 'Anzahl und Menge eingeben.'
          : hasCategoryZero
            ? 'Ein Gut der Beförderungskategorie 0 ist dabei: keine Freistellung nach ADR 1.1.3.6.'
            : exempt
              ? `Freistellung nach ADR 1.1.3.6 möglich. Noch ${format(tool.limit - total)} Punkte frei.`
              : `Über ${format(tool.limit)} Punkte: keine Freistellung nach ADR 1.1.3.6, es gelten die vollen ADR-Vorschriften.`}
      </p>
      {incomplete && !empty && <p className="mt-1 text-base">Unvollständige Positionen zählen noch nicht mit.</p>}
      {summary.categories.length > 0 && (
        <>
          <h3 className="mt-4 font-semibold">Für das Beförderungspapier</h3>
          <table className="mt-1 w-full text-base">
            <thead className="sr-only">
              <tr>
                <th>Beförderungskategorie</th>
                <th>Gesamtmenge</th>
                <th>Punkte</th>
              </tr>
            </thead>
            <tbody>
              {summary.categories.map(({ category, quantities: values, points }) => (
                <tr key={category.category} className="border-t border-line align-top">
                  <th scope="row" className="py-1 pr-2 text-left font-semibold">
                    Kategorie {category.category}
                  </th>
                  <td className="py-1 pr-2">{quantities(values)}</td>
                  <td className="py-1 text-right whitespace-nowrap">
                    {category.factor === null ? '–' : `${format(points)} Punkte`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  )
}

/** Gefahrgut-Tool: mehrere Güter wählen, Mengen eingeben, Punkte nach der 1000-Punkte-Regel und die geltenden Vorschriften */
export function HazmatPoints({ tool, initialLines = [] }: { tool: HazmatPointsTool; initialLines?: LoadLine[] }) {
  const headingId = useId()
  const nextId = useRef(initialLines.length)
  const [lines, setLines] = useState<KeyedLine[]>(() => initialLines.map((line, index) => ({ ...line, id: index })))
  const newLine = (substance: HazmatSubstance): KeyedLine => ({
    id: nextId.current++,
    substance: substance.key,
    count: '1',
    size: substance.sizes.length === 1 ? format(substance.sizes[0]!) : '',
  })
  const selected = new Set(lines.map((line) => line.substance))

  const toggle = (substance: HazmatSubstance) =>
    setLines((current) =>
      current.some((line) => line.substance === substance.key)
        ? current.filter((line) => line.substance !== substance.key)
        : [...current, newLine(substance)],
    )
  const update = (id: number, patch: Partial<LoadLine>) =>
    setLines((current) => current.map((line) => (line.id === id ? { ...line, ...patch } : line)))
  const remove = (id: number) => setLines((current) => current.filter((line) => line.id !== id))
  const addSize = (id: number) =>
    setLines((current) => {
      const index = current.findIndex((line) => line.id === id)
      const substance = findSubstance(tool, current[index]!.substance)!
      return [...current.slice(0, index + 1), { ...newLine(substance), size: '' }, ...current.slice(index + 1)]
    })

  const items: LoadItem[] = []
  let incomplete = false
  for (const line of lines) {
    const substance = findSubstance(tool, line.substance)
    if (!substance) continue
    const { quantity } = lineQuantity(line, substance)
    if (quantity === undefined) incomplete = true
    else items.push({ substance: substance.key, quantity })
  }
  const { exempt } = summarizeLoad(tool, items)
  const rules = rulesForLoad(tool, [...selected], exempt)

  return (
    <section className="mt-6" aria-labelledby={headingId}>
      <HeadingWithClear id={headingId} onClear={() => setLines([])} disabled={lines.length === 0}>
        Gefahrgut wählen
      </HeadingWithClear>
      <p className="mt-1 text-base text-muted">Alles antippen, was mitfährt, auch mehrere. Die Ladung erscheint darunter.</p>
      <SubstancePicker tool={tool} selected={selected} onToggle={toggle} />

      {lines.length > 0 && (
        <>
          <h2 className="mt-8 text-xl font-bold">Ladung</h2>
          {lines.map((line) => (
            <LineCard
              key={line.id}
              tool={tool}
              line={line}
              onChange={(patch) => update(line.id, patch)}
              onRemove={() => remove(line.id)}
              onAddSize={() => addSize(line.id)}
            />
          ))}

          <ResultCard tool={tool} items={items} incomplete={incomplete} />

          <h2 className="mt-8 text-xl font-bold">Vorschriften für diese Ladung</h2>
          <ul className="mt-2 space-y-3">
            {rules.map((rule) => (
              <li
                key={rule.key}
                className={`rounded-2xl border-2 p-4 ${rule.when === 'overLimit' ? 'border-warn-ink bg-warn text-warn-ink' : 'border-line bg-surface'}`}
              >
                <h3 className="text-lg font-bold">{rule.title}</h3>
                <div className="mt-1 text-base">
                  <RichText text={rule.text} />
                </div>
                <p className={`mt-2 text-sm ${rule.when === 'overLimit' ? '' : 'text-muted'}`}>Quelle: {rule.source}</p>
              </li>
            ))}
          </ul>

          <details className="mt-4 rounded-2xl border-2 border-line bg-surface px-4">
            <summary className="min-h-12 cursor-pointer py-3 text-lg font-semibold">{tool.craftsmanRule.title}</summary>
            <div className="pb-4 text-base">
              <RichText text={tool.craftsmanRule.text} />
              <p className="mt-2 text-sm text-muted">Quelle: {tool.craftsmanRule.source}</p>
            </div>
          </details>
        </>
      )}

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
