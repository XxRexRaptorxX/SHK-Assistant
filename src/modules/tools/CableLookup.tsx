import { useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { SelectionBar } from './ChoiceLookup'
import {
  CONTENT_MISSING,
  groupComponents,
  sortedRecommendations,
  type CableEntry,
  type CableLevel,
  type CableRecommendation,
  type CableTool,
} from './cableTool'

const card = 'mt-4 rounded-2xl border-2 border-accent bg-surface p-4'

type CableMode = 'component' | 'situation'

const MODE_LABELS: Record<CableMode, string> = { component: 'Komponente', situation: 'Einbausituation' }

const MODE_BAR = {
  key: 'mode',
  name: 'Auswahl nach',
  options: (Object.keys(MODE_LABELS) as CableMode[]).map((key) => ({ key, label: MODE_LABELS[key], note: '' })),
}

const LEVELS: Record<CableLevel, { label: string; className: string }> = {
  required: { label: 'Vorgeschrieben', className: 'bg-accent text-accent-ink' },
  suitable: { label: 'Geeignet', className: 'bg-raised text-ink' },
  avoid: { label: 'Nicht geeignet', className: 'bg-warn text-warn-ink' },
}

const PROPERTY_MARKS = {
  yes: { mark: '✓', label: 'Ja', className: 'bg-raised text-ink' },
  no: { mark: '✗', label: 'Nein', className: 'border-2 border-line text-muted' },
  conditional: { mark: '~', label: 'Bedingt', className: 'bg-raised text-ink' },
}

/** Eigenschaften als Marken mit Zeichen (nicht nur Farbe), dahinter was die Quelle nicht nennt */
function CableProperties({ tool, cable }: { tool: CableTool; cable: CableEntry }) {
  const unknown = tool.properties.filter((property) => !(property.key in cable.properties))
  return (
    <>
      <ul className="mt-3 flex flex-wrap gap-2">
        {tool.properties.map((property) => {
          const value = cable.properties[property.key]
          if (!value) return null
          const mark = PROPERTY_MARKS[value.value]
          return (
            <li key={property.key} className={`rounded-xl px-2.5 py-1 text-base font-semibold ${mark.className}`}>
              <span aria-hidden="true">{mark.mark} </span>
              <span className="sr-only">{mark.label}: </span>
              {property.name}
              {value.note && <span className="font-normal">: {value.note}</span>}
            </li>
          )
        })}
      </ul>
      {unknown.length > 0 && (
        <p className="mt-2 text-sm text-muted">Keine Angabe: {unknown.map((property) => property.name).join(', ')}</p>
      )}
    </>
  )
}

/** Technische Daten eingeklappt, damit mehrere Kabelarten auf dem Handy überschaubar bleiben */
function CableFacts({ cable }: { cable: CableEntry }) {
  const facts = [
    ['Verwendung', cable.use],
    ['Nennspannung', cable.voltage],
    ['Temperatur', cable.temperature],
    ['Norm/Bauart', cable.standard],
    ['Kabeldaten laut', cable.source],
  ] as const
  return (
    <details className="mt-2">
      <summary className="min-h-12 cursor-pointer py-3 font-semibold text-accent">Technische Daten</summary>
      <dl className="space-y-2">
        {facts.map(
          ([name, value]) =>
            value && (
              <div key={name}>
                <dt className="text-sm font-semibold text-muted">{name}</dt>
                <dd className="text-base">{value}</dd>
              </div>
            ),
        )}
      </dl>
    </details>
  )
}

function CableCard({
  tool,
  cable,
  recommendation,
}: {
  tool: CableTool
  cable: CableEntry
  recommendation: CableRecommendation
}) {
  const level = LEVELS[recommendation.level]
  // Bei „nicht geeignet“ zählt nur der Grund; die Daten würden die Karte wie eine Empfehlung aussehen lassen
  const avoid = recommendation.level === 'avoid'
  return (
    <article className={avoid ? 'mt-4 rounded-2xl border-2 border-warn-ink/60 bg-surface p-4' : card}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-2xl font-bold">{cable.name}</h3>
        <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${level.className}`}>{level.label}</span>
      </div>
      {!avoid && <p className="mt-1 text-base text-muted">{cable.description}</p>}
      {recommendation.note && <p className="mt-2 text-base">{recommendation.note}</p>}
      {!avoid && (
        <>
          <CableProperties tool={tool} cable={cable} />
          {cable.limits && (
            <p className="mt-3 text-base">
              <span className="font-semibold">Einschränkung:</span> {cable.limits}
            </p>
          )}
        </>
      )}
      <p className="mt-3 text-sm text-muted">Zuordnung: {recommendation.source}</p>
      {!avoid && <CableFacts cable={cable} />}
    </article>
  )
}

/** Kabel-Tool: oben umschalten, dann Komponente oder Einbausituation wählen; darunter die Kabelarten mit Bewertung und Eigenschaften */
export function CableLookup({
  tool,
  initialMode = 'component',
  initialSelection = '',
}: {
  tool: CableTool
  initialMode?: CableMode
  /** Vorauswahl in dieser Liste (Tests) */
  initialSelection?: string
}) {
  const idPrefix = useId()
  const [mode, setMode] = useState(initialMode)
  // Auswahl je Liste, damit sie beim Hin- und Herschalten stehen bleibt
  const [selection, setSelection] = useState<Record<CableMode, string>>({
    component: '',
    situation: '',
    [initialMode]: initialSelection,
  })
  const selected = selection[mode]
  const label = MODE_LABELS[mode]
  const entries = mode === 'component' ? tool.components : tool.situations
  const component = entries.find((candidate) => candidate.key === selected)
  const missing = component?.note.startsWith(CONTENT_MISSING) ?? false

  return (
    <section>
      <SelectionBar bar={MODE_BAR} selected={mode} onSelect={(key) => setMode(key as CableMode)} />
      <label htmlFor={`${idPrefix}-select`} className="mt-4 block font-semibold">
        {label}
      </label>
      <select
        id={`${idPrefix}-select`}
        value={component ? selected : ''}
        onChange={(event) => setSelection({ ...selection, [mode]: event.target.value })}
        className={`${fieldBase} mt-1 w-full`}
      >
        <option value="" disabled>
          {label} wählen …
        </option>
        {groupComponents(entries).map(({ group, components }) => (
          <optgroup key={group} label={group}>
            {components.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.label}
              </option>
            ))}
          </optgroup>
        ))}
      </select>

      <div aria-live="polite">
        {!component ? (
          <div className={card}>
            <p className="text-base text-muted">{label} wählen.</p>
          </div>
        ) : (
          <>
            {component.note && (
              <p className={missing ? 'mt-4 rounded-xl bg-warn p-3 font-semibold text-warn-ink' : 'mt-4 text-base'}>
                {component.note}
              </p>
            )}
            {sortedRecommendations(component).map((recommendation) => {
              const cable = tool.cables.find((candidate) => candidate.key === recommendation.cable)!
              return <CableCard key={cable.key} tool={tool} cable={cable} recommendation={recommendation} />
            })}
          </>
        )}
      </div>
    </section>
  )
}
