import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
import { relatedToolsSchema } from './factorTool.ts'

// Abgas-Arten-Tools ("kind": "flueTypes"): Gasgeräte-Arten nach DIN EN 1749 (A, B, C mit Ziffern und Zusätzen).
// Zwei Richtungen: Einbausituation antippen → Art (z. B. C33x), oder Art eingeben → Einbaukriterien.
// Das Tool leitet nichts aus Regeln ab: Jede Art steht mit ihren Merkmalen im Inhalt, die Auswahl filtert nur.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const text = z.string().trim().min(1)

const noteSchema = z.strictObject({
  text,
  /** Woher die Angabe stammt, kurz; die Links stehen in source des Eintrags */
  source: text,
})

/** Öffnung ins Freie im Aufstellraum, als Gitter in der Schemazeichnung */
const ventSchema = z.strictObject({
  /** Kurzbeschriftung am Gitter, z. B. „Zuluft“ */
  label: z.string().trim().min(1).max(12),
  /** Satz unter der Zeichnung, mit Quelle */
  caption: text,
})

/** Gebläse-Ziffer (letzte Ziffer der Art) */
const fanDigit = z.enum(['1', '2', '3', '4'])

/** Grundart: A, B oder C, bei B und C mit erster Ziffer, ab 10 in Klammern, z. B. „C(10)“ */
const groupCode = z.string().regex(/^(A|[BC][1-9]|C\(1[0-9]\))$/, 'code: z. B. „A“, „B1“, „C3“ oder „C(10)“')

const questionSchema = z.strictObject({
  key,
  /** Frage über der Auswahl, z. B. „Abgasführung“ */
  label: text,
  options: z
    .array(
      z.strictObject({
        key,
        label: text,
        /** Kleine zweite Zeile */
        note: z.string().trim().default(''),
        /** Einbaukriterien, die für jede Art mit diesem Merkmal gelten */
        notes: z.array(noteSchema).default([]),
        /** Öffnung ins Freie, die die Zeichnung bei diesem Merkmal zeigt */
        vent: ventSchema.optional(),
      }),
    )
    .min(2),
})

const groupSchema = z.strictObject({
  code: groupCode,
  /** Kurzname, z. B. „Senkrecht über Dach“ */
  name: text,
  /** Eigene Kurzbeschreibung der Art */
  description: text,
  /** Merkmal je Frage (key der Frage → key der Option) */
  criteria: z.record(key, key),
  /** Mögliche Gebläse-Ziffern mit Hinweis zu genau dieser Art, z. B. „B21: in Gerätenormen nicht üblich“ */
  fans: z
    .array(z.strictObject({ digit: fanDigit, note: z.string().trim().default('') }))
    .min(1),
  /** Einbaukriterien und Hinweise zu dieser Grundart */
  notes: z.array(noteSchema).default([]),
  /**
   * Zulässigkeit in Deutschland, nur wenn eine Quelle sie einschränkt: `notPermitted` = nicht (mehr) zulässig,
   * `exceptionOnly` = keine Aufstellregeln, höchstens als baurechtliche Ausnahme
   */
  germany: z
    .strictObject({ status: z.enum(['notPermitted', 'exceptionOnly']), text, source: text })
    .optional(),
  /** Woher die Definition stammt, kurz */
  source: text,
})

const suffixSchema = z.strictObject({
  /** So wie in der Art geschrieben, z. B. „x“, „BS“, „P“ */
  key: z.string().regex(/^(x|[A-Z]{1,2})$/, 'key: „x“ oder Großbuchstaben, z. B. „BS“'),
  /** Kurzname in der Auswahl, z. B. „Abgasüberwachung“ */
  label: text,
  text,
  /** Arten, für die der Zusatz belegt ist: Grundart („B1“) oder volle Art („C33“) */
  allowed: z.array(z.string().trim().min(1)).min(1),
  /** Hinweis, wenn der Zusatz möglich ist, aber fehlt (z. B. C-Gerät mit Gebläse ohne „x“) */
  missingNote: noteSchema.optional(),
  source: text,
})

