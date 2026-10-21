import { content } from '../../content'
import { formatUnit } from '../../lib/units'

// Ohne mathjs, damit auch Listen und Suche (Start-Bundle) die Bezeichnungen nutzen können.

/** Anzeige-Bezeichnungen der Zusatzeinheiten, z. B. "gradDH" → "°dH" */
export const customUnitLabels: ReadonlyMap<string, string> = new Map(
  content.units.flatMap((unit) =>
    unit.label ? [unit.symbol, ...unit.aliases].map((name) => [name, unit.label] as [string, string]) : [],
  ),
)

/** Einheit lesbar, inkl. Bezeichnungen der Zusatzeinheiten */
export function formatAnyUnit(unit: string): string {
  return formatUnit(unit, customUnitLabels)
}
