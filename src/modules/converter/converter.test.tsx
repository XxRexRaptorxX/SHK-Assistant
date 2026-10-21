import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { math } from '../../lib/math'
import { formatSignificant } from '../../lib/number'
import { ensureCustomUnits } from '../units/customUnits'
import { registerCustomUnits } from '../units/registry'
import { ConverterListPage } from './ConverterListPage'
import ConverterPage from './ConverterPage'
import { converterEntries } from './converter'
import { formatFraction } from './RatioConverter'
import { parseFraction, toDecimal, toFraction } from './ratio'
import { convertByFactors, FactorConverter } from './FactorConverter'
import { checkConverter, type ConverterEntry, type ConverterFactor } from './schema'
import { ratioToSlope, slopeToRatio } from './slope'
import { normalizeForSearch } from '../../lib/text'
import { TableView } from './TableView'
import { convert, UnitConverter } from './UnitConverter'

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
  kind: 'units',
  units: ['bar', 'mbar', 'Pa'],
  factors: [],
  from: 'bar',
  to: 'mbar',
  columns: [],
  rows: [],
}

const blank = { units: [], factors: [], from: '', to: '', columns: [], rows: [] }

const wood: ConverterEntry = {
  ...pressure,
  ...blank,
  id: 'converter.test-holz',
  title: 'Testholz',
  kind: 'factors',
  factors: [
    { key: 'fm', label: 'Festmeter', value: 1 },
    { key: 'rm', label: 'Raummeter', value: 1.4 },
    { key: 'srm', label: 'Schüttraummeter', value: 2.2 },
  ],
  from: 'rm',
  to: 'fm',
  min: 0,
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

  it('erlaubt angekündigte Zusatzeinheiten ohne Definition', () => {
    registerCustomUnits([{ id: 'unit.zz-pending', symbol: 'zzPending', definition: '', aliases: [], examples: [] }])
    expect(checkConverter({ ...pressure, units: ['W', 'zzPending/h'], from: 'W', to: 'W' })).toEqual([])
    expect(checkConverter({ ...pressure, units: ['W', 'zzUnbekannt/h'], from: 'W', to: 'W' })[0]).toMatch(/unbekannt/)
  })

  it('prüft Tabellen und nicht benutzte Felder je Art', () => {
    const table = { ...pressure, ...blank, kind: 'table' as const, columns: ['A', 'B'], rows: [['1', '2'], ['3']] }
    expect(checkConverter(table)).toEqual(['rows.1: 1 Zellen, erwartet 2'])
    expect(checkConverter({ ...table, rows: [] })).toEqual(['rows: Pflicht bei status "verified"'])
    expect(checkConverter({ ...pressure, kind: 'slope' })).toEqual([
      'units: wird bei kind "slope" nicht verwendet',
      'from: wird bei kind "slope" nicht verwendet',
      'to: wird bei kind "slope" nicht verwendet',
    ])
    expect(checkConverter({ ...pressure, ...blank, kind: 'ratio' })).toEqual([])
  })
})

describe('Wasserhärte (Spezifikation, Testfälle A–D)', () => {
  ensureCustomUnits()
  const near = (actual: number, expected: number) =>
    expect(Math.abs(actual - expected) / expected).toBeLessThanOrEqual(0.005)

  it('A: 14 °dH', () => {
    near(convert(14, 'gradDH', 'gradFH'), 24.92)
    near(convert(14, 'gradDH', 'gradEH'), 17.542)
    near(convert(14, 'gradDH', 'mmol/l'), 2.4962)
  })

  it('B: 10 °fH', () => {
    near(convert(10, 'gradFH', 'gradDH'), 5.618)
    near(convert(10, 'gradFH', 'gradEH'), 7.04)
    near(convert(10, 'gradFH', 'mmol/l'), 1)
  })

  it('C: 1 mmol/l', () => {
    near(convert(1, 'mmol/l', 'gradDH'), 5.6085)
    near(convert(1, 'mmol/l', 'gradFH'), 10)
    near(convert(1, 'mmol/l', 'gradEH'), 7.0423)
  })

  const hardness = converterEntries.find((e) => e.id === 'converter.wasserhaerte')!
  const render = (value: string) =>
    renderToStaticMarkup(<UnitConverter entry={hardness} initialValue={value} />)

  it('D: lehnt negative, leere und nichtnumerische Eingaben kontrolliert ab, 0 ist gültig', () => {
    expect(render('-1')).toContain('Ungültige Eingabe (keine negativen Werte)')
    expect(render('')).toContain('Bitte einen Wert eingeben.')
    expect(render('abc')).toContain('Ungültige Eingabe')
    const zero = render('0')
    expect(zero).not.toContain('Ungültige Eingabe')
    expect(zero).toContain('0 mmol/l')
  })
})

