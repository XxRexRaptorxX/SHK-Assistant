import { useId, useState } from 'react'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { SelectionBar } from './ChoiceLookup'
import { Help, Stepper } from './HeatingCurveSimulator'
import {
  checkCondensing,
  evaluatePressureSwitch,
  maxCondensingTemperature,
  pressureSwitchRefText,
  type PressureSwitchRef,
  type PressureSwitchTool,
} from './pressureSwitchTool'
import { formatRounded, lastRefrigerant } from './RefrigerantLookup'
import { tablePoints } from './refrigerantTool'
import { isRefrigerantTool, type ToolEntry } from './schema'

const card = 'rounded-2xl border-2 border-accent bg-surface p-4'
const warning = 'mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink'

function Source({ tool, refValue }: { tool: PressureSwitchTool; refValue: PressureSwitchRef | undefined }) {
  if (!refValue) return null
  return <p className="mt-1 text-sm text-muted">Quelle: {pressureSwitchRefText(tool, refValue)}</p>
}

/** Begriffserklärung zu einer Eingabe, als Kasten im Aufklapper „Was bewirkt das?“ */
function Explanations({ tool, explanations }: { tool: PressureSwitchTool; explanations: PressureSwitchTool['inputs']['ps']['explanations'] }) {
  if (explanations.length === 0) return null
  return (
    <div className="mt-3 rounded-2xl border border-edge bg-raised p-4">
      {explanations.map((explanation, index) => (
        <div key={explanation.title} className={index > 0 ? 'mt-3' : undefined}>
          <h3 className="font-semibold">{explanation.title}</h3>
          <p className="text-base">{explanation.text}</p>
          <Source tool={tool} refValue={explanation.ref} />
        </div>
      ))}
    </div>
  )
}

const factor = (value: number) => formatRounded(value, 2).replace(/,?0+$/, '')

