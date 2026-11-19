import { describe, expect, it } from 'vitest'
import { listStatistics, median, parseNumberList, trimmedMean } from './statistics'

describe('Statistik einer Zahlenliste', () => {
  it('liest Listen mit Leerzeichen, Zeilenumbruch, Semikolon und Dezimalkomma', () => {
    expect(parseNumberList('1,5 2.5\n3;4; -1e2')).toEqual({ values: [1.5, 2.5, 3, 4, -100], invalid: [] })
    expect(parseNumberList('1, 2, 3')).toEqual({ values: [1, 2, 3], invalid: [] })
    expect(parseNumberList(' 1 abc 2 1,2,3 ')).toEqual({ values: [1, 2], invalid: ['abc', '1,2,3'] })
    expect(parseNumberList('   ')).toEqual({ values: [], invalid: [] })
  })

  it('berechnet den Median bei gerader und ungerader Anzahl', () => {
    expect(median([1, 3, 7])).toBe(3)
    expect(median([1, 3, 7, 9])).toBe(5)
  })

  it('lässt je Seite ⌊n · p⌋ Werte weg', () => {
    const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 100]
    expect(trimmedMean(sorted, 0.1)).toEqual({ value: 5.5, removed: 1 })
    expect(trimmedMean(sorted, 0.25)).toEqual({ value: 5.5, removed: 2 })
    expect(trimmedMean([1, 2, 3], 0.05)).toEqual({ value: 2, removed: 0 })
  })

  it('liefert alle Kennwerte unabhängig von der Reihenfolge', () => {
    const stats = listStatistics([100, 1, 9, 2, 8, 3, 7, 4, 6, 5])!
    expect(stats).toMatchObject({ count: 10, min: 1, max: 100, mean: 14.5, median: 5.5 })
    expect(stats.trimmed.map((t) => [t.fraction, t.removed, t.value])).toEqual([
      [0.05, 0, 14.5],
      [0.1, 1, 5.5],
      [0.2, 2, 5.5],
      [0.25, 2, 5.5],
    ])
    expect(listStatistics([])).toBeUndefined()
    expect(listStatistics([4])).toMatchObject({ mean: 4, median: 4 })
  })
})
