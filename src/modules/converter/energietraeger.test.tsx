import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { baseAmount, convertByFactors, FactorConverter } from './FactorConverter'
import { checkConverter, type ConverterEntry, type ConverterFactor } from './schema'

// Umrechner „Energieträger“: Mengen über den Heizwert (Bezugsgröße 1 kWh) ineinander umrechnen.
// Die Faktoren stehen so im Inhalt, wie sie in der Quelle stehen (z. B. 12,87 kWh je 1,96 l), dafür gibt es „per“.

const found = content.converter.find((candidate) => candidate.id === 'converter.energietraeger')
if (!found) throw new Error('Umrechner Energieträger erwartet')
const entry: ConverterEntry = found
const factor = (key: string): ConverterFactor => {
  const match = entry.factors.find((candidate) => candidate.key === key)
  if (!match) throw new Error(`Faktor ${key} erwartet`)
  return match
}
const convert = (value: number, from: string, to: string) => convertByFactors(value, factor(from), factor(to))

describe('Umrechner Energieträger', () => {
  it('ist fehlerfrei, intern und noch ungeprüft', () => {
    expect(checkConverter(entry)).toEqual([])
    expect(entry.visibility).toBe('internal')
    expect(entry.status).toBe('draft')
    expect(entry.kind).toBe('factors')
    expect(entry.base).toBe('kwh')
    expect(entry.from).toBe('heizoel-l')
    // Jeder Energieträger hat eine Quelle, nur die Bezugsgröße nicht
    expect(entry.factors.filter((candidate) => !candidate.source).map((candidate) => candidate.key)).toEqual(['kwh'])
  })

  it('rechnet Heizöl in Erdgas, Strom und kWh um', () => {
    // HeizkostenV § 9: Heizöl EL 10 kWh/l, Erdgas H 10 kWh/m³, Faktor 1,11 Brennwert/Heizwert
    expect(convert(2000, 'heizoel-l', 'kwh')).toBeCloseTo(20000, 9)
    expect(convert(2000, 'heizoel-l', 'erdgas-m3')).toBeCloseTo(2000, 9)
    expect(convert(2000, 'heizoel-l', 'erdgas-kwh-hs')).toBeCloseTo(22200, 9)
    expect(convert(2000, 'heizoel-l', 'strom-kwh')).toBeCloseTo(20000, 9)
    // und zurück
    expect(convert(22200, 'erdgas-kwh-hs', 'heizoel-l')).toBeCloseTo(2000, 9)
  })

  it('übernimmt die Heizwerte der Quellen', () => {
    // DGUV Regel 110-010: Propan 12,87 kWh/kg, 1,96 l/kg
    expect(convert(1.96, 'fluessiggas-l', 'kwh')).toBeCloseTo(12.87, 9)
    expect(convert(1, 'fluessiggas-kg', 'fluessiggas-l')).toBeCloseTo(1.96, 9)
    expect(baseAmount(factor('pellets-t'))).toBe(5000)
    expect(convert(1, 'pellets-t', 'pellets-kg')).toBeCloseTo(1000, 9)
    expect(baseAmount(factor('hackschnitzel-srm'))).toBe(650)
    // LWF-Merkblatt 20: Buche, Wassergehalt 20 %
    expect(baseAmount(factor('buche-rm'))).toBe(1885)
    expect(baseAmount(factor('buche-kg'))).toBe(3.86)
  })

  it('zeigt unter dem Rechner die Heizwerte je Energieträger, Quellen hinter einem i-Knopf', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FactorConverter entry={entry} initialValue="2000" />
      </MemoryRouter>,
    )
    expect(html).toContain('1 Einheit in kWh')
    expect(html).toContain('aria-label="Scheitholz Buche"')
    expect(html).toContain('1.885 kWh')
    expect(html).toContain('Raummeter (Ster) Buche · Wassergehalt 20 %')
    expect(html).toContain('aria-label="Quelle Liter Heizöl EL" aria-expanded="false"')
    // Quelle erst nach Antippen
    expect(html).not.toContain('HeizkostenV § 9 Abs. 3')
  })
})

describe('Faktoren mit „per“ und Bezugsgröße', () => {
  const base: ConverterFactor = { key: 'a', label: 'a', value: 1 }
  const scaled: ConverterFactor = { key: 'b', label: 'b', value: 2, per: 8 }

  it('rechnet ohne „per“ wie bisher, mit „per“ über die Bezugsmenge', () => {
    expect(convertByFactors(3, base, { key: 'c', label: 'c', value: 1.4 })).toBeCloseTo(4.2, 9)
    // 2 b = 8 a → 1 b = 4 a
    expect(convertByFactors(1, scaled, base)).toBe(4)
    expect(convertByFactors(4, base, scaled)).toBe(1)
  })

  it('prüft die Bezugsgröße', () => {
    const withBase = (key: string, factors: ConverterFactor[]) => ({ ...entry, factors, base: key, from: 'a', to: 'b', names: { a: 'A', b: 'B' } })
    expect(checkConverter(withBase('a', [base, scaled]))).toEqual([])
    expect(checkConverter(withBase('x', [base, scaled]))).toEqual(['base: "x" steht nicht in factors'])
    expect(checkConverter(withBase('b', [base, scaled]))).toEqual(['base: "b" muss value = per haben (Bezugsgröße)'])
  })
})