/** Hochdruckschalter-Tool: PS und Absicherung wählen, Einstellwerte sehen, Verflüssigungstemperatur prüfen */
export function PressureSwitchSizing({
  tool,
  entries,
  initialRefrigerant,
}: {
  tool: PressureSwitchTool
  /** Alle Tools der Edition, um die verknüpfte Dampfdrucktabelle zu finden */
  entries: readonly ToolEntry[]
  /** Vorauswahl (Tests); sonst das zuletzt gewählte Kältemittel */
  initialRefrigerant?: string
}) {
  const idPrefix = useId()
  const [ps, setPs] = useState(tool.inputs.ps.default)
  const [setupKey, setSetupKey] = useState(tool.defaultSetup)
  const [condensing, setCondensing] = useState(tool.inputs.condensing.default)
  const stored = lastRefrigerant.useValue()
  const [chosen, setChosen] = useState(initialRefrigerant)

  const setup = tool.setups.find((candidate) => candidate.key === setupKey) ?? tool.setups[0]!
  const result = evaluatePressureSwitch(tool, setup, ps)
  const unit = tool.inputs.ps.unit
  const pressure = (value: number) => `${formatRounded(value, tool.pressureDecimals)} ${unit}`

  const table = entries.find((entry) => entry.id === tool.pressureTable)
  const pressureTable = table && isRefrigerantTool(table) ? table : undefined
  const refrigerantName = chosen ?? stored
  const refrigerant = pressureTable?.refrigerants.find((candidate) => candidate.name === refrigerantName)
  const points = pressureTable && refrigerant ? tablePoints(pressureTable, refrigerant) : []
  const check = refrigerant ? checkCondensing(points, condensing, result.tripLow) : null
  const highest = refrigerant ? maxCondensingTemperature(points, result.tripLow) : null

  const selectRefrigerant = (next: string) => {
    setChosen(next)
    lastRefrigerant.set(next)
  }

  return (
    <>
      <section className="mt-6" aria-labelledby={`${idPrefix}-inputs`}>
        <h2 id={`${idPrefix}-inputs`} className="text-xl font-bold">
          Anlage
        </h2>
        <div className="mt-3">
          <Stepper {...tool.inputs.ps} value={ps} onChange={setPs} />
          <Help text={tool.inputs.ps.text}>
            <Source tool={tool} refValue={tool.inputs.ps.ref} />
            <Explanations tool={tool} explanations={tool.inputs.ps.explanations} />
          </Help>
        </div>
        <SelectionBar
          bar={{
            key: 'setup',
            name: 'Absicherung',
            options: tool.setups.map((candidate) => ({ key: candidate.key, label: candidate.label, note: '' })),
          }}
          selected={setup.key}
          onSelect={setSetupKey}
        />
        <p className="mt-2 text-base">{setup.text}</p>
        <Source tool={tool} refValue={setup.ref} />
      </section>

      <section className="mt-6" aria-labelledby={`${idPrefix}-result`}>
        <h2 id={`${idPrefix}-result`} className="text-xl font-bold">
          Einstellwerte
        </h2>
        <div className={`mt-3 ${card}`} aria-live="polite">
          <p className="font-semibold">Sicherheitsdruckschalter</p>
          <p className="text-3xl font-bold">{pressure(result.switchSetting)}</p>
          <p className="text-base text-muted">
            {factor(setup.switchFactor)} × PS
            {setup.switchFactor === 1 && ', höchstens'}
          </p>

          <p className="mt-4 font-semibold">Zulässiges Abschaltfenster</p>
          <p className="text-2xl font-bold">
            {formatRounded(result.tripLow, tool.pressureDecimals)} … {pressure(result.switchSetting)} (+0 %)
          </p>
          <Help text={tool.tripWindow.text}>
            <Source tool={tool} refValue={tool.tripWindow.ref} />
          </Help>

          {result.reliefValve !== null && (
            <>
              <p className="mt-4 font-semibold">Druckbegrenzungsventil</p>
              <p className="text-2xl font-bold">höchstens {pressure(result.reliefValve)}</p>
              <p className="text-base text-muted">{factor(setup.reliefValveFactor!)} × PS</p>
            </>
          )}

          <p className="mt-4 font-semibold">Werksdruckprüfung des Druckschalters</p>
          <p className="text-xl font-bold">über {pressure(result.factoryTest)}</p>
          <Help text={tool.factoryTest.text}>
            <Source tool={tool} refValue={tool.factoryTest.ref} />
          </Help>
        </div>
      </section>

      <section className="mt-6" aria-labelledby={`${idPrefix}-check`}>
        <h2 id={`${idPrefix}-check`} className="text-xl font-bold">
          Verflüssigungstemperatur prüfen
        </h2>
        <p className="mt-2 text-base">{tool.condensingText}</p>
        <Source tool={tool} refValue={tool.condensingRef} />
        {!pressureTable ? (
          <p className="mt-3 text-base text-muted">Die Dampfdrucktabelle ist in dieser Ausgabe nicht enthalten.</p>
        ) : (
          <>
            <label htmlFor={`${idPrefix}-refrigerant`} className="mt-4 block font-semibold">
              Kältemittel
            </label>
            <select
              id={`${idPrefix}-refrigerant`}
              value={refrigerant?.name ?? ''}
              onChange={(event) => selectRefrigerant(event.target.value)}
              className={`${fieldBase} mt-1 w-full max-w-xs`}
            >
              <option value="" disabled>
                Kältemittel wählen …
              </option>
              {pressureTable.refrigerants.map((candidate) => (
                <option key={candidate.name} value={candidate.name}>
                  {candidate.name}
                </option>
              ))}
            </select>
            <div className="mt-4">
              <Stepper {...tool.inputs.condensing} value={condensing} onChange={setCondensing} />
              <Help text={tool.inputs.condensing.text}>
                <Source tool={tool} refValue={tool.inputs.condensing.ref} />
              </Help>
            </div>

            <div className={`mt-4 ${card}`} aria-live="polite">
              {!refrigerant || !check ? (
                <p className="text-base text-muted">Kältemittel wählen.</p>
              ) : check.kind === 'outOfRange' ? (
                <p className="font-semibold">
                  Außerhalb der Dampfdrucktabelle. Für {refrigerant.name} reicht sie von {formatRounded(check.first.temperature, 0)} °C bis{' '}
                  {formatRounded(check.last.temperature, 0)} °C.
                </p>
              ) : (
                <>
                  <p className="font-semibold">
                    Sättigungsdruck {refrigerant.name} bei {formatRounded(condensing, 0)} °C
                  </p>
                  <p className="text-3xl font-bold">
                    {check.pressure.kind === 'interpolated' && '≈ '}
                    {formatRounded(check.pressure.value, 2)} {pressureTable.pressureUnit}
                  </p>
                  {check.kind === 'ok' ? (
                    <p className="mt-2 text-base font-semibold">
                      Passt: {formatRounded(check.margin, 2)} {unit} unter dem Beginn des Abschaltfensters (
                      {pressure(result.tripLow)}).
                    </p>
                  ) : (
                    <p className={warning}>
                      Zu hoch: Der Sättigungsdruck liegt {formatRounded(-check.margin, 2)} {unit} über dem Beginn des
                      Abschaltfensters ({pressure(result.tripLow)}). Der Schalter kann im Betrieb abschalten.
                    </p>
                  )}
                </>
              )}
              {highest && (
                <p className="mt-3 text-base">
                  {highest.kind === 'value'
                    ? `Höchste Verflüssigungstemperatur unter dem Abschaltfenster: ${highest.interpolated ? '≈ ' : ''}${formatRounded(highest.temperature, 1)} °C.`
                    : highest.kind === 'aboveTable'
                      ? `Das Abschaltfenster liegt über dem Tabellenende (${formatRounded(highest.last.temperature, 0)} °C = ${formatRounded(highest.last.pressure, 2)} ${unit}).`
                      : 'Das Abschaltfenster liegt unter dem Anfang der Tabelle.'}
                </p>
              )}
            </div>
            {pressureTable.tableNote && <p className="mt-2 text-base text-muted">{pressureTable.tableNote}</p>}
          </>
        )}
      </section>

      {tool.infos.map((info) => (
        <section key={info.title} className="mt-6">
          <h2 className="text-xl font-bold">{info.title}</h2>
          <p className="mt-2 text-base">{info.text}</p>
          <Source tool={tool} refValue={info.ref} />
        </section>
      ))}

      <div className="mt-6 text-base text-muted">
        <RichText text={tool.closingNote} />
      </div>
    </>
  )
}
