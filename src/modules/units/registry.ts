// Wird auch beim Build geladen: Importe mit Dateiendung .ts.
import { math } from '../../lib/math.ts'

/** Was zum Registrieren einer Zusatzeinheit nötig ist (Teil eines Einheiten-Eintrags) */
export interface CustomUnitDefinition {
  id: string
  symbol: string
  definition: string
  aliases: string[]
  examples: { value: string; expected: string; tolerance: number }[]
}

/** Von uns registrierte Einheiten mit ihrer Definition */
const registered = new Map<string, string>()
/** Angekündigte Einheiten ohne Definition (Entwürfe) */
const pending = new Set<string>()

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

export function isKnownUnit(name: string): boolean {
  try {
    math.unit(1, name)
    return true
  } catch {
    return false
  }
}

/** Einheiten-Namen in einem Ausdruck, z. B. "kcal/h" → ["kcal", "h"] */
function unitNames(expression: string): string[] {
  return expression.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? []
}

/**
 * true, wenn der Ausdruck nur noch an angekündigten, aber undefinierten Zusatzeinheiten scheitert
 * (z. B. "kcal/h", solange kcal ein Entwurf ohne Definition ist).
 */
export function isPendingUnit(expression: string): boolean {
  const names = unitNames(expression)
  return names.some((name) => pending.has(name)) && names.every((name) => pending.has(name) || isKnownUnit(name))
}

/**
 * Registriert Zusatzeinheiten in mathjs und rechnet ihre Testbeispiele nach.
 * Einträge ohne Definition (Entwürfe) werden nur als angekündigt vermerkt.
 * Mehrfacher Aufruf ist unschädlich. Liefert Fehlermeldungen.
 */
export function registerCustomUnits(units: readonly CustomUnitDefinition[]): string[] {
  const issues: string[] = []
  const created: CustomUnitDefinition[] = []
  // 1. Alle registrieren, damit Testbeispiele auch andere Zusatzeinheiten nutzen können
  for (const unit of units) {
    const names = [unit.symbol, ...unit.aliases]
    const clash = names.find((name) => !registered.has(name) && isKnownUnit(name))
    if (clash) {
      issues.push(`${unit.id}: Einheit "${clash}" gibt es in mathjs bereits`)
      continue
    }
    if (unit.definition === '') {
      for (const name of names) pending.add(name)
      continue
    }
    try {
      math.createUnit(unit.symbol, { definition: unit.definition, aliases: unit.aliases }, { override: true })
      for (const name of names) {
        registered.set(name, unit.definition)
        pending.delete(name)
      }
      created.push(unit)
    } catch (error) {
      issues.push(`${unit.id}: Definition "${unit.definition}" ist ungültig (${describeError(error)})`)
    }
  }
  // 2. Testbeispiele nachrechnen
  for (const unit of created) {
    unit.examples.forEach((example, index) => {
      const label = `${unit.id}: Testbeispiel ${index + 1}`
      try {
        const expected = math.unit(example.expected)
        const unitName = expected.formatUnits()
        const expectedValue = expected.toNumber(unitName)
        const actual = math.unit(example.value).toNumber(unitName)
        const allowed = example.tolerance * Math.max(Math.abs(expectedValue), Number.EPSILON)
        if (Math.abs(actual - expectedValue) > allowed) {
          issues.push(`${label}: erwartet ${example.expected}, berechnet ${actual} ${unitName}`)
        }
      } catch (error) {
        issues.push(`${label}: ${describeError(error)}`)
      }
    })
  }
  return issues
}
