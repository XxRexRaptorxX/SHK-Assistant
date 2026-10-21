import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { math } from '../../lib/math'
import { formatSignificant } from '../../lib/number'
import { ensureCustomUnits } from '../units/customUnits'
import { registerCustomUnits } from '../units/registry'
import { ConverterListPage } from './ConverterListPage'
import ConverterPage, { convert } from './ConverterPage'
import { converterEntries } from './converter'
import { checkConverter, type ConverterEntry } from './schema'

const meta = {
  visibility: 'public' as const,
  status: 'verified' as const,
  source: 'Test',
  verifiedBy: 'TS',
  verifiedAt: '2026-01-01',
}

const pressure: ConverterEntry = {
  ...meta,
  id: 'converter.test-druck',
  title: 'Testdruck',
  description: '',
  units: ['bar', 'mbar', 'Pa'],
  from: 'bar',
  to: 'mbar',
}

describe('Zusatzeinheiten', () => {
  const testUnit = (overrides: Partial<Parameters<typeof registerCustomUnits>[0][number]>) => ({
    id: 'unit.test',
    symbol: 'zzTestEinheit',
    definition: '1000 Pa',
    aliases: [],
    examples: [],
    ...overrides,
  })

  it('registriert eine Einheit und prüft ihre Testbeispiele', () => {
    const issues = registerCustomUnits([
      testUnit({ examples: [{ value: '2 zzTestEinheit', expected: '2000 Pa', tolerance: 0.001 }] }),
    ])
    expect(issues).toEqual([])
    expect(math.unit(1, 'zzTestEinheit').toNumber('kPa')).toBeCloseTo(1)
    // erneutes Registrieren ist unschädlich
    expect(registerCustomUnits([testUnit({})])).toEqual([])
  })

  it('meldet falsche Testbeispiele, ungültige Definitionen und Namenskonflikte', () => {
    expect(
      registerCustomUnits([testUnit({ symbol: 'zzB', examples: [{ value: '1 zzB', expected: '5 Pa', tolerance: 0.001 }] })])[0],
    ).toMatch(/Testbeispiel 1: erwartet 5 Pa/)
    expect(registerCustomUnits([testUnit({ symbol: 'zzC', definition: '3 Blubb' })])[0]).toMatch(/ungültig/)
    expect(registerCustomUnits([testUnit({ symbol: 'bar' })])[0]).toMatch(/gibt es in mathjs bereits/)
  })

  it('überspringt Entwürfe ohne Definition', () => {
    expect(registerCustomUnits([testUnit({ symbol: 'zzD', definition: '' })])).toEqual([])
    expect(() => math.unit(1, 'zzD')).toThrow()
  })
})

describe('Umrechner-Prüfung', () => {
  it('akzeptiert passende Einheiten', () => {
    expect(checkConverter(pressure)).toEqual([])
  })

  it('meldet unbekannte, unpassende und doppelte Einheiten sowie falsche Voreinstellungen', () => {
    const issues = checkConverter({ ...pressure, units: ['bar', 'kW', 'xyz', 'bar'], to: 'psi' })
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/"xyz" unbekannt/),
        'Einheit "kW" passt nicht zu "bar"',
        'Einheiten doppelt aufgeführt',
        'to: "psi" steht nicht in units',
      ]),
    )
  })

  it('erkennt, dass "PS" in mathjs keine Leistung ist', () => {
    expect(checkConverter({ ...pressure, units: ['W', 'PS'], from: 'W', to: 'W' })).toEqual([
      'Einheit "PS" passt nicht zu "W"',
    ])
  })
})

describe('Umrechnen', () => {
  it('rechnet mit Nullpunkt-Verschiebung bei Temperaturen', () => {
    expect(convert(20, 'degC', 'K')).toBeCloseTo(293.15)
    expect(convert(1, 'bar', 'mbar')).toBeCloseTo(1000)
  })

  it('kennt die Zusatzeinheiten aus content/units', () => {
    ensureCustomUnits()
    for (const unit of content.units.filter((u) => u.definition !== '')) {
      expect(() => math.unit(1, unit.symbol)).not.toThrow()
    }
  })

  it('formatiert mit gültigen Stellen in deutscher Schreibweise', () => {
    expect(formatSignificant(0.0980665)).toBe('0,0980665')
    expect(formatSignificant(98066.5)).toBe('98.066,5')
    expect(formatSignificant(1234567.89)).toBe('1.234.570')
  })

  it('lädt die echten Größen', () => {
    expect(converterEntries.length).toBeGreaterThan(0)
  })
})

describe('Umrechner-Seiten', () => {
  const renderAt = (path: string) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/umrechner" element={<ConverterListPage entries={[pressure]} />} />
          <Route path="/umrechner/:slug" element={<ConverterPage entries={[pressure]} />} />
        </Routes>
      </MemoryRouter>,
    )

  it('listet die Größen mit ihren Einheiten', () => {
    const html = renderAt('/umrechner')
    expect(html).toContain('href="/umrechner/test-druck"')
    expect(html).toContain('bar · mbar · Pa')
  })

  it('rechnet den Startwert 1 in die Zieleinheit und in alle Einheiten um', () => {
    const html = renderAt('/umrechner/test-druck')
    expect(html).toContain('1.000 mbar')
    expect(html).toContain('In allen Einheiten')
    expect(html).toContain('100.000')
    expect(html).toContain('Testdruck</h1>')
  })

  it('meldet unbekannte Größen', () => {
    expect(renderAt('/umrechner/gibt-es-nicht')).toContain('Größe nicht gefunden')
  })
})
