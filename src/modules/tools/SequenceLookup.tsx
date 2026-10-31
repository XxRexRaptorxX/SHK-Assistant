import { useEffect, useId, useState } from 'react'
import { RichText } from '../../components/RichText'
import { dangerButton, primaryButton, secondaryButton } from '../../components/buttons'
import { ChevronRightIcon, StopwatchIcon } from '../../components/icons'
import { card } from '../../components/surfaces'
import { TermLink } from '../lexicon/TermLink'
import { lexiconPathFor } from '../lexicon/termLinks'
import { SelectionBar } from './ChoiceLookup'
import {
  activePhase,
  faultsByPhase,
  formatSeconds,
  measuredSeconds,
  nextPhase,
  outsideLimit,
  remainingSeconds,
  startStopwatch,
  stopStopwatch,
  type SequenceFault,
  type SequencePhase,
  type SequenceTool,
  type SequenceVariant,
  type Stopwatch,
} from './sequenceTool'

/** Element-Kennung einer Störung in der Fehlersuche */
const faultId = (variant: SequenceVariant, fault: SequenceFault) => `fault-${variant.key}-${variant.faults.indexOf(fault)}`

/** Element-Kennung der Fehlersuche einer Variante */
const faultsId = (variant: SequenceVariant) => `faults-${variant.key}`

/** Zahl und Einheit nicht trennen, z. B. „max. 3 s“ */
const keepUnit = (text: string) => text.replace(/ s\b/g, ' s')

/** Lexikon-Eintrag einer Phase, z. B. „Vorspülzeit“ */
const phasePath = (phase: SequencePhase) => lexiconPathFor([phase.term, phase.label])

/** Üblicher Wert zur Anzeige neben der Messung, z. B. „max. 3 s“ */
function expected(phase: SequencePhase): string {
  if (phase.seconds === undefined) return keepUnit(phase.duration)
  const value = keepUnit(formatSeconds(phase.seconds))
  return phase.limit === 'max' ? `max. ${value}` : phase.limit === 'min' ? `min. ${value}` : `üblich ${value}`
}

/**
 * Ablauf-Tool: Brennerart wählen, Zeitdiagramm mit antippbaren Phasen, Stoppuhr zum Mitmessen und
 * Fehlersuche. Hält man die Stoppuhr an, stehen die Störungen dieser Phase oben.
 */
export function SequenceLookup({
  tool,
  initialVariant,
  initialWatch = { state: 'idle' },
  initialFault,
}: {
  tool: SequenceTool
  initialVariant?: string
  /** Für Tests; sonst startet die Stoppuhr im Ruhezustand */
  initialWatch?: Stopwatch
  initialFault?: string
}) {
  const [variantKey, setVariantKey] = useState(initialVariant ?? tool.variants[0]!.key)
  const variant = tool.variants.find((candidate) => candidate.key === variantKey) ?? tool.variants[0]!
  const [watch, setWatch] = useState<Stopwatch>(initialWatch)
  const [selected, setSelected] = useState(activePhase(initialWatch) ?? 0)
  const [fault, setFault] = useState<string | undefined>(initialFault)

  function selectVariant(key: string) {
    setVariantKey(key)
    setWatch({ state: 'idle' })
    setSelected(0)
    setFault(undefined)
  }

  function update(next: Stopwatch) {
    setWatch(next)
    const phase = activePhase(next)
    if (phase !== undefined) setSelected(phase)
    if (next.state === 'stopped') {
      // Erste Störung der Phase aufklappen, in der der Ablauf stehen geblieben ist
      setFault(faultsByPhase(variant, variant.phases[next.phase]!.key)[0]?.symptom)
    } else if (next.state === 'running' && watch.state !== 'running') {
      setFault(undefined)
    }
  }

  const bar = {
    key: 'variante',
    name: tool.name,
    options: tool.variants.map(({ key, label, note }) => ({ key, label, note })),
  }
  const running = activePhase(watch)

  return (
    <>
      {tool.variants.length > 1 && <SelectionBar bar={bar} selected={variant.key} onSelect={selectVariant} />}
      <section className="mt-6" aria-labelledby={`sequence-${variant.key}`}>
        <h2 id={`sequence-${variant.key}`} className="text-xl font-bold">
          {variant.title}
        </h2>
        <div className="mt-2">
          <RichText text={variant.description} />
        </div>
        <SequenceDiagram
          variant={variant}
          selected={selected}
          running={watch.state === 'running' ? running : undefined}
          stopped={watch.state === 'stopped' ? watch.phase : undefined}
          onSelect={setSelected}
        />
        <StopwatchPanel variant={variant} watch={watch} onChange={update} />
        <PhaseDetails variant={variant} phase={variant.phases[selected]!} onFault={setFault} />
        <FaultFinder variant={variant} watch={watch} open={fault} onToggle={(symptom) => setFault(fault === symptom ? undefined : symptom)} />
      </section>
    </>
  )
}

