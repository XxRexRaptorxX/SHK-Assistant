import { Fragment, useId, useState } from 'react'
import { secondaryButton } from '../../components/buttons'
import { ClearInputsButton } from '../../components/ClearInputsButton'
import { InfoIcon, ToolsIcon } from '../../components/icons'
import { RichText } from '../../components/RichText'
import { chip, fieldBase } from '../../components/surfaces'
import {
  linkHost,
  NORM_TYPE_KEYS,
  NORM_TYPES,
  normsForTopics,
  type NormFinderTool,
  type NormMatch,
  type NormType,
} from './normFinderTool'

const card = 'mt-4 rounded-2xl border-2 border-line bg-surface p-4'

/** Rang als Stufenleiste: je höher der Rang, desto mehr Stufen sind gefüllt; bindende Ränge in der Akzentfarbe */
function RankBar({ match, levels }: { match: NormMatch; levels: number }) {
  const filled = levels - match.rank
  return (
    <span aria-hidden="true" className="flex items-end gap-0.5">
      {Array.from({ length: levels }, (_, index) => (
        <span
          key={index}
          style={{ height: `${6 + index * 2}px` }}
          className={`w-1 rounded-sm ${
            index >= filled ? 'bg-raised' : match.level.binding ? 'bg-accent' : 'bg-muted'
          }`}
        />
      ))}
    </span>
  )
}

