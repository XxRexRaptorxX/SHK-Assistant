import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'

// Faktor-Tools ("kind": "factor"): eine Zahl eingeben (z. B. Personen), Varianten auswählen
// (z. B. Nutzung und Kollektorart); jedes Ergebnis ist Faktor × Bezugsgröße, wobei der Faktor
// von der Auswahl abhängt und die Bezugsgröße die Eingabe oder ein vorheriges Ergebnis ist.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')
const symbol = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Symbol: nur A-Z, a-z, 0-9 und _')

const choiceSchema = z.strictObject({
  key,
  /** Was gewählt wird, z. B. „Nutzung“ */
  name: z.string().trim().min(1),
  options: z
    .array(z.strictObject({ key, label: z.string().trim().min(1) }))
    .min(2),
})

const caseSchema = z.strictObject({
  /** Für welche Auswahl der Faktor gilt: Auswahl-key → Options-key; fehlt eine Auswahl, gilt er für alle */
  when: z.record(z.string(), z.string()).default({}),
  factor: z.number().positive(),
  /** Bezugsgröße: Symbol der Eingabe oder eines vorher stehenden Ergebnisses */
  per: symbol,
  /** Richtwert in Worten, wie in der Quelle, z. B. „1,5 m² pro Person“ */
  rule: z.string().trim().min(1),
})

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
  input: z.number(),
  /** Auswahl-key → Options-key */
  choices: z.record(z.string(), z.string()),
  /** Erwartete Ergebnisse je Symbol */
  expected: z.record(z.string(), z.number()),
  note: z.string().optional(),
})

export const factorToolSchema = defineEntrySchema({
  kind: z.literal('factor'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  input: z.strictObject({
    symbol,
    name: z.string().trim().min(1),
    unit: z.string().trim().default(''),
    min: z.number().optional(),
    max: z.number().optional(),
  }),
  choices: z.array(choiceSchema).default([]),
  results: z.array(resultSchema).min(1),
  examples: z.array(exampleSchema).default([]),
}).superRefine((entry, ctx) => {
  if (entry.status === 'verified' && entry.examples.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['examples'], message: 'Mindestens ein Testbeispiel bei status "verified"' })
  }
})

export type FactorTool = z.output<typeof factorToolSchema>
export type FactorResult = z.output<typeof resultSchema>
export type FactorCase = z.output<typeof caseSchema>

export interface FactorValue {
  value: number
  rule: string
}

/** Der Fall, der zur Auswahl passt (erster Treffer) */
export function matchingCase(result: FactorResult, selection: Record<string, string>): FactorCase | undefined {
  return result.cases.find((candidate) =>
    Object.entries(candidate.when).every(([choice, option]) => selection[choice] === option),
  )
}

/** Alle Ergebnisse der Reihe nach; spätere dürfen sich auf frühere beziehen */
export function computeFactorTool(
  tool: FactorTool,
  input: number,
  selection: Record<string, string>,
): Record<string, FactorValue | undefined> {
  const scope: Record<string, number> = { [tool.input.symbol]: input }
  const values: Record<string, FactorValue | undefined> = {}
  for (const result of tool.results) {
    const match = matchingCase(result, selection)
    const base = match ? scope[match.per] : undefined
    if (!match || base === undefined) {
      values[result.symbol] = undefined
      continue
    }
    const value = match.factor * base
    scope[result.symbol] = value
    values[result.symbol] = { value, rule: match.rule }
  }
  return values
}

/** Jede mögliche Kombination der Auswahlen */
export function allSelections(tool: FactorTool): Record<string, string>[] {
  return tool.choices.reduce<Record<string, string>[]>(
    (combinations, choice) =>
      combinations.flatMap((combination) => choice.options.map((option) => ({ ...combination, [choice.key]: option.key }))),
    [{}],
  )
}

export function checkFactorTool(entry: FactorTool): string[] {
  const issues: string[] = []
  const choiceKeys = entry.choices.map((choice) => choice.key)
  if (new Set(choiceKeys).size !== choiceKeys.length) issues.push('choices: key doppelt vergeben')
  for (const choice of entry.choices) {
    const optionKeys = choice.options.map((option) => option.key)
    if (new Set(optionKeys).size !== optionKeys.length) issues.push(`choices (${choice.key}): Options-key doppelt vergeben`)
  }

  const known = [entry.input.symbol]
  for (const result of entry.results) {
    const where = `results (${result.symbol})`
    if (known.includes(result.symbol)) issues.push(`${where}: Symbol doppelt vergeben`)
    result.cases.forEach((candidate, index) => {
      if (!known.includes(candidate.per)) {
        issues.push(`${where}, cases[${index}]: per "${candidate.per}" ist weder die Eingabe noch ein vorheriges Ergebnis`)
      }
      for (const [choiceKey, optionKey] of Object.entries(candidate.when)) {
        const choice = entry.choices.find((item) => item.key === choiceKey)
        if (!choice) issues.push(`${where}, cases[${index}]: unbekannte Auswahl "${choiceKey}"`)
        else if (!choice.options.some((option) => option.key === optionKey)) {
          issues.push(`${where}, cases[${index}]: unbekannte Option "${optionKey}" bei "${choiceKey}"`)
        }
      }
    })
    for (const selection of allSelections(entry)) {
      const matches = result.cases.filter((candidate) =>
        Object.entries(candidate.when).every(([choice, option]) => selection[choice] === option),
      )
      const label = Object.values(selection).join(' + ') || 'ohne Auswahl'
      if (matches.length === 0) issues.push(`${where}: kein Faktor für ${label}`)
      if (matches.length > 1) issues.push(`${where}: mehrere Faktoren für ${label}`)
    }
    known.push(result.symbol)
  }

  entry.examples.forEach((example, index) => {
    const values = computeFactorTool(entry, example.input, example.choices)
    for (const [resultSymbol, expected] of Object.entries(example.expected)) {
      const actual = values[resultSymbol]?.value
      if (actual === undefined || Math.abs(actual - expected) > Math.abs(expected) * 0.001) {
        issues.push(`examples[${index}]: ${resultSymbol} ergibt ${actual ?? 'nichts'}, erwartet ${expected}`)
      }
    }
  })
  return issues
}