export const flueTypeToolSchema = defineEntrySchema({
  kind: z.literal('flueTypes'),
  title: text,
  summary: text,
  tags: topicTagsSchema,
  description: text,
  category: z.string().trim().default(''),
  related: relatedToolsSchema,
  /** Fragen in der Reihenfolge der Auswahl; es erscheint nur, was die übrigen Arten noch unterscheidet */
  questions: z.array(questionSchema).min(1),
  /** Bedeutung der Gebläse-Ziffer */
  fanDigits: z
    .array(z.strictObject({ digit: fanDigit, label: text, note: z.string().trim().default('') }))
    .min(1),
  groups: z.array(groupSchema).min(1),
  suffixes: z.array(suffixSchema).default([]),
  /** Allgemeine Einbaukriterien zu jeder Art, z. B. wo Mündung und Aufstellraum geregelt sind */
  generalNotes: z.array(noteSchema).default([]),
  /** Allgemeine Abgasvorschriften (z. B. Mündungsabstände) als eigener Block unter dem Ergebnis */
  regulations: z
    .strictObject({
      title: text,
      /** Kurzer Hinweis über der Liste, z. B. welche Verordnung gilt */
      intro: z.string().trim().default(''),
      items: z.array(z.strictObject({ heading: text, text, source: text })).min(1),
    })
    .optional(),
})

export type FlueTypeTool = z.output<typeof flueTypeToolSchema>
export type FlueGroup = FlueTypeTool['groups'][number]
export type FlueQuestion = FlueTypeTool['questions'][number]
export type FlueSuffix = FlueTypeTool['suffixes'][number]
export type FlueNote = z.output<typeof noteSchema>
export type GermanyStatus = NonNullable<FlueGroup['germany']>['status']

/** Kurzbezeichnung der Einschränkung in Deutschland */
export const GERMANY_STATUS: Record<GermanyStatus, string> = {
  notPermitted: 'In Deutschland nicht zulässig',
  exceptionOnly: 'In Deutschland nur als baurechtliche Ausnahme',
}

/** Volle Art ohne Zusätze, z. B. „C33“ oder „C(10)3“ */
export const typeCode = (group: Pick<FlueGroup, 'code'>, digit: string) => `${group.code}${digit}`

/** Gilt ein Zusatz für diese Grundart und Gebläse-Ziffer? */
export const suffixAllowed = (suffix: FlueSuffix, group: FlueGroup, digit: string) =>
  suffix.allowed.includes(group.code) || suffix.allowed.includes(typeCode(group, digit))

/** Zusätze in der Reihenfolge des Inhalts, die für die Art belegt sind */
export const suffixesFor = (tool: FlueTypeTool, group: FlueGroup, digit: string) =>
  tool.suffixes.filter((suffix) => suffixAllowed(suffix, group, digit))

// ---------- Auswahl: Einbausituation → Art ----------

export interface QuestionStep {
  question: FlueQuestion
  /** Optionen, die bei den verbliebenen Arten vorkommen */
  options: FlueQuestion['options']
  /** Gewählte Option, wenn sie noch passt */
  selected: string | undefined
}

/**
 * Fragen der Reihe nach: Eine Frage erscheint, wenn die verbliebenen Arten sich in ihr unterscheiden.
 * Ohne Antwort endet die Liste; candidates sind die Arten, die zu allen Antworten passen.
 */
export function narrow(tool: FlueTypeTool, answers: Record<string, string>): { steps: QuestionStep[]; candidates: FlueGroup[] } {
  let candidates = tool.groups
  const steps: QuestionStep[] = []
  for (const question of tool.questions) {
    if (candidates.length <= 1) break
    const values = new Set(candidates.map((group) => group.criteria[question.key]).filter((value) => value !== undefined))
    if (values.size <= 1) continue
    const options = question.options.filter((option) => values.has(option.key))
    const answer = answers[question.key]
    const selected = answer !== undefined && values.has(answer) ? answer : undefined
    steps.push({ question, options, selected })
    if (!selected) break
    candidates = candidates.filter((group) => group.criteria[question.key] === selected)
  }
  return { steps, candidates }
}

// ---------- Eingabe: Art → Einbaukriterien ----------

