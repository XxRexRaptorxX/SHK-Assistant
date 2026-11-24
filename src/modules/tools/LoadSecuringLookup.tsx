import { useId, useState } from 'react'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { parseDecimal } from '../../lib/number'
import {
  forcesFor,
  hasTippingForces,
  isStable,
  LOAD_RULE_LEVELS,
  loadRefText,
  measuresByGroup,
  sortLoadRules,
  tippingLimit,
  type LoadDirection,
  type LoadMeasure,
  type LoadRule,
  type LoadSecuringTool,
  type LoadSpec,
} from './loadSecuringTool'

const LEVEL_STYLES: Record<LoadRule['level'], string> = {
  forbidden: 'bg-warn text-warn-ink border-2 border-warn-ink',
  required: 'bg-accent text-accent-ink',
  note: 'border-2 border-line bg-surface text-ink',
}

const DIRECTION_LABELS: Record<LoadDirection, string> = {
  forward: 'Nach vorne (Bremsen)',
  backward: 'Nach hinten (Anfahren)',
  side: 'Zur Seite (Kurve)',
}

const formatNumber = (value: number, digits = 2) =>
  value.toLocaleString('de-DE', { maximumFractionDigits: digits })

function RuleList({ tool, rules }: { tool: LoadSecuringTool; rules: readonly LoadRule[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {sortLoadRules(rules).map((rule) => (
        <li key={`${rule.level}-${rule.text}`} className="rounded-xl border-2 border-line bg-surface p-3">
          <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${LEVEL_STYLES[rule.level]}`}>
            {LOAD_RULE_LEVELS[rule.level].label}
          </span>
          <div className="mt-1 text-base">
            <RichText text={rule.text} />
          </div>
          <p className="mt-1 text-sm text-muted">Quelle: {loadRefText(tool, rule.ref)}</p>
        </li>
      ))}
    </ul>
  )
}

function SpecList({ tool, specs }: { tool: LoadSecuringTool; specs: readonly LoadSpec[] }) {
  return (
    <dl className="mt-1 divide-y-2 divide-line">
      {specs.map((spec) => (
        <div key={spec.label} className="py-2">
          <dt className="text-base">{spec.label}</dt>
          <dd className="text-lg font-bold">{spec.value}</dd>
          {spec.note && <dd className="text-sm">{spec.note}</dd>}
          <dd className="text-sm text-muted">Quelle: {loadRefText(tool, spec.ref)}</dd>
        </div>
      ))}
    </dl>
  )
}

function TodoNote({ todo }: { todo: string }) {
  return <p className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink">{todo}</p>
}

/** Eine Maßnahme, aufklappbar: Kennwerte und Vorgaben */
function MeasureCard({ tool, measure }: { tool: LoadSecuringTool; measure: LoadMeasure }) {
  return (
    <details className="rounded-2xl border-2 border-line bg-surface px-4">
      <summary className="min-h-14 cursor-pointer py-3">
        <span className="text-lg font-bold">{measure.label}</span>
        {measure.todo && (
          <span className="ml-2 rounded-md border-2 border-warn-ink bg-warn px-2 text-sm font-bold text-warn-ink">unvollständig</span>
        )}
        <span className="block text-base text-muted">{measure.summary}</span>
      </summary>
      <div className="pb-4">
        {measure.todo && <TodoNote todo={measure.todo} />}
        {measure.specs.length > 0 && (
          <>
            <h4 className="mt-3 font-bold">Kennwerte</h4>
            <SpecList tool={tool} specs={measure.specs} />
          </>
        )}
        {measure.rules.length > 0 && (
          <>
            <h4 className="mt-3 font-bold">Vorgaben</h4>
            <RuleList tool={tool} rules={measure.rules} />
          </>
        )}
      </div>
    </details>
  )
}

/** Zahlenfeld mit Einheit; leere Eingabe ist erlaubt */
function NumberField({
  id,
  label,
  unit,
  value,
  error,
  onChange,
}: {
  id: string
  label: string
  unit: string
  value: string
  error?: string
  onChange: (value: string) => void
}) {
  return (
    <div>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      <div className="mt-1 flex items-center gap-2">
        <input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          value={value}
          aria-invalid={error !== undefined}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldBase} w-36 ${error ? 'border-warn-ink outline-2 outline-warn' : ''}`}
        />
        <span className="text-lg">{unit}</span>
      </div>
      {error && <p className="mt-1 text-base font-semibold">{error}</p>}
    </div>
  )
}

/** Positive Zahl oder undefined; error, wenn etwas eingegeben, aber nicht gültig ist */
function readPositive(raw: string): { value?: number; error?: string } {
  if (raw.trim() === '') return {}
  const parsed = parseDecimal(raw)
  if (parsed === undefined || parsed <= 0) return { error: 'Zahl größer 0 eingeben' }
  return { value: parsed }
}

function ForcesSection({
  tool,
  initialWeight,
  initialVehicle,
  initialTipping,
}: {
  tool: LoadSecuringTool
  initialWeight: string
  initialVehicle: string
  initialTipping: boolean
}) {
  const idPrefix = useId()
  const [weight, setWeight] = useState(initialWeight)
  const [vehicleKey, setVehicleKey] = useState(initialVehicle)
  const [tipping, setTipping] = useState(initialTipping)
  const vehicleClass = tool.vehicleClasses.find((candidate) => candidate.key === vehicleKey)
  const parsedWeight = readPositive(weight)
  const showTipping = vehicleClass ? hasTippingForces(vehicleClass) : false
  const forces = vehicleClass && parsedWeight.value !== undefined ? forcesFor(vehicleClass, parsedWeight.value, showTipping && tipping) : []

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Welche Kräfte muss die Sicherung halten?</h2>
      <div className="mt-3">
        <NumberField
          id={`${idPrefix}-weight`}
          label="Gewicht der Ladung"
          unit="kg"
          value={weight}
          error={parsedWeight.error}
          onChange={setWeight}
        />
      </div>
      <p className="mt-4 font-semibold">Zulässige Gesamtmasse des Fahrzeugs</p>
      <div role="group" aria-label="Zulässige Gesamtmasse des Fahrzeugs" className="mt-2 grid gap-2 sm:grid-cols-3">
        {tool.vehicleClasses.map((candidate) => {
          const active = candidate.key === vehicleKey
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={active}
              onClick={() => setVehicleKey(candidate.key)}
              className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left ${
                active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
              }`}
            >
              <span className="block font-semibold">
                <span aria-hidden="true">{active ? '✓ ' : ''}</span>
                {candidate.label}
              </span>
              {candidate.note && <span className={`block text-sm ${active ? '' : 'text-muted'}`}>{candidate.note}</span>}
            </button>
          )
        })}
      </div>
      {showTipping && (
        <label className="mt-3 flex min-h-12 items-center gap-3 text-base">
          <input type="checkbox" checked={tipping} onChange={(event) => setTipping(event.target.checked)} className="size-6" />
          Ladung ist kippgefährdet
        </label>
      )}

      <div aria-live="polite">
        {forces.length > 0 && vehicleClass ? (
          <div className="mt-4 rounded-2xl border-2 border-accent bg-surface p-4">
            <dl className="divide-y-2 divide-line">
              {forces.map((entry) => (
                <div key={entry.direction} className="flex items-baseline justify-between gap-3 py-2">
                  <dt className="text-base">
                    {DIRECTION_LABELS[entry.direction]}
                    <span className="block text-sm text-muted">{formatNumber(entry.factor)} × Gewicht</span>
                  </dt>
                  <dd className="text-2xl font-bold whitespace-nowrap">{formatNumber(entry.force, 0)} daN</dd>
                </div>
              ))}
            </dl>
            <p className="mt-2 text-sm text-muted">Quelle: {loadRefText(tool, vehicleClass.ref)}</p>
          </div>
        ) : (
          <p className="mt-4 text-base text-muted">Gewicht eingeben und Fahrzeug wählen.</p>
        )}
      </div>
      <p className="mt-3 text-sm">{tool.forcesText}</p>
      <p className="text-sm text-muted">Quelle: {loadRefText(tool, tool.forcesRef)}</p>
    </section>
  )
}

function TippingSection({
  tool,
  initialHeight,
  initialDistance,
}: {
  tool: LoadSecuringTool
  initialHeight: string
  initialDistance: string
}) {
  const idPrefix = useId()
  const [height, setHeight] = useState(initialHeight)
  const [distance, setDistance] = useState(initialDistance)
  const parsedHeight = readPositive(height)
  const parsedDistance = readPositive(distance)
  const ready = parsedHeight.value !== undefined && parsedDistance.value !== undefined
  const stable = ready ? isStable(tool.tipping, parsedHeight.value!, parsedDistance.value!) : undefined

  return (
    <section className="mt-8">
      <h2 className="text-xl font-bold">Kann die Ladung kippen?</h2>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <NumberField
          id={`${idPrefix}-height`}
          label="Schwerpunkthöhe über der Ladefläche"
          unit="m"
          value={height}
          error={parsedHeight.error}
          onChange={setHeight}
        />
        <NumberField
          id={`${idPrefix}-distance`}
          label="Abstand Schwerpunkt – Kippkante"
          unit="m"
          value={distance}
          error={parsedDistance.error}
          onChange={setDistance}
        />
      </div>
      <p className="mt-2 text-sm">{tool.tipping.text}</p>
      <div aria-live="polite">
        {stable !== undefined && (
          <div className={`mt-4 rounded-2xl border-2 p-4 ${stable ? 'border-accent bg-surface' : 'border-warn-ink bg-warn text-warn-ink'}`}>
            <p className="text-2xl font-bold">
              <span aria-hidden="true">{stable ? '✓ ' : '⚠ '}</span>
              {stable ? 'Standsicher' : 'Kippgefährdet'}
            </p>
            <p className="mt-1 text-base">
              {formatNumber(parsedDistance.value!)} m {stable ? 'ist größer als' : 'ist nicht größer als'}{' '}
              {formatNumber(tool.tipping.factor)} × {formatNumber(parsedHeight.value!)} m ={' '}
              {formatNumber(tippingLimit(tool.tipping, parsedHeight.value!))} m.{' '}
              {stable ? 'Sicherung gegen Rutschen genügt.' : 'Zusätzlich gegen Kippen sichern.'}
            </p>
          </div>
        )}
      </div>
      <p className="mt-2 text-sm text-muted">Quelle: {loadRefText(tool, tool.tipping.ref)}</p>
    </section>
  )
}

/** Ladungssicherung: Ladegut wählen, Vorgaben und Umsetzung, Kräfte und Kippprüfung */
export function LoadSecuringLookup({
  tool,
  initialCargo = '',
  initialWeight = '',
  initialVehicle = '',
  initialTipping = false,
  initialHeight = '',
  initialDistance = '',
}: {
  tool: LoadSecuringTool
  /** Vorauswahlen (Tests) */
  initialCargo?: string
  initialWeight?: string
  initialVehicle?: string
  initialTipping?: boolean
  initialHeight?: string
  initialDistance?: string
}) {
  const [cargoKey, setCargoKey] = useState(initialCargo)
  const cargo = tool.cargos.find((candidate) => candidate.key === cargoKey)
  const groups = cargo ? measuresByGroup(tool, cargo) : []

  return (
    <section>
      <h2 className="mt-6 text-xl font-bold">Was wird geladen?</h2>
      <div role="group" aria-label="Ladegut" className="mt-2 grid gap-2 sm:grid-cols-2">
        {tool.cargos.map((candidate) => {
          const active = candidate.key === cargoKey
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={active}
              onClick={() => setCargoKey(candidate.key)}
              className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left ${
                active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
              }`}
            >
              <span className="block font-semibold">
                {/* Häkchen, damit der Zustand nicht nur an der Farbe hängt */}
                <span aria-hidden="true">{active ? '✓ ' : ''}</span>
                {candidate.label}
              </span>
              {candidate.note && <span className={`block text-sm ${active ? '' : 'text-muted'}`}>{candidate.note}</span>}
            </button>
          )
        })}
      </div>

      <div aria-live="polite">
        {!cargo ? (
          <p className="mt-6 text-base text-muted">Ladegut wählen.</p>
        ) : (
          <>
            <h2 className="mt-8 text-xl font-bold">{cargo.label}</h2>
            {cargo.todo && <TodoNote todo={cargo.todo} />}
            {cargo.steps.length > 0 && (
              <section className="mt-4">
                <h3 className="text-lg font-bold">So sicherst du es</h3>
                <ol className="mt-2 space-y-2">
                  {cargo.steps.map((step, index) => (
                    <li key={step.text} className="flex gap-3 rounded-xl border-2 border-line bg-surface p-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-accent-ink">
                        {index + 1}
                      </span>
                      <span>
                        <span className="block text-base">{step.text}</span>
                        <span className="block text-sm text-muted">Quelle: {loadRefText(tool, step.ref)}</span>
                      </span>
                    </li>
                  ))}
                </ol>
              </section>
            )}
            {cargo.rules.length > 0 && (
              <section className="mt-6">
                <h3 className="text-lg font-bold">Vorgaben für dieses Ladegut</h3>
                <RuleList tool={tool} rules={cargo.rules} />
              </section>
            )}
            {cargo.specs.length > 0 && (
              <section className="mt-6">
                <h3 className="text-lg font-bold">Kennwerte</h3>
                <SpecList tool={tool} specs={cargo.specs} />
              </section>
            )}
            {groups.map(({ group, measures }) => (
              <section key={group.key} className="mt-6">
                <h3 className="text-lg font-bold">{group.label}</h3>
                <div className="mt-2 space-y-3">
                  {measures.map((measure) => (
                    <MeasureCard key={measure.key} tool={tool} measure={measure} />
                  ))}
                </div>
              </section>
            ))}
            <details className="mt-6 rounded-2xl border-2 border-line bg-surface px-4">
              <summary className="min-h-14 cursor-pointer py-3 text-lg font-bold">Gilt für jede Ladung</summary>
              <div className="pb-4">
                <RuleList tool={tool} rules={tool.generalRules} />
              </div>
            </details>
          </>
        )}
      </div>

      <ForcesSection tool={tool} initialWeight={initialWeight} initialVehicle={initialVehicle} initialTipping={initialTipping} />
      <TippingSection tool={tool} initialHeight={initialHeight} initialDistance={initialDistance} />

      {tool.checklist.length > 0 && (
        <section className="mt-8">
          <h2 className="text-xl font-bold">Checkliste vor der Fahrt</h2>
          {tool.checklist.map((group) => (
            <div key={group.label} className="mt-3">
              <h3 className="text-lg font-bold">{group.label}</h3>
              <ul className="mt-1 list-disc pl-6 text-base">
                {group.items.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="text-sm text-muted">Quelle: {loadRefText(tool, group.ref)}</p>
            </div>
          ))}
        </section>
      )}

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
