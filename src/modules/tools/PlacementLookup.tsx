import { useId, useState, type ReactNode } from 'react'
import { ClearInputsButton } from '../../components/ClearInputsButton'
import { InfoIcon, WarningIcon } from '../../components/icons'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { SelectionBar } from './ChoiceLookup'
import {
  clearancesAt,
  manufacturersFor,
  PLACEMENT_LEVELS,
  placementResult,
  zoneRowsAt,
  type PlacementLocation,
  type PlacementManufacturer,
  type PlacementResult,
  type PlacementRule,
  type PlacementSeries,
  type PlacementTool,
} from './placementTool'

const card = 'mt-4 rounded-2xl border-2 border-line bg-surface p-4'
const listCard = 'mt-2 divide-y divide-edge rounded-2xl border-2 border-line bg-surface px-4'

const LEVEL_STYLES: Record<PlacementRule['level'], string> = {
  forbidden: 'bg-warn text-warn-ink',
  required: 'bg-accent text-accent-ink',
  avoid: 'border-2 border-warn-ink/60 text-ink',
  recommended: 'bg-raised text-ink',
  note: 'border-2 border-line text-muted',
}

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
    <ul className={listCard}>
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

/** Vorgaben einer Quelle: Ausschlüsse oben, dann passende, immer geltende und eingeklappt die übrigen */
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

/** Skizze in Metern; die Abstände sind nur schematisch, weil die Maße je Hersteller verschieden sind */
const DEVICE_W = 1.2
const DEVICE_H = 0.6
const ZONE = 1
const WALL_GAP = 0.6
const SCALE = 100

/**
 * Draufsicht, schematisch: Gerät mit Ansaugseite hinten (oben) und Ausblasseite vorn (unten), Schutzbereich als Fläche,
 * an Wänden abgeschnitten. Statt Maßen steht „Hersteller“ an der Maßlinie.
 */
function PlacementSketch({ location, zoneName, children }: { location: PlacementLocation; zoneName: string; children?: ReactNode }) {
  const clipId = useId().replace(/:/g, '')
  const back = location.walls.includes('back') ? WALL_GAP : undefined
  const left = location.walls.includes('left') ? WALL_GAP : undefined
  const wall = 0.15
  const margin = 0.2
  // Hinter einer Wand wird nichts gezeichnet: Dort endet die Skizze knapp hinter der Wand
  const minX = (left !== undefined ? -left - wall : -ZONE) - margin
  const minY = (back !== undefined ? -back - wall : -ZONE) - margin
  const maxX = DEVICE_W + ZONE + margin
  const maxY = DEVICE_H + ZONE + margin + 0.15
  const s = (value: number) => Math.round(value * SCALE * 10) / 10
  const clip = { x: left !== undefined ? -left : minX, y: back !== undefined ? -back : minY }
  const walls = [back !== undefined && 'Wand hinter der Ansaugseite', left !== undefined && 'Wand seitlich'].filter(Boolean).join(', ')
  const arrow = `${clipId}-arrow`
  const dimHead = `${clipId}-dim`
  const wallStartX = left !== undefined ? -left - wall : minX
  const wallStartY = back !== undefined ? -back - wall : minY

  return (
    <figure className="mt-3 rounded-2xl border border-edge bg-surface p-3 break-inside-avoid">
      <div
        className="figure-art"
        role="img"
        aria-label={`Draufsicht, schematisch: ${zoneName} um das Gerät${walls ? `, ${walls}` : ''}; Maße laut Hersteller`}
      >
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

          <g clipPath={`url(#${clipId})`}>
            <rect className="area" x={s(-ZONE)} y={s(-ZONE)} width={s(DEVICE_W + 2 * ZONE)} height={s(DEVICE_H + 2 * ZONE)} rx={s(ZONE)} opacity="0.6" />
            <rect className="dim dash" x={s(-ZONE)} y={s(-ZONE)} width={s(DEVICE_W + 2 * ZONE)} height={s(DEVICE_H + 2 * ZONE)} rx={s(ZONE)} />
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
            x2={s(DEVICE_W + ZONE)}
            y2={s(DEVICE_H / 2)}
            markerStart={`url(#${dimHead})`}
            markerEnd={`url(#${dimHead})`}
          />
          <text style={{ fontSize: 16 }} x={s(DEVICE_W + ZONE / 2)} y={s(DEVICE_H / 2) - 6} textAnchor="middle">
            Hersteller
          </text>
        </svg>
      </div>
      <figcaption className="mt-2 text-sm text-muted">Draufsicht, schematisch. Maße laut Herstelleranleitung.</figcaption>
      {children}
    </figure>
  )
}