export interface ParsedType {
  /** Grundart wie im Inhalt, z. B. „C(10)“ */
  code: string
  digit: string | undefined
  /** Zusätze in der eingegebenen Reihenfolge, Schreibweise wie im Inhalt */
  suffixes: string[]
  /** Rest, der sich nicht als Zusatz lesen ließ */
  rest: string
}

/**
 * Liest eine Art wie „C33x“, „c 33 x“, „C(10)3“, „C103“, „B11BS“ oder „B23P“.
 * Ohne Klammern: bei B und C ist eine Ziffer die Grundart, zwei Ziffern Grundart + Gebläse,
 * drei Ziffern zweistellige Grundart + Gebläse (C103 = C(10)3).
 */
export function parseType(tool: FlueTypeTool, input: string): ParsedType | undefined {
  const compact = input.replace(/[\s_\-.]/g, '')
  const match = /^([abcABC])(?:\((\d{1,2})\)(\d)?|(\d{0,3}))(.*)$/.exec(compact)
  if (!match) return undefined
  const letter = match[1]!.toUpperCase()
  let code: string
  let digit: string | undefined
  if (match[2] !== undefined) {
    code = `${letter}(${match[2]})`
    digit = match[3]
  } else {
    const digits = match[4] ?? ''
    if (letter === 'A') {
      if (digits.length > 1) return undefined
      code = 'A'
      digit = digits || undefined
    } else if (digits.length === 0) {
      code = letter
    } else if (digits.length === 1) {
      code = `${letter}${digits}`
    } else if (digits.length === 2) {
      code = `${letter}${digits[0]}`
      digit = digits[1]
    } else {
      code = `${letter}(${digits.slice(0, 2)})`
      digit = digits[2]
    }
  }
  // Zusätze: längste zuerst, Groß-/Kleinschreibung egal
  const known = [...tool.suffixes].sort((a, b) => b.key.length - a.key.length)
  let rest = match[5] ?? ''
  const suffixes: string[] = []
  while (rest) {
    const found = known.find((suffix) => rest.toLowerCase().startsWith(suffix.key.toLowerCase()))
    if (!found) break
    suffixes.push(found.key)
    rest = rest.slice(found.key.length)
  }
  return { code, digit, suffixes, rest }
}

export interface TypeLookup {
  group?: FlueGroup
  digit?: string
  suffixes: FlueSuffix[]
  /** Art gibt es so nicht */
  errors: string[]
  /** Art gibt es, ein Zusatz ist für sie aber nicht belegt */
  warnings: string[]
}

/** Art suchen und prüfen; Meldungen in Klartext für die Anzeige */
export function lookupType(tool: FlueTypeTool, input: string): TypeLookup {
  const parsed = parseType(tool, input.trim())
  if (!parsed) return { suffixes: [], errors: [`„${input.trim()}“ ist keine Art. Sie beginnt mit A, B oder C, z. B. C33x.`], warnings: [] }
  const group = tool.groups.find((candidate) => candidate.code === parsed.code)
  if (!group) {
    return { suffixes: [], errors: [`Die Art ${parsed.code} gibt es nach DIN EN 1749 nicht.`], warnings: [] }
  }
  const errors: string[] = []
  const warnings: string[] = []
  const digits = group.fans.map((fan) => fan.digit)
  if (parsed.digit !== undefined && !digits.includes(parsed.digit as (typeof digits)[number])) {
    errors.push(`${typeCode(group, parsed.digit)} gibt es nicht. Bei ${group.code} sind möglich: ${digits.map((digit) => typeCode(group, digit)).join(', ')}.`)
  }
  if (parsed.rest) errors.push(`Den Zusatz „${parsed.rest}“ kennt das Tool nicht.`)
  const suffixes = parsed.suffixes.map((suffixKey) => tool.suffixes.find((suffix) => suffix.key === suffixKey)!)
  const digit = errors.length === 0 ? parsed.digit : undefined
  for (const suffix of suffixes) {
    const allowed = digit !== undefined ? suffixAllowed(suffix, group, digit) : suffix.allowed.some((code) => code.startsWith(group.code))
    if (!allowed) warnings.push(`Den Zusatz ${suffix.key} nennen die Quellen bei ${digit ? typeCode(group, digit) : group.code} nicht.`)
  }
  return { group, digit, suffixes, errors, warnings }
}

