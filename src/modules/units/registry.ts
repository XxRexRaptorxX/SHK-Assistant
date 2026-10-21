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

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function isKnownUnit(name: string): boolean {
  try {
    math.unit(1, name)
    return true
  } catch {
    return false
  }
}

/**
 * Registriert Zusatzeinheiten in mathjs und rechnet ihre Testbeispiele nach.
 * Einträge ohne Definition (Entwürfe) werden übersprungen. Mehrfacher Aufruf ist unschädlich.
 * Liefert Fehlermeldungen.
 */
export function registerCustomUnits(units: readonly CustomUnitDefinition[]): string[] {
  const issues: string[] = []
  for (const unit of units) {
    if (unit.definition === '') continue
    const names = [unit.symbol, ...unit.aliases]
    const clash = names.find((name) => !registered.has(name) && isKnownUnit(name))
    if (clash) {
      issues.push(`${unit.id}: Einheit "${clash}" gibt es in mathjs bereits`)
      continue
    }
    try {
      math.createUnit(unit.symbol, { definition: unit.definition, aliases: unit.aliases }, { override: true })
      for (const name of names) registered.set(name, unit.definition)
    } catch (error) {
      issues.push(`${unit.id}: Definition "${unit.definition}" ist ungültig (${describeError(error)})`)
      continue
    }
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
