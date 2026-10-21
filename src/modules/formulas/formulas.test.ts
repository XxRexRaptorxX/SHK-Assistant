import { describe, expect, it } from 'vitest'
import { formatNumber, parseDecimal } from '../../lib/number'
import { formatUnit } from '../../lib/units'
import { checkFormula, evaluateExample, evaluateFormula, formatExpression } from './engine'
import { ensureCustomUnits } from '../units/customUnits'
import { formulaEntries } from './formulas'
import type { FormulaEntry } from './schema'

// Rein mathematisches Testgerüst (kein Fachinhalt): Fläche = Länge × Breite
const fixture: FormulaEntry = {
  id: 'formula.test-flaeche',
  visibility: 'public',
  status: 'verified',
  source: 'Test',
  verifiedBy: 'TS',
  verifiedAt: '2026-01-01',
  title: 'Testfläche',
  description: 'Test',
  category: '',
  variables: [
    { symbol: 'l', name: 'Länge', unit: 'm', units: ['cm'], description: '' },
    { symbol: 'b', name: 'Breite', unit: 'm', units: [], description: '' },
  ],
  constants: [],
  result: { symbol: 'A', name: 'Fläche', unit: 'm^2', units: ['cm^2'], decimals: 2 },
  expression: 'l * b',
  examples: [{ inputs: { l: '200 cm', b: 3 }, expected: '6 m^2', tolerance: 0.001 }],
}

describe('Formel-Engine', () => {
  it('rechnet mit Einheiten und rechnet das Ergebnis um', () => {
    const inputs = { l: { value: 2, unit: 'm' }, b: { value: 3, unit: 'm' } }
    expect(evaluateFormula(fixture, inputs)).toBeCloseTo(6)
    expect(evaluateFormula(fixture, inputs, 'cm^2')).toBeCloseTo(60000)
  })

  it('zeigt die Formel mit Malpunkt und Anzeige-Bezeichnungen', () => {
    const withLabel = { ...fixture, variables: fixture.variables.map((v) => (v.symbol === 'b' ? { ...v, label: 'B' } : v)) }
    expect(formatExpression(withLabel)).toBe('l · B')
  })

  it('prüft Testbeispiele', () => {
    expect(evaluateExample(fixture, fixture.examples[0]!).ok).toBe(true)
    expect(checkFormula({ ...fixture, examples: [{ ...fixture.examples[0]!, expected: 7 }] })[0]).toMatch(/Testbeispiel 1/)
  })

  it('meldet unbekannte Symbole, Einheiten und unbenutzte Variablen', () => {
    expect(checkFormula({ ...fixture, expression: 'l * x' })).toEqual(
      expect.arrayContaining([expect.stringMatching(/"x"/), expect.stringMatching(/"b" kommt/)]),
    )
    expect(checkFormula({ ...fixture, result: { ...fixture.result!, units: ['kg'] } })[0]).toMatch(/passt nicht/)
    expect(checkFormula({ ...fixture, result: { ...fixture.result!, unit: 'xyz' } })[0]).toMatch(/unbekannte Einheit/)
  })

  it('liest und formatiert deutsche Zahlen und Einheiten', () => {
    expect(parseDecimal('12,5')).toBe(12.5)
    expect(parseDecimal('1.234,5')).toBeUndefined()
    expect(parseDecimal('abc')).toBeUndefined()
    expect(formatNumber(1234.5, 2)).toBe('1.234,50')
    expect(formatUnit('kJ/(kg K)')).toBe('kJ/(kg·K)')
    expect(formatUnit('m^3/h')).toBe('m³/h')
    expect(formatUnit('kohm')).toBe('kΩ')
    expect(formatUnit('degC')).toBe('°C')
    expect(formatUnit('gradDH', new Map([['gradDH', '°dH']]))).toBe('°dH')
  })
})

// CLAUDE.md: Jede Formel wird automatisch gegen ihre Testbeispiele geprüft.
describe('Formeln in content/formulas', () => {
  // Zusatzeinheiten (z. B. mWS) wie in der App registrieren
  ensureCustomUnits()

  for (const formula of formulaEntries) {
    describe(formula.id, () => {
      it('besteht die fachliche Prüfung', () => {
        expect(checkFormula(formula)).toEqual([])
      })
      if (formula.examples.length === 0) {
        it.todo('Testbeispiel fehlt (Entwurf)')
      }
      formula.examples.forEach((example, index) => {
        it(`Testbeispiel ${index + 1}`, () => {
          const { expected, actual } = evaluateExample(formula, example)
          expect(Math.abs(actual - expected)).toBeLessThanOrEqual(example.tolerance * Math.abs(expected))
        })
      })
    })
  }
})
