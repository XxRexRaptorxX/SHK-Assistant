import { describe, expect, it } from 'vitest'
import { formatNumber, parseDecimal } from '../../lib/number'
import { formatUnit } from '../../lib/units'
import { asTargetUnit, math } from '../../lib/math'
import { alternativeUnits } from '../units/alternatives'
import { checkFormula, evaluateExample, evaluateFormula, exampleInputs, formatExpression } from './engine'
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
    expect(['deg', 'grad', 'arcmin', 'arcsec'].map((u) => formatUnit(u))).toEqual(['°', 'gon', '′', '″'])
    expect(formatUnit('N/cm^2')).toBe('N/cm²')
    expect(formatUnit('gradDH', new Map([['gradDH', '°dH']]))).toBe('°dH')
  })
})

describe('Wählbare Einheiten', () => {
  ensureCustomUnits()

  it('bietet gleichartige Einheiten aus dem Umrechner an', () => {
    const areas = alternativeUnits('m^2')
    expect(areas).toContain('cm^2')
    expect(areas).toContain('hectare')
    expect(alternativeUnits('m^3/h')).toContain('l/min')
    // ausdrücklich genannte Einheiten kommen dazu, unbekannte Kombinationen bleiben allein
    expect(alternativeUnits('kJ/(kg K)', ['J/(kg K)'])).toEqual(['kJ/(kg K)', 'J/(kg K)'])
    expect(alternativeUnits('')).toEqual([''])
  })

  it('rechnet Ergebnisse auch in Kehrwert-Einheiten wie 1/K aus', () => {
    const inverse: FormulaEntry = {
      ...fixture,
      variables: [{ symbol: 'l', name: 'Länge', unit: 'K', units: [], description: '' }],
      result: { symbol: 'k', name: 'Kehrwert', unit: '1/K', units: [], decimals: 3 },
      expression: '1 / l',
      examples: [],
    }
    expect(evaluateFormula(inverse, { l: { value: 4, unit: 'K' } })).toBeCloseTo(0.25)
  })

  it('rechnet absolute Temperaturen in °C mit Nullpunkt, Differenzen bleiben in K', () => {
    const mix = formulaEntries.find((f) => f.id === 'formula.thermodynamik.mischtemperatur-gleicher-stoff')!
    const inputs = {
      mk: { value: 10, unit: 'kg' },
      Tk: { value: 10, unit: 'degC' },
      mw: { value: 10, unit: 'kg' },
      Tw: { value: 50, unit: 'degC' },
    }
    expect(evaluateFormula(mix, inputs, 'degC')).toBeCloseTo(30)
    expect(evaluateFormula(mix, inputs)).toBeCloseTo(303.15)
    const diff = formulaEntries.find((f) => f.id === 'formula.thermodynamik.temperaturdifferenz')!
    expect(evaluateFormula(diff, { T2: { value: 30, unit: 'degC' }, T1: { value: 20, unit: 'degC' } })).toBeCloseTo(10)
  })

  it('bietet bei Temperaturen keine automatischen Alternativen an (Differenz ≠ Temperatur)', () => {
    expect(alternativeUnits('K')).toEqual(['K'])
    expect(alternativeUnits('degC')).toEqual(['degC'])
  })

  // Jede angebotene Einheit muss dasselbe Ergebnis liefern (Umrechnung über mathjs)
  for (const formula of formulaEntries.filter((f) => f.result && f.examples.length > 0)) {
    it(`${formula.id}: Ergebnis unabhängig von der gewählten Einheit`, () => {
      const result = formula.result!
      for (const example of formula.examples) {
        const inputs = exampleInputs(formula, example)
        const baseline = evaluateFormula(formula, inputs)
        const same = (actual: number, expected: number) =>
          expect(Math.abs(actual - expected)).toBeLessThanOrEqual(1e-9 * Math.max(1, Math.abs(expected)))

        for (const variable of formula.variables) {
          const input = inputs[variable.symbol]!
          for (const unit of alternativeUnits(variable.unit, variable.units)) {
            const value =
              unit === variable.unit ? input.value : math.unit(input.value, variable.unit).toNumber(asTargetUnit(unit))
            same(evaluateFormula(formula, { ...inputs, [variable.symbol]: { value, unit } }), baseline)
          }
        }
        for (const unit of alternativeUnits(result.unit, result.units)) {
          const expected =
            unit === result.unit ? baseline : math.unit(baseline, result.unit).toNumber(asTargetUnit(unit))
          same(evaluateFormula(formula, inputs, unit), expected)
        }
      }
    })
  }
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
