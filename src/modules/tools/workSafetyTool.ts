import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'

// Arbeitsschutz-Tools ("kind": "workSafety"): Tätigkeiten wählen (mehrere, z. B. Löten, Arbeiten an Gasleitungen, Einstieg
// in Schächte) oder einen typischen Auftrag als Vorauswahl. Das Tool sammelt die Schutzausrüstung, eine Prüfliste vor
// Arbeitsbeginn zum Abhaken und je Tätigkeit die Vorgaben nach Thema (Erlaubnis, bei/nach der Arbeit, Prüfungen,
// Vorsorge). Fragen je Tätigkeit (z. B. „Brandgefahr im Umfeld?“) blenden Vorgaben ein oder aus; solange eine Frage offen
// ist, erscheint die Vorgabe mit „Gilt bei …“. Alle Texte, Fundstellen und Bedingungen stehen im Inhalt, nicht im Code.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)

/** Fundstelle: Quelle (key) und Stelle darin, z. B. „Abschn. 3.8.3“ oder „§ 11a Abs. 4“ */
const refSchema = z.strictObject({
  source: key,
  where: text,
})

/** Wortwahl der Quelle (nicht der Rechtsrang); Reihenfolge = Reihenfolge der Legende */
export const WORK_RULE_LEVELS = {
  forbidden: { label: 'Verboten' },
  required: { label: 'Pflicht' },
  recommended: { label: 'Empfehlung' },
  exception: { label: 'Ausnahme' },
  note: { label: 'Hinweis' },
} as const

export type WorkRuleLevel = keyof typeof WORK_RULE_LEVELS
const LEVEL_KEYS = Object.keys(WORK_RULE_LEVELS) as [WorkRuleLevel, ...WorkRuleLevel[]]

/**
 * Themen einer Tätigkeit in Anzeigereihenfolge. „before“ landet in der gemeinsamen Prüfliste zum Abhaken,
 * die übrigen Themen stehen in der Karte der Tätigkeit.
 */
export const WORK_TOPICS = {
  info: { label: 'Einordnung' },
  permit: { label: 'Erlaubnis und Qualifikation' },
  before: { label: 'Vor Arbeitsbeginn' },
  during: { label: 'Bei der Arbeit' },
  after: { label: 'Nach der Arbeit' },
  inspection: { label: 'Prüfungen der Arbeitsmittel' },
  health: { label: 'Arbeitsmedizinische Vorsorge' },
} as const

export type WorkTopic = keyof typeof WORK_TOPICS
const TOPIC_KEYS = Object.keys(WORK_TOPICS) as [WorkTopic, ...WorkTopic[]]

/** Bedingung: Die Antwort auf die Frage (key der Tätigkeit) ist eine dieser Optionen */
const conditionSchema = z.strictObject({
  question: key,
  is: z.array(key).min(1),
})

const ruleSchema = z.strictObject({
  topic: z.enum(TOPIC_KEYS),
  level: z.enum(LEVEL_KEYS),
  /** Eigene Kurzfassung, kein Text aus der Quelle */
  text,
  ref: refSchema,
  /** Alle Bedingungen müssen passen; leer = gilt immer */
  when: z.array(conditionSchema).default([]),
})

const optionSchema = z.strictObject({ key, label: text })

const questionSchema = z.strictObject({
  key,
  /** Frage, z. B. „Besteht Brand- oder Explosionsgefahr im Umfeld?“ */
  text,
  /** Kurzform für „Gilt bei …“, z. B. „Brandgefahr im Umfeld“ */
  label: text,
  note: z.string().trim().default(''),
  options: z
    .array(optionSchema)
    .min(2)
    .default([
      { key: 'yes', label: 'Ja' },
      { key: 'no', label: 'Nein' },
    ]),
})

/** Gefährdung in einem Satz, z. B. „Ausströmendes Gas kann zu Bränden … führen.“ */
const hazardSchema = z.strictObject({ text, ref: refSchema })

/** Schutzausrüstung einer Tätigkeit: Stück aus ppeItems, wann und welche (z. B. „mindestens FFP2“) */
const ppeSchema = z.strictObject({
  item: key,
  text,
  ref: refSchema,
  when: z.array(conditionSchema).default([]),
})

