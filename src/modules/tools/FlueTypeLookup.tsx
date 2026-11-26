import { useId, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { SelectionBar } from './ChoiceLookup'
import { FlueDiagram } from './FlueDiagram'
import {
  formatType,
  GERMANY_STATUS,
  lookupType,
  narrow,
  suffixesFor,
  type FlueGroup,
  type FlueNote,
  type FlueSuffix,
  type FlueTypeTool,
} from './flueTypeTool'

type Mode = 'situation' | 'type'

/** Gemeinsame Einschränkung in Deutschland, wenn alle Arten sie haben (sonst keine Marke) */
function germanyBadge(groups: readonly FlueGroup[]): string | undefined {
  if (groups.length === 0 || !groups.every((group) => group.germany)) return undefined
  return groups.every((group) => group.germany!.status === 'notPermitted')
    ? GERMANY_STATUS.notPermitted
    : GERMANY_STATUS.exceptionOnly
}

/** Deutlicher Hinweis zur Zulässigkeit in Deutschland */
function GermanyNotice({ group }: { group: FlueGroup }) {
  if (!group.germany) return null
  return (
    <p role="note" className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 text-warn-ink">
      <span className="block font-bold">⚠ {GERMANY_STATUS[group.germany.status]}</span>
      <span className="block">{group.germany.text}</span>
      <span className="block text-sm">({group.germany.source})</span>
    </p>
  )
}

const resultCard = 'mt-4 rounded-2xl border-2 border-accent bg-surface p-4'

/** Große Auswahlknöpfe untereinander, für lange Beschriftungen und Bedienung mit Handschuhen */
function OptionList({
  name,
  options,
  selected,
  onSelect,
}: {
  name: string
  /** badge: Warnmarke, z. B. „In Deutschland nicht zulässig“ */
  options: { key: string; label: string; note?: string; badge?: string }[]
  selected: string | undefined
  onSelect: (key: string) => void
}) {
  return (
    <div className="mt-6">
      <p className="font-semibold">{name}</p>
      <div role="group" aria-label={name} className="mt-1 grid gap-2">
        {options.map((option) => {
          const active = option.key === selected
          return (
            <button
              key={option.key}
              type="button"
              aria-pressed={active}
              onClick={() => onSelect(option.key)}
              className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left leading-tight ${
                active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
              }`}
            >
              <span className="block text-base font-bold">{option.label}</span>
              {option.note && <span className={`block text-sm ${active ? '' : 'text-muted'}`}>{option.note}</span>}
              {option.badge && (
                <span className="mt-1 inline-block rounded-md border-2 border-warn-ink bg-warn px-1.5 text-sm font-bold text-warn-ink">
                  ⚠ {option.badge}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function NoteList({ title, notes }: { title: string; notes: FlueNote[] }) {
  if (notes.length === 0) return null
  return (
    <>
      <h4 className="mt-4 text-lg font-bold">{title}</h4>
      <ul className="mt-1 list-disc space-y-2 pl-5">
        {notes.map((note, index) => (
          <li key={index} className="text-base">
            {note.text} <span className="text-sm text-muted">({note.source})</span>
          </li>
        ))}
      </ul>
    </>
  )
}

/** Ergebnis: Art mit Merkmalen, Gebläse, Zusätzen und Einbaukriterien */
export function TypeResult({
  tool,
  group,
  digit,
  suffixes,
  messages = [],
}: {
  tool: FlueTypeTool
  group: FlueGroup
  digit: string | undefined
  suffixes: FlueSuffix[]
  /** Warnungen zur Eingabe, z. B. ein nicht belegter Zusatz */
  messages?: string[]
}) {
  const criteria = tool.questions.flatMap((question) => {
    const option = question.options.find((candidate) => candidate.key === group.criteria[question.key])
    return option ? [{ question, option }] : []
  })
  const fan = digit ? tool.fanDigits.find((candidate) => candidate.digit === digit) : undefined
  const fanNote = digit ? group.fans.find((candidate) => candidate.digit === digit)?.note : undefined
  const missing = digit
    ? suffixesFor(tool, group, digit).filter((suffix) => suffix.missingNote && !suffixes.includes(suffix))
    : []
  const installNotes = [
    ...criteria.flatMap(({ option }) => option.notes),
    ...group.notes,
    ...missing.map((suffix) => suffix.missingNote!),
    ...tool.generalNotes,
  ]
  return (
    <article className={resultCard} aria-label="Ergebnis">
      <p className="text-sm font-semibold text-muted">Art</p>
      <h3 className="text-4xl font-bold">{formatType(group, digit, suffixes)}</h3>
      <p className="mt-1 text-lg font-semibold">{group.name}</p>
      <GermanyNotice group={group} />
      {messages.map((message) => (
        <p key={message} role="note" className="mt-3 rounded-xl border-2 border-warn-ink bg-warn p-3 font-semibold text-warn-ink">
          {message}
        </p>
      ))}
      <p className="mt-3 text-base">{group.description}</p>
      <FlueDiagram
        code={group.code}
        digit={digit}
        title={formatType(group, digit, suffixes)}
        vent={criteria.find(({ option }) => option.vent)?.option.vent}
      />

      <h4 className="mt-4 text-lg font-bold">Merkmale</h4>
      <dl className="mt-1 space-y-2">
        {criteria.map(({ question, option }) => (
          <div key={question.key}>
            <dt className="text-sm text-muted">{question.label}</dt>
            <dd className="text-base font-semibold">
              {option.label}
              {option.note && <span className="block text-sm font-normal">{option.note}</span>}
            </dd>
          </div>
        ))}
        <div>
          <dt className="text-sm text-muted">Gebläse (letzte Ziffer)</dt>
          <dd className="text-base font-semibold">
            {fan ? (
              <>
                {fan.digit} = {fan.label}
                {fan.note && <span className="block text-sm font-normal">{fan.note}</span>}
                {fanNote && <span className="block text-sm font-normal">{fanNote}</span>}
              </>
            ) : (
              <>Möglich: {group.fans.map((candidate) => `${group.code}${candidate.digit}`).join(', ')}</>
            )}
          </dd>
        </div>
        {suffixes.map((suffix) => (
          <div key={suffix.key}>
            <dt className="text-sm text-muted">Zusatz {suffix.key}</dt>
            <dd className="text-base font-semibold">
              {suffix.label}
              <span className="block text-sm font-normal">
                {suffix.text} <span className="text-muted">({suffix.source})</span>
              </span>
            </dd>
          </div>
        ))}
      </dl>

      <NoteList title="Einbaukriterien und Hinweise" notes={installNotes} />
      <p className="mt-3 text-sm text-muted">Definition: {group.source}</p>
    </article>
  )
}

/** Einbausituation antippen, Schritt für Schritt bis zur Art */
function SituationFinder({ tool }: { tool: FlueTypeTool }) {
  const [answers, setAnswers] = useState<Record<string, string>>({})
  const [digit, setDigit] = useState<string>()
  const [chosen, setChosen] = useState<string[]>([])
  const { steps, candidates } = narrow(tool, answers)
  const group = steps.every((step) => step.selected) && candidates.length === 1 ? candidates[0] : undefined

  const answer = (questionKey: string, optionKey: string) => {
    // Spätere Antworten verwerfen: sie passen sonst womöglich nicht mehr
    const index = tool.questions.findIndex((question) => question.key === questionKey)
    const kept = Object.fromEntries(
      Object.entries(answers).filter(([key]) => tool.questions.findIndex((question) => question.key === key) < index),
    )
    setAnswers({ ...kept, [questionKey]: optionKey })
    setDigit(undefined)
    setChosen([])
  }

  const fans = group?.fans ?? []
  const fanDigit = fans.length === 1 ? fans[0]!.digit : fans.find((fan) => fan.digit === digit)?.digit
  const available = group && fanDigit ? suffixesFor(tool, group, fanDigit) : []
  const suffixes = available.filter((suffix) => chosen.includes(suffix.key))

  return (
    <>
      {steps.map((step, index) => (
        <OptionList
          key={step.question.key}
          name={step.question.label}
          options={step.options.map((option) => ({
            ...option,
            badge: germanyBadge(
              tool.groups.filter(
                (candidate) =>
                  candidate.criteria[step.question.key] === option.key &&
                  steps.slice(0, index).every((earlier) => candidate.criteria[earlier.question.key] === earlier.selected),
              ),
            ),
          }))}
          selected={step.selected}
          onSelect={(key) => answer(step.question.key, key)}
        />
      ))}
      {group && fans.length > 1 && (
        <OptionList
          name="Gebläse"
          options={fans.map((fan) => {
            const label = tool.fanDigits.find((candidate) => candidate.digit === fan.digit)!
            return { key: fan.digit, label: `${label.label} (${group.code}${fan.digit})`, note: label.note }
          })}
          selected={fanDigit}
          onSelect={(key) => {
            setDigit(key)
            setChosen([])
          }}
        />
      )}
      {available.length > 0 && (
        <div className="mt-6">
          <p className="font-semibold">Zusätze laut Typenschild (optional)</p>
          <div role="group" aria-label="Zusätze" className="mt-1 grid gap-2">
            {available.map((suffix) => {
              const active = chosen.includes(suffix.key)
              return (
                <button
                  key={suffix.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() =>
                    setChosen(active ? chosen.filter((key) => key !== suffix.key) : [...chosen, suffix.key])
                  }
                  className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left leading-tight ${
                    active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface'
                  }`}
                >
                  <span className="block text-base font-bold">
                    {active ? '☑' : '☐'} {suffix.key}: {suffix.label}
                  </span>
                  <span className={`block text-sm ${active ? '' : 'text-muted'}`}>{suffix.text}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
      <div aria-live="polite">
        {group && fanDigit ? (
          <TypeResult tool={tool} group={group} digit={fanDigit} suffixes={suffixes} />
        ) : (
          <div className={resultCard}>
            <p className="text-base text-muted">{group ? 'Gebläse wählen.' : 'Einbausituation wählen.'}</p>
          </div>
        )}
      </div>
    </>
  )
}

/** Art eingeben und ihre Einbaukriterien sehen */
function TypeSearch({ tool, initialQuery = '' }: { tool: FlueTypeTool; initialQuery?: string }) {
  const id = useId()
  const [query, setQuery] = useState(initialQuery)
  const result = query.trim() ? lookupType(tool, query) : undefined
  return (
    <>
      <label htmlFor={id} className="mt-6 block font-semibold">
        Art
      </label>
      <input
        id={id}
        type="text"
        inputMode="text"
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder="z. B. C33x, C(10)3, B11BS"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        className={`${fieldBase} mt-1 w-full`}
      />
      <div aria-live="polite">
        {!result ? (
          <div className={resultCard}>
            <p className="text-base text-muted">Art eingeben oder unten antippen.</p>
          </div>
        ) : result.group && result.errors.length === 0 ? (
          <TypeResult tool={tool} group={result.group} digit={result.digit} suffixes={result.suffixes} messages={result.warnings} />
        ) : (
          <div className={resultCard}>
            {result.errors.map((error) => (
              <p key={error} role="alert" className="text-base font-semibold">
                {error}
              </p>
            ))}
          </div>
        )}
      </div>
      <h3 className="mt-6 font-semibold">Alle Arten</h3>
      {(['A', 'B', 'C'] as const).map((letter) => (
        <div key={letter} className="mt-2 flex flex-wrap gap-2">
          {tool.groups
            .filter((group) => group.code.startsWith(letter))
            .flatMap((group) => group.fans.map((fan) => ({ code: `${group.code}${fan.digit}`, germany: group.germany })))
            .map(({ code, germany }) => (
              <button
                key={code}
                type="button"
                onClick={() => setQuery(code)}
                title={germany ? GERMANY_STATUS[germany.status] : undefined}
                aria-label={germany ? `${code}, ${GERMANY_STATUS[germany.status]}` : undefined}
                className={`min-h-11 min-w-14 rounded-lg border-2 px-2 text-base font-bold ${
                  germany ? 'border-warn-ink bg-warn text-warn-ink' : 'border-line bg-surface'
                }`}
              >
                {code}
                {germany && ' ⚠'}
              </button>
            ))}
        </div>
      ))}
    </>
  )
}

/** Abgas-Arten-Tool: Einbausituation → Art oder Art → Einbaukriterien */
export function FlueTypeLookup({
  tool,
  initialMode = 'situation',
  initialQuery,
}: {
  tool: FlueTypeTool
  /** Vorauswahl (Tests) */
  initialMode?: Mode
  initialQuery?: string
}) {
  const [mode, setMode] = useState<Mode>(initialMode)
  return (
    <section>
      <SelectionBar
        bar={{
          key: 'mode',
          name: 'Suchen nach',
          options: [
            { key: 'situation', label: 'Einbausituation', note: '→ Art' },
            { key: 'type', label: 'Art', note: '→ Einbaukriterien' },
          ],
        }}
        selected={mode}
        onSelect={(key) => setMode(key as Mode)}
      />
      {mode === 'situation' ? <SituationFinder tool={tool} /> : <TypeSearch tool={tool} initialQuery={initialQuery} />}
    </section>
  )
}
