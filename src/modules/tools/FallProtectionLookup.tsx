import { useId, useState } from 'react'
import { RichText } from '../../components/RichText'
import { fieldBase } from '../../components/surfaces'
import { parseDecimal } from '../../lib/number'
import {
  bandFor,
  FALL_RULE_LEVELS,
  measuresByRank,
  needsHeight,
  refText,
  sortRules,
  type FallBand,
  type FallBandTone,
  type FallMeasure,
  type FallProtectionTool,
  type FallRule,
} from './fallProtectionTool'

const TONE_STYLES: Record<FallBandTone, string> = {
  required: 'border-warn-ink bg-warn text-warn-ink',
  limited: 'border-warn-ink bg-warn text-warn-ink',
  forbidden: 'border-warn-ink bg-warn text-warn-ink',
  ok: 'border-accent bg-surface',
}

const LEVEL_STYLES: Record<FallRule['level'], string> = {
  forbidden: 'bg-warn text-warn-ink border-2 border-warn-ink',
  required: 'bg-accent text-accent-ink',
  exception: 'border-2 border-line bg-raised text-ink',
  note: 'border-2 border-line bg-surface text-ink',
}

function RuleList({ tool, rules }: { tool: FallProtectionTool; rules: readonly FallRule[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {sortRules(rules).map((rule) => (
        <li key={`${rule.level}-${rule.text}`} className="rounded-xl border-2 border-line bg-surface p-3">
          <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${LEVEL_STYLES[rule.level]}`}>
            {FALL_RULE_LEVELS[rule.level].label}
          </span>
          <div className="mt-1 text-base">
            <RichText text={rule.text} />
          </div>
          <p className="mt-1 text-sm text-muted">Quelle: {refText(tool, rule.ref)}</p>
        </li>
      ))}
    </ul>
  )
}

function BandCard({ tool, band }: { tool: FallProtectionTool; band: FallBand }) {
  const warn = band.tone !== 'ok'
  return (
    <div className={`mt-6 rounded-2xl border-2 p-4 ${TONE_STYLES[band.tone]}`}>
      <p className="text-2xl font-bold">
        <span aria-hidden="true">{warn ? '⚠ ' : '✓ '}</span>
        {band.label}
      </p>
      {band.text && <p className="mt-1 text-base">{band.text}</p>}
      <p className={`mt-2 text-sm ${warn ? '' : 'text-muted'}`}>Quelle: {refText(tool, band.ref)}</p>
    </div>
  )
}

/** Eine Schutzmaßnahme, aufklappbar: Maße und Vorgaben zum Aufbau */
function MeasureCard({ tool, measure, open }: { tool: FallProtectionTool; measure: FallMeasure; open: boolean }) {
  return (
    <details open={open} className="rounded-2xl border-2 border-line bg-surface px-4">
      <summary className="min-h-14 cursor-pointer py-3">
        <span className="text-lg font-bold">{measure.label}</span>
        {measure.todo && <span className="ml-2 rounded-md border-2 border-warn-ink bg-warn px-2 text-sm font-bold text-warn-ink">unvollständig</span>}
        <span className="block text-base text-muted">{measure.summary}</span>
      </summary>
      <div className="pb-4">
        {measure.todo && <p className="rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink">{measure.todo}</p>}
        {measure.specs.length > 0 && (
          <>
            <h4 className="mt-3 font-bold">Maße und Kennwerte</h4>
            <dl className="mt-1 divide-y-2 divide-line">
              {measure.specs.map((spec) => (
                <div key={spec.label} className="py-2">
                  <dt className="text-base">{spec.label}</dt>
                  <dd className="text-lg font-bold">{spec.value}</dd>
                  {spec.note && <dd className="text-sm">{spec.note}</dd>}
                  <dd className="text-sm text-muted">Quelle: {refText(tool, spec.ref)}</dd>
                </div>
              ))}
            </dl>
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

/** Absturzsicherung: Arbeitsplatz wählen, Höhe eingeben, Ergebnis und Schutzmaßnahmen in der Rangfolge */
export function FallProtectionLookup({
  tool,
  initialSituation = '',
  initialHeight = '',
}: {
  tool: FallProtectionTool
  /** Vorauswahlen (Tests) */
  initialSituation?: string
  initialHeight?: string
}) {
  const idPrefix = useId()
  const [situationKey, setSituationKey] = useState(initialSituation)
  const [height, setHeight] = useState(initialHeight)
  const situation = tool.situations.find((candidate) => candidate.key === situationKey)

  const parsed = height.trim() === '' ? undefined : parseDecimal(height)
  const heightError = height.trim() !== '' && (parsed === undefined || parsed < 0) ? 'Zahl ab 0 eingeben' : undefined
  const heightValue = parsed !== undefined && parsed >= 0 ? parsed : undefined
  const askHeight = situation ? needsHeight(situation) : false
  const band = situation ? bandFor(situation, heightValue) : undefined
  const groups = situation ? measuresByRank(tool, situation) : []
  // Gibt es nur eine Maßnahme, ist sie gleich aufgeklappt
  const single = groups.length === 1 && groups[0]!.measures.length === 1

  return (
    <section>
      <h2 className="mt-6 text-xl font-bold">Wo wird gearbeitet?</h2>
      <div role="group" aria-label="Arbeitsplatz" className="mt-2 grid gap-2 sm:grid-cols-2">
        {tool.situations.map((candidate) => {
          const active = candidate.key === situationKey
          return (
            <button
              key={candidate.key}
              type="button"
              aria-pressed={active}
              onClick={() => setSituationKey(candidate.key)}
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

      {situation && askHeight && (
        <div className="mt-6">
          <label htmlFor={`${idPrefix}-height`} className="block font-semibold">
            {situation.heightLabel}
          </label>
          <div className="mt-1 flex items-center gap-2">
            <input
              id={`${idPrefix}-height`}
              type="text"
              inputMode="decimal"
              autoComplete="off"
              value={height}
              aria-invalid={heightError !== undefined}
              aria-describedby={situation.heightHint ? `${idPrefix}-hint` : undefined}
              onChange={(event) => setHeight(event.target.value)}
              className={`${fieldBase} w-36 ${heightError ? 'border-warn-ink outline-2 outline-warn' : ''}`}
            />
            <span className="text-lg">m</span>
          </div>
          {heightError && <p className="mt-1 text-base font-semibold">{heightError}</p>}
          {situation.heightHint && (
            <p id={`${idPrefix}-hint`} className="mt-2 text-sm text-muted">
              {situation.heightHint}
            </p>
          )}
        </div>
      )}

      <div aria-live="polite">
        {!situation ? (
          <p className="mt-6 text-base text-muted">Arbeitsplatz wählen.</p>
        ) : (
          <>
            {band ? (
              <BandCard tool={tool} band={band} />
            ) : (
              <p className="mt-4 text-base text-muted">{situation.heightLabel} eingeben.</p>
            )}
            {situation.rules.length > 0 && (
              <section className="mt-6">
                <h3 className="text-lg font-bold">Vorgaben für diesen Arbeitsplatz</h3>
                <RuleList tool={tool} rules={situation.rules} />
              </section>
            )}
            {groups.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Schutzmaßnahmen in dieser Rangfolge</h2>
                {groups.map(({ rank, measures }) => (
                  <section key={rank.key} className="mt-4">
                    <h3 className="text-lg font-bold">{rank.label}</h3>
                    <p className="text-base">{rank.text}</p>
                    <p className="text-sm text-muted">Quelle: {refText(tool, rank.ref)}</p>
                    <div className="mt-2 space-y-3">
                      {measures.map((measure) => (
                        <MeasureCard key={measure.key} tool={tool} measure={measure} open={single} />
                      ))}
                    </div>
                  </section>
                ))}
              </section>
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