/** Volle Bezeichnung mit Zusätzen, z. B. „C33x“ */
export const formatType = (group: FlueGroup, digit: string | undefined, suffixes: readonly FlueSuffix[]) =>
  `${group.code}${digit ?? ''}${suffixes.map((suffix) => suffix.key).join('')}`

/** Alle vollen Arten ohne Zusatz, in der Reihenfolge des Inhalts */
export const allTypeCodes = (tool: FlueTypeTool) =>
  tool.groups.flatMap((group) => group.fans.map((fan) => typeCode(group, fan.digit)))

// ---------- Prüfung beim Build ----------

export function checkFlueTypeTool(tool: FlueTypeTool): string[] {
  const issues: string[] = []
  const questionKeys = tool.questions.map((question) => question.key)
  if (new Set(questionKeys).size !== questionKeys.length) issues.push('questions: key doppelt vergeben')
  for (const question of tool.questions) {
    const optionKeys = question.options.map((option) => option.key)
    if (new Set(optionKeys).size !== optionKeys.length) issues.push(`questions (${question.key}): Option doppelt vergeben`)
    for (const option of question.options) {
      if (!tool.groups.some((group) => group.criteria[question.key] === option.key)) {
        issues.push(`questions (${question.key}): Option "${option.key}" hat keine Art`)
      }
    }
  }
  const fanKeys = tool.fanDigits.map((fan) => fan.digit)
  if (new Set(fanKeys).size !== fanKeys.length) issues.push('fanDigits: Ziffer doppelt vergeben')
  const codes = tool.groups.map((group) => group.code)
  if (new Set(codes).size !== codes.length) issues.push('groups: code doppelt vergeben')
  for (const group of tool.groups) {
    const where = `groups (${group.code})`
    for (const [questionKey, optionKey] of Object.entries(group.criteria)) {
      const question = tool.questions.find((candidate) => candidate.key === questionKey)
      if (!question) issues.push(`${where}: unbekannte Frage "${questionKey}"`)
      else if (!question.options.some((option) => option.key === optionKey)) {
        issues.push(`${where}: unbekannte Option "${optionKey}" bei "${questionKey}"`)
      }
    }
    const digits = group.fans.map((fan) => fan.digit)
    if (new Set(digits).size !== digits.length) issues.push(`${where}: Gebläse-Ziffer doppelt`)
    for (const digit of digits) {
      if (!fanKeys.includes(digit)) issues.push(`${where}: Gebläse-Ziffer ${digit} fehlt in fanDigits`)
    }
    // Jede Art muss über ihre eigenen Merkmale eindeutig erreichbar sein
    const { candidates } = narrow(tool, group.criteria)
    if (candidates.length !== 1 || candidates[0] !== group) {
      issues.push(`${where}: über die Fragen nicht eindeutig erreichbar (${candidates.map((candidate) => candidate.code).join(', ')})`)
    }
  }
  const suffixKeys = tool.suffixes.map((suffix) => suffix.key)
  if (new Set(suffixKeys.map((suffixKey) => suffixKey.toLowerCase())).size !== suffixKeys.length) {
    issues.push('suffixes: key doppelt vergeben')
  }
  const fullCodes = new Set(allTypeCodes(tool))
  for (const suffix of tool.suffixes) {
    for (const code of suffix.allowed) {
      if (!codes.includes(code) && !fullCodes.has(code)) issues.push(`suffixes (${suffix.key}): unbekannte Art "${code}"`)
    }
  }
  return issues
}

/** Suchbegriffe für die globale Suche: alle Arten und ihre Kurznamen */
export function flueTypeKeywords(tool: FlueTypeTool): string[] {
  return [
    ...allTypeCodes(tool),
    ...tool.groups.map((group) => group.name),
    ...tool.suffixes.map((suffix) => suffix.label),
    'Abgasanlage',
    'Gasgeräte-Art',
    'raumluftabhängig',
    'raumluftunabhängig',
  ]
}
