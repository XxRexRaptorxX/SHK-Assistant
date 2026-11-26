import { useId, useState } from 'react'
import {
  metalsByGroup,
  selectedPairs,
  type Metal,
  type MetalGroup,
  type MetalRating,
  type MetalTool,
  type PairResult,
} from './metalTool'

const RATINGS: Record<MetalRating, { label: string; className: string }> = {
  ok: { label: 'Unbedenklich', className: 'bg-accent text-accent-ink' },
  limited: { label: 'Nur unter Bedingungen', className: 'border-2 border-warn bg-warn/25 text-ink' },
  avoid: { label: 'Vermeiden', className: 'bg-warn text-warn-ink' },
}

const GROUPS: { key: MetalGroup; title: string }[] = [
  { key: 'noble', title: 'Edle Metalle' },
  { key: 'base', title: 'Unedle Metalle' },
  { key: 'unknown', title: 'Noch nicht eingeordnet' },
]

const formatPotential = (value: number) => `${value > 0 ? '+' : ''}${value.toLocaleString('de-DE', { minimumFractionDigits: 2 })} V`

const Source = ({ children }: { children: string }) => <span className="text-sm text-muted">({children})</span>
const DerivedMark = () => (
  <span className="mr-1 rounded-md border-2 border-warn px-1.5 py-0.5 text-xs font-bold">Abgeleitet</span>
)