const activitySchema = z.strictObject({
  key,
  group: key,
  label: text,
  note: z.string().trim().default(''),
  aliases: z.array(text).default([]),
  hazards: z.array(hazardSchema).default([]),
  questions: z.array(questionSchema).default([]),
  rules: z.array(ruleSchema).default([]),
  ppe: z.array(ppeSchema).default([]),
  /** Passende Tools, z. B. die Absturzsicherung bei Leitern */
  related: relatedToolsSchema,
  /** Solange Angaben fehlen: beginnt mit „TODO: Inhalt fehlt“ */
  todo: z.string().trim().default(''),
})

const sourceSchema = z.strictObject({
  key,
  /** Kurzname für die Fundstellen, z. B. „DGUV Regel 100-500, Kap. 2.26“ */
  name: text,
  /** Dokument mit Ausgabe und Link */
  source: text,
})

/** Grundpflichten, die für jeden Betrieb gelten (z. B. Unterweisung, Erste Hilfe) */
const basicSectionSchema = z.strictObject({
  key,
  label: text,
  rules: z
    .array(
      z.strictObject({
        level: z.enum(LEVEL_KEYS),
        text,
        ref: refSchema,
      }),
    )
    .min(1),
})

export const workSafetyToolSchema = defineEntrySchema({
  kind: z.literal('workSafety'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  keywords: z.array(text).default([]),
  /** Einschränkungen des Tools, stehen am Seitenende */
  closingNote: text,
  sources: z.array(sourceSchema).min(1),
  /** Gruppen der Tätigkeiten in Anzeigereihenfolge */
  groups: z.array(z.strictObject({ key, label: text })).min(1),
  /** Stücke der Schutzausrüstung in Anzeigereihenfolge */
  ppeItems: z.array(z.strictObject({ key, label: text })).default([]),
  activities: z.array(activitySchema).min(1),
  /** Typische Aufträge als Vorauswahl mehrerer Tätigkeiten */
  jobs: z.array(z.strictObject({ key, label: text, activities: z.array(key).min(1) })).default([]),
  /** Hinweis unter den Aufträgen, z. B. dass die Zuordnung ein Vorschlag ist */
  jobsNote: z.string().trim().default(''),
  basics: z.array(basicSectionSchema).default([]),
  related: relatedToolsSchema,
})

export type WorkSafetyTool = z.output<typeof workSafetyToolSchema>
export type WorkActivity = WorkSafetyTool['activities'][number]
export type WorkRule = WorkActivity['rules'][number]
export type WorkPpe = WorkActivity['ppe'][number]
export type WorkCondition = WorkRule['when'][number]
export type WorkQuestion = WorkActivity['questions'][number]
export type WorkRef = WorkRule['ref']
export type WorkBasicRule = WorkSafetyTool['basics'][number]['rules'][number]

/** Antworten je Tätigkeit: Tätigkeits-key → Frage-key → Options-key */
export type WorkAnswers = Record<string, Record<string, string>>

/**
 * Stand der Bedingungen: „met“ alle passen, „open“ mindestens eine Frage ist offen (und keine widerspricht),
 * „unmet“ mindestens eine Antwort widerspricht. Ohne Bedingungen immer „met“.
 */
export type ConditionState = 'met' | 'open' | 'unmet'

export function conditionState(when: readonly WorkCondition[], answers: Readonly<Record<string, string>> = {}): ConditionState {
  let open = false
  for (const condition of when) {
    const answer = answers[condition.question]
    if (answer === undefined) open = true
    else if (!condition.is.includes(answer)) return 'unmet'
  }
  return open ? 'open' : 'met'
}

/** „Gilt bei …“-Text einer Bedingung, z. B. „Brandgefahr im Umfeld: Ja“ */
export function conditionLabel(activity: WorkActivity, when: readonly WorkCondition[]): string {
  return when
    .map((condition) => {
      const question = activity.questions.find((candidate) => candidate.key === condition.question)
      if (!question) return condition.question
      const options = condition.is.map((optionKey) => question.options.find((option) => option.key === optionKey)?.label ?? optionKey)
      return `${question.label}: ${options.join(' oder ')}`
    })
    .join('; ')
}

export interface VisibleRule {
  rule: WorkRule
  /** Bedingung noch offen: Vorgabe mit „Gilt bei …“ anzeigen */
  open: boolean
}

/** Vorgaben eines Themas, die zu den Antworten passen; Reihenfolge wie im Inhalt */
export function visibleRules(activity: WorkActivity, topic: WorkTopic, answers: Readonly<Record<string, string>> = {}): VisibleRule[] {
  return activity.rules.flatMap((rule) => {
    if (rule.topic !== topic) return []
    const state = conditionState(rule.when, answers)
    return state === 'unmet' ? [] : [{ rule, open: state === 'open' }]
  })
}

/** Gewählte Tätigkeiten in der Reihenfolge des Inhalts */
export function selectedActivities(tool: WorkSafetyTool, keys: readonly string[]): WorkActivity[] {
  return tool.activities.filter((activity) => keys.includes(activity.key))
}

export interface PpeUse {
  activity: WorkActivity
  ppe: WorkPpe
  open: boolean
}

/** Schutzausrüstung aller gewählten Tätigkeiten, je Stück zusammengefasst, in der Reihenfolge von ppeItems */
export function combinedPpe(
  tool: WorkSafetyTool,
  activities: readonly WorkActivity[],
  answers: WorkAnswers = {},
): { item: WorkSafetyTool['ppeItems'][number]; uses: PpeUse[] }[] {
  return tool.ppeItems
    .map((item) => ({
      item,
      uses: activities.flatMap((activity) =>
        activity.ppe.flatMap((ppe) => {
          if (ppe.item !== item.key) return []
          const state = conditionState(ppe.when, answers[activity.key])
          return state === 'unmet' ? [] : [{ activity, ppe, open: state === 'open' }]
        }),
      ),
    }))
    .filter((entry) => entry.uses.length > 0)
}

export interface ChecklistItem extends VisibleRule {
  /** Stabil je Tätigkeit und Position im Inhalt, für den Haken */
  id: string
  activity: WorkActivity
}

/** Prüfliste vor Arbeitsbeginn: Thema „before“ aller gewählten Tätigkeiten */
export function checklist(activities: readonly WorkActivity[], answers: WorkAnswers = {}): ChecklistItem[] {
  return activities.flatMap((activity) =>
    activity.rules.flatMap((rule, index) => {
      if (rule.topic !== 'before') return []
      const state = conditionState(rule.when, answers[activity.key])
      return state === 'unmet' ? [] : [{ id: `${activity.key}-${index}`, activity, rule, open: state === 'open' }]
    }),
  )
}

/** Fundstelle als Text, z. B. „DGUV Regel 100-500, Kap. 2.26, Abschn. 3.8.3“ */
export function refText(tool: WorkSafetyTool, ref: WorkRef): string {
  const source = tool.sources.find((candidate) => candidate.key === ref.source)
  return `${source?.name ?? ref.source}, ${ref.where}`
}

function duplicates(values: readonly string[]): string[] {
  return [...new Set(values.filter((value, index) => values.indexOf(value) !== index))]
}

export function checkWorkSafetyTool(tool: WorkSafetyTool): string[] {
  const issues: string[] = []
  const sourceKeys = tool.sources.map((source) => source.key)
  const groupKeys = tool.groups.map((group) => group.key)
  const ppeKeys = tool.ppeItems.map((item) => item.key)
  const activityKeys = tool.activities.map((activity) => activity.key)
  const lists: [string, string[]][] = [
    ['sources', sourceKeys],
    ['groups', groupKeys],
    ['ppeItems', ppeKeys],
    ['activities', activityKeys],
    ['jobs', tool.jobs.map((job) => job.key)],
    ['basics', tool.basics.map((section) => section.key)],
  ]
  for (const [name, keys] of lists) {
    for (const value of duplicates(keys)) issues.push(`${name}: key "${value}" doppelt vergeben`)
  }

  const usedSources = new Set<string>()
  const checkRef = (ref: WorkRef, where: string) => {
    usedSources.add(ref.source)
    if (!sourceKeys.includes(ref.source)) issues.push(`${where}: unbekannte Quelle "${ref.source}"`)
  }
  const usedPpe = new Set<string>()

  for (const activity of tool.activities) {
    const where = `activities (${activity.key})`
    if (!groupKeys.includes(activity.group)) issues.push(`${where}: unbekannte Gruppe "${activity.group}"`)
    for (const value of duplicates(activity.questions.map((question) => question.key))) {
      issues.push(`${where}: Frage "${value}" doppelt`)
    }
    for (const question of activity.questions) {
      for (const value of duplicates(question.options.map((option) => option.key))) {
        issues.push(`${where}, questions (${question.key}): Option "${value}" doppelt`)
      }
    }
    const usedQuestions = new Set<string>()
    const checkWhen = (when: readonly WorkCondition[], whereWhen: string) => {
      for (const condition of when) {
        usedQuestions.add(condition.question)
        const question = activity.questions.find((candidate) => candidate.key === condition.question)
        if (!question) {
          issues.push(`${whereWhen}: unbekannte Frage "${condition.question}"`)
          continue
        }
        for (const option of condition.is) {
          if (!question.options.some((candidate) => candidate.key === option)) {
            issues.push(`${whereWhen}: unbekannte Option "${option}" bei "${condition.question}"`)
          }
        }
      }
    }
    activity.hazards.forEach((hazard, index) => checkRef(hazard.ref, `${where}, hazards[${index}]`))
    activity.rules.forEach((rule, index) => {
      checkRef(rule.ref, `${where}, rules[${index}]`)
      checkWhen(rule.when, `${where}, rules[${index}]`)
    })
    activity.ppe.forEach((ppe, index) => {
      usedPpe.add(ppe.item)
      checkRef(ppe.ref, `${where}, ppe[${index}]`)
      checkWhen(ppe.when, `${where}, ppe[${index}]`)
      if (!ppeKeys.includes(ppe.item)) issues.push(`${where}, ppe[${index}]: unbekanntes Stück "${ppe.item}"`)
    })
    for (const question of activity.questions) {
      if (!usedQuestions.has(question.key)) issues.push(`${where}: Frage "${question.key}" wird nirgends verwendet`)
    }
    if (activity.todo && !activity.todo.startsWith('TODO: Inhalt fehlt')) issues.push(`${where}: todo muss mit „TODO: Inhalt fehlt“ beginnen`)
    if (activity.todo && tool.status === 'verified') issues.push(`${where}: todo bei verified nicht erlaubt`)
    if (!activity.todo && activity.rules.length === 0) issues.push(`${where}: keine Vorgaben`)
  }

  for (const group of tool.groups) {
    if (!tool.activities.some((activity) => activity.group === group.key)) issues.push(`groups (${group.key}): keine Tätigkeit`)
  }
  for (const item of tool.ppeItems) {
    if (!usedPpe.has(item.key)) issues.push(`ppeItems (${item.key}): wird bei keiner Tätigkeit genannt`)
  }
  for (const job of tool.jobs) {
    for (const value of duplicates(job.activities)) issues.push(`jobs (${job.key}): Tätigkeit "${value}" doppelt`)
    for (const activityKey of job.activities) {
      if (!activityKeys.includes(activityKey)) issues.push(`jobs (${job.key}): unbekannte Tätigkeit "${activityKey}"`)
    }
  }
  for (const section of tool.basics) {
    section.rules.forEach((rule, index) => checkRef(rule.ref, `basics (${section.key}), rules[${index}]`))
  }
  for (const source of sourceKeys) {
    if (!usedSources.has(source)) issues.push(`sources (${source}): wird nirgends zitiert`)
  }
  return issues
}

/** In den Tätigkeiten verwiesene Tools (related am Seitenende läuft über relatedTools in schema.ts) */
export const workSafetyReferences = (tool: WorkSafetyTool): string[] => tool.activities.flatMap((activity) => activity.related)

/** Suchbegriffe für die globale Suche */
export function workSafetyKeywords(tool: WorkSafetyTool): string[] {
  return [
    ...tool.keywords,
    ...tool.groups.map((group) => group.label),
    ...tool.activities.flatMap((activity) => [activity.label, ...activity.aliases]),
    ...tool.ppeItems.map((item) => item.label),
    ...tool.jobs.map((job) => job.label),
    ...tool.basics.map((section) => section.label),
    ...tool.sources.map((source) => source.name),
  ]
}
