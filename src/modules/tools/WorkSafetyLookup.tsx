import { useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { RichText } from '../../components/RichText'
import { listCard } from '../../components/surfaces'
import type { ToolEntry } from './schema'
import { toolEntries, toolPath } from './tools'
import {
  checklist,
  combinedPpe,
  conditionLabel,
  refText,
  selectedActivities,
  visibleRules,
  WORK_RULE_LEVELS,
  WORK_TOPICS,
  type VisibleRule,
  type WorkActivity,
  type WorkAnswers,
  type WorkBasicRule,
  type WorkRuleLevel,
  type WorkSafetyTool,
  type WorkTopic,
} from './workSafetyTool'

const LEVEL_STYLES: Record<WorkRuleLevel, string> = {
  forbidden: 'bg-warn text-warn-ink border-2 border-warn-ink',
  required: 'bg-accent text-accent-ink',
  recommended: 'border-2 border-accent bg-surface text-ink',
  exception: 'border-2 border-line bg-raised text-ink',
  note: 'border-2 border-line bg-surface text-ink',
}

/** Themen in der Karte einer Tätigkeit; „before“ steht in der Prüfliste */
const CARD_TOPICS = (Object.keys(WORK_TOPICS) as WorkTopic[]).filter((topic) => topic !== 'before')

function LevelBadge({ level }: { level: WorkRuleLevel }) {
  return <span className={`rounded-md px-2 py-0.5 text-sm font-bold ${LEVEL_STYLES[level]}`}>{WORK_RULE_LEVELS[level].label}</span>
}

/** „Gilt bei …“, solange eine Frage zur Vorgabe offen ist */
function OpenCondition({ activity, when }: { activity: WorkActivity; when: VisibleRule['rule']['when'] }) {
  return <span className="mt-1 block text-sm font-semibold">Gilt bei: {conditionLabel(activity, when)}</span>
}

function RuleItem({ level, text, sourceText, children }: {
  level: WorkRuleLevel
  text: string
  sourceText: string
  /** Zusatz unter dem Etikett, z. B. „Gilt bei …“ */
  children?: ReactNode
}) {
  return (
    <li className="rounded-xl border-2 border-line bg-surface p-3">
      <LevelBadge level={level} />
      {children}
      <div className="mt-1 text-base">
        <RichText text={text} />
      </div>
      <p className="mt-1 text-sm text-muted">Quelle: {sourceText}</p>
    </li>
  )
}

function ActivityRules({ tool, activity, rules }: { tool: WorkSafetyTool; activity: WorkActivity; rules: VisibleRule[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {rules.map(({ rule, open }) => (
        <RuleItem key={`${rule.topic}-${rule.text}`} level={rule.level} text={rule.text} sourceText={refText(tool, rule.ref)}>
          {open && <OpenCondition activity={activity} when={rule.when} />}
        </RuleItem>
      ))}
    </ul>
  )
}

function BasicRules({ tool, rules }: { tool: WorkSafetyTool; rules: readonly WorkBasicRule[] }) {
  return (
    <ul className="mt-2 space-y-2">
      {rules.map((rule) => (
        <RuleItem key={rule.text} level={rule.level} text={rule.text} sourceText={refText(tool, rule.ref)} />
      ))}
    </ul>
  )
}

/** Eine Tätigkeit, aufklappbar: Gefährdungen, Vorgaben nach Thema, passende Tools */
function ActivityCard({
  tool,
  activity,
  answers,
  open,
  entries,
}: {
  tool: WorkSafetyTool
  activity: WorkActivity
  answers: Readonly<Record<string, string>>
  open: boolean
  entries: readonly ToolEntry[]
}) {
  const links = activity.related.flatMap((id) => entries.find((entry) => entry.id === id) ?? [])
  return (
    <details open={open} className="rounded-2xl border-2 border-line bg-surface px-4">
      <summary className="min-h-14 cursor-pointer py-3">
        <span className="text-lg font-bold">{activity.label}</span>
        {activity.todo && (
          <span className="ml-2 rounded-md border-2 border-warn-ink bg-warn px-2 text-sm font-bold text-warn-ink">unvollständig</span>
        )}
        {activity.note && <span className="block text-base text-muted">{activity.note}</span>}
      </summary>
      <div className="pb-4">
        {activity.todo && <p className="rounded-xl border-2 border-warn-ink bg-warn p-3 text-base font-semibold text-warn-ink">{activity.todo}</p>}
        {activity.hazards.length > 0 && (
          <>
            <h4 className="mt-3 font-bold">Gefährdungen</h4>
            <ul className="mt-1 space-y-2">
              {activity.hazards.map((hazard) => (
                <li key={hazard.text} className="text-base">
                  <span aria-hidden="true">⚠ </span>
                  {hazard.text}
                  <span className="block text-sm text-muted">Quelle: {refText(tool, hazard.ref)}</span>
                </li>
              ))}
            </ul>
          </>
        )}
        {CARD_TOPICS.map((topic) => {
          const rules = visibleRules(activity, topic, answers)
          if (rules.length === 0) return null
          return (
            <section key={topic}>
              <h4 className="mt-4 font-bold">{WORK_TOPICS[topic].label}</h4>
              <ActivityRules tool={tool} activity={activity} rules={rules} />
            </section>
          )
        })}
        {visibleRules(activity, 'before', answers).length > 0 && (
          <p className="mt-4 text-sm text-muted">Was vor Arbeitsbeginn zu tun ist, steht in der Prüfliste oben.</p>
        )}
        {links.length > 0 && (
          <>
            <h4 className="mt-4 font-bold">Mehr dazu</h4>
            <ul className="mt-1 space-y-1">
              {links.map((entry) => (
                <li key={entry.id}>
                  <Link to={toolPath(entry.id)} className="inline-flex min-h-12 items-center font-semibold underline">
                    {entry.title}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </details>
  )
}

/** Eine Frage: Offen und die Optionen als Knöpfe nebeneinander */
function QuestionButtons({
  activity,
  question,
  answer,
  onAnswer,
}: {
  activity: WorkActivity
  question: WorkActivity['questions'][number]
  answer: string | undefined
  onAnswer: (value: string | undefined) => void
}) {
  const choices = [{ key: undefined, label: 'Offen' }, ...question.options]
  return (
    <fieldset className="mt-4">
      <legend className="font-semibold">
        {question.text}
        <span className="block text-sm font-normal text-muted">{activity.label}</span>
      </legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {choices.map((choice) => {
          const active = choice.key === answer
          return (
            <button
              key={choice.key ?? ''}
              type="button"
              aria-pressed={active}
              onClick={() => onAnswer(choice.key)}
              className={`min-h-12 rounded-xl border-2 px-4 py-2 text-left font-semibold ${
                active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
              }`}
            >
              <span aria-hidden="true">{active ? '✓ ' : ''}</span>
              {choice.label}
            </button>
          )
        })}
      </div>
      {question.note && <p className="mt-1 text-sm text-muted">{question.note}</p>}
    </fieldset>
  )
}

/** UVV-Helfer: Tätigkeiten wählen, Fragen beantworten; Schutzausrüstung, Prüfliste und Vorgaben je Tätigkeit */
export function WorkSafetyLookup({
  tool,
  entries = toolEntries,
  initialActivities = [],
  initialAnswers = {},
}: {
  tool: WorkSafetyTool
  /** Für Tests überschreibbar */
  entries?: readonly ToolEntry[]
  /** Vorauswahlen (Tests) */
  initialActivities?: string[]
  initialAnswers?: WorkAnswers
}) {
  const [selected, setSelected] = useState<string[]>(initialActivities)
  const [answers, setAnswers] = useState<WorkAnswers>(initialAnswers)
  const [checked, setChecked] = useState<ReadonlySet<string>>(new Set())

  const activities = selectedActivities(tool, selected)
  const ppe = combinedPpe(tool, activities, answers)
  const items = checklist(activities, answers)
  const done = items.filter((item) => checked.has(item.id)).length
  const withQuestions = activities.filter((activity) => activity.questions.length > 0)

  const toggle = (activityKey: string) =>
    setSelected((current) => (current.includes(activityKey) ? current.filter((value) => value !== activityKey) : [...current, activityKey]))
  const answer = (activityKey: string, questionKey: string, value: string | undefined) =>
    setAnswers((current) => {
      const next = { ...(current[activityKey] ?? {}) }
      if (value === undefined) delete next[questionKey]
      else next[questionKey] = value
      return { ...current, [activityKey]: next }
    })
  const check = (id: string, value: boolean) =>
    setChecked((current) => {
      const next = new Set(current)
      if (value) next.add(id)
      else next.delete(id)
      return next
    })
  const sameSelection = (keys: readonly string[]) => keys.length === selected.length && keys.every((value) => selected.includes(value))

  return (
    <section>
      {tool.jobs.length > 0 && (
        <>
          <h2 className="mt-6 text-xl font-bold">Typischer Auftrag</h2>
          <div role="group" aria-label="Typischer Auftrag" className="mt-2 flex flex-wrap gap-2">
            {tool.jobs.map((job) => {
              const active = sameSelection(job.activities)
              return (
                <button
                  key={job.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelected([...job.activities])}
                  className={`min-h-12 rounded-full border-2 px-4 py-2 font-semibold ${
                    active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
                  }`}
                >
                  <span aria-hidden="true">{active ? '✓ ' : ''}</span>
                  {job.label}
                </button>
              )
            })}
          </div>
          {tool.jobsNote && <p className="mt-2 text-sm text-muted">{tool.jobsNote}</p>}
        </>
      )}

      <h2 className="mt-6 text-xl font-bold">Welche Arbeiten stehen an?</h2>
      {tool.groups.map((group) => (
        <div key={group.key} className="mt-3">
          <h3 className="font-bold">{group.label}</h3>
          <div role="group" aria-label={group.label} className="mt-2 grid gap-2 sm:grid-cols-2">
            {tool.activities
              .filter((activity) => activity.group === group.key)
              .map((activity) => {
                const active = selected.includes(activity.key)
                return (
                  <button
                    key={activity.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => toggle(activity.key)}
                    className={`min-h-14 rounded-xl border-2 px-3 py-2 text-left ${
                      active ? 'border-accent bg-accent text-accent-ink' : 'border-line bg-surface text-ink'
                    }`}
                  >
                    <span className="block font-semibold">
                      {/* Häkchen, damit der Zustand nicht nur an der Farbe hängt */}
                      <span aria-hidden="true">{active ? '✓ ' : ''}</span>
                      {activity.label}
                    </span>
                    {activity.note && <span className={`block text-sm ${active ? '' : 'text-muted'}`}>{activity.note}</span>}
                  </button>
                )
              })}
          </div>
        </div>
      ))}
      {selected.length > 0 && (
        <button
          type="button"
          onClick={() => {
            setSelected([])
            setAnswers({})
            setChecked(new Set())
          }}
          className="mt-3 min-h-12 rounded-xl border-2 border-line bg-surface px-4 font-semibold"
        >
          Auswahl löschen
        </button>
      )}

      <div aria-live="polite">
        {activities.length === 0 ? (
          <p className="mt-6 text-base text-muted">Arbeiten wählen – mehrere sind möglich.</p>
        ) : (
          <>
            {withQuestions.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Angaben zur Arbeit</h2>
                <p className="text-base text-muted">Solange eine Frage offen ist, stehen die betroffenen Vorgaben mit „Gilt bei …“ da.</p>
                {withQuestions.flatMap((activity) =>
                  activity.questions.map((question) => (
                    <QuestionButtons
                      key={`${activity.key}-${question.key}`}
                      activity={activity}
                      question={question}
                      answer={answers[activity.key]?.[question.key]}
                      onAnswer={(value) => answer(activity.key, question.key, value)}
                    />
                  )),
                )}
              </section>
            )}

            {ppe.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Schutzausrüstung</h2>
                <ul className={`mt-2 ${listCard}`}>
                  {ppe.map(({ item, uses }) => (
                    <li key={item.key} className="px-4 py-3">
                      <span className="block text-lg font-bold">{item.label}</span>
                      <ul className="mt-1 space-y-1">
                        {uses.map(({ activity, ppe: use, open }) => (
                          <li key={`${activity.key}-${use.text}`} className="text-base">
                            <span className="font-semibold">{activity.label}:</span> {use.text}
                            {open && <OpenCondition activity={activity} when={use.when} />}
                            <span className="block text-sm text-muted">Quelle: {refText(tool, use.ref)}</span>
                          </li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {items.length > 0 && (
              <section className="mt-8">
                <h2 className="text-xl font-bold">Vor Arbeitsbeginn prüfen</h2>
                <p className="text-base">
                  {done} von {items.length} erledigt
                </p>
                <ul className={`mt-2 ${listCard}`}>
                  {items.map((item) => {
                    const isDone = checked.has(item.id)
                    return (
                      <li key={item.id}>
                        <label className="flex min-h-14 cursor-pointer items-start gap-3 px-4 py-3">
                          <input
                            type="checkbox"
                            className="check mt-0.5"
                            checked={isDone}
                            onChange={(event) => check(item.id, event.target.checked)}
                          />
                          <span>
                            <LevelBadge level={item.rule.level} />
                            <span className={`mt-1 block text-base ${isDone ? 'done-text' : ''}`}>{item.rule.text}</span>
                            {item.open && <OpenCondition activity={item.activity} when={item.rule.when} />}
                            <span className="block text-sm text-muted">
                              {item.activity.label} · Quelle: {refText(tool, item.rule.ref)}
                            </span>
                          </span>
                        </label>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )}

            <section className="mt-8">
              <h2 className="text-xl font-bold">Vorgaben je Tätigkeit</h2>
              <div className="mt-2 space-y-3">
                {activities.map((activity) => (
                  <ActivityCard
                    key={activity.key}
                    tool={tool}
                    activity={activity}
                    answers={answers[activity.key] ?? {}}
                    open={activities.length === 1}
                    entries={entries}
                  />
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      {tool.basics.length > 0 && (
        <details className="mt-8 rounded-2xl border-2 border-line bg-surface px-4">
          <summary className="min-h-14 cursor-pointer py-3">
            <span className="text-lg font-bold">Grundpflichten im Betrieb</span>
            <span className="block text-base text-muted">Gelten unabhängig von der Tätigkeit</span>
          </summary>
          <div className="pb-4">
            {tool.basics.map((section) => (
              <section key={section.key}>
                <h3 className="mt-4 font-bold">{section.label}</h3>
                <BasicRules tool={tool} rules={section.rules} />
              </section>
            ))}
          </div>
        </details>
      )}

      <div className="mt-8 text-base">
        <RichText text={tool.closingNote} />
      </div>
    </section>
  )
}
