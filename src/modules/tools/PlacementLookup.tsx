import { useId, useState, type ReactNode } from 'react'
import { ClearInputsButton } from '../../components/ClearInputsButton'
import { InfoIcon, WarningIcon } from '../../components/icons'
import { RichText } from '../../components/RichText'
import { formatNumber } from '../../lib/number'
import { SelectionBar } from './ChoiceLookup'
import {
  exampleZoneMeters,
  PLACEMENT_LEVELS,
  placementResult,
  type PlacementExample,
  type PlacementLocation,
  type PlacementResult,
  type PlacementRule,
  type PlacementTool,
} from './placementTool'

const card = 'mt-4 rounded-2xl border-2 border-line bg-surface p-4'

const LEVEL_STYLES: Record<PlacementRule['level'], string> = {
  forbidden: 'bg-warn text-warn-ink',
  required: 'bg-accent text-accent-ink',
  avoid: 'border-2 border-warn-ink/60 text-ink',
  recommended: 'bg-raised text-ink',
  note: 'border-2 border-line text-muted',
}

const meters = (value: number) => `${formatNumber(value, value % 1 === 0 ? 0 : 1)} m`

/** Ein Umgebungsmerkmal zum An- und Abwählen; gewählt mit Häkchen, damit der Zustand nicht nur an der Farbe hängt */
function FeatureToggle({ label, note, active, onToggle }: { label: string; note: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`flex min-h-14 w-full items-start gap-3 rounded-xl border-2 px-3 py-2 text-left ${
        active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
      }`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md border-2 font-bold ${
          active ? 'border-accent-ink' : 'border-line'
        }`}
      >
        {active ? '✓' : ''}
      </span>
      <span className="leading-snug">
        <span className="block font-semibold">{label}</span>
        {note && <span className={`block text-sm ${active ? '' : 'text-muted'}`}>{note}</span>}
      </span>
    </button>
  )
}

function RuleList({ rules, sourceName }: { rules: PlacementRule[]; sourceName: string }) {
  return (
    <ul className="mt-2 divide-y divide-edge rounded-2xl border-2 border-line bg-surface px-4">
      {rules.map((rule) => (
        <li key={`${rule.page}-${rule.text}`} className="py-3">
          <span className={`inline-block rounded-md px-2 py-0.5 text-sm font-bold ${LEVEL_STYLES[rule.level]}`}>
            {PLACEMENT_LEVELS[rule.level].label}
          </span>
          <p className="mt-1 text-base">{rule.text}</p>
          <p className="text-sm text-muted">
            {sourceName}, {rule.page}
          </p>
        </li>
      ))}
    </ul>
  )
}

/** Vorgaben eines Abschnitts: Ausschlüsse oben, dann passende, immer geltende und eingeklappt die übrigen */
function RuleSections({ result, sourceName, title }: { result: PlacementResult; sourceName: string; title: string }) {
  return (
    <>
      {result.excluded.length > 0 ? (
        <div className="mt-3 rounded-2xl border-2 border-warn-ink bg-warn p-4 text-warn-ink">
          <p className="flex items-center gap-2 text-lg font-bold">
            <WarningIcon className="size-6 shrink-0" aria-hidden="true" />
            {title}: nicht zulässig
          </p>
          <ul className="mt-2 list-disc space-y-2 pl-6">
            {result.excluded.map((rule) => (
              <li key={rule.text} className="text-base">
                {rule.text}{' '}
                <span className="whitespace-nowrap">
                  ({sourceName}, {rule.page})
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="mt-3 rounded-2xl border-2 border-accent bg-surface p-4">
          <p className="font-bold">{title}: Keine deiner Angaben ist als nicht zulässig genannt.</p>
          <p className="mt-1 text-base">Die Vorgaben unten trotzdem einzeln vor Ort prüfen.</p>
        </div>
      )}
      {result.matching.length > 0 && (
        <>
          <h4 className="mt-5 text-lg font-bold">Zu deinen Angaben</h4>
          <RuleList rules={result.matching} sourceName={sourceName} />
        </>
      )}
      {result.general.length > 0 && (
        <>
          <h4 className="mt-5 text-lg font-bold">Gilt immer</h4>
          <RuleList rules={result.general} sourceName={sourceName} />
        </>
      )}
      {result.other.length > 0 && (
        <details className="mt-5">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold text-accent">
            Weitere Vorgaben für andere Situationen ({result.other.length})
          </summary>
          <RuleList rules={result.other} sourceName={sourceName} />
        </details>
      )}
    </>
  )
}

/** Gerätegröße und Abstände in der Skizze ohne Maße (schematisch, in Metern) */
const DEVICE_W = 1.2
const DEVICE_H = 0.6
const SCALE = 100

interface SketchDistances {
  zone: number
  /** Abstand zur Wand hinter der Ansaugseite bzw. daneben */
  back?: number
  left?: number
}

/**
 * Draufsicht: Gerät mit Ansaugseite hinten (oben) und Ausblasseite vorn (unten), Schutzbereich als Fläche, Wände je
 * Aufstellort. Mit Maßen (Beispiel aus einer Anleitung) maßstäblich, ohne Maße nur als Form.
 */
function PlacementSketch({
  location,
  distances,
  labeled,
  zoneName,
  children,
}: {
  location: PlacementLocation
  distances: SketchDistances
  /** Maße anschreiben; sonst steht an den Maßlinien „Hersteller“ */
  labeled: boolean
  zoneName: string
  children?: ReactNode
}) {
  const clipId = useId().replace(/:/g, '')
  const zoneMeters = distances.zone
  const back = location.walls.includes('back') ? distances.back : undefined
  const left = location.walls.includes('left') ? distances.left : undefined
  const wall = 0.15
  const margin = 0.2
  // Hinter einer Wand wird nichts gezeichnet: Dort endet die Skizze knapp hinter der Wand
  const minX = (left !== undefined ? -left - wall : -zoneMeters) - margin
  const minY = (back !== undefined ? -back - wall : -zoneMeters) - margin
  const maxX = DEVICE_W + zoneMeters + margin
  const maxY = DEVICE_H + zoneMeters + margin + 0.15
  const s = (value: number) => Math.round(value * SCALE * 10) / 10
  const text = (value: number) => (labeled ? meters(value) : 'Hersteller')
  const zone = { x: -zoneMeters, y: -zoneMeters, w: DEVICE_W + 2 * zoneMeters, h: DEVICE_H + 2 * zoneMeters }
  const clip = { x: left !== undefined ? -left : minX, y: back !== undefined ? -back : minY }
  const walls = [back !== undefined && 'Wand hinter der Ansaugseite', left !== undefined && 'Wand seitlich'].filter(Boolean).join(', ')
  const label = labeled
    ? `Draufsicht: ${zoneName} ${meters(zoneMeters)} um das Gerät${back !== undefined ? `, Wand hinter der Ansaugseite im Abstand ${meters(back)}` : ''}${
        left !== undefined ? `, Wand seitlich im Abstand ${meters(left)}` : ''
      }`
    : `Draufsicht, schematisch: ${zoneName} um das Gerät${walls ? `, ${walls}` : ''}; Maße laut Hersteller`
  const arrow = `${clipId}-arrow`
  const dimHead = `${clipId}-dim`
  const wallStartX = left !== undefined ? -left - wall : minX
  const wallStartY = back !== undefined ? -back - wall : minY

  return (
    <figure className="mt-3 rounded-2xl border border-edge bg-surface p-3 break-inside-avoid">
      <div className="figure-art" role="img" aria-label={label}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox={`${s(minX)} ${s(minY)} ${s(maxX - minX)} ${s(maxY - minY)}`}>
          <defs>
            <clipPath id={clipId}>
              <rect x={s(clip.x)} y={s(clip.y)} width={s(maxX - clip.x)} height={s(maxY - clip.y)} />
            </clipPath>
            <marker id={arrow} viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
              <path className="flow-head" d="M0 0L10 5L0 10z" />
            </marker>
            <marker id={dimHead} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path className="dim-head" d="M0 0L10 5L0 10z" />
            </marker>
          </defs>

          {/* Schutzbereich: Rechteck mit um den Abstand gerundeten Ecken, an Wänden abgeschnitten */}
          <g clipPath={`url(#${clipId})`}>
            <rect className="area" x={s(zone.x)} y={s(zone.y)} width={s(zone.w)} height={s(zone.h)} rx={s(zoneMeters)} opacity="0.6" />
            <rect className="dim dash" x={s(zone.x)} y={s(zone.y)} width={s(zone.w)} height={s(zone.h)} rx={s(zoneMeters)} />
          </g>

          {/* Wände treffen sich in der Ecke, statt sich zu kreuzen */}
          {back !== undefined && (
            <rect className="metal" x={s(wallStartX)} y={s(-back - wall)} width={s(maxX - wallStartX)} height={s(wall)} />
          )}
          {left !== undefined && (
            <rect className="metal" x={s(-left - wall)} y={s(wallStartY)} width={s(wall)} height={s(maxY - wallStartY)} />
          )}

          <rect className="line" x="0" y="0" width={s(DEVICE_W)} height={s(DEVICE_H)} rx="6" />
          <text style={{ fontSize: 19 }} x={s(DEVICE_W / 2)} y={s(DEVICE_H / 2) + 5} textAnchor="middle" fontWeight="700">
            Gerät
          </text>

          <path className="flow" d={`M${s(DEVICE_W * 0.75)} ${s(-0.42)}V${s(-0.08)}`} markerEnd={`url(#${arrow})`} />
          <text style={{ fontSize: 16 }} className="note" x={s(DEVICE_W * 0.75) + 8} y={s(-0.22)}>
            Ansaugen
          </text>
          <path className="flow" d={`M${s(DEVICE_W * 0.75)} ${s(DEVICE_H + 0.08)}V${s(DEVICE_H + 0.42)}`} markerEnd={`url(#${arrow})`} />
          <text style={{ fontSize: 16 }} className="note" x={s(DEVICE_W * 0.75) + 8} y={s(DEVICE_H + 0.3)}>
            Ausblasen
          </text>

          <line
            className="dim"
            x1={s(DEVICE_W)}
            y1={s(DEVICE_H / 2)}
            x2={s(DEVICE_W + zoneMeters)}
            y2={s(DEVICE_H / 2)}
            markerStart={`url(#${dimHead})`}
            markerEnd={`url(#${dimHead})`}
          />
          <text style={{ fontSize: labeled ? 19 : 16 }} x={s(DEVICE_W + zoneMeters / 2)} y={s(DEVICE_H / 2) - 6} textAnchor="middle">
            {text(zoneMeters)}
          </text>
          {back !== undefined && labeled && (
            <>
              <line
                className="dim"
                x1={s(DEVICE_W * 0.25)}
                y1={s(-back)}
                x2={s(DEVICE_W * 0.25)}
                y2="0"
                markerStart={`url(#${dimHead})`}
                markerEnd={`url(#${dimHead})`}
              />
              <text style={{ fontSize: 19 }} x={s(DEVICE_W * 0.25) + 6} y={s(-back / 2) + 5}>
                {meters(back)}
              </text>
            </>
          )}
          {left !== undefined && labeled && (
            <>
              <line
                className="dim"
                x1={s(-left)}
                y1={s(DEVICE_H * 0.7)}
                x2="0"
                y2={s(DEVICE_H * 0.7)}
                markerStart={`url(#${dimHead})`}
                markerEnd={`url(#${dimHead})`}
              />
              <text style={{ fontSize: 19 }} x={s(-left / 2)} y={s(DEVICE_H * 0.7) - 6} textAnchor="middle">
                {meters(left)}
              </text>
            </>
          )}
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-muted">
        {labeled ? 'Draufsicht, Abstände maßstäblich, Gerät schematisch.' : 'Draufsicht, schematisch. Maße laut Herstelleranleitung.'}
      </figcaption>
      {children}
    </figure>
  )
}

/** Beispiel aus einer Herstelleranleitung, eingeklappt: Maße, Abstände und Vorgaben dieser Geräteserie */
function ExampleView({
  example,
  location,
  features,
}: {
  example: PlacementExample
  location: PlacementLocation
  features: readonly string[]
}) {
  const result = placementResult(example.rules, example.refrigerant, location.key, features)
  const zoneMeters = exampleZoneMeters(example, location.key)
  const distance = (side: string) => example.clearances.find((clearance) => clearance.side === side)?.meters
  const name = `${example.manufacturer} ${example.series}`
  return (
    <details className="mt-8 rounded-2xl border-2 border-line bg-surface/95 px-4">
      <summary className="min-h-14 cursor-pointer py-3 font-bold">
        Beispiel aus einer Herstelleranleitung: {name} ({example.refrigerantName})
        {result.excluded.length > 0 && (
          <span className="mt-1 block text-base font-semibold text-warn-ink">
            <WarningIcon className="mr-1 inline size-5 align-text-bottom" aria-hidden="true" />
            {result.excluded.length} Angabe{result.excluded.length === 1 ? '' : 'n'} dort nicht zulässig
          </span>
        )}
      </summary>
      <div className="pb-4">
        <p className="text-base">
          So sehen Maße und Vorgaben in einer konkreten Anleitung aus. Andere Geräte haben andere Werte. Quelle: {example.source}.
        </p>
        {example.zone && zoneMeters !== undefined && (
          <>
            <h4 className="mt-5 text-lg font-bold">
              {example.zone.name}: {meters(zoneMeters)}
            </h4>
            <PlacementSketch
              location={location}
              distances={{ zone: zoneMeters, back: distance('intake') ?? zoneMeters, left: distance('side') ?? zoneMeters }}
              labeled
              zoneName={example.zone.name}
            >
              <p className="mt-2 text-base">{example.zone.description}</p>
              <p className="text-sm text-muted">
                {example.manufacturer}, {example.zone.page}
              </p>
            </PlacementSketch>
          </>
        )}
        {example.clearances.length > 0 && (
          <>
            <h4 className="mt-5 text-lg font-bold">Mindestabstände</h4>
            <dl className="mt-2 divide-y divide-edge rounded-2xl border-2 border-line bg-surface px-4">
              {example.clearances.map((clearance) => (
                <div key={clearance.label} className="py-3">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="font-semibold">{clearance.label}</dt>
                    <dd className="text-lg font-bold">{clearance.value}</dd>
                  </div>
                  {clearance.note && <dd className="mt-1 text-base">{clearance.note}</dd>}
                  <dd className="text-sm text-muted">
                    {example.manufacturer}, {clearance.page}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        )}
        <RuleSections result={result} sourceName={example.manufacturer} title={`Laut ${name}`} />
      </div>
    </details>
  )
}

/** Aufstellungs-Tool: Kältemittel, Aufstellort und Umgebung wählen; darunter die Vorgaben des Leitfadens und Beispiele */
export function PlacementLookup({
  tool,
  initialType,
  initialRefrigerant,
  initialLocation,
  initialFeatures = [],
}: {
  tool: PlacementTool
  initialType?: string
  initialRefrigerant?: string
  initialLocation?: string
  initialFeatures?: string[]
}) {
  const [type, setType] = useState(initialType ?? tool.deviceTypes[0]!.key)
  const [refrigerant, setRefrigerant] = useState(initialRefrigerant)
  const [location, setLocation] = useState(initialLocation)
  const [features, setFeatures] = useState<string[]>(initialFeatures)

  const deviceType = tool.deviceTypes.find((entry) => entry.key === type)!
  const covered = tool.guide.deviceTypes.includes(type)
  const place = tool.locations.find((entry) => entry.key === location)
  const chosenRefrigerant = tool.refrigerants.find((entry) => entry.key === refrigerant)
  const ready = covered && chosenRefrigerant && place
  const result = ready ? placementResult(tool.guide.rules, chosenRefrigerant.key, place.key, features) : undefined
  const zone = ready && tool.guide.zone?.refrigerants.includes(chosenRefrigerant.key) ? tool.guide.zone : undefined
  const examples = ready
    ? tool.examples.filter((example) => example.type === type && example.refrigerant === chosenRefrigerant.key)
    : []

  const toggle = (key: string) =>
    setFeatures((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]))
  const reset = () => {
    setRefrigerant(undefined)
    setLocation(undefined)
    setFeatures([])
  }
  const groups = [...new Set(tool.features.map((feature) => feature.group))]

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Gerät</h2>
        <ClearInputsButton onClear={reset} disabled={refrigerant === undefined && location === undefined && features.length === 0} />
      </div>
      {tool.deviceTypes.length > 1 && (
        <SelectionBar
          bar={{ key: 'type', name: 'Gerätetyp', options: tool.deviceTypes.map((entry) => ({ key: entry.key, label: entry.label, note: '' })) }}
          selected={type}
          onSelect={setType}
        />
      )}

      {!covered ? (
        <div className={card} role="note">
          <p className="flex items-center gap-2 font-bold">
            <InfoIcon className="size-5 shrink-0" aria-hidden="true" />
            Noch keine Vorgaben
          </p>
          <p className="mt-1 text-base">{deviceType.todo}</p>
        </div>
      ) : (
        <>
          <SelectionBar bar={{ key: 'refrigerant', name: 'Kältemittel', options: tool.refrigerants }} selected={refrigerant} onSelect={setRefrigerant} />
          <SelectionBar bar={{ key: 'location', name: 'Aufstellort', options: tool.locations }} selected={location} onSelect={setLocation} wrap />

          {tool.features.length > 0 && (
            <>
              <h2 className="mt-6 text-xl font-bold">Was ist in der Nähe?</h2>
              <p className="text-base text-muted">Alles antippen, was zutrifft.</p>
              {groups.map((group) => (
                <div key={group} role="group" aria-label={group} className="mt-3">
                  <p className="font-semibold">{group}</p>
                  <div className="mt-1 grid gap-2 sm:grid-cols-2">
                    {tool.features
                      .filter((feature) => feature.group === group)
                      .map((feature) => (
                        <FeatureToggle
                          key={feature.key}
                          label={feature.label}
                          note={feature.note}
                          active={features.includes(feature.key)}
                          onToggle={() => toggle(feature.key)}
                        />
                      ))}
                  </div>
                </div>
              ))}
            </>
          )}
        </>
      )}

      <div aria-live="polite">
        {covered && !ready && (
          <div className={card}>
            <p className="text-base text-muted">{!chosenRefrigerant ? 'Kältemittel wählen.' : 'Aufstellort wählen.'}</p>
          </div>
        )}
        {ready && result && (
          <>
            <h2 className="mt-8 text-xl font-bold">
              Ergebnis für {chosenRefrigerant.label} ({chosenRefrigerant.note})
            </h2>
            <RuleSections result={result} sourceName={tool.guide.name} title={`Laut ${tool.guide.name}`} />
            {zone && (
              <>
                <h3 className="mt-6 text-lg font-bold">{zone.name}</h3>
                <PlacementSketch location={place} distances={{ zone: 1, back: 0.6, left: 0.6 }} labeled={false} zoneName={zone.name}>
                  <p className="mt-2 text-base">{zone.description}</p>
                  <p className="text-sm text-muted">
                    {tool.guide.name}, {zone.page}
                  </p>
                </PlacementSketch>
              </>
            )}
            <p className="mt-4 text-sm text-muted">Quelle: {tool.guide.source}</p>
            {examples.map((example) => (
              <ExampleView key={example.key} example={example} location={place} features={features} />
            ))}
          </>
        )}
      </div>

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
