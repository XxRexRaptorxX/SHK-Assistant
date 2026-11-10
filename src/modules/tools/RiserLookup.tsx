import { useId, useState } from 'react'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { content } from '../../content'
import { formatNumber } from '../../lib/number'
import { evaluateFormula } from '../formulas/engine'
import type { FormulaEntry } from '../formulas/schema'
import { SelectionBar } from './ChoiceLookup'
import {
  AIRFLOW_UNIT,
  airflowsFor,
  deviceCounts,
  findSetup,
  riserAirflow,
  selectRiser,
  type VentilationRiserTool,
} from './riserTool'
import { Counter } from './SurveyParts'

const card = 'rounded-2xl border-2 border-accent bg-surface p-4'
const MAX_FLOORS = 99

const devicesText = (count: number) => (count === 1 ? '1 Gerät' : `${count} Geräte`)
/** Nach „bei“: 1 Gerät, 2 Geräten */
const devicesDative = (count: number) => (count === 1 ? '1 Gerät' : `${count} Geräten`)

/**
 * Strömungsgeschwindigkeit über die hinterlegte Formel (Volumenstrom in m³/h, Durchmesser in der Einheit des
 * Tools). Ohne Formel oder bei einem Rechenfehler gibt es keinen Wert.
 */
export function riserVelocity(formula: FormulaEntry | undefined, airflow: number, diameter: number, diameterUnit: string) {
  if (!formula) return undefined
  try {
    return evaluateFormula(formula, {
      Vdot: { value: airflow, unit: 'm^3/h' },
      d: { value: diameter, unit: diameterUnit },
    })
  } catch {
    return undefined
  }
}