function PairCard({ result, derivation }: { result: PairResult; derivation: MetalTool['derivation'] }) {
  const { a, b, pair, derivedLessNoble, derivationBlocked } = result
  const otherOf = (metal: Metal) => (metal === a ? b : a)
  const corrodes = pair?.corrodes ? (pair.corrodes === a.key ? a : b) : undefined
  const first = pair?.flow?.first ? (pair.flow.first === a.key ? a : b) : undefined
  // Abgeleitetes nur, wo die Quelle zum Paar nichts sagt
  const derivedAnode = !corrodes && derivation ? derivedLessNoble : undefined
  const derivedFirst = !pair?.flow && derivation ? derivedLessNoble : undefined
  const blocked = derivation && (!corrodes || !pair?.flow) ? derivationBlocked : undefined
  return (
    <article className="mt-4 rounded-2xl border-2 border-accent bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-2xl font-bold">
          {a.name} + {b.name}
        </h3>
        {pair && (
          <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${RATINGS[pair.rating].className}`}>
            {RATINGS[pair.rating].label}
          </span>
        )}
      </div>
      {corrodes ? (
        <p className="mt-2 text-base font-semibold">
          Angegriffen wird: {corrodes.name} (Anode, gibt Elektronen ab) · geschützt: {otherOf(corrodes).name} (Kathode)
        </p>
      ) : (
        derivedAnode &&
        derivation && (
          <p className="mt-2 text-base">
            <DerivedMark />
            <span className="font-semibold">
              Angegriffen wird: {derivedAnode.name} (Anode) · geschützt: {otherOf(derivedAnode).name} (Kathode).
            </span>{' '}
            {derivation.anode.text} <Source>{derivation.anode.source}</Source>
          </p>
        )
      )}
      {pair ? (
        <p className="mt-2 text-base">
          {pair.text} <Source>{pair.source}</Source>
        </p>
      ) : (
        <p className="mt-2 text-base font-semibold text-muted">Keine belegte Bewertung zu diesem Paar.</p>
      )}
      <h4 className="mt-3 font-semibold">Fließrichtung</h4>
      {pair?.flow ? (
        <p className="text-base">
          {first && (
            <span className="font-semibold">
              Zuerst {first.name} → dann {otherOf(first).name}.
            </span>
          )}{' '}
          {pair.flow.text} <Source>{pair.flow.source}</Source>
        </p>
      ) : derivedFirst && derivation ? (
        <p className="text-base">
          <DerivedMark />
          <span className="font-semibold">
            Zuerst {derivedFirst.name} → dann {otherOf(derivedFirst).name}.
          </span>{' '}
          {derivation.flow.text} <Source>{derivation.flow.source}</Source>
        </p>
      ) : (
        <p className="text-base text-muted">Keine Angabe in den Quellen.</p>
      )}
      {blocked?.reason && (
        <p className="mt-1 text-base">
          <span className="font-semibold">Nicht aus der Spannungsreihe ableitbar ({blocked.metal.name}): </span>
          {blocked.reason.text} <Source>{blocked.reason.source}</Source>
        </p>
      )}
      <h4 className="mt-3 font-semibold">Ionenaustausch</h4>
      {pair?.ions ? (
        <p className="text-base">
          {pair.ions.text} <Source>{pair.ions.source}</Source>
        </p>
      ) : (
        <p className="text-base text-muted">Keine Angabe in den Quellen.</p>
      )}
      {derivation && (derivedAnode || derivedFirst) && (
        <p className="mt-3 text-sm text-muted">
          Abgeleitet heißt: aus dem Standardpotential nach dem Grundsatz oben, nicht aus einer Quelle zu diesem Paar.{' '}
          {derivation.caveat.text} ({derivation.caveat.source})
        </p>
      )}
    </article>
  )
}

const GROUP_STYLE: Record<MetalGroup, { label: string; stripe: string; badge: string }> = {
  noble: { label: 'edel', stripe: 'border-l-accent', badge: 'bg-accent text-accent-ink' },
  base: { label: 'unedel', stripe: 'border-l-warn', badge: 'bg-warn text-warn-ink' },
  unknown: { label: 'nicht eingeordnet', stripe: 'border-l-line', badge: 'bg-raised text-ink' },
}

/** Ein Messwert mit großer Zahl; Bezug und Quelle hinter dem i-Knopf */
function ValueBox({ label, value, note }: { label: string; value: string; note: string }) {
  const [open, setOpen] = useState(false)
  const noteId = useId()
  return (
    <div className="rounded-xl bg-raised px-3 py-2">
      <p className="text-sm font-semibold text-muted">{label}</p>
      <div className="flex items-center justify-between gap-2">
        <p className="whitespace-nowrap text-xl font-bold tabular-nums">{value}</p>
        {note && (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={noteId}
            aria-label={`Info zu ${label}`}
            onClick={() => setOpen((current) => !current)}
            className={`flex size-11 shrink-0 items-center justify-center rounded-full border-2 font-serif text-lg font-bold italic ${
              open ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
            }`}
          >
            i
          </button>
        )}
      </div>
      {note && (
        <p id={noteId} hidden={!open} className="mt-1 text-xs text-muted">
          {note}
        </p>
      )}
    </div>
  )
}

function MetalCard({ metal, selected, onToggle }: { metal: Metal; selected: boolean; onToggle: () => void }) {
  const group: MetalGroup = metal.group ?? 'unknown'
  const style = GROUP_STYLE[group]
  const practical = metal.practical
  return (
    <li
      className={`flex flex-col rounded-2xl border-2 border-l-8 bg-surface p-4 ${style.stripe} ${
        selected ? 'border-accent ring-2 ring-accent' : 'border-line'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex size-14 shrink-0 items-center justify-center rounded-xl border-2 border-line bg-raised text-2xl font-bold"
        >
          {metal.symbol || metal.name.slice(0, 2)}
        </span>
        <div className="min-w-0 flex-1">
          <h4 className="text-xl font-bold leading-tight">{metal.name}</h4>
          <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-sm font-bold ${style.badge}`}>{style.label}</span>
        </div>
        <button
          type="button"
          aria-pressed={selected}
          aria-label={`${metal.name} ${selected ? 'abwählen' : 'auswählen'}`}
          onClick={onToggle}
          className={`flex size-12 shrink-0 items-center justify-center rounded-xl border-2 text-2xl font-bold ${
            selected ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
          }`}
        >
          {selected ? '✓' : '+'}
        </button>
      </div>

      {(metal.potential !== undefined || practical) && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {metal.potential !== undefined && (
            <ValueBox label="Standardpotential" value={formatPotential(metal.potential)} note={metal.potentialNote} />
          )}
          {practical && (
            <ValueBox
              label="In Trinkwasser"
              value={`ca. ${
                practical.min === practical.max
                  ? formatPotential(practical.min)
                  : `${formatPotential(practical.max)} bis ${formatPotential(practical.min)}`
              }`}
              note={`${practical.note} (${practical.source})`}
            />
          )}
        </div>
      )}

      {metal.note && (
        <p className="mt-3 text-base">{metal.note}</p>
      )}
      {metal.noDerivation && (
        <p className="mt-2 text-sm">
          <span className="font-semibold">Hinweis: </span>
          {metal.noDerivation.text} <span className="text-muted">({metal.noDerivation.source})</span>
        </p>
      )}
      {metal.source && <p className="mt-auto pt-3 text-xs text-muted">Quelle: {metal.source}</p>}
    </li>
  )
}

/** Metalle auswählen, Reaktionen je Paar sehen; darunter alle Metalle nach edel und unedel */
export function MetalLookup({ tool, initialSelected = [] }: { tool: MetalTool; initialSelected?: string[] }) {
  const [selected, setSelected] = useState<string[]>(initialSelected)
  const toggle = (key: string) =>
    setSelected((current) => (current.includes(key) ? current.filter((k) => k !== key) : [...current, key]))
  const pairs = selectedPairs(tool, selected)
  const groups = metalsByGroup(tool)

  return (
    <div>
      <div className="mt-6">
        <p className="font-semibold">Metalle auswählen</p>
        <div role="group" aria-label="Metalle auswählen" className="mt-1 flex flex-wrap gap-2">
          {tool.metals.map((metal) => {
            const active = selected.includes(metal.key)
            return (
              <button
                key={metal.key}
                type="button"
                aria-pressed={active}
                onClick={() => toggle(metal.key)}
                className={`min-h-12 rounded-xl border-2 px-4 text-lg font-semibold ${
                  active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
                }`}
              >
                {metal.name}
              </button>
            )
          })}
        </div>
        {selected.length > 0 && (
          <button type="button" onClick={() => setSelected([])} className="mt-2 min-h-12 text-base font-semibold underline">
            Auswahl löschen
          </button>
        )}
      </div>

      <section aria-label="Reaktionen" className="mt-4">
        {tool.ionExchange && selected.length >= 2 && (
          <p className="rounded-2xl border-2 border-line bg-surface p-4 text-base">
            <span className="font-semibold">So entsteht Kontaktkorrosion: </span>
            {tool.ionExchange.text} <span className="text-sm text-muted">({tool.ionExchange.source})</span>
          </p>
        )}
        {selected.length < 2 ? (
          <p className="text-base text-muted">Mindestens zwei Metalle wählen, um ihre Reaktion zu sehen.</p>
        ) : (
          pairs.map((result) => <PairCard key={`${result.a.key}|${result.b.key}`} result={result} derivation={tool.derivation} />)
        )}
      </section>

      {GROUPS.map(({ key, title }) =>
        groups[key].length === 0 ? null : (
          <section key={key} className="mt-8">
            <h3 className="text-xl font-bold">{title}</h3>
            {key !== 'unknown' && <p className="text-sm text-muted">Edelstes zuerst · mit + zur Auswahl hinzufügen</p>}
            <ul className="mt-2 grid gap-3 sm:grid-cols-2">
              {groups[key].map((metal) => (
                <MetalCard
                  key={metal.key}
                  metal={metal}
                  selected={selected.includes(metal.key)}
                  onToggle={() => toggle(metal.key)}
                />
              ))}
            </ul>
          </section>
        ),
      )}
    </div>
  )
}
