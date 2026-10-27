import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { math } from '../../lib/math.ts'

// Faktor-Tools ("kind": "factor"): Zahlen eingeben (z. B. Personen), Varianten auswählen
// (z. B. Nutzung und Kollektorart); jedes Ergebnis kommt aus dem Fall, der zur Auswahl passt:
// Faktor × Bezugsgröße, ein fester Wert, ein Text (z. B. „keine Anforderung“) oder ein
// Rechenausdruck mit den Eingaben und vorherigen Ergebnissen.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const symbol = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Symbol: nur A-Z, a-z, 0-9 und _')

const optionSchema = z.strictObject({
  key,
  label: z.string().trim().min(1),
  /** Nur anbieten, wenn eine andere Auswahl so steht: Auswahl-key → Options-key */
  when: z.record(z.string(), z.string()).default({}),
})

const choiceSchema = z.strictObject({
  key,
  /** Was gewählt wird, z. B. „Nutzung“ */
  name: z.string().trim().min(1),
  options: z.array(optionSchema).min(2),
  /** Vorausgewählte Option (key); sonst die erste */
  default: key.optional(),
  /** "bar": Knöpfe nebeneinander (wenige, kurze Optionen); "dropdown": Auswahlliste (viele Optionen) */
  display: z.enum(['bar', 'dropdown']).default('bar'),
})

const inputSchema = z.strictObject({
  symbol,
  /** Anzeige statt Symbol, z. B. "λ" */
  label: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  unit: z.string().trim().default(''),
  min: z.number().optional(),
  max: z.number().optional(),
  /** Vorbelegung, z. B. ein Standardwert; bleibt änderbar */
  default: z.number().optional(),
  /** Feld darf leer bleiben; dann wird mit diesem Wert gerechnet */
  whenEmpty: z.number().optional(),
})

const caseSchema = z
  .strictObject({
    /** Für welche Auswahl der Fall gilt: Auswahl-key → Options-key; fehlt eine Auswahl, gilt er für alle */
    when: z.record(z.string(), z.string()).default({}),
    /** Ergebnis = factor × per … */
    factor: z.number().positive().optional(),
    /** … mit per als Symbol einer Eingabe oder eines vorher stehenden Ergebnisses */
    per: symbol.optional(),
    /** … oder ein fester Wert */
    value: z.number().optional(),
    /** … oder ein Text statt einer Zahl, z. B. „keine Anforderung“ */
    text: z.string().trim().min(1).optional(),
    /** … oder ein Rechenausdruck (mathjs, ohne Einheiten) mit Eingaben und vorherigen Ergebnissen */
    expression: z.string().trim().min(1).optional(),
    /** Bereich: nur wenn die Größe `of` (Standard: erste Eingabe) über `above` (ausschließlich) … */
    above: z.number().optional(),
    /** … und bis `upTo` (einschließlich) liegt */
    upTo: z.number().optional(),
    of: symbol.optional(),
    /** Richtwert in Worten, wie in der Quelle, z. B. „1,5 m² pro Person“ */
    rule: z.string().trim().min(1),
  })
  .refine(
    (item) =>
      [
        item.factor !== undefined || item.per !== undefined,
        item.value !== undefined,
        item.text !== undefined,
        item.expression !== undefined,
      ].filter(Boolean).length === 1 && (item.factor === undefined) === (item.per === undefined),
    { message: 'Genau eins angeben: factor und per, value, text oder expression' },
  )

const resultSchema = z.strictObject({
  symbol,
  /** Anzeige statt Symbol, z. B. "Vₛ" */
  label: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  /** Einheit zur Anzeige, z. B. "m²" */
  unit: z.string().trim().default(''),
  decimals: z.number().int().min(0).max(6).default(1),
  cases: z.array(caseSchema).min(1),
})

const exampleSchema = z.strictObject({
  /** Eingaben je Symbol */
  inputs: z.record(z.string(), z.number()),
  /** Auswahl-key → Options-key */
  choices: z.record(z.string(), z.string()),
  /** Erwartete Ergebnisse je Symbol: Zahl oder Text (z. B. „keine Anforderung“) */
  expected: z.record(z.string(), z.union([z.number(), z.string()])),
  note: z.string().optional(),
})

export const factorToolSchema = defineEntrySchema({
  kind: z.literal('factor'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Eingabefelder; leer, wenn das Ergebnis nur von der Auswahl abhängt */
  inputs: z.array(inputSchema).default([]),
  choices: z.array(choiceSchema).default([]),
  results: z.array(resultSchema).min(1),
  examples: z.array(exampleSchema).default([]),
}).superRefine((entry, ctx) => {
  if (entry.status === 'verified' && entry.examples.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['examples'], message: 'Mindestens ein Testbeispiel bei status "verified"' })
  }
})

