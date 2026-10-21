import { content } from '../../content'
import { math } from '../../lib/math'
import { isKnownUnit } from './registry'

const TEMPERATURE = math.unit(1, 'K')

/** Zusatzeinheiten, die Formeln nur anbieten, wenn sie dort ausdrücklich stehen (z. B. PS, kcal) */
const notOfferedAutomatically: ReadonlySet<string> = new Set(
  content.units.filter((unit) => !unit.offerInFormulas).flatMap((unit) => [unit.symbol, ...unit.aliases]),
)

function usesRestrictedUnit(unit: string): boolean {
  return (unit.match(/[A-Za-z_]\w*/g) ?? []).some((name) => notOfferedAutomatically.has(name))
}

/**
 * Wählbare Einheiten für einen Wert mit der Haupteinheit `unit`:
 * die Haupteinheit, ausdrücklich genannte Einheiten (`explicit`) und alle
 * gleichartigen Einheiten aus den Umrechner-Größen (content/converter).
 *
 * Keine automatischen Alternativen bekommen:
 * - Temperaturen: Bei Differenzen gilt 10 K ≠ 10 °C, und ob ein Wert absolut oder eine
 *   Differenz ist, weiß nur die Formel.
 * - Scheinleistung (VA): für mathjs dimensionsgleich mit W, fachlich aber etwas anderes.
 * - Zusatzeinheiten mit offerInFormulas: false (PS nur mechanisch, kcal nur Wärme).
 * Passende Einheiten lassen sich in der Formel über `units` angeben.
 */
export function alternativeUnits(unit: string, explicit: readonly string[] = []): string[] {
  if (unit === '' || !isKnownUnit(unit)) return [unit]
  const base = math.unit(1, unit)
  const isApparentPower = /\b[kM]?VA\b/.test(unit)
  const fromConverter = base.equalBase(TEMPERATURE) || isApparentPower
    ? []
    : content.converter
        .filter((entry) => entry.kind === 'units')
        .flatMap((entry) => entry.units)
        .filter(
          (candidate) =>
            isKnownUnit(candidate) && !usesRestrictedUnit(candidate) && math.unit(1, candidate).equalBase(base),
        )

  const ordered = fromConverter.includes(unit) ? fromConverter : [unit, ...fromConverter]
  return [...new Set([...ordered, ...explicit])].filter((candidate) => candidate === unit || isKnownUnit(candidate))
}