describe('Rohrdimensionen', () => {
  it('findet Zollmaße mit und ohne Bruchzeichen', () => {
    expect(normalizeForSearch('1 ¼')).toBe(normalizeForSearch('1 1/4'))
    const pipes = converterEntries.find((e) => e.id === 'converter.rohrdimensionen')!
    const html = renderToStaticMarkup(<TableView entry={pipes} initialQuery="1 1/4" />)
    expect(html).toContain('DN 32')
    expect(html).not.toContain('DN 15')
  })
})

describe('Richtwert-Faktoren (Holzmaße)', () => {
  const [fm, rm, srm] = wood.factors as [ConverterFactor, ConverterFactor, ConverterFactor]

  it('rechnet über die gemeinsame Bezugsmenge um', () => {
    expect(convertByFactors(1, fm, rm)).toBeCloseTo(1.4)
    expect(convertByFactors(1, rm, fm)).toBeCloseTo(0.714, 3)
    expect(convertByFactors(10, fm, srm)).toBeCloseTo(22)
    expect(convertByFactors(1.4, rm, srm)).toBeCloseTo(2.2)
  })

  it('prüft Schlüssel und Voreinstellungen', () => {
    expect(checkConverter(wood)).toEqual([])
    const broken = { ...wood, factors: [...wood.factors, { key: 'rm', label: 'doppelt', value: 1 }], to: 'xyz' }
    expect(checkConverter(broken)).toEqual(['factors: key doppelt vergeben', 'to: "xyz" steht nicht in factors'])
    expect(checkConverter({ ...pressure, factors: wood.factors })).toEqual(['factors: wird bei kind "units" nicht verwendet'])
  })

  it('zeigt Richtwerte mit wenigen Stellen und lehnt negative Mengen ab', () => {
    const html = renderToStaticMarkup(<FactorConverter entry={wood} />)
    expect(html).toContain('≈ 0,714')
    expect(html).toContain('In allen Maßen (Richtwerte)')
    expect(renderToStaticMarkup(<FactorConverter entry={wood} initialValue="-2" />)).toContain(
      'Ungültige Eingabe (keine negativen Werte)',
    )
  })

  it('lädt die echten Holzmaße', () => {
    const entry = converterEntries.find((e) => e.id === 'converter.holzmasse')
    expect(entry?.kind).toBe('factors')
    expect(entry?.factors.map((f) => f.key)).toContain('fm')
  })
})

describe('Steigung', () => {
  it('rechnet zwischen Prozent, Promille, Grad und 1:x um', () => {
    const r = slopeToRatio(2, 'percent')!
    expect(ratioToSlope(r, 'permille')).toBeCloseTo(20)
    expect(ratioToSlope(r, 'oneTo')).toBeCloseTo(50)
    expect(ratioToSlope(slopeToRatio(45, 'degree')!, 'percent')).toBeCloseTo(100)
    expect(ratioToSlope(slopeToRatio(100, 'oneTo')!, 'percent')).toBeCloseTo(1)
  })

  it('lehnt nicht darstellbare Angaben ab', () => {
    expect(slopeToRatio(90, 'degree')).toBeUndefined()
    expect(slopeToRatio(0, 'oneTo')).toBeUndefined()
    expect(ratioToSlope(0, 'oneTo')).toBeUndefined()
  })
})

