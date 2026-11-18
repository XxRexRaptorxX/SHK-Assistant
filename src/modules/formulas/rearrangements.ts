// Wird auch von vite.config.ts geladen (über schema.ts): Importe mit Dateiendung .ts, sonst nur Typen.
import type { FormulaEntry, FormulaRearrangement } from './schema.ts'

/** id der Seite, die eine Formel nach symbol umstellt, z. B. "formula.x.nach-pel" */
export function rearrangedId(base: Pick<FormulaEntry, 'id'>, symbol: string): string {
  return `${base.id}.nach-${symbol.toLowerCase().replace(/_/g, '-')}`
}

/** Variablen einer Formel, die im Ausdruck vorkommen (ganze Wörter) */
const usesSymbol = (expression: string, symbol: string) => new RegExp(`(^|[^A-Za-z0-9_])${symbol}([^A-Za-z0-9_]|$)`).test(expression)

/**
 * Baut aus einer Formel und einer Umstellung mit eigenem Ausdruck die umgestellte Formel:
 * Die gesuchte Variable wird zum Ergebnis, das bisherige Ergebnis zur Eingabe (an erster Stelle).
 * Metadaten, Skizze und Kategorie kommen von der Ausgangsformel, die Testbeispiele werden
 * rückwärts gerechnet (bisheriges Ergebnis als Eingabe, bisherige Eingabe als Erwartung).
 */
export function rearrangedFormula(base: FormulaEntry, item: FormulaRearrangement): FormulaEntry | undefined {
  const target = base.variables.find((v) => v.symbol === item.symbol)
  const result = base.result
  if (!target || !result || item.expression === undefined) return undefined
  const expression = item.expression
  return {
    ...base,
    id: rearrangedId(base, item.symbol),
    title: item.title ?? base.title,
    description: item.description ?? `Umgestellte Form von „${base.title}“: berechnet ${target.name} aus den übrigen Größen.`,
    variables: [
      {
        symbol: result.symbol,
        label: result.label,
        name: result.name,
        term: result.term,
        unit: result.unit,
        unitLabel: result.unitLabel,
        units: result.units,
        description: '',
        min: result.min,
      },
      ...base.variables.filter((v) => v.symbol !== item.symbol),
    ],
    constants: base.constants.filter((c) => usesSymbol(expression, c.symbol)),
    result: {
      symbol: target.symbol,
      label: target.label,
      name: target.name,
      term: target.term,
      unit: target.unit,
      unitLabel: target.unitLabel,
      units: target.units,
      min: item.min ?? target.min,
      minMessage: item.minMessage,
      decimals: item.decimals ?? 2,
    },
    expression,
    examples: base.examples.flatMap((example) => {
      const expected = example.inputs[item.symbol]
      if (expected === undefined) return []
      const inputs = Object.fromEntries(Object.entries(example.inputs).filter(([symbol]) => symbol !== item.symbol))
      return [{ ...example, inputs: { [result.symbol]: example.expected, ...inputs }, expected }]
    }),
    rearrangements: [],
  }
}

/** Alle Formeln samt der daraus entstehenden umgestellten Seiten */
export function withRearrangements(entries: readonly FormulaEntry[]): FormulaEntry[] {
  return entries.flatMap((entry) => [
    entry,
    ...(entry.rearrangements ?? []).flatMap((item) => rearrangedFormula(entry, item) ?? []),
  ])
}

/** Prüft die Umstellungen einer Formel; die umgestellten Seiten mit derselben Prüfung wie Formeln */
export function checkRearrangements(entry: FormulaEntry, check: (formula: FormulaEntry) => string[]): string[] {
  const issues: string[] = []
  const seen = new Set<string>()
  for (const item of entry.rearrangements ?? []) {
    const prefix = `Umstellung nach "${item.symbol}"`
    if (seen.has(item.symbol)) issues.push(`${prefix}: doppelt`)
    seen.add(item.symbol)
    if (!entry.variables.some((v) => v.symbol === item.symbol)) {
      issues.push(`${prefix}: keine Variable dieser Formel`)
      continue
    }
    if (item.expression === undefined) continue
    if (usesSymbol(item.expression, item.symbol)) issues.push(`${prefix}: Ausdruck enthält die gesuchte Größe`)
    const derived = rearrangedFormula(entry, item)
    if (!derived) continue
    if (derived.examples.length === 0) issues.push(`${prefix}: kein Testbeispiel zum Rückwärtsrechnen`)
    issues.push(...check(derived).map((issue) => `${prefix}: ${issue}`))
  }
  return issues
}

/**
 * Zusammengehörige Formeln (Ausgangsformel, umgestellte Seiten, verwiesene Formeln) je id.
 * Jede Formel einer Gruppe kennt so die Seiten, die nach ihren übrigen Größen auflösen.
 */
export function rearrangementGroups(entries: readonly FormulaEntry[]): Map<string, FormulaEntry[]> {
  const byId = new Map(entries.map((entry) => [entry.id, entry]))
  const groups = new Map<string, FormulaEntry[]>()
  for (const base of entries) {
    if (!base.rearrangements?.length) continue
    const members = [
      base,
      ...(base.rearrangements ?? []).flatMap((item) => {
        const member = byId.get(item.formula ?? rearrangedId(base, item.symbol))
        return member ? [member] : []
      }),
    ]
    for (const member of members) groups.set(member.id, members)
  }
  return groups
}

/** Seiten, die die Formel nach einem ihrer Formelzeichen umstellen: Symbol → Formel */
export function rearrangementTargets(
  formula: FormulaEntry,
  groups: ReadonlyMap<string, readonly FormulaEntry[]>,
): Map<string, FormulaEntry> {
  const targets = new Map<string, FormulaEntry>()
  const symbols = new Set(formula.variables.map((v) => v.symbol))
  for (const member of groups.get(formula.id) ?? []) {
    if (member.id === formula.id || !member.result || !symbols.has(member.result.symbol)) continue
    if (!targets.has(member.result.symbol)) targets.set(member.result.symbol, member)
  }
  return targets
}
