import { useId, useRef, useState } from 'react'
import { secondaryButton } from '../../components/buttons'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { formatNumber, parseDecimal } from '../../lib/number'
import { SelectionBar } from './ChoiceLookup'
import {
  countedFixtures,
  dnLabel,
  findLine,
  findTable,
  findUsage,
  innerDiameter,
  selectedTable,
  sizeLine,
  usesFlow,
  type CustomFixture,
  type DesignFlow,
  type DrainageLine,
  type DrainageSizingTool,
  type SizingResult,
  type SlopeLine,
} from './drainageSizingTool'
import { Counter } from './SurveyParts'

/** Eigener Gegenstand im Formular; Zahlenfelder als Text */
export interface CustomRow {
  key: string
  name: string
  du: string
  count: number
  dn: string
  wc: boolean
}

/** Außendurchmesser (DN/OD wie im Leitfaden) oder Innendurchmesser */
export type DiameterMode = 'outer' | 'inner'

/** Eingaben des Rechners; Zahlenfelder als Text */
export interface DrainageState {
  line: string
  usage: string
  counts: Record<string, number>
  custom: CustomRow[]
  units: number
  continuous: string
  pump: string
  ventilation: string
  branchType: string
  table: string
  diameter: DiameterMode
}

const MAX_COUNT = 999

const decimals = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 2 })
// Anschlusswerte wie in der Quelle mit mindestens einer Nachkommastelle, z. B. 2,0 l/s
const duFormat = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 })
const formatDu = (value: number) => `${duFormat.format(value)} l/s`
const formatFlow = (value: number) => `${formatNumber(value, 2)} l/s`
const formatSlope = (value: number) => `${formatNumber(value, 1)} %`

function initialDrainageState(tool: DrainageSizingTool): DrainageState {
  const stack = tool.lines.find((line) => line.type === 'stack')
  return {
    line: tool.lines[0]!.key,
    usage: tool.usages[0]!.key,
    counts: {},
    custom: [],
    units: 1,
    continuous: '',
    pump: '',
    ventilation: stack?.type === 'stack' ? stack.ventilations[0]!.key : '',
    branchType: stack?.type === 'stack' ? stack.branchTypes[0]!.key : '',
    table: '',
    diameter: 'outer',
  }
}

/** Optionale Zufluss-Felder: leer = 0, ungültig = undefined */
function optionalFlow(text: string): number | undefined {
  if (text.trim() === '') return 0
  const value = parseDecimal(text)
  return value === undefined || value < 0 ? undefined : value
}

/** DU eines eigenen Gegenstands: leer = noch nichts, sonst Zahl größer 0 */
function customDu(row: CustomRow): { value?: number; error: boolean } {
  if (row.du.trim() === '') return { error: false }
  const value = parseDecimal(row.du)
  return value === undefined || value <= 0 ? { error: true } : { value, error: false }
}

/** Nennweite eines eigenen Gegenstands: leer = unbekannt, sonst ganze Zahl größer 0 */
function customDn(row: CustomRow): { value?: number; error: boolean } {
  if (row.dn.trim() === '') return { error: false }
  const value = parseDecimal(row.dn)
  return value === undefined || value <= 0 || !Number.isInteger(value) ? { error: true } : { value, error: false }
}

function toCustomFixtures(rows: readonly CustomRow[]): CustomFixture[] {
  return rows.flatMap((row) => {
    const du = customDu(row).value
    if (du === undefined) return []
    const dn = customDn(row).value
    return [{ key: row.key, name: row.name, du, count: row.count, wc: row.wc, ...(dn !== undefined ? { connectionDn: dn } : {}) }]
  })
}

/** Nennweite als Außen- oder Innendurchmesser; ohne bekannte Fläche bleibt es bei DN */
function diameterLabel(tool: DrainageSizingTool, mode: DiameterMode) {
  return (dn: number) => {
    const inner = mode === 'inner' ? innerDiameter(tool, dn) : undefined
    return inner === undefined ? dnLabel(dn) : `di ${formatNumber(inner, 1)} mm`
  }
}