/** Vorgaben einer Baureihe: Schutzbereich am gewählten Ort, Mindestabstände und Vorgaben */
function SeriesView({
  manufacturer,
  series,
  location,
  features,
}: {
  manufacturer: PlacementManufacturer
  series: PlacementSeries
  location: PlacementLocation
  features: readonly string[]
}) {
  const result = placementResult(series.rules, series.refrigerant, location.key, features)
  const zones = zoneRowsAt(series, location.key)
  const clearances = clearancesAt(series, location.key)
  const name = `${manufacturer.name} ${series.name}`
  return (
    <section className="mt-10 border-t-2 border-line pt-6" aria-label={`Laut ${name}`}>
      <h2 className="text-xl font-bold">
        Laut {name} ({series.refrigerantName})
      </h2>
      {series.covers && <p className="mt-1 text-base">{series.covers}</p>}

      <h3 className="mt-5 text-lg font-bold">Schutzbereich bei „{location.label}“</h3>
      {zones.length === 0 ? (
        <div className={card}>
          <p className="text-base">Die Anleitung nennt für diesen Aufstellort keinen Schutzbereich. Prüfen, ob sie diese Aufstellung überhaupt vorsieht; siehe Vorgaben unten.</p>
        </div>
      ) : (
        <dl className={listCard}>
          {zones.map((row) => (
            <div key={`${row.condition}-${row.value}`} className="py-3">
              {row.condition && <dt className="text-sm font-semibold text-muted">{row.condition}</dt>}
              <dd className="text-lg font-bold">{row.value}</dd>
              {row.note && <dd className="mt-1 text-base">{row.note}</dd>}
              <dd className="text-sm text-muted">
                {manufacturer.name}, {row.page}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {series.zoneNote && <p className="mt-2 text-base">{series.zoneNote}</p>}

      {clearances.length > 0 && (
        <>
          <h3 className="mt-5 text-lg font-bold">Mindestabstände</h3>
          <dl className={listCard}>
            {clearances.map((clearance) => (
              <div key={clearance.label} className="py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <dt className="font-semibold">{clearance.label}</dt>
                  <dd className="text-lg font-bold">{clearance.value}</dd>
                </div>
                {clearance.note && <dd className="mt-1 text-base">{clearance.note}</dd>}
                <dd className="text-sm text-muted">
                  {manufacturer.name}, {clearance.page}
                </dd>
              </div>
            ))}
          </dl>
        </>
      )}

      <RuleSections result={result} sourceName={manufacturer.name} title={`Laut ${manufacturer.name}`} />
      <p className="mt-4 text-sm text-muted">Quelle: {series.source}</p>
    </section>
  )
}

/** Aufstellungs-Tool: Kältemittel, optional Hersteller, Aufstellort und Umgebung wählen; darunter Leitfaden und Hersteller */
export function PlacementLookup({
  tool,
  initialType,
  initialRefrigerant,
  initialManufacturer,
  initialSeries,
  initialLocation,
  initialFeatures = [],
}: {
  tool: PlacementTool
  initialType?: string
  initialRefrigerant?: string
  initialManufacturer?: string
  initialSeries?: string
  initialLocation?: string
  initialFeatures?: string[]
}) {
  const idPrefix = useId()
  const [type, setType] = useState(initialType ?? tool.deviceTypes[0]!.key)
  const [refrigerant, setRefrigerant] = useState(initialRefrigerant)
  const [manufacturerKey, setManufacturerKey] = useState(initialManufacturer ?? '')
  const [seriesKey, setSeriesKey] = useState(initialSeries)
  const [location, setLocation] = useState(initialLocation)
  const [features, setFeatures] = useState<string[]>(initialFeatures)

  const deviceType = tool.deviceTypes.find((entry) => entry.key === type)!
  const covered = tool.guide.deviceTypes.includes(type)
  const place = tool.locations.find((entry) => entry.key === location)
  const chosenRefrigerant = tool.refrigerants.find((entry) => entry.key === refrigerant)
  const manufacturers = chosenRefrigerant ? manufacturersFor(tool, type, chosenRefrigerant.key) : []
  const manufacturer = manufacturers.find((entry) => entry.key === manufacturerKey)
  // Bei nur einer Baureihe gleich auswählen
  const series = manufacturer?.series.find((entry) => entry.key === seriesKey) ?? (manufacturer?.series.length === 1 ? manufacturer.series[0] : undefined)
  const ready = covered && chosenRefrigerant && place
  const result = ready ? placementResult(tool.guide.rules, chosenRefrigerant.key, place.key, features) : undefined
  const zone = ready && tool.guide.zone?.refrigerants.includes(chosenRefrigerant.key) ? tool.guide.zone : undefined

  const toggle = (key: string) =>
    setFeatures((current) => (current.includes(key) ? current.filter((value) => value !== key) : [...current, key]))
  const reset = () => {
    setRefrigerant(undefined)
    setManufacturerKey('')
    setSeriesKey(undefined)
    setLocation(undefined)
    setFeatures([])
  }
  const groups = [...new Set(tool.features.map((feature) => feature.group))]

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-xl font-bold">Gerät</h2>
        <ClearInputsButton
          onClear={reset}
          disabled={refrigerant === undefined && manufacturerKey === '' && location === undefined && features.length === 0}
        />
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
          <SelectionBar
            bar={{ key: 'refrigerant', name: 'Kältemittel', options: tool.refrigerants }}
            selected={refrigerant}
            onSelect={(key) => {
              setRefrigerant(key)
              setManufacturerKey('')
              setSeriesKey(undefined)
            }}
          />

          {chosenRefrigerant && (
            <>
              <label htmlFor={`${idPrefix}-manufacturer`} className="mt-6 block font-semibold">
                Hersteller
              </label>
              {manufacturers.length === 0 ? (
                <p className="mt-1 text-base text-muted">
                  Für {chosenRefrigerant.label} sind noch keine Herstellerangaben hinterlegt. Es gelten die allgemeinen Vorgaben.
                </p>
              ) : (
                <select
                  id={`${idPrefix}-manufacturer`}
                  value={manufacturer?.key ?? ''}
                  onChange={(event) => {
                    setManufacturerKey(event.target.value)
                    setSeriesKey(undefined)
                  }}
                  className={`${fieldBase} mt-1 w-full`}
                >
                  <option value="">Kein bestimmter Hersteller</option>
                  {manufacturers.map((entry) => (
                    <option key={entry.key} value={entry.key}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              )}
              {manufacturer && manufacturer.series.length > 1 && (
                <SelectionBar
                  bar={{ key: 'series', name: 'Baureihe', options: manufacturer.series.map((entry) => ({ key: entry.key, label: entry.name, note: '' })) }}
                  selected={series?.key}
                  onSelect={setSeriesKey}
                  wrap
                />
              )}
              {series && manufacturer && manufacturer.series.length === 1 && (
                <p className="mt-1 text-sm text-muted">Angaben aus der Anleitung {series.name}.</p>
              )}
            </>
          )}

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
              Allgemein für {chosenRefrigerant.label} ({chosenRefrigerant.note})
            </h2>
            <RuleSections result={result} sourceName={tool.guide.name} title={`Laut ${tool.guide.name}`} />
            {zone && (
              <>
                <h3 className="mt-6 text-lg font-bold">{zone.name}</h3>
                <PlacementSketch location={place} zoneName={zone.name}>
                  <p className="mt-2 text-base">{zone.description}</p>
                  <p className="text-sm text-muted">
                    {tool.guide.name}, {zone.page}
                  </p>
                </PlacementSketch>
              </>
            )}
            <p className="mt-4 text-sm text-muted">Quelle: {tool.guide.source}</p>
            {manufacturer && series && <SeriesView manufacturer={manufacturer} series={series} location={place} features={features} />}
            {manufacturers.length > 0 && !manufacturer && (
              <div className={card}>
                <p className="text-base">
                  Maße von Schutzbereich und Mindestabständen legt der Hersteller fest. Hersteller wählen, um sie zu sehen.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
