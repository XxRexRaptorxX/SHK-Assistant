import { useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { SelectionBar } from './ChoiceLookup'
import {
  CONTENT_MISSING,
  installationRelevant,
  pipeSelection,
  type PipeLevel,
  type PipeMaterial,
  type PipeMaterialTool,
  type PipeRecommendation,
  type PipeStatement,
} from './pipeMaterialTool'

const card = 'mt-4 rounded-2xl border-2 border-accent bg-surface p-4'

const LEVELS: Record<PipeLevel, { label: string; className: string }> = {
  required: { label: 'Vorgeschrieben', className: 'bg-accent text-accent-ink' },
  recommended: { label: 'Empfohlen', className: 'bg-accent text-accent-ink' },
  suitable: { label: 'Geeignet', className: 'bg-raised text-ink' },
  limited: { label: 'Eingeschränkt geeignet', className: 'border-2 border-warn bg-warn/25 text-ink' },
  avoid: { label: 'Nicht geeignet', className: 'bg-warn text-warn-ink' },
}

/** Kasten unter den Ergebnissen, z. B. Vorgaben oder Dämmung; ohne Einträge nicht angezeigt */
function StatementBox({ title, items }: { title: string; items: PipeStatement[] }) {
  if (items.length === 0) return null
  return (
    <section className="mt-6 rounded-2xl border-2 border-line bg-surface p-4">
      <h3 className="text-xl font-bold">{title}</h3>
      <ul className="mt-2 space-y-1">
        {items.map((item) => (
          <li key={item.text} className="text-base">
            {item.text} <span className="text-sm text-muted">({item.source})</span>
          </li>
        ))}
      </ul>
    </section>
  )
}

const FORM_LABELS = { rigid: 'starres Rohr', flexible: 'flexibles Rohr' } as const

/** Vor- oder Nachteile mit Zeichen (nicht nur Farbe) und kurzer Quelle */
function Statements({ title, mark, items }: { title: string; mark: string; items: PipeStatement[] }) {
  return (
    <div className="mt-3">
      <h4 className="font-semibold">{title}</h4>
      {items.length === 0 ? (
        <p className="text-base text-muted">Keine Angabe in den Quellen.</p>
      ) : (
        <ul className="mt-1 space-y-1">
          {items.map((item) => (
            <li key={item.text} className="flex gap-2 text-base">
              <span aria-hidden="true" className="w-4 shrink-0 font-bold">
                {mark}
              </span>
              <span>
                {item.text} <span className="text-sm text-muted">({item.source})</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function MaterialCard({ material, recommendation }: { material: PipeMaterial; recommendation: PipeRecommendation }) {
  const level = LEVELS[recommendation.level]
  // Bei „nicht geeignet“ zählt nur der Grund; Vorteile würden die Karte wie eine Empfehlung aussehen lassen
  const avoid = recommendation.level === 'avoid'
  return (
    <article className={avoid ? 'mt-4 rounded-2xl border-2 border-warn-ink/60 bg-surface p-4' : card}>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h3 className="text-2xl font-bold">{material.name}</h3>
        <span className="flex flex-wrap gap-1.5">
          {material.outdated && (
            <span className="rounded-md border-2 border-current px-2 py-0.5 text-sm font-bold text-muted">Veraltet</span>
          )}
          <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${level.className}`}>{level.label}</span>
        </span>
      </div>
      {!avoid && (
        <p className="mt-1 text-base text-muted">
          {material.description}
          {material.form && ` · ${FORM_LABELS[material.form]}`}
        </p>
      )}
      {material.outdated && (
        <p className="mt-1 text-sm text-muted">
          Veraltet: {material.outdated.text} ({material.outdated.source})
        </p>
      )}
      {recommendation.note && <p className="mt-2 text-base">{recommendation.note}</p>}
      <p className="mt-2 text-sm text-muted">Zuordnung: {recommendation.source}</p>
      {!avoid && (
        <details className="mt-1">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold text-accent">
            {material.products.length > 0 ? 'Vor- und Nachteile, Produkte' : 'Vor- und Nachteile'}
          </summary>
          <Statements title="Vorteile" mark="+" items={material.pros} />
          <Statements title="Nachteile" mark="−" items={material.cons} />
          {material.products.length > 0 && (
            <div className="mt-3">
              <h4 className="font-semibold">Beispielprodukte</h4>
              <ul className="mt-1 list-disc space-y-1 pl-5">
                {material.products.map((product) => (
                  <li key={product.text} className="text-base">
                    {product.text} <span className="text-sm text-muted">({product.source})</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </details>
      )}
    </article>
  )
}

/** Rohrwerkstoff-Tool: Verlegung und Anlagensystem wählen, ggf. Untersystem; darunter die Werkstoffe mit Bewertung */
export function PipeMaterialLookup({
  tool,
  initialSystem = '',
  initialSubsystem,
  initialInstallation,
}: {
  tool: PipeMaterialTool
  /** Vorauswahlen (Tests) */
  initialSystem?: string
  initialSubsystem?: string
  initialInstallation?: string
}) {
  const idPrefix = useId()
  const [installation, setInstallation] = useState(initialInstallation ?? tool.installations[0]!.key)
  const [systemKey, setSystemKey] = useState(initialSystem)
  // Untersystem je System, damit die Wahl beim Wechseln stehen bleibt
  const [subsystems, setSubsystems] = useState<Record<string, string>>(
    initialSubsystem ? { [initialSystem]: initialSubsystem } : {},
  )
  const system = tool.systems.find((candidate) => candidate.key === systemKey)
  const subsystem = system?.subsystems.find((candidate) => candidate.key === subsystems[system.key]) ?? system?.subsystems[0]
  const installationLabel = tool.installations.find((candidate) => candidate.key === installation)?.label ?? ''
  const result = system ? pipeSelection(system, subsystem, installation) : undefined
  const askInstallation = system ? installationRelevant(system, subsystem) : false
  const materialOf = (recommendation: PipeRecommendation) =>
    tool.materials.find((candidate) => candidate.key === recommendation.material)!
  const pipes = result?.recommendations.filter((entry) => materialOf(entry).kind === 'pipe') ?? []
  const fittings = result?.recommendations.filter((entry) => materialOf(entry).kind === 'fitting') ?? []

  return (
    <section>
      <label htmlFor={`${idPrefix}-system`} className="mt-6 block font-semibold">
        Anlagensystem
      </label>
      <select
        id={`${idPrefix}-system`}
        value={system ? systemKey : ''}
        onChange={(event) => setSystemKey(event.target.value)}
        className={`${fieldBase} mt-1 w-full`}
      >
        <option value="" disabled>
          Anlagensystem wählen …
        </option>
        {tool.systems.map((candidate) => (
          <option key={candidate.key} value={candidate.key}>
            {candidate.label}
          </option>
        ))}
      </select>
      {system && subsystem && (
        <SelectionBar
          bar={{
            key: 'subsystem',
            name: 'Untersystem',
            options: system.subsystems.map((candidate) => ({ key: candidate.key, label: candidate.label, note: '' })),
          }}
          selected={subsystem.key}
          onSelect={(key) => setSubsystems({ ...subsystems, [system.key]: key })}
          wrap={system.subsystems.length > 3}
        />
      )}
      {askInstallation && (
        <SelectionBar
          bar={{ key: 'installation', name: 'Verlegung', options: tool.installations }}
          selected={installation}
          onSelect={setInstallation}
        />
      )}

      <div aria-live="polite">
        {!result ? (
          <div className={card}>
            <p className="text-base text-muted">Anlagensystem wählen.</p>
          </div>
        ) : (
          <>
            {result.notes.map((note) => (
              <p
                key={note}
                className={
                  note.startsWith(CONTENT_MISSING) ?'mt-4 rounded-xl bg-warn p-3 font-semibold text-warn-ink' : 'mt-4 text-base'
                }
              >
                {note}
              </p>
            ))}
            {result.recommendations.length === 0 && !result.missing && (
              <div className={card}>
                <p className="text-base text-muted">Für {installationLabel} nennen die Quellen hier keinen Werkstoff.</p>
              </div>
            )}
            {pipes.map((recommendation) => (
              <MaterialCard
                key={`${recommendation.material}-${recommendation.installations.join('-')}`}
                material={materialOf(recommendation)}
                recommendation={recommendation}
              />
            ))}
            {fittings.length > 0 && (
              <section aria-label="Fittingwerkstoffe" className="mt-8">
                <h3 className="text-xl font-bold">Fittingwerkstoffe</h3>
                {fittings.map((recommendation) => (
                  <MaterialCard
                    key={`${recommendation.material}-${recommendation.installations.join('-')}`}
                    material={materialOf(recommendation)}
                    recommendation={recommendation}
                  />
                ))}
              </section>
            )}
            <StatementBox title="Dämmung und Schutz" items={result.protection} />
            <StatementBox title="Vorgaben und Einsatzgrenzen" items={result.requirements} />
          </>
        )}
      </div>
    </section>
  )
}