function FlowField({ id, label, hint, value, onChange }: { id: string; label: string; hint: string; value: string; onChange: (value: string) => void }) {
  const invalid = optionalFlow(value) === undefined
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
          placeholder="0"
          value={value}
          aria-invalid={invalid}
          aria-describedby={`${id}-hint`}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldBase} w-28 ${invalid ? 'border-warn-ink outline-2 outline-warn' : ''}`}
        />
        <span className="text-lg">l/s</span>
      </div>
      <p id={`${id}-hint`} className="mt-1 text-sm text-muted">
        {invalid ? 'Zahl ab 0 eingeben (Beispiel: 0,5)' : hint}
      </p>
    </div>
  )
}

/** Liste der Gegenstände je Gruppe mit Zähler */
function FixtureList({
  tool,
  line,
  counts,
  perUnit,
  onChange,
}: {
  tool: DrainageSizingTool
  line: DrainageLine
  counts: Record<string, number>
  perUnit: boolean
  onChange: (key: string, value: number) => void
}) {
  const idPrefix = useId()
  return (
    <>
      {tool.groups.map((group) => (
        <div key={group.key} className="mt-4">
          <h3 className="text-lg font-semibold">{group.label}</h3>
          <ul className="mt-1 divide-y divide-line rounded-2xl border-2 border-line bg-surface">
            {tool.fixtures
              .filter((fixture) => fixture.group === group.key)
              .map((fixture) => (
                <li key={fixture.key} className="flex items-center justify-between gap-3 px-3 py-2">
                  <label htmlFor={`${idPrefix}-${fixture.key}`} className="min-w-0">
                    <span className="block font-semibold">{fixture.name}</span>
                    <span className="block text-sm text-muted">
                      {line.type === 'single' ? `Einzelanschluss ${dnLabel(fixture.connectionDn)}` : `DU ${formatDu(fixture.du)}`}
                    </span>
                  </label>
                  <Counter
                    id={`${idPrefix}-${fixture.key}`}
                    label={perUnit ? `${fixture.name} je Einheit` : fixture.name}
                    value={counts[fixture.key] ?? 0}
                    max={MAX_COUNT}
                    onChange={(value) => onChange(fixture.key, Math.min(Math.max(value, 0), MAX_COUNT))}
                  />
                </li>
              ))}
          </ul>
        </div>
      ))}
    </>
  )
}

/** Ein eigener Gegenstand: Bezeichnung, DU, Anzahl, optional Einzelanschluss-DN und WC */
function CustomRowCard({
  row,
  index,
  showDn,
  perUnit,
  onChange,
  onRemove,
}: {
  row: CustomRow
  index: number
  showDn: boolean
  perUnit: boolean
  onChange: (patch: Partial<CustomRow>) => void
  onRemove: () => void
}) {
  const id = useId()
  const du = customDu(row)
  const dn = customDn(row)
  const label = row.name.trim() || `Eigener Gegenstand ${index + 1}`
  return (
    <li className="rounded-2xl border-2 border-line bg-surface p-3">
      <div className="flex items-end gap-3">
        <div className="min-w-0 flex-1">
          <label htmlFor={`${id}-name`} className="block font-semibold">
            Bezeichnung
          </label>
          <input
            id={`${id}-name`}
            type="text"
            autoComplete="off"
            placeholder="z. B. Gewerbespülmaschine"
            value={row.name}
            onChange={(event) => onChange({ name: event.target.value })}
            className={`${fieldBase} mt-1 w-full`}
          />
        </div>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${label} entfernen`}
          className="inline-flex size-12 shrink-0 items-center justify-center rounded-xl border-2 border-line text-xl font-bold"
        >
          <span aria-hidden="true">✕</span>
        </button>
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        <div>
          <label htmlFor={`${id}-du`} className="block font-semibold">
            Anschlusswert DU
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${id}-du`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,8"
              value={row.du}
              aria-invalid={du.error}
              onChange={(event) => onChange({ du: event.target.value })}
              className={`${fieldBase} w-24 ${du.error ? 'border-warn-ink outline-2 outline-warn' : ''}`}
            />
            <span className="text-lg">l/s</span>
          </div>
        </div>
        {showDn && (
          <div>
            <label htmlFor={`${id}-dn`} className="block font-semibold">
              Einzelanschluss DN
            </label>
            <input
              id={`${id}-dn`}
              type="text"
              inputMode="numeric"
              autoComplete="off"
              placeholder="falls bekannt"
              value={row.dn}
              aria-invalid={dn.error}
              onChange={(event) => onChange({ dn: event.target.value })}
              className={`${fieldBase} mt-1 w-36 ${dn.error ? 'border-warn-ink outline-2 outline-warn' : ''}`}
            />
          </div>
        )}
        <div>
          <span className="block font-semibold">{perUnit ? 'Anzahl je Einheit' : 'Anzahl'}</span>
          <div className="mt-1">
            <Counter id={`${id}-count`} label={label} value={row.count} max={MAX_COUNT} onChange={(value) => onChange({ count: Math.min(Math.max(value, 0), MAX_COUNT) })} />
          </div>
        </div>
      </div>
      {du.error && <p className="mt-2 font-semibold">Zahl größer 0 eingeben (Beispiel: 1,5)</p>}
      {dn.error && <p className="mt-2 font-semibold">Ganze Zahl eingeben (Beispiel: 50)</p>}
      {!du.error && du.value === undefined && <p className="mt-2 text-sm text-muted">Zählt mit, sobald ein DU eingetragen ist.</p>}
      <label className="mt-3 flex min-h-12 cursor-pointer items-center gap-3 font-semibold">
        <input type="checkbox" checked={row.wc} onChange={(event) => onChange({ wc: event.target.checked })} className="size-6 shrink-0 accent-current" />
        Ist ein WC (zählt bei den WC-Grenzen mit)
      </label>
    </li>
  )
}

/** Rechenweg für Fall-, Sammel- und Grundleitungen */
function FlowSteps({ flow, units, extra }: { flow: DesignFlow; units: number; extra: boolean }) {
  return (
    <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
      <dt className="font-semibold">ΣDU</dt>
      <dd>
        {formatDu(flow.sumDu)}
        {units > 1 && <span className="text-muted"> ({units} Einheiten)</span>}
      </dd>
      <dt className="font-semibold">
        Q<sub>ww</sub>
      </dt>
      <dd>
        {decimals.format(flow.k)} · √{decimals.format(flow.sumDu)} = {formatFlow(flow.qww)}
      </dd>
      {extra && (
        <>
          <dt className="font-semibold">
            Q<sub>tot</sub>
          </dt>
          <dd>{formatFlow(flow.qtot)}</dd>
        </>
      )}
      {flow.largest && (
        <>
          <dt className="font-semibold">Größter DU</dt>
          <dd>
            {formatDu(flow.largest.du)} <span className="text-muted">({flow.largest.name})</span>
          </dd>
        </>
      )}
    </dl>
  )
}

function Skipped({ skipped, label }: { skipped: { dn: number; reasons: string[] }[]; label: (dn: number) => string }) {
  if (skipped.length === 0) return null
  return (
    <ul className="mt-2 space-y-1 text-base">
      {skipped.map((entry) => (
        <li key={entry.dn}>
          {label(entry.dn)} reicht, aber {entry.reasons.join(', ')}.
        </li>
      ))}
    </ul>
  )
}

/** Im Innendurchmesser-Modus die Nennweite klein dahinter, damit man das Rohr findet */
function OuterHint({ dn, mode, tool }: { dn: number; mode: DiameterMode; tool: DrainageSizingTool }) {
  if (mode !== 'inner' || innerDiameter(tool, dn) === undefined) return null
  return <span className="text-base font-semibold"> ({dnLabel(dn)})</span>
}

function ResultCard({
  tool,
  line,
  result,
  state,
  custom,
  onDiameter,
}: {
  tool: DrainageSizingTool
  line: DrainageLine
  result: SizingResult
  state: DrainageState
  custom: readonly CustomFixture[]
  onDiameter: (mode: DiameterMode) => void
}) {
  const counted = countedFixtures(tool, state.counts, custom)
  const empty = counted.length === 0
  const found = result.type === 'single' ? !empty : result.type === 'slope' ? result.options.length > 0 : result.row !== undefined
  const warn = !empty && !found
  const mode = state.diameter
  const size = diameterLabel(tool, mode)
  const own = counted.filter(({ fixture }) => fixture.custom).map(({ fixture }) => fixture.name)
  return (
    <div aria-live="polite" className={`mt-6 rounded-2xl border-2 p-4 ${warn ? 'border-warn-ink bg-warn text-warn-ink' : 'border-accent bg-surface'}`}>
      <p className="font-semibold">{line.title}</p>
      {empty ? (
        <p className="mt-1 text-lg font-bold">Gegenstände zählen, die an dieser Leitung hängen.</p>
      ) : result.type === 'single' ? (
        <ul className="mt-2 space-y-2">
          {result.items.map(({ fixture }) => (
            <li key={fixture.key}>
              {fixture.connectionDn === undefined ? (
                <span className="text-lg font-bold">Nennweite laut Hersteller</span>
              ) : (
                <>
                  <span className="text-2xl font-bold">{size(fixture.connectionDn)}</span>
                  <OuterHint dn={fixture.connectionDn} mode={mode} tool={tool} />
                </>
              )}{' '}
              <span className="text-lg">{fixture.name}</span>
              {fixture.connectionNote && <span className="block text-sm">{fixture.connectionNote}</span>}
            </li>
          ))}
        </ul>
      ) : result.type === 'branch' ? (
        <>
          <p className="mt-1 text-base">ΣDU = {formatDu(result.sumDu)}</p>
          {result.noValues ? (
            <p className="mt-2 text-lg font-bold">Für diese Gebäudeart nennt der Leitfaden keine Werte.</p>
          ) : result.row ? (
            <>
              <p className="text-4xl font-bold">
                {size(result.row.dn)}
                <OuterHint dn={result.row.dn} mode={mode} tool={tool} />
              </p>
              <p className="mt-1 text-lg font-semibold">
                bis ΣDU {formatDu(result.row.maxSumDu[state.usage]!)}, unbelüftet höchstens {decimals.format(result.row.maxLength)} m lang
              </p>
              {result.largerConnection?.connectionDn !== undefined && (
                <p className="mt-2 text-base">
                  Hinweis: Die Einzelanschlussleitung von „{result.largerConnection.name}“ ist{' '}
                  {size(result.largerConnection.connectionDn)}, also größer.
                </p>
              )}
            </>
          ) : (
            <p className="mt-2 text-lg font-bold">{line.type === 'branch' ? line.overTable : ''}</p>
          )}
          <Skipped skipped={result.skipped} label={size} />
        </>
      ) : result.type === 'stack' ? (
        <>
          {result.row ? (
            <>
              <p className="text-4xl font-bold">
                {size(result.row.dn)}
                <OuterHint dn={result.row.dn} mode={mode} tool={tool} />
              </p>
              <p className="mt-1 text-lg font-semibold">
                bis {formatFlow(result.capacity!)}
                {result.row.ventDn !== undefined && `, Nebenlüftung ${size(result.row.ventDn)}`}
              </p>
              {result.row.notes.map((note) => (
                <p key={note} className="mt-1 text-base font-semibold">
                  {note}
                </p>
              ))}
            </>
          ) : (
            <p className="mt-2 text-lg font-bold">{line.type === 'stack' ? line.overTable : ''}</p>
          )}
          <Skipped skipped={result.skipped} label={size} />
          <FlowSteps flow={result.flow} units={state.units} extra={result.flow.qtot !== result.flow.qww} />
          <MaxDuNote flow={result.flow} />
        </>
      ) : (
        <>
          {result.options.length > 0 ? (
            <ul className="mt-2 space-y-2">
              {result.options.map((option) => (
                <li key={option.dn}>
                  <span className="text-2xl font-bold">{size(option.dn)}</span>
                  <OuterHint dn={option.dn} mode={mode} tool={tool} />{' '}
                  <span className="text-lg font-semibold">ab {formatSlope(option.slope)} Gefälle</span>{' '}
                  <span className="text-base text-muted">(bis {formatFlow(option.capacity)})</span>
                  {option.belowRecommended && line.type === 'slope' && line.recommendedMinDn && (
                    <span className="block text-sm">{line.recommendedMinDn.text}</span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-lg font-bold">{line.type === 'slope' ? line.overTable : ''}</p>
          )}
          <p className="mt-2 text-sm">{result.table.condition}</p>
          <FlowSteps flow={result.flow} units={state.units} extra={result.flow.qtot !== result.flow.qww} />
          <MaxDuNote flow={result.flow} />
        </>
      )}
      {own.length > 0 && (
        <p className="mt-3 text-base font-semibold">Mit eigenen Angaben, nicht aus dem Leitfaden: {own.join(', ')}.</p>
      )}
      {!empty && (
        <>
          <SelectionBar
            bar={{
              key: 'diameter',
              name: 'Angabe als',
              options: [
                { key: 'outer', label: 'Außen-Ø', note: 'DN/OD' },
                { key: 'inner', label: 'Innen-Ø', note: 'di' },
              ],
            }}
            selected={mode}
            onSelect={(key) => onDiameter(key as DiameterMode)}
          />
          <p className="mt-1 text-sm">
            {mode === 'outer'
              ? 'Rohraußendurchmesser DN/OD wie im Leitfaden, z. B. DN 110 statt DN 100.'
              : `Innendurchmesser aus den Querschnittsflächen ${tool.crossSections.system}, auf 0,1 mm gerundet.`}
          </p>
        </>
      )}
    </div>
  )
}

/** Wann der gewählte Füllungsgrad gilt; abseits der Empfehlung mit Hinweis auf den Regelfall */
function FillingHint({
  tool,
  line,
  current,
  single,
}: {
  tool: DrainageSizingTool
  line: DrainageLine
  current: SlopeLine['tables'][number]
  single: boolean
}) {
  if (line.type !== 'slope') return null
  const table = findTable(tool, current.key)
  const recommended = line.tables
    .filter((entry) => entry.recommended)
    .flatMap((entry) => {
      const label = findTable(tool, entry.key)?.label
      return label ? [`Füllungsgrad ${label}`] : []
    })
  const regular = [...new Set(recommended)].join(' oder ')
  return (
    <div
      className={`mt-2 rounded-xl p-3 text-base ${current.recommended ? 'border-2 border-line bg-surface' : 'bg-warn font-semibold text-warn-ink'}`}
    >
      {current.recommended ? (
        <p>
          <span className="font-bold">
            <span aria-hidden="true">✓ </span>
            {`Empfohlen${single && table ? `: Füllungsgrad ${table.label}` : ''}`}
          </span>{' '}
          {`– ${current.use}`}
        </p>
      ) : (
        <>
          <p>{current.use}</p>
          {regular && <p className="mt-1">{`Im Regelfall empfohlen: ${regular}.`}</p>}
        </>
      )}
    </div>
  )
}

function MaxDuNote({ flow }: { flow: DesignFlow }) {
  if (!flow.largestGoverns || !flow.largest) return null
  return (
    <p className="mt-2 text-base font-semibold">
      Maßgebend ist der größte Anschlusswert ({formatDu(flow.largest.du)}), weil er über dem errechneten Abfluss liegt.
    </p>
  )
}

/** Abwasser-Bemessung: Abschnitt und Gebäudeart wählen, Gegenstände zählen, Nennweite ablesen */
export function DrainageSizing({ tool, initial }: { tool: DrainageSizingTool; initial?: Partial<DrainageState> }) {
  const headingId = useId()
  const fieldId = useId()
  const [state, setState] = useState<DrainageState>(() => ({ ...initialDrainageState(tool), ...initial }))
  const nextCustom = useRef(state.custom.length)
  // Eigene Gegenstände zugeklappt, damit die Seite kürzer bleibt; offen, wenn schon welche da sind
  const [customOpen, setCustomOpen] = useState(state.custom.length > 0)
  const update = (patch: Partial<DrainageState>) => setState((current) => ({ ...current, ...patch }))
  const updateCustom = (key: string, patch: Partial<CustomRow>) =>
    setState((current) => ({ ...current, custom: current.custom.map((row) => (row.key === key ? { ...row, ...patch } : row)) }))

  const line = findLine(tool, state.line) ?? tool.lines[0]!
  const usage = findUsage(tool, state.usage) ?? tool.usages[0]!
  const flowLine = usesFlow(line)
  const continuous = optionalFlow(state.continuous)
  const pump = optionalFlow(state.pump)
  const custom = toCustomFixtures(state.custom)
  const result = sizeLine(tool, {
    line: line.key,
    usage: usage.key,
    counts: state.counts,
    custom,
    units: flowLine ? state.units : 1,
    continuous: flowLine ? (continuous ?? 0) : 0,
    pump: flowLine ? (pump ?? 0) : 0,
    ventilation: state.ventilation,
    branchType: state.branchType,
    table: state.table,
  })
  const tables =
    line.type === 'slope' ? line.tables.flatMap((entry) => (findTable(tool, entry.key) ? [{ ...entry, table: findTable(tool, entry.key)! }] : [])) : []
  const currentTable = line.type === 'slope' ? selectedTable(line, state.table) : undefined
  const hasInput =
    countedFixtures(tool, state.counts).length > 0 ||
    state.custom.length > 0 ||
    state.units !== 1 ||
    state.continuous !== '' ||
    state.pump !== ''

  return (
    <section className="mt-6" aria-labelledby={headingId}>
      <SelectionBar
        bar={{ key: 'line', name: 'Leitungsabschnitt', options: tool.lines.map(({ key, label, note }) => ({ key, label, note })) }}
        selected={line.key}
        onSelect={(key) => update({ line: key })}
        wrap
      />

      {line.type !== 'single' && (
        <>
          <SelectionBar
            bar={{
              key: 'usage',
              name: 'Gebäudeart',
              options: tool.usages.map((option) => ({ key: option.key, label: option.label, note: `K = ${decimals.format(option.k)}` })),
            }}
            selected={usage.key}
            onSelect={(key) => update({ usage: key })}
            wrap={tool.usages.length > 3}
          />
          <p className="mt-1 text-base">
            z. B. {usage.examples}
            {usage.note && <span className="block text-sm text-muted">{usage.note}</span>}
          </p>
        </>
      )}

      {line.type === 'stack' && (
        <>
          <SelectionBar
            bar={{ key: 'ventilation', name: 'Lüftung', options: line.ventilations.map(({ key, label, note }) => ({ key, label, note })) }}
            selected={line.ventilations.some((option) => option.key === state.ventilation) ? state.ventilation : line.ventilations[0]!.key}
            onSelect={(key) => update({ ventilation: key })}
          />
          <SelectionBar
            bar={{ key: 'branchType', name: 'Abzweige', options: line.branchTypes }}
            selected={line.branchTypes.some((option) => option.key === state.branchType) ? state.branchType : line.branchTypes[0]!.key}
            onSelect={(key) => update({ branchType: key })}
          />
        </>
      )}

      {tables.length > 1 && (
        <SelectionBar
          bar={{
            key: 'table',
            name: 'Füllungsgrad',
            options: tables.map(({ key, recommended, table }) => ({
              key,
              label: table.label,
              note: '',
              badge: recommended ? 'Empfohlen' : undefined,
            })),
          }}
          selected={currentTable?.key}
          onSelect={(key) => update({ table: key })}
        />
      )}
      {currentTable && <FillingHint tool={tool} line={line} current={currentTable} single={tables.length === 1} />}

      <div className="mt-8">
        <HeadingWithClear
          id={headingId}
          onClear={() => update({ counts: {}, custom: [], units: 1, continuous: '', pump: '' })}
          disabled={!hasInput}
        >
          {flowLine ? 'Gegenstände je Einheit' : 'Angeschlossene Gegenstände'}
        </HeadingWithClear>
      </div>
      {flowLine && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded-2xl border-2 border-line bg-surface px-3 py-2">
          <label htmlFor={`${fieldId}-units`} className="min-w-0">
            <span className="block font-semibold">Anzahl gleicher Einheiten</span>
            <span className="block text-sm text-muted">z. B. Wohnungen an der Leitung</span>
          </label>
          <Counter
            id={`${fieldId}-units`}
            label="Einheiten"
            value={state.units}
            min={1}
            max={MAX_COUNT}
            onChange={(value) => update({ units: Math.min(Math.max(value, 1), MAX_COUNT) })}
          />
        </div>
      )}
      <FixtureList
        tool={tool}
        line={line}
        counts={state.counts}
        perUnit={flowLine && state.units > 1}
        onChange={(key, value) => update({ counts: { ...state.counts, [key]: value } })}
      />

      <details
        open={customOpen}
        onToggle={(event) => setCustomOpen(event.currentTarget.open)}
        className="group mt-4 rounded-2xl border-2 border-line bg-surface px-3"
      >
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-2 py-2 text-lg font-semibold [&::-webkit-details-marker]:hidden">
          Eigene Gegenstände
          {state.custom.length > 0 && (
            <span className="rounded-full bg-accent px-2 text-base font-bold text-accent-ink">{state.custom.length}</span>
          )}
          <span aria-hidden="true" className="ml-auto text-xl transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>
        <div className="pb-3">
          <p className="text-base text-muted">Für Gegenstände, die nicht in der Liste stehen. Den Anschlusswert DU z. B. beim Hersteller nachsehen.</p>
          {state.custom.length > 0 && (
            <ul className="mt-2 space-y-3">
              {state.custom.map((row, index) => (
                <CustomRowCard
                  key={row.key}
                  row={row}
                  index={index}
                  showDn={line.type === 'single'}
                  perUnit={flowLine && state.units > 1}
                  onChange={(patch) => updateCustom(row.key, patch)}
                  onRemove={() => update({ custom: state.custom.filter((candidate) => candidate.key !== row.key) })}
                />
              ))}
            </ul>
          )}
          <button
            type="button"
            className={`${secondaryButton} mt-2`}
            onClick={() =>
              update({ custom: [...state.custom, { key: `custom${nextCustom.current++}`, name: '', du: '', count: 1, dn: '', wc: false }] })
            }
          >
            <span aria-hidden="true">+</span> Eigener Gegenstand
          </button>
        </div>
      </details>

      {flowLine && (
        <div className="mt-6 flex flex-wrap gap-x-6 gap-y-3">
          <FlowField
            id={`${fieldId}-qc`}
            label="Dauerabfluss Qc"
            hint="Leer lassen, wenn keiner"
            value={state.continuous}
            onChange={(value) => update({ continuous: value })}
          />
          <FlowField
            id={`${fieldId}-qp`}
            label="Hebeanlage Qp"
            hint="Pumpenförderstrom, leer wenn keine"
            value={state.pump}
            onChange={(value) => update({ pump: value })}
          />
        </div>
      )}

      <ResultCard
        tool={tool}
        line={line}
        result={result}
        state={state}
        custom={custom}
        onDiameter={(mode) => update({ diameter: mode })}
      />

      {line.rules.length > 0 && (
        <>
          <h2 className="mt-8 text-xl font-bold">Worauf achten</h2>
          <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
            {line.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </>
      )}

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
