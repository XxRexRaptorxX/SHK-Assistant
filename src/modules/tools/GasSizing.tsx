import { useId, useRef, useState, type ReactNode } from 'react'
import { secondaryButton } from '../../components/buttons'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { fieldBase } from '../../components/surfaces'
import { formatNumber, parseDecimal } from '../../lib/number'
import {
  calculateBalancing,
  calculateGasSizing,
  type BalancingResult,
  findSeries,
  innerDiameter,
  type GasAppliance,
  type GasSizingResult,
  type GasSizingTool,
  type SectionInput,
  type SectionResult,
  type ValveForm,
} from './gasSizingTool'
import { Counter, iconButton } from './SurveyParts'

/** Gerät im Formular; Zahl als Text */
export interface ApplianceRow {
  key: string
  name: string
  load: string
}

export interface ValveRow {
  key: string
  type: string
  form: ValveForm
  dn: number
  count: number
}

/** Teilstrecke im Formular; Zahlen als Text. excluded: Geräte, die nicht über diese Teilstrecke laufen */
export interface SectionRow {
  key: string
  lineType: string
  series: string
  size: string
  length: string
  height: string
  fittings: Record<string, number>
  excluded: string[]
  valves: ValveRow[]
}

export interface GasSizingState {
  appliances: ApplianceRow[]
  sections: SectionRow[]
  /** Baugröße von Hand; leer = Auswahl des Tools */
  flowMonitor: string
  /** Zähler im Fließweg; leer = keiner */
  meter: string
  /** Bauart des GS für den direkten Abgleich */
  gsType: string
}

const MAX_COUNT = 99

const fmt = (value: number, decimals: number) => formatNumber(value, decimals)
const kw = (value: number) => `${fmt(value, 1)} kW`
const pa = (value: number) => `${fmt(value, 1)} Pa`

function newSection(tool: GasSizingTool, key: string, from?: SectionRow): SectionRow {
  const series = from ? findSeries(tool, from.series) : undefined
  const firstSeries = series ?? tool.pipeSeries[0]!
  return {
    key,
    lineType: from?.lineType ?? tool.lineTypes[0]!.key,
    series: firstSeries.key,
    size: from?.size ?? firstSeries.sizes[0]!.key,
    length: '',
    height: '',
    fittings: {},
    excluded: [],
    valves: [],
  }
}

export function initialGasSizingState(tool: GasSizingTool): GasSizingState {
  return {
    appliances: [{ key: 'a1', name: '', load: '' }],
    sections: [newSection(tool, 's1')],
    flowMonitor: '',
    meter: '',
    gsType: tool.flowMonitor.types[0]!.key,
  }
}

/** Nennbelastung: leer = noch nichts, sonst Zahl größer 0 */
function parseLoad(text: string): { value?: number; error: boolean } {
  if (text.trim() === '') return { error: false }
  const value = parseDecimal(text)
  return value === undefined || value <= 0 ? { error: true } : { value, error: false }
}

/** Länge: leer = 0, sonst Zahl ab 0 */
function parseLength(text: string): number | undefined {
  if (text.trim() === '') return 0
  const value = parseDecimal(text)
  return value === undefined || value < 0 ? undefined : value
}

/** Höhenunterschied: leer = 0, negativ erlaubt */
function parseHeight(text: string): number | undefined {
  if (text.trim() === '') return 0
  return parseDecimal(text)
}

const applianceLabel = (row: ApplianceRow, index: number) => row.name.trim() || `Gerät ${index + 1}`

function toAppliances(rows: readonly ApplianceRow[]): GasAppliance[] {
  return rows.flatMap((row, index) => {
    const load = parseLoad(row.load).value
    return load === undefined ? [] : [{ key: row.key, name: applianceLabel(row, index), load }]
  })
}

