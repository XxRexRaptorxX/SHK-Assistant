import { parseDecimal } from '../../lib/number'

// Prozent, Promille, Dezimalzahl und Bruch – alles über den Dezimalwert.

export const RATIO_FORMS = ['percent', 'permille', 'decimal', 'fraction'] as const
export type RatioForm = (typeof RATIO_FORMS)[number]

export const RATIO_LABELS: Record<RatioForm, string> = {
  percent: 'Prozent (%)',
  permille: 'Promille (‰)',
  decimal: 'Dezimalzahl',
  fraction: 'Bruch',
}

/**
 * Liest einen Bruch: "3/4", "-1/8" oder gemischt "1 1/2".
 * Liefert undefined bei ungültiger Eingabe oder Nenner 0.
 */
export function parseFraction(input: string): number | undefined {
  const match = /^\s*([+-])?\s*(?:(\d+)\s+)?(\d+)\s*\/\s*(\d+)\s*$/.exec(input)
  // Ganze Zahlen und Dezimalzahlen sind auch erlaubt ("2", "0,5")
  if (!match) return parseDecimal(input)
  const [, sign, whole, numerator, denominator] = match
  const d = Number(denominator)
  if (d === 0) return undefined
  const value = Number(whole ?? 0) + Number(numerator) / d
  return sign === '-' ? -value : value
}

/** Dezimalwert aus einer Eingabe in der gewählten Form */
export function toDecimal(input: string, form: RatioForm): number | undefined {
  if (form === 'fraction') return parseFraction(input)
  const value = parseDecimal(input)
  if (value === undefined) return undefined
  return form === 'percent' ? value / 100 : form === 'permille' ? value / 1000 : value
}

export interface Fraction {
  numerator: number
  denominator: number
  /** false, wenn der Bruch den Wert nur annähert */
  exact: boolean
}

/**
 * Nächster Bruch mit Nenner bis maxDenominator (Kettenbruch-Näherung), gekürzt.
 * 0.75 → 3/4, 0.333… → 1/3, 1.5 → 3/2.
 */
export function toFraction(value: number, maxDenominator = 1000): Fraction {
  const sign = value < 0 ? -1 : 1
  const x = Math.abs(value)
  // Konvergenten h/k des Kettenbruchs
  let [h0, h1] = [0, 1]
  let [k0, k1] = [1, 0]
  let rest = x
  for (let i = 0; i < 64; i++) {
    const a = Math.floor(rest)
    const [h2, k2] = [a * h1 + h0, a * k1 + k0]
    if (k2 > maxDenominator) break
    ;[h0, h1, k0, k1] = [h1, h2, k1, k2]
    const fractional = rest - a
    if (fractional < 1e-12) break
    rest = 1 / fractional
  }
  const exact = Math.abs(h1 / k1 - x) < 1e-9 * Math.max(1, x)
  return { numerator: sign * h1, denominator: k1, exact }
}
