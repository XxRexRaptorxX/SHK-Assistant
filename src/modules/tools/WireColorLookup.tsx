import { useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { SelectionBar } from './ChoiceLookup'
import {
  assignmentsFor,
  cablesForSystem,
  coresKey,
  WIRE_COLORS,
  type WireAssignment,
  type WireColorTool,
} from './wireColorTool'

const card = 'mt-4 rounded-2xl border-2 border-accent bg-surface p-4'

/** Belegung als Liste: Farbfeld und Farbname, damit es auch ohne Farbensehen und bei schlechtem Licht lesbar ist */
function WireList({ assignment }: { assignment: WireAssignment }) {
  return (
    <div className={card}>
      <ul className="space-y-3">
        {assignment.wires.map((wire, index) => {
          const color = WIRE_COLORS[wire.color]
          return (
            <li key={index} className="flex items-center gap-3">
              <span
                aria-hidden="true"
                className="size-11 shrink-0 rounded-full border-2 border-line"
                style={{ background: color.swatch }}
              />
              <span className="min-w-0">
                <span className="block text-lg font-bold">{color.name}</span>
                <span className="block text-base">{wire.use}</span>
                {wire.note && <span className="block text-sm text-muted">{wire.note}</span>}
              </span>
            </li>
          )
        })}
      </ul>
      {assignment.note && <p className="mt-4 text-base">{assignment.note}</p>}
      <p className="mt-3 text-sm text-muted">Belegung: {assignment.source}</p>
    </div>
  )
}

/** Aderfarben-Tool: System, Kabeltyp und Aderzahl wählen, darunter die Farben mit ihrer Nutzung */
export function WireColorLookup({
  tool,
  initialSystem,
  initialCable = '',
  initialCores = '',
}: {
  tool: WireColorTool
  initialSystem?: string
  /** Vorauswahl (Tests) */
  initialCable?: string
  initialCores?: string
}) {
  const idPrefix = useId()
  const [system, setSystem] = useState(initialSystem ?? tool.systems[0]!.key)
  const [cable, setCable] = useState(initialCable)
  const [cores, setCores] = useState(initialCores)

  const currentSystem = tool.systems.find((candidate) => candidate.key === system)!
  // Passt die Auswahl nicht mehr zum System, gilt sie als leer
  const cables = cablesForSystem(tool, system)
  const selectedCable = cables.find((candidate) => candidate.key === cable)
  const cableKey = selectedCable?.key ?? ''
  const options = cableKey ? assignmentsFor(tool, system, cableKey) : []
  // Gibt es nur eine Aderzahl, ist sie schon gewählt
  const assignment = options.length === 1 ? options[0] : options.find((option) => coresKey(option) === cores)

  return (
    <section>
      <SelectionBar
        bar={{ key: 'system', name: 'System', options: tool.systems.map(({ key, label, note }) => ({ key, label, note })) }}
        selected={system}
        onSelect={setSystem}
        wrap
      />
      {currentSystem.warning && (
        <p role="note" className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 font-semibold text-warn-ink">
          {currentSystem.warning}
        </p>
      )}
      {currentSystem.hint && <p className="mt-2 text-base">{currentSystem.hint}</p>}

      <label htmlFor={`${idPrefix}-cable`} className="mt-6 block font-semibold">
        Kabeltyp
      </label>
      <select
        id={`${idPrefix}-cable`}
        value={cableKey}
        onChange={(event) => setCable(event.target.value)}
        className={`${fieldBase} mt-1 w-full`}
      >
        <option value="" disabled>
          Kabeltyp wählen …
        </option>
        {cables.map((candidate) => (
          <option key={candidate.key} value={candidate.key}>
            {candidate.name}
          </option>
        ))}
      </select>

      {selectedCable?.note && <p className="mt-2 text-base">{selectedCable.note}</p>}

      {options.length > 1 && (
        <SelectionBar
          bar={{
            key: 'cores',
            name: 'Aderzahl',
            options: options.map((option) => ({ key: coresKey(option), label: option.cores, note: option.coresNote })),
          }}
          selected={assignment && coresKey(assignment)}
          onSelect={setCores}
        />
      )}

      <div aria-live="polite">
        {assignment ? (
          <WireList assignment={assignment} />
        ) : (
          <div className={card}>
            <p className="text-base text-muted">{cableKey ? 'Aderzahl wählen.' : 'Kabeltyp wählen.'}</p>
          </div>
        )}
      </div>
    </section>
  )
}