function toSection(row: SectionRow, appliances: readonly GasAppliance[]): SectionInput {
  return {
    key: row.key,
    lineType: row.lineType,
    series: row.series,
    size: row.size,
    length: parseLength(row.length) ?? 0,
    height: parseHeight(row.height) ?? 0,
    fittings: row.fittings,
    appliances: appliances.filter((appliance) => !row.excluded.includes(appliance.key)).map((appliance) => appliance.key),
    valves: row.valves,
  }
}

export function GasSizing({ tool, initial }: { tool: GasSizingTool; initial?: Partial<GasSizingState> }) {
  const headingId = useId()
  const [state, setState] = useState<GasSizingState>(() => ({ ...initialGasSizingState(tool), ...initial }))
  const nextKey = useRef(100)
  const makeKey = (prefix: string) => `${prefix}${nextKey.current++}`

  const appliances = toAppliances(state.appliances)
  const selection = {
    appliances,
    sections: state.sections.map((row) => toSection(row, appliances)),
    flowMonitor: state.flowMonitor || undefined,
    meter: state.meter || undefined,
  }
  const result = calculateGasSizing(tool, selection)
  const balancing = calculateBalancing(tool, selection, state.gsType)
  const pristine = JSON.stringify(state) === JSON.stringify(initialGasSizingState(tool))

  const setAppliance = (key: string, patch: Partial<ApplianceRow>) =>
    setState({ ...state, appliances: state.appliances.map((row) => (row.key === key ? { ...row, ...patch } : row)) })
  const setSection = (key: string, patch: Partial<SectionRow>) =>
    setState({ ...state, sections: state.sections.map((row) => (row.key === key ? { ...row, ...patch } : row)) })

  return (
    <section className="mt-6" aria-labelledby={headingId}>
      <HeadingWithClear id={headingId} onClear={() => setState(initialGasSizingState(tool))} disabled={pristine}>
        Gasgeräte
      </HeadingWithClear>
      <p className="mt-1 text-base">Nennbelastung laut Typschild bzw. Herstellerangabe (Nennwärmebelastung, nicht Nennwärmeleistung).</p>
      <ul className="mt-3 space-y-3">
        {state.appliances.map((row, index) => {
          const load = parseLoad(row.load)
          return (
            <li key={row.key} className="rounded-2xl border-2 border-line bg-surface p-3">
              <div className="flex flex-wrap items-end gap-x-4 gap-y-3">
                <TextField
                  id={`${row.key}-name`}
                  label="Bezeichnung"
                  value={row.name}
                  placeholder={`Gerät ${index + 1}`}
                  onChange={(name) => setAppliance(row.key, { name })}
                  wide
                />
                <NumberField
                  id={`${row.key}-load`}
                  label="Nennbelastung"
                  unit="kW"
                  value={row.load}
                  invalid={load.error}
                  onChange={(value) => setAppliance(row.key, { load: value })}
                />
                {state.appliances.length > 1 && (
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`${applianceLabel(row, index)} entfernen`}
                    onClick={() =>
                      setState({
                        ...state,
                        appliances: state.appliances.filter((candidate) => candidate.key !== row.key),
                        sections: state.sections.map((section) => ({
                          ...section,
                          excluded: section.excluded.filter((excluded) => excluded !== row.key),
                        })),
                      })
                    }
                  >
                    ✕
                  </button>
                )}
              </div>
              {load.error && <p className="mt-2 font-semibold">Zahl größer 0 eingeben (Beispiel: 24,5)</p>}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className={`${secondaryButton} mt-3`}
        onClick={() => setState({ ...state, appliances: [...state.appliances, { key: makeKey('a'), name: '', load: '' }] })}
      >
        + Gerät
      </button>

      <FlowMonitorResult tool={tool} result={result} state={state} setState={setState} />

      <h2 className="mt-8 text-xl font-bold">Teilstrecken</h2>
      <p className="mt-1 text-base">
        In Fließrichtung vom Gasströmungswächter bis zum ungünstigsten Gerät. Teilstrecke 1 enthält GS und Zählergruppe; eine neue
        Teilstrecke beginnt, wo sich Belastung oder Dimension ändert.
      </p>
      <ol className="mt-3 space-y-4">
        {state.sections.map((row, index) => (
          <SectionCard
            key={row.key}
            tool={tool}
            index={index}
            row={row}
            applianceRows={state.appliances}
            result={result.sections[index]!}
            canRemove={state.sections.length > 1}
            onChange={(patch) => setSection(row.key, patch)}
            onRemove={() => setState({ ...state, sections: state.sections.filter((candidate) => candidate.key !== row.key) })}
            makeKey={makeKey}
          />
        ))}
      </ol>
      <button
        type="button"
        className={`${secondaryButton} mt-3`}
        onClick={() => setState({ ...state, sections: [...state.sections, newSection(tool, makeKey('s'), state.sections.at(-1))] })}
      >
        + Teilstrecke
      </button>

      <TotalResult tool={tool} result={result} />

      <BalancingResultView tool={tool} balancing={balancing} gsType={state.gsType} onType={(gsType) => setState({ ...state, gsType })} />

      <details className="mt-8 rounded-2xl border-2 border-line bg-surface px-3">
        <summary className="min-h-12 cursor-pointer py-3 text-xl font-bold">Rechengrundlage</summary>
        <Rules
          rules={[
            `Stoffwerte: ${tool.gas.label}, Betriebsheizwert ${fmt(tool.gas.heatingValue, 1)} kWh/m³, Dichte ${fmt(tool.gas.density, 3)} kg/m³, relative Dichte ${fmt(tool.gas.relativeDensity, 2)}.`,
            tool.peakLoad.text,
            tool.friction.text,
            tool.fittings.note,
            tool.meters.note,
            `Zulässiger Gesamtdruckverlust ${fmt(tool.pressureBudget.total, 0)} Pa. ${tool.pressureBudget.text}`,
          ].filter((rule) => rule !== '')}
        />
        <p className="mt-3 pb-3 text-base font-semibold">{tool.closingNote}</p>
      </details>
    </section>
  )
}

function Rules({ rules }: { rules: readonly string[] }) {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-6 text-base">
      {rules.map((rule) => (
        <li key={rule}>{rule}</li>
      ))}
    </ul>
  )
}

function TextField({
  id,
  label,
  value,
  placeholder,
  onChange,
  wide = false,
}: {
  id: string
  label: string
  value: string
  placeholder?: string
  onChange: (value: string) => void
  wide?: boolean
}) {
  return (
    <div className={wide ? 'min-w-0 flex-1 basis-48' : ''}>
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      <input
        id={id}
        type="text"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldBase} mt-1 w-full`}
      />
    </div>
  )
}

function NumberField({
  id,
  label,
  unit,
  value,
  invalid,
  onChange,
  placeholder = '0',
}: {
  id: string
  label: string
  unit: string
  value: string
  invalid: boolean
  onChange: (value: string) => void
  placeholder?: string
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
          placeholder={placeholder}
          value={value}
          aria-invalid={invalid}
          onChange={(event) => onChange(event.target.value)}
          className={`${fieldBase} w-28 ${invalid ? 'border-warn-ink outline-2 outline-warn' : ''}`}
        />
        <span className="text-lg">{unit}</span>
      </div>
    </div>
  )
}

function SelectField({
  id,
  label,
  value,
  options,
  onChange,
}: {
  id: string
  label: string
  value: string
  options: readonly { value: string; label: string }[]
  onChange: (value: string) => void
}) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block font-semibold">
        {label}
      </label>
      <select id={id} value={value} onChange={(event) => onChange(event.target.value)} className={`${fieldBase} mt-1 max-w-full`}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  )
}

function ValueList({ rows }: { rows: readonly [string, ReactNode][] }) {
  return (
    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
      {rows.map(([name, value]) => (
        <div key={name} className="contents">
          <dt>{name}</dt>
          <dd className="font-semibold tabular-nums">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function FlowMonitorResult({
  tool,
  result,
  state,
  setState,
}: {
  tool: GasSizingTool
  result: GasSizingResult
  state: GasSizingState
  setState: (state: GasSizingState) => void
}) {
  const id = useId()
  const choice = result.flowMonitor
  const { loads } = choice
  const used = result.usedFlowMonitor
  return (
    <>
      <h2 className="mt-8 text-xl font-bold">Gasströmungswächter</h2>
      <div className="mt-2 rounded-2xl border-2 border-line bg-surface p-3" aria-live="polite">
        {loads.count === 0 ? (
          <p className="text-lg font-bold">Nennbelastung mindestens eines Geräts eintragen.</p>
        ) : (
          <>
            <ValueList
              rows={[
                ...(loads.count > 1
                  ? ([
                      ['Summenbelastung', kw(loads.sum)],
                      ['Größte Nennbelastung', kw(loads.max)],
                    ] as [string, ReactNode][])
                  : ([['Nennbelastung', kw(loads.max)]] as [string, ReactNode][])),
                ['Spitzenbelastung', kw(loads.peak)],
              ]}
            />
            {choice.size ? (
              <>
                <p className="mt-3 text-2xl font-bold">
                  {choice.size.label}
                  {choice.size.color && <span className="ml-2 text-lg font-semibold">(Typschild {choice.size.color})</span>}
                </p>
                <p className="mt-1 text-base">
                  {choice.basis === 'single'
                    ? `Ein Gerät: Einzelzuleitung bis ${fmt(choice.size.maxSingle, 0)} kW Nennbelastung.`
                    : `Mehrere Geräte: bis ${fmt(choice.size.maxMultiple, 0)} kW Summenbelastung, größtes Gerät bis ${fmt(choice.size.maxSingle, 0)} kW.`}
                  {choice.raisedForLargest && ' Wegen des größten Geräts eine Baugröße größer als nach der Summenbelastung.'}
                </p>
              </>
            ) : (
              <p className="mt-3 text-lg font-bold">
                Keine Baugröße in der Tabelle: über{' '}
                {choice.basis === 'single'
                  ? `${fmt(tool.flowMonitor.sizes.at(-1)!.maxSingle, 0)} kW an einer Einzelzuleitung`
                  : `${fmt(tool.flowMonitor.sizes.at(-1)!.maxMultiple, 0)} kW Summenbelastung oder ${fmt(tool.flowMonitor.sizes.at(-1)!.maxSingle, 0)} kW für das größte Gerät`}
                .
              </p>
            )}
          </>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-3">
        <SelectField
          id={`${id}-gs`}
          label="GS für die Rechnung"
          value={state.flowMonitor}
          options={[
            { value: '', label: choice.size ? `Wie ausgewählt (${choice.size.label})` : 'Wie ausgewählt' },
            ...tool.flowMonitor.sizes.map((size) => ({ value: size.key, label: size.label })),
          ]}
          onChange={(flowMonitor) => setState({ ...state, flowMonitor })}
        />
        <SelectField
          id={`${id}-meter`}
          label="Gaszähler im Fließweg"
          value={state.meter}
          options={[{ value: '', label: 'Kein Zähler' }, ...tool.meters.sizes.map((meter) => ({ value: meter.key, label: meter.label }))]}
          onChange={(meter) => setState({ ...state, meter })}
        />
      </div>
      {used && choice.size && used.key !== choice.size.key && (
        <p className="mt-2 text-base font-semibold">Gerechnet mit {used.label} statt der ausgewählten Baugröße {choice.size.label}.</p>
      )}
      <ul className="mt-3 space-y-1 text-base">
        {tool.flowMonitor.types.map((type) => (
          <li key={type.key}>
            <span className="font-semibold">{type.label}</span> (Schließfaktor {fmt(type.closingFactor, 2)}): {type.text}
          </li>
        ))}
      </ul>
      <details className="mt-3">
        <summary className="min-h-12 cursor-pointer py-2 font-semibold">Regeln zur Auswahl und zum Einbau</summary>
        <Rules rules={tool.flowMonitor.rules} />
      </details>
    </>
  )
}

function SectionCard({
  tool,
  index,
  row,
  applianceRows,
  result,
  canRemove,
  onChange,
  onRemove,
  makeKey,
}: {
  tool: GasSizingTool
  index: number
  row: SectionRow
  applianceRows: readonly ApplianceRow[]
  result: SectionResult
  canRemove: boolean
  onChange: (patch: Partial<SectionRow>) => void
  onRemove: () => void
  makeKey: (prefix: string) => string
}) {
  const id = useId()
  const title = `Teilstrecke ${index + 1}`
  const series = findSeries(tool, row.series) ?? tool.pipeSeries[0]!
  const lengthInvalid = parseLength(row.length) === undefined
  const heightInvalid = parseHeight(row.height) === undefined
  const defaultValveType = tool.valves.types[0]!
  return (
    <li className="rounded-2xl border-2 border-line bg-surface p-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-lg font-bold">{title}</h3>
        {canRemove && (
          <button type="button" className={iconButton} aria-label={`${title} entfernen`} onClick={onRemove}>
            ✕
          </button>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-end gap-x-4 gap-y-3">
        <SelectField
          id={`${id}-type`}
          label="Leitungsart"
          value={row.lineType}
          options={tool.lineTypes.map((type) => ({ value: type.key, label: type.note ? `${type.label} (${type.note})` : type.label }))}
          onChange={(lineType) => onChange({ lineType })}
        />
        {tool.pipeSeries.length > 1 && (
          <SelectField
            id={`${id}-series`}
            label="Rohr"
            value={row.series}
            options={tool.pipeSeries.map((candidate) => ({ value: candidate.key, label: candidate.label }))}
            onChange={(value) => onChange({ series: value, size: findSeries(tool, value)!.sizes[0]!.key })}
          />
        )}
        <SelectField
          id={`${id}-size`}
          label={`${series.label}${series.note ? `, ${series.note}` : ''}`}
          value={row.size}
          options={series.sizes.map((size) => ({ value: size.key, label: `${size.label} (di ${fmt(innerDiameter(size), 1)} mm)` }))}
          onChange={(size) => onChange({ size })}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-end gap-x-4 gap-y-3">
        <NumberField id={`${id}-length`} label="Leitungslänge" unit="m" value={row.length} invalid={lengthInvalid} onChange={(length) => onChange({ length })} />
        <NumberField
          id={`${id}-height`}
          label="Höhenunterschied"
          unit="m"
          value={row.height}
          invalid={heightInvalid}
          onChange={(height) => onChange({ height })}
        />
      </div>
      <p className="mt-1 text-sm text-muted">Höhenunterschied: Ende minus Anfang, nach oben positiv (Beispiel: −2,5).</p>
      {lengthInvalid && <p className="mt-1 font-semibold">Länge als Zahl ab 0 eingeben (Beispiel: 12,5)</p>}
      {heightInvalid && <p className="mt-1 font-semibold">Höhenunterschied als Zahl eingeben (Beispiel: 2,8)</p>}

      <p className="mt-3 font-semibold">Formteile</p>
      <ul className="mt-1 space-y-2">
        {tool.fittings.items.map((item) => (
          <li key={item.key} className="flex items-center justify-between gap-3">
            <span>
              {item.label} <span className="text-sm text-muted">(ζ {fmt(item.zeta, 1)})</span>
            </span>
            <Counter
              id={`${id}-fit-${item.key}`}
              label={`${title}, ${item.label}`}
              value={row.fittings[item.key] ?? 0}
              max={MAX_COUNT}
              onChange={(count) => onChange({ fittings: { ...row.fittings, [item.key]: Math.min(count, MAX_COUNT) } })}
            />
          </li>
        ))}
      </ul>

      <p className="mt-3 font-semibold">Armaturen</p>
      {row.valves.length === 0 && <p className="text-sm text-muted">Keine. Absperreinrichtungen und Geräteanschlussarmatur hier eintragen.</p>}
      <ul className="mt-1 space-y-3">
        {row.valves.map((valve) => {
          const type = tool.valves.types.find((candidate) => candidate.key === valve.type) ?? defaultValveType
          const valveRow = type.rows.find((candidate) => candidate.dn === valve.dn)
          const setValve = (patch: Partial<ValveRow>) =>
            onChange({ valves: row.valves.map((candidate) => (candidate.key === valve.key ? { ...candidate, ...patch } : candidate)) })
          return (
            <li key={valve.key} className="rounded-xl border border-line p-2">
              <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                <SelectField
                  id={`${valve.key}-type`}
                  label="Bauart"
                  value={valve.type}
                  options={tool.valves.types.map((candidate) => ({ value: candidate.key, label: candidate.label }))}
                  onChange={(value) => setValve({ type: value })}
                />
                <SelectField
                  id={`${valve.key}-form`}
                  label="Form"
                  value={valve.form}
                  options={[
                    { value: 'straight', label: 'Durchgangsform' },
                    { value: 'angle', label: 'Eckform' },
                  ]}
                  onChange={(value) => setValve({ form: value as ValveForm })}
                />
                <SelectField
                  id={`${valve.key}-dn`}
                  label="Nennweite"
                  value={String(valve.dn)}
                  options={type.rows.map((candidate) => ({ value: String(candidate.dn), label: `DN ${candidate.dn}` }))}
                  onChange={(value) => setValve({ dn: Number(value) })}
                />
                <div>
                  <p className="font-semibold">Anzahl</p>
                  <div className="mt-1 flex items-center gap-2">
                    <Counter id={`${valve.key}-count`} label="Armatur" value={valve.count} min={1} max={MAX_COUNT} onChange={(count) => setValve({ count: Math.max(1, Math.min(count, MAX_COUNT)) })} />
                    <button
                      type="button"
                      className={iconButton}
                      aria-label="Armatur entfernen"
                      onClick={() => onChange({ valves: row.valves.filter((candidate) => candidate.key !== valve.key) })}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
              {(!valveRow || (valve.form === 'angle' && valveRow.angle === null)) && (
                <p className="mt-2 font-semibold">Für diese Nennweite gibt es keinen Wert in Eckform. Durchgangsform oder andere Nennweite wählen.</p>
              )}
            </li>
          )
        })}
      </ul>
      <button
        type="button"
        className={`${secondaryButton} mt-2`}
        onClick={() =>
          onChange({
            valves: [
              ...row.valves,
              { key: makeKey('v'), type: defaultValveType.key, form: 'straight', dn: defaultValveType.rows.find((candidate) => candidate.dn === 15)?.dn ?? defaultValveType.rows[0]!.dn, count: 1 },
            ],
          })
        }
      >
        + Armatur
      </button>

      {applianceRows.length > 1 && (
        <fieldset className="mt-3">
          <legend className="font-semibold">Versorgt über diese Teilstrecke</legend>
          {applianceRows.map((appliance, applianceIndex) => (
            <label key={appliance.key} className="flex min-h-12 cursor-pointer items-center gap-3">
              <input
                type="checkbox"
                className="size-6"
                checked={!row.excluded.includes(appliance.key)}
                onChange={(event) =>
                  onChange({
                    excluded: event.target.checked
                      ? row.excluded.filter((key) => key !== appliance.key)
                      : [...row.excluded, appliance.key],
                  })
                }
              />
              {applianceLabel(appliance, applianceIndex)}
            </label>
          ))}
        </fieldset>
      )}

      <SectionValues index={index} result={result} />
    </li>
  )
}

function SectionValues({ index, result }: { index: number; result: SectionResult }) {
  if (result.loads.count === 0) {
    return <p className="mt-3 text-lg font-bold">Kein Gerät mit Nennbelastung an dieser Teilstrecke.</p>
  }
  const { pipe, size, lineType } = result
  const rows: [string, ReactNode][] = [
    ...(result.loads.count > 1 ? ([['Summenbelastung', kw(result.loads.sum)]] as [string, ReactNode][]) : []),
    ['Spitzenbelastung', kw(result.loads.peak)],
    ['Volumenstrom', `${fmt(result.flow, 2)} m³/h`],
  ]
  if (pipe) {
    rows.push(
      ['Fließgeschwindigkeit', `${fmt(pipe.velocity, 2)} m/s`],
      ['Rohrdruckgefälle R', `${fmt(pipe.r, 2)} Pa/m`],
      ['Berechnungslänge', `${fmt(result.calcLength, 2)} m (Formteile ${fmt(result.fittingLength, 2)} m)`],
      ['Rohr', pa(result.pipeLoss)],
      ['Formteile', pa(result.fittingLoss)],
    )
  }
  if (result.valveLoss > 0) rows.push(['Armaturen', pa(result.valveLoss)])
  if (index === 0 && result.flowMonitorLoss > 0) rows.push(['Gasströmungswächter', pa(result.flowMonitorLoss)])
  if (index === 0 && result.meterLoss > 0) rows.push(['Zählergruppe', pa(result.meterLoss)])
  if (result.heightLoss !== 0) rows.push([result.heightLoss < 0 ? 'Höhe (Druckgewinn)' : 'Höhe', pa(result.heightLoss)])
  const overFirst = pipe && lineType && pipe.r > lineType.firstChoiceR
  return (
    <div className="mt-3 rounded-xl bg-raised p-3" aria-live="polite">
      <ValueList rows={rows} />
      <p className="mt-2 text-lg font-bold">Druckverlust Teilstrecke: {pa(result.total)}</p>
      <p className="text-base">Bis hier: {pa(result.cumulative)}</p>
      {lineType && (
        <p className={`mt-2 text-base ${overFirst ? 'font-semibold' : ''}`}>
          {result.firstChoice
            ? `Erstauswahl (R ≤ ${fmt(lineType.firstChoiceR, 0)} Pa/m): ${result.firstChoice.label}${size && result.firstChoice.key === size.key ? ', wie gewählt.' : '.'}`
            : `Keine Dimension der Reihe bleibt bei R ≤ ${fmt(lineType.firstChoiceR, 0)} Pa/m.`}
          {overFirst && ` Gewählte Dimension liegt darüber.`}
        </p>
      )}
      {result.unknownValves.length > 0 && <p className="mt-2 font-semibold">Mindestens eine Armatur hat keinen Tabellenwert und fehlt in der Summe.</p>}
    </div>
  )
}

function BalancingResultView({
  tool,
  balancing,
  gsType,
  onType,
}: {
  tool: GasSizingTool
  balancing: BalancingResult | undefined
  gsType: string
  onType: (key: string) => void
}) {
  const id = useId()
  const warn = balancing && !balancing.incomplete && (!balancing.ok || balancing.typeNotAllowed)
  return (
    <>
      <h2 className="mt-8 text-xl font-bold">Direkter Abgleich des GS</h2>
      <p className="mt-1 text-base">
        Gleiche Teilstrecken, aber mit dem Schließvolumenstrom des GS: So viel Gas muss bei einem Bruch am Ende des Fließwegs
        nachströmen können, damit der GS schließt.
      </p>
      <div className="mt-3">
        <SelectField
          id={`${id}-type`}
          label="Bauart des GS"
          value={gsType}
          options={tool.flowMonitor.types.map((type) => ({ value: type.key, label: `${type.label} (fS ${fmt(type.closingFactor, 2)})` }))}
          onChange={onType}
        />
      </div>
      <div
        className={`mt-3 rounded-2xl border-2 p-3 ${warn ? 'border-warn-ink bg-warn text-warn-ink' : 'border-line bg-surface'}`}
        aria-live="polite"
      >
        {!balancing ? (
          <p className="text-lg font-bold">Erst Geräte eintragen oder einen GS für die Rechnung wählen.</p>
        ) : (
          <>
            <ValueList
              rows={[
                ['GS', `${balancing.size.label}, ${balancing.type.label}`],
                [
                  'Schließvolumenstrom',
                  `${fmt(balancing.closingFlow, 2)} m³/h (${fmt(balancing.type.closingFactor, 2)} · ${fmt(balancing.size.nominalFlow, 1)} m³/h)`,
                ],
                ...balancing.sections.map(
                  (section, index): [string, ReactNode] => [
                    `Teilstrecke ${index + 1}`,
                    `${pa(section.total)}${section.pipe ? `, R ${fmt(section.pipe.r, 1)} Pa/m` : ''} · bis hier ${pa(section.cumulative)}`,
                  ],
                ),
              ]}
            />
            <p className="mt-3 text-2xl font-bold">
              {pa(balancing.max)} von {fmt(balancing.limit, 0)} Pa
            </p>
            <p className="text-base">
              {balancing.metal ? 'Grenze für metallene Leitungen.' : 'Grenze für Kunststoffleitungen (nicht alle Teilstrecken metallen).'}
            </p>
            <p className="mt-1 text-lg font-semibold">
              {balancing.incomplete
                ? 'Unvollständig: Armatur ohne Tabellenwert oder Teilstrecke ohne Rohr.'
                : balancing.ok
                  ? 'Eingehalten: Der GS kann bei einem Bruch am Ende dieses Fließwegs schließen.'
                  : 'Überschritten: Der GS schließt womöglich nicht sicher. Größere Dimension wählen oder Leitungsführung ändern.'}
            </p>
            {balancing.typeNotAllowed && <p className="mt-1 text-lg font-semibold">{balancing.type.label} ist nur für metallene Leitungen zulässig.</p>}
          </>
        )}
      </div>
      <details className="mt-3">
        <summary className="min-h-12 cursor-pointer py-2 font-semibold">Wann welcher Abgleich</summary>
        <Rules rules={tool.balancing.rules} />
      </details>
    </>
  )
}

function TotalResult({ tool, result }: { tool: GasSizingTool; result: GasSizingResult }) {
  const hasLoad = result.flowMonitor.loads.count > 0
  const ok = result.total <= result.budget
  return (
    <div className={`mt-6 rounded-2xl border-2 p-3 ${hasLoad && !result.incomplete && !ok ? 'border-warn-ink bg-warn text-warn-ink' : 'border-line bg-surface'}`} aria-live="polite">
      <h2 className="text-xl font-bold">Gesamtdruckverlust</h2>
      {!hasLoad ? (
        <p className="mt-1 text-lg">Erst Geräte und Teilstrecken eintragen.</p>
      ) : (
        <>
          <p className="mt-1 text-2xl font-bold">
            {pa(result.total)} von {fmt(tool.pressureBudget.total, 0)} Pa
          </p>
          <p className="mt-1 text-lg font-semibold">
            {result.incomplete
              ? 'Unvollständig: Mindestens eine Teilstrecke ohne Gerät oder mit Armatur ohne Tabellenwert.'
              : ok
                ? 'Eingehalten.'
                : 'Überschritten: größere Dimension wählen oder Leitungsführung ändern.'}
          </p>
        </>
      )}
    </div>
  )
}
