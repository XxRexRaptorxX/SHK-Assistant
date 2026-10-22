import { FRACTION_DENOMINATORS } from './constants'
import { formatFractionParts } from './ratio'

// Brüche – ein Wert in verschiedenen Nennern (erweitert bzw. als nächster Bruch genähert).

export { FRACTION_DENOMINATORS }
export type FractionDenominator = (typeof FRACTION_DENOMINATORS)[number]

export const DENOMINATOR_LABELS: Record<FractionDenominator, string> = {
  '2': 'Halbe',
  '3': 'Drittel',
  '4': 'Viertel',
  '5': 'Fünftel',
  '6': 'Sechstel',
  '8': 'Achtel',
  '10': 'Zehntel',
  '12': 'Zwölftel',
  '16': 'Sechzehntel',
  '32': 'Zweiunddreißigstel',
  '64': 'Vierundsechzigstel',
  '100': 'Hundertstel',
}

/** Wert mit festem Nenner: genau, wenn er sich glatt erweitern lässt, sonst der nächste Bruch mit "≈" */
export function inDenominator(value: number, denominator: number): string {
  const numerator = Math.round(value * denominator)
  const exact = Math.abs(numerator / denominator - value) < 1e-9 * Math.max(1, Math.abs(value))
  return formatFractionParts(numerator, denominator, exact)
}