/** Lüftungsstrang-Tool: Bereich, Geräte pro Etage, Volumenstrom und Etagen wählen, Strangdimension sehen */
export function RiserLookup({
  tool,
  initialRange,
  initialDevices,
  initialAirflow,
  initialFloors = 0,
}: {
  tool: VentilationRiserTool
  /** Vorauswahl (Tests) */
  initialRange?: string
  initialDevices?: number
  initialAirflow?: number
  initialFloors?: number
}) {
  const idPrefix = useId()
  const counts = deviceCounts(tool)
  const [range, setRange] = useState(initialRange ?? tool.ranges[0]!.key)
  const [devices, setDevices] = useState(initialDevices ?? counts[0]!)
  const [chosenAirflow, setChosenAirflow] = useState(initialAirflow)
  const [floors, setFloors] = useState(initialFloors)

  // Gibt es den gewählten Volumenstrom bei dieser Gerätezahl nicht, gilt der erste vorhandene
  const airflows = airflowsFor(tool, devices)
  const airflow = chosenAirflow !== undefined && airflows.includes(chosenAirflow) ? chosenAirflow : airflows[0]!
  const setup = findSetup(tool, devices, airflow)!
  const rangeEntry = tool.ranges.find((candidate) => candidate.key === range) ?? tool.ranges[0]!
  const selection = floors > 0 ? selectRiser(tool, setup, rangeEntry.key, floors) : undefined
  const flow = riserAirflow(setup, floors)
  const formula = content.formulas.find((entry) => entry.id === tool.velocityFormula)
  const fitDiameter = selection?.kind === 'fits' ? selection.diameter : undefined
  const velocity = fitDiameter !== undefined ? riserVelocity(formula, flow.total, fitDiameter, tool.diameterUnit) : undefined

  const diameterText = (diameter: number) => `Ø ${formatNumber(diameter, 0)} ${tool.diameterUnit}`
  const airflowText = (value: number) => `${formatNumber(value, 0)} ${AIRFLOW_UNIT}`

  return (
    <>
      <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
        <HeadingWithClear id={`${idPrefix}-heading`} onClear={() => setFloors(0)} disabled={floors === 0}>
          Auswahl
        </HeadingWithClear>

        <SelectionBar bar={{ key: 'range', name: 'Bereich', options: tool.ranges }} selected={rangeEntry.key} onSelect={setRange} />
        <SelectionBar
          bar={{
            key: 'devices',
            name: 'Lüftergeräte pro Etage',
            options: counts.map((count) => ({ key: String(count), label: String(count), note: count === 1 ? 'Gerät' : 'Geräte' })),
          }}
          selected={String(devices)}
          onSelect={(key) => setDevices(Number(key))}
        />
        <SelectionBar
          bar={{
            key: 'airflow',
            name: 'Volumenstrom je Gerät',
            options: airflows.map((value) => ({ key: String(value), label: formatNumber(value, 0), note: AIRFLOW_UNIT })),
          }}
          selected={String(airflow)}
          onSelect={(key) => setChosenAirflow(Number(key))}
        />

        <label htmlFor={`${idPrefix}-floors`} className="mt-6 block font-semibold">
          Anzahl Etagen
        </label>
        <div className="mt-1">
          <Counter id={`${idPrefix}-floors`} label="Etagen" value={floors} onChange={setFloors} max={MAX_FLOORS} />
        </div>

        <div className={`mt-5 ${card}`} aria-live="polite">
          {!selection ? (
            <p className="text-base text-muted">Anzahl der Etagen eintragen.</p>
          ) : selection.kind === 'beyond' ? (
            <p className="font-semibold">
              Mehr Etagen als in der Auswahlhilfe: Bei {devicesDative(setup.devices)} pro Etage mit je {airflowText(setup.airflow)}{' '}
              reicht sie im Bereich {rangeEntry.label} bis {selection.maxFloors} Etagen ({diameterText(selection.largest)}).
            </p>
          ) : (
            <>
              <p className="font-semibold">Strangdimension</p>
              <p className="text-3xl font-bold">{diameterText(selection.diameter)}</p>
              <p className="text-base text-muted">
                Bereich {rangeEntry.label}
                {rangeEntry.note && ` (${rangeEntry.note})`}, trägt laut Auswahlhilfe bis {selection.maxFloors} Etagen.
              </p>
            </>
          )}
        </div>

        {selection && (
          <dl className="mt-4 divide-y divide-edge rounded-2xl border border-edge bg-surface">
            <DataRow label="Lüftergeräte im Strang" value={`${flow.devices} (${devicesText(setup.devices)} × ${floors} Etagen)`} />
            <DataRow label="Luftdurchsatz je Etage" value={airflowText(flow.perFloor)} />
            <DataRow label="Luftdurchsatz im Strang" value={airflowText(flow.total)} note="alle Geräte gleichzeitig" />
            {velocity !== undefined && fitDiameter !== undefined && (
              <DataRow
                label="Strömungsgeschwindigkeit im Strang"
                value={`${formatNumber(velocity, 1)} m/s`}
                note={`gerechnet mit ${diameterText(fitDiameter)} als Innendurchmesser`}
              />
            )}
          </dl>
        )}

        {tool.note && <p className="mt-3 text-base font-semibold">{tool.note}</p>}
        {tool.conditions.length > 0 && (
          <p className="mt-1 text-base text-muted">Annahmen der Auswahlhilfe: {tool.conditions.join(', ')}.</p>
        )}
      </section>

      <section className="mt-6" aria-labelledby={`${idPrefix}-table`}>
        <h2 id={`${idPrefix}-table`} className="text-xl font-bold">
          Auswahlhilfe {tool.product}
        </h2>
        <p className="mt-1 text-base text-muted">
          Höchste Etagenzahl bei {devicesDative(setup.devices)} pro Etage mit je {airflowText(setup.airflow)}
          {setup.page && ` (Quelle Seite ${setup.page})`}.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-edge bg-surface">
          <table className="w-full text-left text-base">
            <thead>
              <tr className="border-b border-edge">
                <th scope="col" className="px-2 py-2">
                  Strang
                  <span className="block text-sm font-normal text-muted">Ø {tool.diameterUnit}</span>
                </th>
                {tool.ranges.map((entry) => (
                  <th key={entry.key} scope="col" className="px-2 py-2">
                    {entry.label}
                    <span className="block text-sm font-normal text-muted">Etagen</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {tool.diameters.map((diameter, index) => {
                const active = fitDiameter === diameter
                return (
                  <tr key={diameter} className={active ? 'bg-raised font-semibold' : undefined} aria-current={active ? 'true' : undefined}>
                    <th scope="row" className="px-2 py-2 whitespace-nowrap">
                      {formatNumber(diameter, 0)}
                    </th>
                    {tool.ranges.map((entry) => (
                      <td key={entry.key} className={`px-2 py-2 ${entry.key === rangeEntry.key ? '' : 'text-muted'}`}>
                        bis {setup.maxFloors[entry.key]?.[index]}
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function DataRow({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 px-3 py-2">
      <dt className="text-base">
        {label}
        {note && <span className="block text-sm text-muted">{note}</span>}
      </dt>
      <dd className="text-lg font-bold tabular-nums">{value}</dd>
    </div>
  )
}
