import { useEffect, useId, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { secondaryButton } from '../../components/buttons'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { InfoIcon, WarningIcon } from '../../components/icons'
import { fieldBase } from '../../components/surfaces'
import { content } from '../../content'
import { formatNumber, parseDecimal } from '../../lib/number'
import { converterPath } from '../converter/converter'
import { SelectionBar } from './ChoiceLookup'
import { PRICES_FILE, parsePricesData, type PricesData } from './heatingCostSources'
import {
  compareSystems,
  convertAmount,
  findFuel,
  findUnit,
  priceUnit,
  resolveHeatingCostTool,
  resolvePrice,
  sortByCost,
  unitEnergy,
  usefulHeat,
  type ComparisonRow,
  type Fuel,
  type FuelUnit,
  type HeatingCostTool,
  type HeatingCostToolEntry,
  type HeatingSystem,
  type ResolvedPrice,
} from './heatingCostTool'
import {
  DEFAULT_HEATING_COST_SETTINGS,
  HEAT_REFERENCE,
  updateHeatingCostSettings,
  useHeatingCostSettings,
  type HeatingCostSettings,
} from './heatingCostSettings'

const resultCard = 'rounded-2xl border-2 bg-surface p-4'
const HEAT_UNIT = 'kWh'

/** Menge mit sinnvoller Rundung: große Zahlen ohne, kleine mit Nachkommastellen */
export function formatAmount(value: number): string {
  const abs = Math.abs(value)
  return formatNumber(value, abs >= 100 ? 0 : abs >= 10 ? 1 : 2)
}
const formatEuro = (value: number) => `${formatNumber(value, 0)} €`
/** Preise unter 10 € (je l, kWh) mit vier Nachkommastellen wie in den Quellen, sonst (je t, Rm) mit zwei */
const formatPrice = (value: number) => formatNumber(value, value < 10 ? 4 : 2)
const formatSigned = (value: number, text: string) => `${value > 0 ? '+' : value < 0 ? '−' : '±'}${text}`

/** Nutzungsgrad als Prozent, Jahresarbeitszahl als Zahl */
const efficiencyText = (system: HeatingSystem, value: number) =>
  system.efficiency.kind === 'efficiency' ? `${formatNumber(value * 100, 0)} %` : `JAZ ${formatNumber(value, 1)}`
const efficiencyName = (system: HeatingSystem) => (system.efficiency.kind === 'efficiency' ? 'Jahresnutzungsgrad' : 'Jahresarbeitszahl')

/** Eigener Wert aus dem Eingabetext: Nutzungsgrad in % → Anteil, JAZ unverändert; ungültig → undefined */
export function parseEfficiency(system: HeatingSystem, raw: string | undefined): number | undefined {
  const value = raw ? parseDecimal(raw) : undefined
  if (value === undefined || !(value > 0)) return undefined
  return system.efficiency.kind === 'efficiency' ? value / 100 : value
}

function useLivePrices(): PricesData | undefined {
  const [data, setData] = useState<PricesData>()
  useEffect(() => {
    let active = true
    fetch(`${import.meta.env.BASE_URL}${PRICES_FILE}`)
      .then((response) => (response.ok ? response.json() : undefined))
      .then((raw: unknown) => {
        if (active) setData(parsePricesData(raw))
      })
      .catch(() => {
        // offline ohne vorgecachte Datei: es gelten die hinterlegten Preise
      })
    return () => {
      active = false
    }
  }, [])
  return data
}

/** Heizkosten-Vergleich: Eingaben bleiben auf dem Gerät, Marktpreise kommen aus prices.json */
/** Heizwerte aus dem Umrechner einsetzen; fehlen sie in dieser Edition, gibt es nur einen Hinweis */
export function resolveFromContent(entry: HeatingCostToolEntry): HeatingCostTool | undefined {
  try {
    return resolveHeatingCostTool(
      entry,
      content.converter.find((converter) => converter.id === entry.heatingValues),
    )
  } catch {
    return undefined
  }
}

export function HeatingCostComparison({ tool: entry }: { tool: HeatingCostToolEntry }) {
  const settings = useHeatingCostSettings()
  const live = useLivePrices()
  const tool = resolveFromContent(entry)
  if (!tool) return <p className="mt-6 font-semibold">Die Heizwerte für diesen Vergleich fehlen in dieser Ausgabe der App.</p>
  return <HeatingCostView tool={tool} settings={settings} onChange={updateHeatingCostSettings} live={live} />
}

export interface HeatingCostResult {
  reference: HeatingSystem | undefined
  /** Nutzwärme in kWh; ohne gültigen Verbrauch undefined */
  heat: number | undefined
  rows: ComparisonRow[]
  prices: Record<string, ResolvedPrice>
}

/** Alles, was die Ansicht aus den Eingaben ableitet (auch für Tests) */
export function computeHeatingCost(tool: HeatingCostTool, settings: HeatingCostSettings, live?: PricesData): HeatingCostResult {
  const reference = tool.systems.find((system) => system.key === settings.reference) ?? (settings.reference === HEAT_REFERENCE ? undefined : tool.systems[0])
  const efficiencies = Object.fromEntries(tool.systems.map((system) => [system.key, parseEfficiency(system, settings.efficiencies[system.key])]))
  const prices = Object.fromEntries(
    tool.fuels.map((fuel) => {
      const own = settings.prices[fuel.key] ? parseDecimal(settings.prices[fuel.key]!) : undefined
      return [fuel.key, resolvePrice(fuel, live, own)]
    }),
  )
  const amount = parseDecimal(settings.amount)
  let heat: number | undefined
  if (amount !== undefined && amount > 0) {
    if (!reference) heat = amount
    else {
      const fuel = findFuel(tool, reference.fuel)!
      const unit = referenceUnit(fuel, settings.units[reference.key])
      heat = usefulHeat(amount, unit, efficiencies[reference.key] ?? reference.efficiency.value)
    }
  }
  const rows =
    heat === undefined
      ? []
      : sortByCost(
          compareSystems(tool, {
            heat,
            prices: Object.fromEntries(Object.entries(prices).map(([key, price]) => [key, price.value])),
            efficiencies,
          }),
        )
  return { reference, heat, rows, prices }
}

/** Einheit des Verbrauchs: gewählte, sonst die Preiseinheit (so steht es meist auf der Rechnung) */
const referenceUnit = (fuel: Fuel, unitKey: string | undefined): FuelUnit => (unitKey && findUnit(fuel, unitKey)) || priceUnit(fuel)

export function HeatingCostView({
  tool,
  settings,
  onChange,
  live,
}: {
  tool: HeatingCostTool
  settings: HeatingCostSettings
  onChange: (change: Partial<HeatingCostSettings>) => void
  live?: PricesData
}) {
  const idPrefix = useId()
  const { reference, heat, rows, prices } = computeHeatingCost(tool, settings, live)
  const referenceFuel = reference ? findFuel(tool, reference.fuel)! : undefined
  const unit = referenceFuel ? referenceUnit(referenceFuel, settings.units[reference!.key]) : undefined
  const amountInvalid = settings.amount.trim() !== '' && heat === undefined
  const referenceRow = reference ? rows.find((row) => row.system.key === reference.key) : undefined
  const referenceEfficiency = reference ? (referenceRow?.efficiency ?? reference.efficiency.value) : undefined

  return (
    <>
      <section className="mt-6" aria-labelledby={`${idPrefix}-input`}>
        <HeadingWithClear id={`${idPrefix}-input`} onClear={() => onChange({ amount: '' })} disabled={settings.amount === ''}>
          Vorhandene Heizung
        </HeadingWithClear>

        <label htmlFor={`${idPrefix}-reference`} className="mt-4 block font-semibold">
          Referenzheizung
        </label>
        <select
          id={`${idPrefix}-reference`}
          value={reference?.key ?? HEAT_REFERENCE}
          onChange={(event) => onChange({ reference: event.target.value })}
          className={`${fieldBase} mt-1 w-full`}
        >
          {tool.systems.map((system) => (
            <option key={system.key} value={system.key}>
              {system.name}
            </option>
          ))}
          <option value={HEAT_REFERENCE}>Wärmebedarf direkt eingeben (kWh Nutzwärme)</option>
        </select>

        {reference && referenceFuel && referenceFuel.units.length > 1 && (
          <SelectionBar
            bar={{
              key: 'unit',
              name: 'Verbrauch angeben in',
              options: referenceFuel.units.map((option) => ({ key: option.key, label: option.symbol, note: option.label })),
            }}
            selected={unit!.key}
            onSelect={(key) => onChange({ units: { ...settings.units, [reference.key]: key } })}
          />
        )}

        <label htmlFor={`${idPrefix}-amount`} className="mt-6 block font-semibold">
          {reference ? `Jahresverbrauch ${referenceFuel!.name}` : 'Wärmebedarf pro Jahr'}
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id={`${idPrefix}-amount`}
            type="text"
            inputMode="decimal"
            autoComplete="off"
            value={settings.amount}
            aria-invalid={amountInvalid}
            onChange={(event) => onChange({ amount: event.target.value })}
            className={`${fieldBase} w-full max-w-48 ${amountInvalid ? 'border-warn-ink outline-2 outline-warn' : ''}`}
          />
          <span className="text-lg">{unit ? unit.symbol : HEAT_UNIT}</span>
        </div>
        {amountInvalid && <p className="mt-1 text-base font-semibold">Bitte eine Zahl größer als 0 eintragen.</p>}

        <div className={`mt-5 ${resultCard} border-accent`} aria-live="polite">
          {heat === undefined ? (
            <p className="text-base text-muted">Jahresverbrauch eintragen.</p>
          ) : (
            <>
              <p className="font-semibold">Nutzwärme pro Jahr</p>
              <p className="text-3xl font-bold tabular-nums">
                {formatNumber(heat, 0)} {HEAT_UNIT}
              </p>
              {reference && unit && referenceEfficiency !== undefined && (
                <p className="text-base text-muted">
                  {settings.amount.trim()} {unit.symbol} × {formatNumber(unitEnergy(unit), unitEnergy(unit) < 10 ? 3 : 0)} kWh/{unit.symbol} ×{' '}
                  {efficiencyText(reference, referenceEfficiency)}
                </p>
              )}
            </>
          )}
        </div>
      </section>

      {heat !== undefined && (
        <section className="mt-6" aria-labelledby={`${idPrefix}-results`}>
          <h2 id={`${idPrefix}-results`} className="text-xl font-bold">
            Vergleich für dieselbe Wärme
          </h2>
          <p className="mt-1 text-base text-muted">Nach Brennstoffkosten pro Jahr sortiert, günstigstes zuerst.</p>
          <ol className="mt-3 space-y-3">
            {rows.map((row) => (
              <ResultCard key={row.system.key} row={row} referenceRow={referenceRow} price={prices[row.fuel.key]!} />
            ))}
          </ol>
        </section>
      )}

      <Assumptions tool={tool} settings={settings} onChange={onChange} prices={prices} live={live} idPrefix={idPrefix} />

      {tool.closingNote && <p className="mt-6 text-base font-semibold">{tool.closingNote}</p>}
    </>
  )
}

function Rating({ label, value }: { label: string; value: number }) {
  return (
    <span className="whitespace-nowrap">
      {label}{' '}
      <span aria-hidden="true" className="font-bold tracking-wider">
        {'€'.repeat(value)}
        <span className="text-faint">{'€'.repeat(3 - value)}</span>
      </span>
      <span className="sr-only">{['günstig', 'mittel', 'teuer'][value - 1]}</span>
    </span>
  )
}

function ResultCard({ row, referenceRow, price }: { row: ComparisonRow; referenceRow: ComparisonRow | undefined; price: ResolvedPrice }) {
  const isReference = referenceRow?.system.key === row.system.key
  const difference = row.cost !== undefined && referenceRow?.cost !== undefined && !isReference ? row.cost - referenceRow.cost : undefined
  const otherUnits = row.fuel.units.filter((unit) => unit.key !== row.unit.key)
  return (
    <li className={`${resultCard} ${isReference ? 'border-accent' : 'border-edge'}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h3 className="text-lg font-bold">
          {row.system.name}
          {isReference && <span className="ml-2 rounded-md bg-accent px-2 py-0.5 text-sm text-accent-ink">Referenz</span>}
        </h3>
        <p className="text-2xl font-bold tabular-nums">
          {row.cost === undefined ? 'Preis fehlt' : formatEuro(row.cost)}
          {row.cost !== undefined && <span className="text-base font-normal text-muted"> / Jahr</span>}
        </p>
      </div>

      {difference !== undefined && referenceRow?.cost !== undefined && (
        <p className="mt-1 text-base font-semibold">
          {formatSigned(difference, formatEuro(Math.abs(difference)))} pro Jahr gegenüber der Referenz (
          {formatSigned(difference, `${formatNumber(Math.abs((difference / referenceRow.cost) * 100), 0)} %`)})
        </p>
      )}

      <dl className="mt-2 space-y-1 text-base">
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted">Bedarf {row.fuel.name}</dt>
          <dd className="font-semibold tabular-nums">
            {formatAmount(row.amount)} {row.unit.symbol}
            {otherUnits.map((unit) => (
              <span key={unit.key} className="font-normal text-muted">
                {' '}
                ≈ {formatAmount(convertAmount(row.amount, row.unit, unit))} {unit.symbol}
              </span>
            ))}
          </dd>
        </div>
        <div className="flex flex-wrap justify-between gap-x-4">
          <dt className="text-muted">{efficiencyName(row.system)}</dt>
          <dd className="tabular-nums">{efficiencyText(row.system, row.efficiency)}</dd>
        </div>
        {row.costPerKWh !== undefined && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-muted">Kosten je kWh Wärme</dt>
            <dd className="tabular-nums">{formatNumber(row.costPerKWh * 100, 1)} ct</dd>
          </div>
        )}
        {price.value !== undefined && (
          <div className="flex flex-wrap justify-between gap-x-4">
            <dt className="text-muted">Preis</dt>
            <dd className="tabular-nums">
              {formatPrice(price.value)} €/{row.unit.symbol}
              <span className="text-muted"> ({priceOriginText(price)})</span>
            </dd>
          </div>
        )}
      </dl>

      <p className="mt-2 flex flex-wrap gap-x-5 text-base">
        <Rating label="Anschaffung" value={row.system.purchase} />
        <Rating label="Wartung" value={row.system.maintenance} />
      </p>

      {row.cost === undefined && <p className="mt-2 text-base font-semibold">Unter „Annahmen“ einen Preis eintragen.</p>}
      {row.system.efficiency.todo && (
        <p className="mt-2 flex items-start gap-2 rounded-lg bg-warn px-2 py-1 text-sm font-semibold text-warn-ink">
          <WarningIcon className="mt-0.5 size-4 shrink-0" />
          {efficiencyName(row.system)} ohne eigene Quelle, vorläufiger Wert.
        </p>
      )}
    </li>
  )
}

function priceOriginText(price: ResolvedPrice): string {
  if (price.origin === 'own') return 'eigener Preis'
  if (price.origin === 'live') return `Marktpreis ${price.period}`.trim()
  return price.period ? `hinterlegt, ${price.period}` : 'hinterlegt'
}

function Assumptions({
  tool,
  settings,
  onChange,
  prices,
  live,
  idPrefix,
}: {
  tool: HeatingCostTool
  settings: HeatingCostSettings
  onChange: (change: Partial<HeatingCostSettings>) => void
  prices: Record<string, ResolvedPrice>
  live: PricesData | undefined
  idPrefix: string
}) {
  const hasOwnValues = Object.keys(settings.prices).length > 0 || Object.keys(settings.efficiencies).length > 0
  const setPrice = (fuel: Fuel, raw: string) => {
    const { [fuel.key]: _removed, ...rest } = settings.prices
    onChange({ prices: raw.trim() === '' ? rest : { ...rest, [fuel.key]: raw } })
  }
  const setEfficiency = (system: HeatingSystem, raw: string) => {
    const { [system.key]: _removed, ...rest } = settings.efficiencies
    onChange({ efficiencies: raw.trim() === '' ? rest : { ...rest, [system.key]: raw } })
  }
  const generated = live ? new Date(live.generatedAt) : undefined
  const heatingValuesTitle = content.converter.find((converter) => converter.id === tool.heatingValues)?.title ?? 'Energieträger'

  return (
    <details className="mt-6">
      <summary className="min-h-12 cursor-pointer py-3 text-xl font-bold text-accent">Annahmen: Preise, Nutzungsgrade, Heizwerte</summary>

      <h3 className="mt-2 text-lg font-bold">Preise</h3>
      <p className="mt-1 text-base text-muted">
        Leeres Feld: es gilt der Marktpreis bzw. der hinterlegte Preis.
        {generated && !Number.isNaN(generated.getTime()) && ` Marktpreise abgerufen am ${generated.toLocaleDateString('de-DE')}.`}
      </p>
      <ul className="mt-2 space-y-4">
        {tool.fuels.map((fuel) => {
          const unit = priceUnit(fuel)
          const price = prices[fuel.key]!
          const inputId = `${idPrefix}-price-${fuel.key}`
          const raw = settings.prices[fuel.key] ?? ''
          const invalid = raw.trim() !== '' && price.origin !== 'own'
          const fallback = resolvePrice(fuel, live, undefined)
          return (
            <InfoItem
              key={fuel.key}
              id={`${inputId}-info`}
              name={`Quelle Preis ${fuel.name}`}
              title={
                <label htmlFor={inputId} className="font-semibold">
                  {fuel.name}
                </label>
              }
              note={<PriceNote price={fallback} />}
            >
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={raw}
                  placeholder={fallback.value !== undefined ? formatPrice(fallback.value) : 'Preis'}
                  aria-invalid={invalid}
                  onChange={(event) => setPrice(fuel, event.target.value)}
                  className={`${fieldBase} w-full max-w-36 ${invalid ? 'border-warn-ink outline-2 outline-warn' : ''}`}
                />
                <span className="text-lg">€/{unit.symbol}</span>
              </div>
            </InfoItem>
          )
        })}
      </ul>

      <h3 className="mt-6 text-lg font-bold">Nutzungsgrade und Jahresarbeitszahlen</h3>
      <p className="mt-1 text-base text-muted">Gerechnet auf den Heizwert. Eigene Werte z. B. für eine ältere Anlage eintragen.</p>
      <ul className="mt-2 space-y-4">
        {tool.systems.map((system) => {
          const inputId = `${idPrefix}-eff-${system.key}`
          const raw = settings.efficiencies[system.key] ?? ''
          const invalid = raw.trim() !== '' && parseEfficiency(system, raw) === undefined
          const isEfficiency = system.efficiency.kind === 'efficiency'
          return (
            <InfoItem
              key={system.key}
              id={`${inputId}-info`}
              name={`Quelle ${efficiencyName(system)} ${system.name}`}
              title={
                <label htmlFor={inputId} className="font-semibold">
                  {system.name}
                  <span className="font-normal text-muted"> ({efficiencyName(system)})</span>
                </label>
              }
              note={system.efficiency.source}
            >
              <div className="mt-1 flex items-center gap-2">
                <input
                  id={inputId}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  value={raw}
                  placeholder={isEfficiency ? formatNumber(system.efficiency.value * 100, 0) : formatNumber(system.efficiency.value, 1)}
                  aria-invalid={invalid}
                  onChange={(event) => setEfficiency(system, event.target.value)}
                  className={`${fieldBase} w-full max-w-28 ${invalid ? 'border-warn-ink outline-2 outline-warn' : ''}`}
                />
                {isEfficiency && <span className="text-lg">%</span>}
              </div>
            </InfoItem>
          )
        })}
      </ul>

      {hasOwnValues && (
        <button
          type="button"
          className={`${secondaryButton} mt-4`}
          onClick={() => onChange({ prices: DEFAULT_HEATING_COST_SETTINGS.prices, efficiencies: DEFAULT_HEATING_COST_SETTINGS.efficiencies })}
        >
          Eigene Preise und Werte zurücksetzen
        </button>
      )}

      <h3 className="mt-6 text-lg font-bold">Heizwerte</h3>
      <p className="mt-1 text-base">
        Gerechnet wird mit den Heizwerten aus dem Umrechner{' '}
        <Link to={converterPath(tool.heatingValues)} className="font-semibold text-accent underline">
          {heatingValuesTitle}
        </Link>
        ; dort stehen sie mit ihren Quellen.
      </p>

      <h3 className="mt-6 text-lg font-bold">Anschaffung und Wartung</h3>
      <p className="mt-1 text-base text-muted">€ günstig, €€ mittel, €€€ teuer.</p>
    </details>
  )
}

/** Hinweis zur Quelle eines Preises: Marktpreis oder hinterlegter Preis mit Zeitraum, sonst das TODO */
function PriceNote({ price }: { price: ResolvedPrice }) {
  if (price.origin === 'missing') return <>{price.source}</>
  return (
    <>
      {price.origin === 'live' ? 'Marktpreis' : 'Hinterlegt'} {price.period && `(${price.period})`}:{' '}
      {price.url ? (
        <a href={price.url} target="_blank" rel="noreferrer" className="underline">
          {price.source}
        </a>
      ) : (
        price.source
      )}
    </>
  )
}

/** Listenpunkt mit Überschrift und kleinem i-Knopf daneben; der Hinweis (Quelle) erscheint erst auf Antippen */
function InfoItem({ id, name, title, note, children }: { id: string; name: string; title: ReactNode; note: ReactNode; children?: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <li>
      <div className="flex items-center gap-1">
        {title}
        <button
          type="button"
          aria-label={name}
          aria-expanded={open}
          aria-controls={id}
          onClick={() => setOpen(!open)}
          className={`inline-flex size-11 shrink-0 items-center justify-center rounded-lg print:hidden ${open ? 'bg-accent text-accent-ink' : 'text-muted'}`}
        >
          <InfoIcon className="size-5" />
        </button>
      </div>
      {children}
      {open && (
        <p id={id} className="mt-1 text-sm text-muted [overflow-wrap:anywhere]">
          {note}
        </p>
      )}
    </li>
  )
}

