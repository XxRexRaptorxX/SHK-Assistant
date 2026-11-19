// Kennwerte einer Zahlenliste: Durchschnitt, Median und getrimmte Mittelwerte.
// Getrimmter Mittelwert zu p: je Seite werden k = ⌊n · p⌋ Werte der sortierten Liste weggelassen,
// aus den übrigen wird der Durchschnitt gebildet.
import { parseDecimal } from '../../lib/number'

/** Anteile, die je Seite weggelassen werden (5 %, 10 %, 20 %, 25 %) */
export const TRIM_LEVELS = [0.05, 0.1, 0.2, 0.25] as const

export interface ParsedList {
  values: number[]
  /** Teile, die keine Zahl sind, in Eingabereihenfolge */
  invalid: string[]
}

/**
 * Liest eine Zahlenliste. Trennzeichen: Leerzeichen, Zeilenumbruch und Semikolon.
 * Komma und Punkt sind Dezimaltrennzeichen; ein Komma direkt am Ende („1, 2, 3“) wird ignoriert.
 */
export function parseNumberList(text: string): ParsedList {
  const values: number[] = []
  const invalid: string[] = []
  for (const part of text.split(/[\s;]+/)) {
    if (part === '') continue
    const value = parseDecimal(part)
    if (value === undefined) invalid.push(part)
    else values.push(value)
  }
  return { values, invalid }
}

function mean(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

/** Mittelwert der aufsteigend sortierten Liste ohne je k Werte an beiden Enden; undefined, wenn nichts übrig bleibt */
export function trimmedMean(sorted: readonly number[], fraction: number) {
  const removed = Math.floor(sorted.length * fraction)
  const kept = sorted.slice(removed, sorted.length - removed)
  return kept.length === 0 ? undefined : { value: mean(kept), removed }
}

export function median(sorted: readonly number[]): number {
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 1 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2
}

export interface ListStatistics {
  count: number
  min: number
  max: number
  mean: number
  median: number
  trimmed: { fraction: number; value: number; removed: number }[]
}

/** Kennwerte; undefined bei leerer Liste */
export function listStatistics(values: readonly number[]): ListStatistics | undefined {
  if (values.length === 0) return undefined
  const sorted = [...values].sort((a, b) => a - b)
  return {
    count: sorted.length,
    min: sorted[0]!,
    max: sorted[sorted.length - 1]!,
    mean: mean(sorted),
    median: median(sorted),
    trimmed: TRIM_LEVELS.flatMap((fraction) => {
      const result = trimmedMean(sorted, fraction)
      return result ? [{ fraction, ...result }] : []
    }),
  }
}