export type FactorTool = z.output<typeof factorToolSchema>
export type FactorChoice = z.output<typeof choiceSchema>
export type FactorResult = z.output<typeof resultSchema>
export type FactorCase = z.output<typeof caseSchema>

/** Ergebnis: Zahl, oder Text statt Zahl (z. B. „keine Anforderung“) */
export type FactorValue = { value: number; text?: undefined; rule: string } | { value?: undefined; text: string; rule: string }

const matches = (when: Record<string, string>, selection: Record<string, string>) =>
  Object.entries(when).every(([choice, option]) => selection[choice] === option)

const rangeOf = (tool: FactorTool, candidate: FactorCase) => candidate.of ?? tool.inputs[0]?.symbol ?? ''

const inRange = (candidate: FactorCase, value: number | undefined) =>
  (candidate.above === undefined && candidate.upTo === undefined) ||
  (value !== undefined &&
    (candidate.above === undefined || value > candidate.above) &&
    (candidate.upTo === undefined || value <= candidate.upTo))

/** Optionen einer Auswahl, die zur übrigen Auswahl passen */
export function availableOptions(choice: FactorChoice, selection: Record<string, string>) {
  return choice.options.filter((option) => matches(option.when, selection))
}

/** Auswahl bereinigen: steht eine Auswahl auf einer nicht angebotenen Option, die erste passende nehmen */
export function normalizeSelection(tool: FactorTool, selection: Record<string, string>): Record<string, string> {
  const next = { ...selection }
  for (const choice of tool.choices) {
    const options = availableOptions(choice, next)
    if (!options.some((option) => option.key === next[choice.key])) {
      const fallback = options.find((option) => option.key === choice.default) ?? options[0]
      if (fallback) next[choice.key] = fallback.key
    }
  }
  return next
}

/** Der Fall, der zu Auswahl und Werten passt (erster Treffer) */
export function matchingCase(
  tool: FactorTool,
  result: FactorResult,
  selection: Record<string, string>,
  scope: Record<string, number>,
): FactorCase | undefined {
  return result.cases.find(
    (candidate) => matches(candidate.when, selection) && inRange(candidate, scope[rangeOf(tool, candidate)]),
  )
}

/** Alle Ergebnisse der Reihe nach; spätere dürfen sich auf frühere beziehen */
export function computeFactorTool(
  tool: FactorTool,
  inputs: Record<string, number>,
  selection: Record<string, string>,
): Record<string, FactorValue | undefined> {
  const scope: Record<string, number> = { ...inputs }
  const values: Record<string, FactorValue | undefined> = {}
  for (const result of tool.results) {
    const match = matchingCase(tool, result, selection, scope)
    if (match?.text !== undefined) {
      values[result.symbol] = { text: match.text, rule: match.rule }
      continue
    }
    let value: number | undefined
    if (match?.value !== undefined) value = match.value
    else if (match?.factor !== undefined && match.per !== undefined && scope[match.per] !== undefined) {
      value = match.factor * scope[match.per]!
    } else if (match?.expression !== undefined) {
      try {
        const evaluated: unknown = math.evaluate(match.expression, { ...scope })
        value = typeof evaluated === 'number' && Number.isFinite(evaluated) ? evaluated : undefined
      } catch {
        value = undefined
      }
    }
    if (!match || value === undefined) {
      values[result.symbol] = undefined
      continue
    }
    scope[result.symbol] = value
    values[result.symbol] = { value, rule: match.rule }
  }
  return values
}

/** Jede mögliche Kombination der Auswahlen (nur angebotene Optionen; ohne passende Option bleibt die Auswahl offen) */
export function allSelections(tool: FactorTool): Record<string, string>[] {
  return tool.choices.reduce<Record<string, string>[]>(
    (combinations, choice) =>
      combinations.flatMap((combination) => {
        const options = availableOptions(choice, combination)
        return options.length === 0
          ? [combination]
          : options.map((option) => ({ ...combination, [choice.key]: option.key }))
      }),
    [{}],
  )
}

/**
 * Prüft, dass die Bereiche der Fälle lückenlos aneinander anschließen:
 * der erste ohne Untergrenze, jeder weitere ab der Obergrenze des vorigen, der letzte ohne Obergrenze.
 */
