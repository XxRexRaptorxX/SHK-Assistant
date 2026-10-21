import { content } from '../../content'
import { registerCustomUnits } from './registry'

let done = false

/**
 * Registriert die Zusatzeinheiten aus content/units in der App (einmalig).
 * Muss vor jeder Rechnung mit mathjs laufen (Formeln, Umrechner).
 */
export function ensureCustomUnits(): void {
  if (done) return
  done = true
  // Fehler wurden schon beim Build geprüft und hätten ihn abgebrochen
  registerCustomUnits(content.units)
}

/** Symbole von Zusatzeinheiten, die noch nicht fachlich geprüft sind */
export const unverifiedUnitSymbols: ReadonlySet<string> = new Set(
  content.units
    .filter((unit) => unit.status !== 'verified' && unit.definition !== '')
    .flatMap((unit) => [unit.symbol, ...unit.aliases]),
)