describe('Anteile (Prozent, Dezimalzahl, Bruch)', () => {
  it('liest Brüche, gemischte Zahlen und Dezimalzahlen', () => {
    expect(parseFraction('3/4')).toBe(0.75)
    expect(parseFraction('1 1/2')).toBe(1.5)
    expect(parseFraction('-1/8')).toBe(-0.125)
    expect(parseFraction('0,5')).toBe(0.5)
    expect(parseFraction('1/0')).toBeUndefined()
    expect(toDecimal('75', 'percent')).toBe(0.75)
    expect(toDecimal('5', 'permille')).toBe(0.005)
  })

  it('findet den passenden Bruch und kennzeichnet Näherungen', () => {
    expect(toFraction(0.75)).toEqual({ numerator: 3, denominator: 4, exact: true })
    expect(toFraction(1 / 3)).toEqual({ numerator: 1, denominator: 3, exact: true })
    expect(toFraction(Math.PI).exact).toBe(false)
    expect(formatFraction(0.75)).toBe('3/4')
    expect(formatFraction(1.5)).toBe('3/2 = 1 1/2')
    expect(formatFraction(2)).toBe('2')
    expect(formatFraction(Math.PI)).toBe('≈ 355/113 = 3 16/113')
  })
})

describe('Umrechnen', () => {
  it('rechnet die ergänzten Einheiten um', () => {
    expect(convert(1, 'grad', 'deg')).toBeCloseTo(0.9)
    expect(convert(1, 'deg', 'arcmin')).toBeCloseTo(60)
    expect(convert(1, 'dt', 'kg')).toBeCloseTo(100)
    expect(convert(1, 'hl', 'dm^3')).toBeCloseTo(100)
    expect(convert(1, 'N/cm^2', 'mbar')).toBeCloseTo(100)
    expect(convert(1, 'ft', 'mm')).toBeCloseTo(304.8)
    expect(convert(3600, 'm/h', 'm/s')).toBeCloseTo(1)
  })

  it('kennt Industrie- und Hundertstelminute, Quartal und Jahr (365 Tage)', () => {
    ensureCustomUnits()
    expect(convert(1, 'Industrieminute', 's')).toBeCloseTo(36)
    expect(convert(1, 'Hundertstelminute', 's')).toBeCloseTo(0.6)
    expect(convert(1, 'Industrieminute', 'Hundertstelminute')).toBeCloseTo(60)
    expect(convert(1, 'Kalenderjahr', 'day')).toBeCloseTo(365)
    expect(convert(1, 'Quartal', 'day')).toBeCloseTo(91.25)
    expect(convert(250, 'ms', 's')).toBeCloseTo(0.25)
  })

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

  it('zeigt Steigung, Prozentrechner und Tabelle', () => {
    const entries: ConverterEntry[] = [
      { ...pressure, ...blank, id: 'converter.s', kind: 'slope' },
      { ...pressure, ...blank, id: 'converter.r', kind: 'ratio' },
      { ...pressure, ...blank, id: 'converter.t', kind: 'table', columns: ['DN', 'Zoll'], rows: [['15', '½']] },
      { ...pressure, ...blank, id: 'converter.leer', kind: 'table', columns: ['DN'] },
    ]
    const at = (slug: string) =>
      renderToStaticMarkup(
        <MemoryRouter initialEntries={[`/umrechner/${slug}`]}>
          <Routes>
            <Route path="/umrechner/:slug" element={<ConverterPage entries={entries} />} />
          </Routes>
        </MemoryRouter>,
      )
    expect(at('s')).toContain('1 : 50')
    expect(at('r')).toContain('3/4')
    expect(at('t')).toContain('<th scope="col" class="py-2 pr-4 font-bold">DN</th>')
    expect(at('leer')).toContain('TODO: Inhalt fehlt')
  })

  it('weist auf noch nicht definierte Einheiten hin', () => {
    registerCustomUnits([{ id: 'unit.zz-p2', symbol: 'zzP2', definition: '', aliases: [], examples: [] }])
    const entry = { ...pressure, units: ['mbar', 'zzP2'], from: 'mbar', to: 'zzP2' }
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/umrechner/test-druck']}>
        <Routes>
          <Route path="/umrechner/:slug" element={<ConverterPage entries={[entry]} />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('noch nicht genug Einheiten')
    expect(html).toContain('Noch ohne Definition (Inhalt fehlt): zzP2')
  })

  it('meldet unbekannte Größen', () => {
    expect(renderAt('/umrechner/gibt-es-nicht')).toContain('Größe nicht gefunden')
  })
})