function NormCard({ match, levels, showTopics }: { match: NormMatch; levels: number; showTopics: boolean }) {
  const { norm, topics, level, practicalReasons } = match
  const practical = practicalReasons.length > 0
  const low = norm.lowPractice !== ''
  const frame = practical ? 'border-accent' : low ? 'border-dashed' : ''
  return (
    <article className={practical || low ? `${card} overflow-hidden ${frame} !p-0` : card}>
      {practical && (
        <div className="bg-accent px-4 py-2 text-accent-ink">
          <p className="flex items-center gap-2 font-bold">
            <ToolsIcon className="size-5 shrink-0" aria-hidden="true" />
            Praxistipp
          </p>
          {practicalReasons.map((reason) => (
            <p key={reason} className="mt-1 text-base">
              {reason}
            </p>
          ))}
        </div>
      )}
      {low && (
        <div className="bg-raised px-4 py-2 text-ink">
          <p className="flex items-center gap-2 font-bold">
            <InfoIcon className="size-5 shrink-0" aria-hidden="true" />
            Wenig Praxisbezug
          </p>
          <p className="mt-1 text-base">{norm.lowPractice}</p>
        </div>
      )}
      <div className={practical || low ? 'p-4' : undefined}>
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-muted">
          <RankBar match={match} levels={levels} />
          <span className="sr-only">
            Rechtlicher Rang {match.rank + 1} von {levels}:{' '}
          </span>
          {level.label}
          <span className="font-normal">· {level.binding ? 'bindend' : 'nicht bindend'}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
          <h3 className="text-2xl font-bold">{norm.name}</h3>
          {/* Bei bindenden Rängen sagt der Rang schon, um welche Art es sich handelt */}
          {!level.binding && (
            <span className="rounded-md bg-raised px-2 py-0.5 text-sm font-bold text-ink">{NORM_TYPES[norm.type].label}</span>
          )}
        </div>
        <p className="mt-1 font-semibold">{norm.title}</p>
        <p className="mt-2 text-base">{norm.description}</p>
        {norm.note && (
          <p className="mt-2 text-base">
            <span className="font-semibold">Hinweis:</span> {norm.note}
          </p>
        )}
        {norm.edition && <p className="mt-2 text-sm text-muted">Ausgabe: {norm.edition}</p>}
        {showTopics && (
          <ul className="mt-3 flex flex-wrap gap-2" aria-label="Gehört zu">
            {topics.map((topic) => (
              <li key={topic.key} className={chip}>
                {topic.label}
              </li>
            ))}
          </ul>
        )}
        <a
          href={norm.url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${norm.name} auf ${linkHost(norm.url)} öffnen`}
          className={`${secondaryButton} mt-3 w-full text-center [overflow-wrap:anywhere]`}
        >
          {/* ︎: als Textzeichen, sonst macht Windows daraus ein farbiges Emoji */}
          {linkHost(norm.url)} öffnen <span aria-hidden="true">{'↗︎'}</span>
        </a>
      </div>
    </article>
  )
}

/** Erklärung der Rangfolge, eingeklappt, damit die Ergebnisse oben bleiben */
function LevelLegend({ tool }: { tool: NormFinderTool }) {
  return (
    <details className="mt-3">
      <summary className="min-h-12 cursor-pointer py-3 font-semibold text-accent">Wie wird sortiert?</summary>
      <ol className="list-decimal space-y-2 pl-6">
        {tool.levels.map((level) => (
          <li key={level.key} className="text-base">
            <span className="font-semibold">{level.label}:</span> {level.description}
          </li>
        ))}
      </ol>
      <p className="mt-3 text-base">{tool.levelNote}</p>
    </details>
  )
}

/** Ein Schalter: eingeschaltet trägt er ein Häkchen, damit der Zustand nicht nur an der Farbe hängt */
function ShowToggle({ label, active, onToggle }: { label: string; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onToggle}
      className={`min-h-12 rounded-xl border-2 bg-surface px-3 py-1 text-base font-semibold ${
        active ? 'border-accent text-ink' : 'border-line text-muted'
      }`}
    >
      <span aria-hidden="true">{active ? '✓ ' : ''}</span>
      {label}
    </button>
  )
}

/** Was angezeigt wird: je Art und alles mit wenig Praxisbezug; standardmäßig ist alles an */
function ShowFilter({
  hiddenTypes,
  onToggleType,
  hideLow,
  onToggleLow,
}: {
  hiddenTypes: readonly NormType[]
  onToggleType: (type: NormType) => void
  hideLow: boolean
  onToggleLow: () => void
}) {
  return (
    <>
      <h2 id="norm-show" className="mt-6 text-xl font-bold">
        Anzeigen
      </h2>
      <div role="group" aria-labelledby="norm-show" className="mt-2 flex flex-wrap gap-2">
        {NORM_TYPE_KEYS.map((type) => (
          <ShowToggle
            key={type}
            label={NORM_TYPES[type].filter}
            active={!hiddenTypes.includes(type)}
            onToggle={() => onToggleType(type)}
          />
        ))}
        <ShowToggle label="Wenig Praxisbezug" active={!hideLow} onToggle={onToggleLow} />
      </div>
    </>
  )
}

/** Normen-Tool: Themenbereiche im Menü wählen (auch mehrere), darunter die zuständigen Regelwerke nach rechtlichem Rang */
export function NormFinder({
  tool,
  initialTopics = [],
  initialHiddenTypes = [],
  initialHideLow = false,
}: {
  tool: NormFinderTool
  initialTopics?: string[]
  /** Ausgeblendete Arten (Tests); standardmäßig ist alles an */
  initialHiddenTypes?: NormType[]
  /** Wenig Praxisbezug ausgeblendet (Tests) */
  initialHideLow?: boolean
}) {
  const selectId = useId()
  const [selected, setSelected] = useState<string[]>(initialTopics)
  const [hiddenTypes, setHiddenTypes] = useState<NormType[]>(initialHiddenTypes)
  const [hideLow, setHideLow] = useState(initialHideLow)
  const removeTopic = (key: string) => setSelected((current) => current.filter((value) => value !== key))
  const toggleType = (type: NormType) =>
    setHiddenTypes((current) => (current.includes(type) ? current.filter((value) => value !== type) : [...current, type]))
  const reset = () => {
    setSelected([])
    setHiddenTypes([])
    setHideLow(false)
  }
  const matches = normsForTopics(tool, selected, hiddenTypes, hideLow)

  return (
    <section className="mt-6">
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={selectId} className="text-xl font-bold">
          Themenbereiche
        </label>
        <ClearInputsButton onClear={reset} disabled={selected.length === 0 && hiddenTypes.length === 0 && !hideLow} />
      </div>
      {/* Das Menü fügt Themen hinzu und steht danach wieder auf dem Platzhalter; die Auswahl zeigen die Marken darunter */}
      <select
        id={selectId}
        value=""
        onChange={(event) => setSelected([...selected, event.target.value])}
        className={`${fieldBase} mt-1 w-full`}
      >
        <option value="" disabled>
          {selected.length === 0 ? 'Themenbereich wählen …' : 'Weiteren Themenbereich wählen …'}
        </option>
        {tool.topics
          .filter((topic) => !selected.includes(topic.key))
          .map((topic) => (
            <option key={topic.key} value={topic.key}>
              {topic.note ? `${topic.label} (${topic.note})` : topic.label}
            </option>
          ))}
      </select>
      {selected.length > 0 && (
        <ul aria-label="Gewählte Themenbereiche" className="mt-2 flex flex-wrap gap-2">
          {tool.topics
            .filter((topic) => selected.includes(topic.key))
            .map((topic) => (
              <li key={topic.key}>
                <button
                  type="button"
                  aria-label={`${topic.label} entfernen`}
                  onClick={() => removeTopic(topic.key)}
                  className="min-h-12 rounded-xl border-2 border-accent bg-accent px-3 py-1 font-bold text-accent-ink"
                >
                  {topic.label} <span aria-hidden="true">✕</span>
                </button>
              </li>
            ))}
        </ul>
      )}

      <ShowFilter
        hiddenTypes={hiddenTypes}
        onToggleType={toggleType}
        hideLow={hideLow}
        onToggleLow={() => setHideLow(!hideLow)}
      />

      <div aria-live="polite">
        {selected.length === 0 ? null : matches.length === 0 ? (
          <div className={card}>
            <p className="text-base text-muted">
              {hiddenTypes.length === NORM_TYPE_KEYS.length
                ? 'Alle Arten sind ausgeblendet. Mindestens eine Art einschalten.'
                : 'Mit dieser Auswahl bleibt nichts übrig. Unter „Anzeigen“ mehr einschalten.'}
            </p>
          </div>
        ) : (
          <>
            <LevelLegend tool={tool} />
            {matches.map((match, index) => {
              const previous = matches[index - 1]
              return (
                <Fragment key={match.norm.key}>
                  {previous?.level.binding && !match.level.binding && (
                    <p className="mt-6 border-t-2 border-line pt-3 text-center text-base font-semibold">
                      Ab hier nicht selbst rechtlich bindend
                    </p>
                  )}
                  <NormCard match={match} levels={tool.levels.length} showTopics={selected.length > 1} />
                </Fragment>
              )
            })}
          </>
        )}
      </div>
      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