function rangeIssues(cases: FactorCase[]): string | undefined {
  const sorted = [...cases].sort((a, b) => (a.above ?? -Infinity) - (b.above ?? -Infinity))
  if (sorted[0]!.above !== undefined) return `keiner ohne Untergrenze (above)`
  for (let index = 1; index < sorted.length; index += 1) {
    const previous = sorted[index - 1]!.upTo
    const next = sorted[index]!.above
    if (previous === undefined || next === undefined || previous !== next) {
      return `Bereiche schließen nicht aneinander an (upTo ${previous ?? '–'}, above ${next ?? '–'})`
    }
  }
  if (sorted.at(-1)!.upTo !== undefined) return `keiner ohne Obergrenze (upTo)`
  return undefined
}

/** Symbole, die ein Rechenausdruck verwendet (ohne Funktionsnamen) */
function expressionSymbols(expression: string): string[] {
  const node = math.parse(expression)
  return node
    .filter((item) => item.type === 'SymbolNode')
    .map((item) => (item as unknown as { name: string }).name)
    .filter((name) => !(name in math) || typeof (math as unknown as Record<string, unknown>)[name] !== 'function')
}

export function checkFactorTool(entry: FactorTool): string[] {
  const issues: string[] = []
  const inputSymbols = entry.inputs.map((input) => input.symbol)
  if (new Set(inputSymbols).size !== inputSymbols.length) issues.push('inputs: Symbol doppelt vergeben')
  const choiceKeys = entry.choices.map((choice) => choice.key)
  if (new Set(choiceKeys).size !== choiceKeys.length) issues.push('choices: key doppelt vergeben')
  for (const choice of entry.choices) {
    const optionKeys = choice.options.map((option) => option.key)
    if (new Set(optionKeys).size !== optionKeys.length) issues.push(`choices (${choice.key}): Options-key doppelt vergeben`)
    if (choice.default !== undefined && !optionKeys.includes(choice.default)) {
      issues.push(`choices (${choice.key}): default "${choice.default}" ist keine Option`)
    }
  }

  const known = [...inputSymbols]
  for (const result of entry.results) {
    const where = `results (${result.symbol})`
    if (known.includes(result.symbol)) issues.push(`${where}: Symbol doppelt vergeben`)
    result.cases.forEach((candidate, index) => {
      const at = `${where}, cases[${index}]`
      if (candidate.per !== undefined && !known.includes(candidate.per)) {
        issues.push(`${at}: per "${candidate.per}" ist weder eine Eingabe noch ein vorheriges Ergebnis`)
      }
      if (candidate.of !== undefined && !known.includes(candidate.of)) {
        issues.push(`${at}: of "${candidate.of}" ist weder eine Eingabe noch ein vorheriges Ergebnis`)
      }
      if (candidate.expression !== undefined) {
        try {
          const unknown = expressionSymbols(candidate.expression).filter((name) => !known.includes(name))
          if (unknown.length > 0) issues.push(`${at}: unbekannte Symbole im Ausdruck: ${unknown.join(', ')}`)
        } catch {
          issues.push(`${at}: Ausdruck nicht lesbar: ${candidate.expression}`)
        }
      }
      for (const [choiceKey, optionKey] of Object.entries(candidate.when)) {
        const choice = entry.choices.find((item) => item.key === choiceKey)
        if (!choice) issues.push(`${at}: unbekannte Auswahl "${choiceKey}"`)
        else if (!choice.options.some((option) => option.key === optionKey)) {
          issues.push(`${at}: unbekannte Option "${optionKey}" bei "${choiceKey}"`)
        }
      }
    })
    for (const selection of allSelections(entry)) {
      const found = result.cases.filter((candidate) => matches(candidate.when, selection))
      const label = Object.values(selection).join(' + ') || 'ohne Auswahl'
      if (found.length === 0) issues.push(`${where}: kein Faktor für ${label}`)
      else if (found.length > 1) {
        // Mehrere Fälle nur, wenn sie verschiedene Bereiche abdecken
        const problem = found.every((candidate) => candidate.above !== undefined || candidate.upTo !== undefined)
          ? rangeIssues(found)
          : 'mehrere Faktoren'
        if (problem) issues.push(`${where}: ${problem} für ${label}`)
      }
    }
    known.push(result.symbol)
  }

  entry.examples.forEach((example, index) => {
    const values = computeFactorTool(entry, example.inputs, example.choices)
    for (const [resultSymbol, expected] of Object.entries(example.expected)) {
      const actual = values[resultSymbol]
      const ok =
        typeof expected === 'string'
          ? actual?.text === expected
          : actual?.value !== undefined && Math.abs(actual.value - expected) <= Math.abs(expected) * 0.001
      if (!ok) {
        issues.push(`examples[${index}]: ${resultSymbol} ergibt ${actual?.value ?? actual?.text ?? 'nichts'}, erwartet ${expected}`)
      }
    }
  })
  return issues
}