/**
 * Zeitdiagramm als Tabelle: Zeilen = Signale, Spalten = Phasen (gleich breit, nicht maßstäblich).
 * Ein gelber Balken zeigt, dass das Signal anliegt. Die Kürzel oben wählen eine Phase aus; ins Lexikon
 * verlinken die Phasennamen in den Texten darunter.
 */
export function SequenceDiagram({
  variant,
  selected,
  running,
  stopped,
  onSelect,
}: {
  variant: SequenceVariant
  selected: number
  running?: number
  stopped?: number
  onSelect: (index: number) => void
}) {
  const column = (index: number) =>
    index === stopped ? 'bg-warn/30' : index === running ? 'bg-accent/15' : index === selected ? 'bg-raised' : ''
  return (
    <figure className={`${card} mt-4 p-2`}>
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">Ablauf {variant.title}: Signale je Phase</caption>
        <colgroup>
          <col className="w-[5.75rem] sm:w-40" />
          {variant.phases.map((phase) => (
            <col key={phase.key} />
          ))}
        </colgroup>
        <thead>
          <tr>
            <td />
            {variant.phases.map((phase, index) => (
              <th key={phase.key} scope="col" className={`p-0 ${column(index)}`}>
                <button
                  type="button"
                  aria-pressed={index === selected}
                  aria-label={phase.label}
                  onClick={() => onSelect(index)}
                  className={`flex min-h-12 w-full items-center justify-center rounded-lg text-sm font-bold ${
                    index === selected ? 'text-accent underline decoration-2 underline-offset-4' : ''
                  } ${index === running ? 'animate-pulse' : ''}`}
                >
                  {phase.abbr}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {variant.signals.map((signal) => (
            <tr key={signal.key}>
              <th scope="row" className="py-1.5 pr-1 text-left text-sm leading-tight font-semibold break-words hyphens-auto">
                {signal.label}
              </th>
              {variant.phases.map((phase, index) => {
                const on = phase.signals.includes(signal.key)
                return (
                  <td key={phase.key} className={`p-0 align-middle ${column(index)}`}>
                    {/* Ohne Lücke zwischen den Zellen, damit durchgehende Signale als ein Balken erscheinen */}
                    <div className={on ? 'h-4 border-y-2 border-yellow-600 bg-yellow-400 dark:border-yellow-300' : 'mx-auto h-px w-full bg-line/50'} />
                    <span className="sr-only">{on ? 'an' : 'aus'}</span>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td />
            {variant.phases.map((phase, index) => (
              <td key={phase.key} className={`px-0.5 pt-1 text-center text-xs leading-tight text-muted ${column(index)}`}>
                {keepUnit(phase.duration)}
              </td>
            ))}
          </tr>
          {variant.phases.some((phase) => phase.repeat) && (
            <tr>
              <th scope="row" className="pt-1 pr-1 text-left text-xs leading-tight font-semibold text-muted">
                Wieder&shy;holung
              </th>
              {variant.phases.map((phase, index) => (
                <td
                  key={phase.key}
                  title={phase.repeat?.text}
                  className={`px-0.5 pt-1 text-center text-xs leading-tight font-semibold ${column(index)}`}
                >
                  {phase.repeat?.short ?? '–'}
                </td>
              ))}
            </tr>
          )}
        </tfoot>
      </table>
      <figcaption className="mt-2 text-sm text-muted">Phase antippen für Einzelheiten.</figcaption>
    </figure>
  )
}

/** Läuft die Stoppuhr, wird die Anzeige zehnmal pro Sekunde erneuert */
function useNow(active: boolean): number {
  const [now, setNow] = useState(() => performance.now())
  useEffect(() => {
    if (!active) return
    const timer = setInterval(() => setNow(performance.now()), 100)
    return () => clearInterval(timer)
  }, [active])
  return now
}

function StopwatchPanel({
  variant,
  watch,
  onChange,
}: {
  variant: SequenceVariant
  watch: Stopwatch
  onChange: (watch: Stopwatch) => void
}) {
  const headingId = useId()
  const now = useNow(watch.state === 'running')
  const phases = variant.phases
  const active = activePhase(watch)
  const current = active === undefined ? undefined : phases[active]
  const next = active === undefined ? undefined : phases[active + 1]
  const measured = measuredSeconds(watch)
  const elapsed = watch.state === 'running' ? Math.max(0, (now - watch.marks.at(-1)!) / 1000) : undefined

  return (
    <section className={`${card} mt-4 p-4`} aria-labelledby={headingId}>
      <h3 id={headingId} className="flex items-center gap-2 text-lg font-bold">
        <StopwatchIcon className="size-6 text-accent" />
        Stoppuhr
      </h3>

      {watch.state !== 'idle' && <PhaseProgress phases={phases} watch={watch} />}

      {watch.state === 'idle' && (
        <>
          <p className="mt-2 text-base text-muted">
            Starten, sobald „{phases[0]!.event}“, und bei jedem Phasenwechsel tippen. Bleibt der Start hängen, anhalten:
            Die Fehlersuche zeigt dann die Ursachen dieser Phase.
          </p>
          <button type="button" className={`${primaryButton} mt-3 w-full`} onClick={() => onChange(startStopwatch(performance.now()))}>
            Stoppuhr starten
          </button>
        </>
      )}

      {watch.state === 'running' && current && (
        <>
          <p className="mt-2 text-base">
            Phase {active! + 1} von {phases.length}:{' '}
            <TermLink to={phasePath(current)}>
              <strong>{current.label}</strong> ({current.abbr})
            </TermLink>
          </p>
          <p className="mt-1 flex items-baseline justify-between gap-3">
            {/* Laufende Zeit in ganzen Sekunden wie bei einer Stoppuhr */}
            <span className="text-4xl font-bold tabular-nums" aria-live="off">
              {Math.floor(elapsed ?? 0)}&nbsp;s
            </span>
            <span className="text-base text-muted">{expected(current)}</span>
          </p>
          <PhaseEnd phase={current} next={next} elapsed={elapsed ?? 0} />
          {current.repeat && (
            <p className="mt-2 text-sm">
              <span className="font-semibold">Wiederholung: </span>
              {current.repeat.text}
            </p>
          )}
          {next ? (
            <button
              type="button"
              className={`${primaryButton} mt-3 w-full flex-col gap-0 py-2 ${
                // Fester Rahmen statt Pulsieren, damit die Schrift lesbar bleibt
                phaseOver(current, elapsed ?? 0) ? 'ring-4 ring-warn ring-offset-2 ring-offset-surface' : ''
              }`}
              onClick={() => onChange(nextPhase(watch, performance.now(), phases.length))}
            >
              <span>Weiter: {next.label}</span>
              <span className="text-sm font-normal">{next.event}</span>
            </button>
          ) : null}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" className={dangerButton} onClick={() => onChange(stopStopwatch(watch, performance.now()))}>
              Bleibt hier stehen
            </button>
            <button type="button" className={secondaryButton} onClick={() => onChange({ state: 'idle' })}>
              Abbrechen
            </button>
          </div>
        </>
      )}

      {watch.state === 'stopped' && (
        <div className="mt-2 rounded-xl bg-warn p-3 text-warn-ink" role="status">
          <p className="font-semibold">
            Angehalten in <TermLink to={phasePath(phases[watch.phase]!)}>{phases[watch.phase]!.label}</TermLink> nach {formatSeconds(measured.at(-1) ?? 0)}.
          </p>
          <button
            type="button"
            className="mt-2 inline-flex min-h-12 items-center gap-1 rounded-xl border-2 border-warn-ink px-3 font-bold"
            onClick={() =>
              document.getElementById(faultsId(variant))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }
          >
            Zu den Ursachen
            <ChevronRightIcon className="size-5" />
          </button>
        </div>
      )}

      {watch.state === 'done' && (
        <p className="mt-2 font-semibold" role="status">
          Start durchlaufen: {phases.at(-1)!.label} erreicht.
        </p>
      )}

      {measured.length > 0 && (
        <table className="mt-3 w-full text-base">
          <caption className="sr-only">Gemessene Phasen</caption>
          <thead className="text-left text-sm text-muted">
            <tr>
              <th scope="col" className="font-normal">
                Phase
              </th>
              <th scope="col" className="text-right font-normal">
                gemessen
              </th>
              <th scope="col" className="text-right font-normal">
                Vorgabe
              </th>
            </tr>
          </thead>
          <tbody>
            {measured.map((seconds, index) => {
              const phase = phases[index]!
              const outside = outsideLimit(phase, seconds)
              return (
                <tr key={phase.key} className="border-t border-edge">
                  <th scope="row" className="py-1 text-left font-semibold">
                    <TermLink to={phasePath(phase)}>{phase.label}</TermLink>
                  </th>
                  <td className={`py-1 text-right tabular-nums ${outside ? 'font-bold text-red-700 dark:text-red-400' : ''}`}>
                    {formatSeconds(seconds)}
                    {outside && <span className="block text-xs">{outside === 'over' ? 'über Höchstwert' : 'unter Mindestwert'}</span>}
                  </td>
                  <td className="py-1 text-right text-muted">{expected(phase)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}

      {(watch.state === 'stopped' || watch.state === 'done') && (
        <button type="button" className={`${secondaryButton} mt-3 w-full`} onClick={() => onChange(startStopwatch(performance.now()))}>
          Neu messen
        </button>
      )}
      {measured.length > 0 && (
        <p className="mt-2 text-sm text-muted">
          Von Hand gemessen, Abweichungen um etwa 1 s sind normal. Maßgeblich sind die Zeiten des eingebauten Automaten
          laut Datenblatt.
        </p>
      )}
    </section>
  )
}

/** Ist der übliche Wert bzw. die Grenze der Phase erreicht? */
const phaseOver = (phase: SequencePhase, elapsed: number) => phase.seconds !== undefined && elapsed >= phase.seconds

/**
 * Zeigt, wann die laufende Phase endet: Balken bis zum üblichen Wert bzw. zur Grenze, darunter ein
 * Countdown. Ist die Zeit erreicht, sagt der Hinweis deutlich, worauf jetzt zu achten ist.
 */
export function PhaseEnd({ phase, next, elapsed }: { phase: SequencePhase; next?: SequencePhase; elapsed: number }) {
  const remaining = remainingSeconds(phase, elapsed)
  const cue = next ? `„${next.event}“` : 'den Betrieb'
  if (remaining === undefined) {
    return next ? <p className="mt-2 text-base font-semibold">Weiter tippen, sobald {cue}.</p> : null
  }
  const over = phaseOver(phase, elapsed)
  const share = Math.min(1, elapsed / phase.seconds!)
  const countdown = `${Math.ceil(remaining)} s`
  const message = over
    ? phase.limit === 'max'
      ? `Höchstzeit erreicht: Ohne ${cue} bleibt der Start hier stehen.`
      : `Phase jetzt vorbei: Bei ${cue} weiter tippen.`
    : phase.limit === 'max'
      ? `Noch höchstens ${countdown}, dann muss ${cue} kommen.`
      : phase.limit === 'min'
        ? `Frühestens in ${countdown} endet die Phase.`
        : `Phase endet in etwa ${countdown}.`
  return (
    <div className="mt-2">
      <div className="h-3 overflow-hidden rounded-full bg-raised" aria-hidden="true">
        <div className={`h-full rounded-full ${over ? 'bg-warn' : 'bg-accent'}`} style={{ width: `${share * 100}%` }} />
      </div>
      <p
        className={`mt-2 text-base ${over ? 'rounded-xl bg-warn p-2 font-bold text-warn-ink' : 'font-semibold'}`}
        // Nur das Erreichen ansagen, nicht jede Sekunde des Countdowns
        role={over ? 'status' : undefined}
      >
        {message}
      </p>
    </div>
  )
}

/** Phasen als Leiste in der Stoppuhr, damit der Fortschritt auch ohne Diagramm im Blick bleibt */
function PhaseProgress({ phases, watch }: { phases: SequencePhase[]; watch: Stopwatch }) {
  const active = activePhase(watch) ?? 0
  return (
    <ol className="mt-3 flex gap-1" aria-label="Fortschritt">
      {phases.map((phase, index) => {
        const done = index < active || watch.state === 'done'
        const current = index === active && watch.state !== 'done'
        const style = current
          ? watch.state === 'stopped'
            ? 'bg-warn text-warn-ink'
            : 'bg-accent text-accent-ink animate-pulse'
          : done
            ? 'border-2 border-yellow-500 text-ink'
            : 'bg-raised text-muted'
        return (
          <li
            key={phase.key}
            aria-current={current ? 'step' : undefined}
            className={`min-w-0 flex-1 truncate rounded-md py-1 text-center text-xs font-bold ${style}`}
          >
            <span aria-hidden="true">{phase.abbr}</span>
            <span className="sr-only">
              {phase.label}: {done ? 'erledigt' : current ? (watch.state === 'stopped' ? 'angehalten' : 'läuft') : 'offen'}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

function PhaseDetails({
  variant,
  phase,
  onFault,
}: {
  variant: SequenceVariant
  phase: SequencePhase
  onFault: (symptom: string) => void
}) {
  const faults = variant.faults.filter((fault) => fault.phase === phase.key)
  return (
    <section className="mt-6" aria-live="polite">
      <h3 className="text-lg font-bold">
        <TermLink to={phasePath(phase)}>
          {phase.label} <span className="font-normal text-muted">({phase.abbr})</span>
        </TermLink>
      </h3>
      {phase.duration && <p className="text-base text-muted">Dauer: {keepUnit(phase.duration)}</p>}
      {phase.repeat && (
        <p className="text-base">
          <span className="font-semibold">Wiederholung: </span>
          {phase.repeat.text}
        </p>
      )}
      <p className="mt-1 text-base">
        <span className="font-semibold">Beginn: </span>
        {phase.event}
      </p>
      <div className="mt-2">
        <RichText text={phase.description} />
      </div>
      {phase.check && (
        <div className="mt-2 border-l-4 border-accent pl-3">
          <p className="font-semibold">Prüfen</p>
          <RichText text={phase.check} />
        </div>
      )}
      {faults.length > 0 && (
        <ul className="mt-3 flex flex-wrap gap-2">
          {faults.map((fault) => (
            <li key={fault.symptom}>
              {/* Kein Anker-Link: die App nutzt Hash-Routing; stattdessen aufklappen und hinscrollen */}
              <button
                type="button"
                onClick={() => {
                  onFault(fault.symptom)
                  requestAnimationFrame(() =>
                    document
                      .getElementById(faultId(variant, fault))
                      ?.scrollIntoView({ behavior: 'smooth', block: 'start' }),
                  )
                }}
                className="inline-flex min-h-12 items-center rounded-xl border-2 border-line px-3 text-left font-semibold"
              >
                {fault.symptom}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function FaultFinder({
  variant,
  watch,
  open,
  onToggle,
}: {
  variant: SequenceVariant
  watch: Stopwatch
  open: string | undefined
  onToggle: (symptom: string) => void
}) {
  const headingId = useId()
  const stoppedAt = watch.state === 'stopped' ? variant.phases[watch.phase]!.key : undefined
  return (
    <section id={faultsId(variant)} className="mt-8 scroll-mt-4" aria-labelledby={headingId}>
      <h3 id={headingId} className="text-lg font-bold">
        Fehlersuche: Wo bleibt der Start stehen?
      </h3>
      <ul className="mt-2 space-y-2">
        {faultsByPhase(variant, stoppedAt).map((fault) => {
          const id = faultId(variant, fault)
          const expanded = open === fault.symptom
          const phase = variant.phases.find((candidate) => candidate.key === fault.phase)!
          return (
            <li key={fault.symptom} id={id} className={`${card} scroll-mt-4 overflow-hidden`}>
              <button
                type="button"
                aria-expanded={expanded}
                aria-controls={`${id}-causes`}
                onClick={() => onToggle(fault.symptom)}
                className="flex min-h-14 w-full items-center gap-2 p-3 text-left"
              >
                <ChevronRightIcon className={`size-6 shrink-0 text-accent transition-transform ${expanded ? 'rotate-90' : ''}`} />
                <span className="min-w-0 flex-1 font-semibold">{fault.symptom}</span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-sm font-bold ${
                    fault.phase === stoppedAt ? 'bg-warn text-warn-ink' : 'bg-raised'
                  }`}
                  title={phase.label}
                >
                  {phase.abbr}
                </span>
              </button>
              <div id={`${id}-causes`} hidden={!expanded} className="border-t border-edge p-3">
                <p className="text-sm font-semibold text-muted">Mögliche Ursachen in Prüfreihenfolge</p>
                <ol className="mt-1 list-decimal space-y-1 pl-6">
                  {fault.causes.map((cause) => (
                    <li key={cause}>{cause}</li>
                  ))}
                </ol>
                {fault.note && <p className="mt-2 text-base text-muted">{fault.note}</p>}
              </div>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
