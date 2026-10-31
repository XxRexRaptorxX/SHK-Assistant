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
import { converterEntries, converterTitle, groupConvertersByCategory } from './converter'
import { RatioConverter } from './RatioConverter'
import { formatFraction } from './RatioConverter'
import { parseFraction, toDecimal, toFraction } from './ratio'
import { convertByFactors, FactorConverter } from './FactorConverter'
import { checkConverter, type ConverterEntry, type ConverterFactor } from './schema'
import { ratioToSlope, slopeToRatio } from './slope'
import { normalizeForSearch } from '../../lib/text'
import { TableView } from './TableView'
import { convert, UnitConverter } from './UnitConverter'
import { NumeralConverter } from './NumeralConverter'
import { FractionsConverter } from './FractionsConverter'
import { inDenominator } from './fractions'
import { formatNumeral, parseNumeral } from './numeral'
import { formatAnyUnit } from '../units/labels'

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
  category: '',
  description: '',
  kind: 'units',
  approximate: true,
  units: ['bar', 'mbar', 'Pa'],
  factors: [],
  from: 'bar',
  to: 'mbar',
  rare: [],
  names: { bar: 'Bar', mbar: 'Millibar', Pa: 'Pascal' },
  columns: [],
  rows: [],
}

/** Ergebnis im Nach-Feld mit gewählter Zieleinheit, z. B. „1.000 mbar“ */
function shownResult(html: string): string {
  const value = /<output[^>]*>(.*?)<\/output>/.exec(html)?.[1] ?? ''
  const unit = /<select id="[^"]*-to"[^>]*>.*?<option value="[^"]*" selected="">(.*?)<\/option>/.exec(html)?.[1] ?? ''
  return `${value} ${unit}`
}

const blank = { units: [], factors: [], from: '', to: '', names: {}, columns: [], rows: [] }

/** Prüfung ohne die Namens-Vollständigkeit (für Tests, die andere Felder variieren) */
const checkWithoutNames = (entry: ConverterEntry) => checkConverter(entry).filter((issue) => !issue.startsWith('names:'))

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
  names: { fm: 'Festmeter', rm: 'Raummeter', srm: 'Schüttraummeter' },
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
    const issues = checkWithoutNames({ ...pressure, units: ['bar', 'kW', 'xyz', 'bar'], to: 'psi' })
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
    expect(checkWithoutNames({ ...pressure, units: ['W', 'PS'], from: 'W', to: 'W' })).toEqual([
      'Einheit "PS" passt nicht zu "W"',
    ])
  })

  it('erlaubt angekündigte Zusatzeinheiten ohne Definition', () => {
    registerCustomUnits([{ id: 'unit.zz-pending', symbol: 'zzPending', definition: '', aliases: [], examples: [] }])
    expect(checkWithoutNames({ ...pressure, units: ['W', 'zzPending/h'], from: 'W', to: 'W' })).toEqual([])
    expect(checkWithoutNames({ ...pressure, units: ['W', 'zzUnbekannt/h'], from: 'W', to: 'W' })[0]).toMatch(/unbekannt/)
  })

  it('prüft Tabellen und nicht benutzte Felder je Art', () => {
    const table = { ...pressure, ...blank, kind: 'table' as const, columns: ['A', 'B'], rows: [['1', '2'], ['3']] }
    expect(checkConverter(table)).toEqual(['rows.1: 1 Zellen, erwartet 2'])
    expect(checkConverter({ ...table, rows: [] })).toEqual(['rows: Pflicht bei status "verified"'])
    expect(checkConverter({ ...pressure, kind: 'slope' })).toEqual([
      'units: wird bei kind "slope" nicht verwendet',
      'from: wird bei kind "slope" nicht verwendet',
      'to: wird bei kind "slope" nicht verwendet',
      'names: wird bei kind "slope" nicht verwendet',
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
    near(convert(14, 'gradDH', 'gradEH'), 17.53)
    near(convert(14, 'gradDH', 'mmol/l'), 2.4962)
  })

  it('B: 10 °fH', () => {
    near(convert(10, 'gradFH', 'gradDH'), 5.618)
    near(convert(10, 'gradFH', 'gradEH'), 7.022)
    near(convert(10, 'gradFH', 'mmol/l'), 1)
  })

  it('C: 1 mmol/l', () => {
    near(convert(1, 'mmol/l', 'gradDH'), 5.6085)
    near(convert(1, 'mmol/l', 'gradFH'), 10)
    near(convert(1, 'mmol/l', 'gradEH'), 7.0225)
    // °e genau: 1 grain CaCO₃ je britische Gallone = 0,1424 mmol/l (nicht gerundet 0,142)
    expect(convert(1, 'mmol/l', 'gradEH')).toBeCloseTo(7.0225, 3)
  })

  const hardness = converterEntries.find((e) => e.id === 'converter.wasserhaerte')!
  const render = (value: string) =>
    renderToStaticMarkup(<MemoryRouter><UnitConverter entry={hardness} initialValue={value} /></MemoryRouter>)

  it('D: lehnt negative, leere und nichtnumerische Eingaben kontrolliert ab, 0 ist gültig', () => {
    expect(render('-1')).toContain('Ungültige Eingabe (keine negativen Werte)')
    expect(render('')).toContain('Bitte einen Wert eingeben.')
    expect(render('abc')).toContain('Ungültige Eingabe')
    const zero = render('0')
    expect(zero).not.toContain('Ungültige Eingabe')
    expect(shownResult(zero)).toBe('0 mmol/l')
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

describe('Unübliche Einheiten ausblenden', () => {
  const withRare: ConverterEntry = { ...pressure, units: ['bar', 'mbar', 'Pa', 'psi'], rare: ['psi', 'Pa'] }

  it('blendet unübliche Einheiten nur bei eingeschalteter Einstellung aus', () => {
    const shown = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={withRare} hideRareUnits={false} /></MemoryRouter>)
    const hidden = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={withRare} hideRareUnits /></MemoryRouter>)
    expect(shown).toContain('>psi<')
    expect(hidden).not.toContain('>psi<')
    expect(hidden).not.toContain('>Pa<')
    expect(shownResult(hidden)).toBe('1.000 mbar')
  })

  it('bietet neben den Ergebnissen einen Umschalter, nur wenn es unübliche Einheiten gibt', () => {
    const hidden = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={withRare} hideRareUnits /></MemoryRouter>)
    expect(hidden).toContain('aria-pressed="true"')
    expect(hidden).toContain('aria-label="Unübliche Einheiten einblenden"')
    const shown = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={withRare} hideRareUnits={false} /></MemoryRouter>)
    expect(shown).toContain('aria-label="Unübliche Einheiten ausblenden"')
    const none = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={pressure} /></MemoryRouter>)
    expect(none).not.toContain('Unübliche Einheiten ausblenden')
    expect(none).not.toContain('Unübliche Einheiten einblenden')
  })

  it('zeigt „Von“ mit Eingabe und Einheit, darunter „Nach“ mit Ergebnis und Einheit', () => {
    const html = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={pressure} /></MemoryRouter>)
    expect(html.indexOf('>Von</label>')).toBeLessThan(html.indexOf('<input'))
    expect(html.indexOf('<input')).toBeLessThan(html.indexOf('>Nach</label>'))
    expect(html.indexOf('>Nach</label>')).toBeLessThan(html.indexOf('<output'))
    expect(shownResult(html)).toBe('1.000 mbar')
  })

  it('fällt auf eine sichtbare Einheit zurück, wenn die Voreinstellung ausgeblendet ist', () => {
    const html = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={{ ...withRare, from: 'psi' }} hideRareUnits /></MemoryRouter>)
    expect(html).toContain('value="bar" selected=""')
  })

  it('wirkt auch bei Faktoren und Anteilen', () => {
    const factors = renderToStaticMarkup(<MemoryRouter><FactorConverter entry={{ ...wood, rare: ['srm'] }} hideRareUnits /></MemoryRouter>)
    expect(factors).not.toContain('Schüttraummeter')
    const ratio = renderToStaticMarkup(<RatioConverter rare={['ppb', 'permyriad']} hideRareUnits />)
    expect(ratio).not.toContain('ppb')
    expect(ratio).toContain('ppm')
  })

  it('prüft die rare-Liste beim Build', () => {
    expect(checkWithoutNames(withRare)).toEqual([])
    expect(checkWithoutNames({ ...withRare, rare: ['xyz'] })).toEqual(['rare: "xyz" gibt es bei kind "units" nicht'])
    expect(checkWithoutNames({ ...withRare, rare: ['psi', 'Pa', 'mbar'] })).toEqual([
      'rare: mindestens zwei Einheiten müssen übrig bleiben',
    ])
  })

  it('ist in den echten Inhalten gültig und lässt überall genug Einheiten übrig', () => {
    for (const entry of converterEntries) expect(checkConverter(entry)).toEqual([])
    expect(converterEntries.find((e) => e.id === 'converter.laenge')?.rare).toContain('ft')
  })
})

describe('Ausgeschriebene Einheiten', () => {
  // Name in der grauen Spalte, mit oder ohne Lexikon-Link
  const nameCell = (name: string) => new RegExp('text-muted hyphens-auto">(<a [^>]*>)?' + name + '(</a>)?</td>')

  it('zeigt den Namen grau hinter der Einheit, abschaltbar', () => {
    const shown = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={pressure} showUnitNames /></MemoryRouter>)
    const hidden = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={pressure} showUnitNames={false} /></MemoryRouter>)
    expect(shown).toMatch(nameCell('Millibar'))
    expect(hidden).not.toContain('Millibar')
  })

  it('wiederholt den Namen nicht, wenn er der Kurzform entspricht', () => {
    const html = renderToStaticMarkup(<MemoryRouter><UnitConverter entry={pressure} showUnitNames /></MemoryRouter>)
    expect(html).not.toMatch(nameCell('Bar'))
    const factors = renderToStaticMarkup(<MemoryRouter><FactorConverter entry={wood} showUnitNames /></MemoryRouter>)
    expect(factors).not.toMatch(nameCell('Festmeter'))
    const named = renderToStaticMarkup(
      <MemoryRouter>
        <FactorConverter entry={{ ...wood, factors: wood.factors.map((f) => ({ ...f, label: f.key })) }} showUnitNames />
      </MemoryRouter>,
    )
    expect(named).toMatch(nameCell('Schüttraummeter'))
  })

  it('verlangt beim Build einen Namen je Einheit, aber keine überzähligen', () => {
    expect(checkConverter({ ...pressure, names: { bar: 'Bar', mbar: 'Millibar' } })).toEqual(['names: Name für "Pa" fehlt'])
    expect(checkConverter({ ...pressure, names: { ...pressure.names, psi: 'Pfund' } })).toEqual([
      'names: "psi" gibt es bei kind "units" nicht',
    ])
    expect(checkConverter({ ...pressure, ...blank, kind: 'ratio', names: { x: 'X' } })).toEqual([
      'names: wird bei kind "ratio" nicht verwendet',
    ])
  })

  it('hat in den echten Inhalten für jede Einheit einen Namen', () => {
    const volume = converterEntries.find((e) => e.id === 'converter.volumen')
    expect(volume?.names.hl).toBe('Hektoliter')
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
    expect(checkWithoutNames({ ...pressure, factors: wood.factors })).toEqual(['factors: wird bei kind "units" nicht verwendet'])
  })

  it('zeigt Richtwerte mit wenigen Stellen und lehnt negative Mengen ab', () => {
    const html = renderToStaticMarkup(<MemoryRouter><FactorConverter entry={wood} /></MemoryRouter>)
    expect(html).toContain('≈ 0,714')
    expect(html).toContain('In allen Maßen (Richtwerte)')
    expect(renderToStaticMarkup(<MemoryRouter><FactorConverter entry={wood} initialValue="-2" /></MemoryRouter>)).toContain(
      'Ungültige Eingabe (keine negativen Werte)',
    )
  })

  it('zeigt exakte Verhältnisse ohne „≈“ (Stückmaß)', () => {
    const pieces: ConverterEntry = {
      ...wood,
      approximate: false,
      factors: [
        { key: 'stk', label: 'Stk.', value: 720 },
        { key: 'dtzd', label: 'Dtzd.', value: 60 },
        { key: 'gros', label: 'Gros', value: 5 },
      ],
      from: 'gros',
      to: 'stk',
    }
    const html = renderToStaticMarkup(<MemoryRouter><FactorConverter entry={pieces} /></MemoryRouter>)
    expect(shownResult(html)).toBe('144 Stk.')
    expect(html).toContain('In allen Maßen<')
    expect(html).not.toContain('≈')
    const [stk, dtzd] = pieces.factors as [ConverterFactor, ConverterFactor]
    expect(convertByFactors(1, dtzd, stk)).toBe(12)
  })

  it('lädt das echte Stückmaß mit exakten Werten', () => {
    const entry = converterEntries.find((e) => e.id === 'converter.stueckmass')!
    const byKey = new Map(entry.factors.map((f) => [f.key, f]))
    expect(entry.approximate).toBe(false)
    expect(convertByFactors(1, byKey.get('schock')!, byKey.get('stk')!)).toBe(60)
    expect(convertByFactors(1, byKey.get('gros')!, byKey.get('dtzd')!)).toBe(12)
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

  it('kennt Pro Zehntausend, ppm, ppb und pu', () => {
    expect(toDecimal('25', 'permyriad')).toBeCloseTo(0.0025)
    expect(toDecimal('500', 'ppm')).toBeCloseTo(0.0005)
    expect(toDecimal('20', 'ppb')).toBeCloseTo(2e-8)
    expect(toDecimal('1,2', 'decimal')).toBe(1.2)
    const html = renderToStaticMarkup(<RatioConverter initialValue="1" initialForm="permille" />)
    expect(html).toContain('10 ‱')
    expect(html).toContain('1.000 ppm')
    expect(html).toContain('1.000.000 ppb')
    expect(html).toContain('Dezimalzahl / pu')
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

  it('rechnet Spannung, Strom, Ladung und die ergänzten Kräfte um', () => {
    expect(convert(1, 'Ah', 'C')).toBeCloseTo(3600)
    expect(convert(2500, 'mAh', 'Ah')).toBeCloseTo(2.5)
    expect(convert(230, 'V', 'kV')).toBeCloseTo(0.23)
    expect(convert(16, 'A', 'mA')).toBeCloseTo(16000)
    expect(convert(1, 'MN', 'kN')).toBeCloseTo(1000)
    expect(convert(100, 'cN', 'N')).toBeCloseTo(1)
    expect(convert(1, 'kgf', 'N')).toBeCloseTo(9.80665)
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

  it('zeigt Einheitenzeichen statt Wörtern, wo es eines gibt (Tag d, Jahr a)', () => {
    ensureCustomUnits()
    expect(['day', 'Kalenderjahr', 'week', 'Quartal'].map(formatAnyUnit)).toEqual(['d', 'a', 'Woche', 'Quartal'])
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

  it('gruppiert nach Kategorie und zeigt das Formelzeichen hinter dem Namen', () => {
    const entries: ConverterEntry[] = [
      { ...pressure, id: 'converter.a', title: 'Druck', symbol: 'p', category: 'Hydraulik' },
      { ...pressure, id: 'converter.b', title: 'Zeit', category: '' },
      { ...pressure, id: 'converter.c', title: 'Fläche', symbol: 'A', category: 'Geometrie' },
    ]
    expect(groupConvertersByCategory(entries).map((g) => g.category)).toEqual(['Geometrie', 'Hydraulik', 'Allgemein'])
    expect(converterTitle(entries[2]!)).toBe('Fläche A')
    expect(converterTitle(entries[1]!)).toBe('Zeit')
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ConverterListPage entries={entries} />
      </MemoryRouter>,
    )
    expect(html).toContain('>Geometrie</h2>')
    expect(html).toContain('Druck<span class="ml-2 font-normal text-muted">p</span>')
  })

  it('ordnet alle echten Größen einer Kategorie zu', () => {
    expect(converterEntries.every((entry) => entry.category !== '')).toBe(true)
  })

  it('zeigt die Kategorien in der vorgegebenen Reihenfolge', () => {
    expect(groupConvertersByCategory(converterEntries).map((g) => g.category)).toEqual([
      'Geometrie',
      'Hydraulik',
      'Mechanik',
      'Thermodynamik',
      'Elektrotechnik',
      'Allgemein',
    ])
    // unbekannte Kategorien landen vor „Allgemein“
    const extra = [...converterEntries, { ...pressure, id: 'converter.x', category: 'Akustik' }]
    expect(groupConvertersByCategory(extra).map((g) => g.category).slice(-2)).toEqual(['Akustik', 'Allgemein'])
  })

  it('rechnet den Startwert 1 in die Zieleinheit und in alle Einheiten um', () => {
    const html = renderAt('/umrechner/test-druck')
    expect(shownResult(html)).toBe('1.000 mbar')
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
    expect(at('t')).toContain('<th scope="col" class="px-4 py-2 font-bold">DN</th>')
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

describe('Zahlensysteme', () => {
  it('rechnet ganze Zahlen zwischen allen Systemen um', () => {
    const value = parseNumeral('255', 'dec')!
    expect(formatNumeral(value, 'bin')).toBe('1111 1111')
    expect(formatNumeral(value, 'ter')).toBe('100110')
    expect(formatNumeral(value, 'oct')).toBe('377')
    expect(formatNumeral(value, 'duo')).toBe('193')
    expect(formatNumeral(value, 'hex')).toBe('FF')
    expect(parseNumeral('ff', 'hex')).toBe(255n)
    expect(parseNumeral('1111 1111', 'bin')).toBe(255n)
    expect(parseNumeral('B', 'duo')).toBe(11n)
  })

  it('rechnet große Zahlen ohne Rundung und mit Vorzeichen', () => {
    expect(formatNumeral(parseNumeral('FFFFFFFFFFFFFFFF', 'hex')!, 'dec')).toBe('18.446.744.073.709.551.615')
    expect(parseNumeral('1.000.000', 'dec')).toBe(1000000n)
    expect(formatNumeral(parseNumeral('-10', 'dec')!, 'bin')).toBe('-1010')
  })

  it('lehnt Ziffern ab, die es im System nicht gibt', () => {
    expect(parseNumeral('2', 'bin')).toBeUndefined()
    expect(parseNumeral('C', 'duo')).toBeUndefined()
    expect(parseNumeral('1,5', 'dec')).toBeUndefined()
    expect(parseNumeral('', 'dec')).toBeUndefined()
    expect(parseNumeral('1'.repeat(65), 'bin')).toBeUndefined()
  })

  it('zeigt alle Systeme und blendet unübliche aus', () => {
    const html = renderToStaticMarkup(<NumeralConverter hideRareUnits={false} />)
    expect(html).toContain('1111 1111')
    expect(html).toContain('Hexadezimal (Basis 16)')
    const hidden = renderToStaticMarkup(<NumeralConverter rare={['ter', 'duo']} hideRareUnits />)
    expect(hidden).not.toContain('Ternär')
  })

  it('prüft die Felder beim Build', () => {
    expect(checkConverter({ ...pressure, ...blank, kind: 'numeral' })).toEqual([])
    expect(checkConverter({ ...pressure, ...blank, kind: 'numeral', rare: ['xyz'] })).toEqual([
      'rare: "xyz" gibt es bei kind "numeral" nicht',
    ])
  })
})

describe('Datenmenge, Leitfähigkeit und angloamerikanische Einheiten', () => {
  it('rechnet dezimale und binäre Vorsätze getrennt', () => {
    expect(convert(1, 'MiB', 'B')).toBe(1048576)
    expect(convert(1, 'MB', 'B')).toBe(1e6)
    expect(convert(1, 'B', 'b')).toBe(8)
    expect(formatAnyUnit('b')).toBe('bit')
  })

  it('rechnet die Leitfähigkeit für Wasseranalysen', () => {
    expect(convert(1, 'mS/cm', 'uS/cm')).toBeCloseTo(1000, 9)
    expect(convert(1, 'mS/cm', 'mS/m')).toBeCloseTo(100, 9)
    expect(formatAnyUnit('uS/cm')).toBe('µS/cm')
  })

  it('kennt die Einheiten mit den üblichen Kurzzeichen', () => {
    expect(['mile', 'acre', 'lbm', 'floz', 'pint', 'quart', 'oilbarrel', 'inch^2'].map(formatAnyUnit)).toEqual([
      'mi', 'ac', 'lb', 'fl oz', 'pt', 'qt', 'bbl', 'in²',
    ])
  })

  it('führt die neuen Einheiten als unüblich', () => {
    const units = { laenge: ['yd', 'mile'], flaeche: ['acre', 'mile^2'], gewicht: ['oz', 'lbm'], volumen: ['gal', 'cup'] }
    for (const [slug, list] of Object.entries(units)) {
      const entry = converterEntries.find((e) => e.id === `converter.${slug}`)!
      for (const unit of list) expect(entry.rare).toContain(unit)
    }
  })

  it('hat Formelzeichen für Rohrdimensionen, Steigung und Stückmaß', () => {
    const symbol = (slug: string) => converterEntries.find((e) => e.id === `converter.${slug}`)?.symbol
    expect([symbol('rohrdimensionen'), symbol('steigung'), symbol('stueckmass')]).toEqual(['⌀', '∠', 'n'])
  })
})

describe('Massenstrom, Dichte, Beschleunigung, Paar', () => {
  it('rechnet die neuen Größen über mathjs', () => {
    expect(convert(3600, 'kg/h', 'kg/s')).toBeCloseTo(1, 12)
    expect(convert(1, 'g/cm^3', 'kg/m^3')).toBeCloseTo(1000, 9)
    expect(convert(1, 'kg/l', 't/m^3')).toBeCloseTo(1, 12)
    expect(convert(36, 'km/(h s)', 'm/s^2')).toBeCloseTo(10, 12)
    expect(formatAnyUnit('km/(h s)')).toBe('km/(h·s)')
  })

  it('kennt die Normfallbeschleunigung als Zusatzeinheit', () => {
    expect(convert(1, 'gn', 'm/s^2')).toBeCloseTo(9.80665, 12)
    expect(formatAnyUnit('gn')).toBe('gₙ')
  })

  it('rechnet die Leitfähigkeit von Leiterwerkstoffen und % IACS', () => {
    expect(convert(1, 'm/(ohm mm^2)', 'S/m')).toBeCloseTo(1e6, 3)
    expect(convert(1, 'S m/mm^2', 'm/(ohm mm^2)')).toBeCloseTo(1, 12)
    expect(convert(100, 'IACS', 'S m/mm^2')).toBeCloseTo(58, 9)
    expect(convert(1, 'S/cm', 'mS/cm')).toBeCloseTo(1000, 9)
    expect(['m/(ohm mm^2)', 'S m/mm^2', 'IACS'].map(formatAnyUnit)).toEqual(['m/(Ω·mm²)', 'S·m/mm²', '% IACS'])
    const entry = converterEntries.find((e) => e.id === 'converter.leitfaehigkeit')!
    expect(entry.rare).toEqual(['S/cm', 'm/(ohm mm^2)', 'S m/mm^2', 'IACS'])
  })

  it('zählt 1 Paar als 2 Stück', () => {
    const entry = converterEntries.find((e) => e.id === 'converter.stueckmass')!
    const [stk, paar] = ['stk', 'paar'].map((key) => entry.factors.find((f) => f.key === key)!)
    expect(convertByFactors(1, paar!, stk!)).toBe(2)
  })
})

describe('Brüche', () => {
  it('erweitert auf andere Nenner, sonst nächster Bruch mit ≈', () => {
    expect(inDenominator(0.75, 8)).toBe('6/8')
    expect(inDenominator(0.75, 64)).toBe('48/64')
    expect(inDenominator(1 / 3, 8)).toBe('≈ 3/8')
    expect(inDenominator(1 / 3, 6)).toBe('2/6')
    expect(inDenominator(1.5, 4)).toBe('6/4 = 1 2/4')
    expect(inDenominator(2, 8)).toBe('16/8 = 2')
    expect(inDenominator(0.001, 8)).toBe('≈ 0')
  })

  it('zeigt gekürzt, als Dezimalzahl und in allen Nennern', () => {
    const html = renderToStaticMarkup(<FractionsConverter initialValue="12/16" hideRareUnits={false} />)
    expect(html).toContain('>3/4<')
    expect(html).toContain('>0,75<')
    expect(html).toContain('>24/32<')
    expect(html).toContain('Vierundsechzigstel')
    const hidden = renderToStaticMarkup(<FractionsConverter rare={['5', '100']} hideRareUnits />)
    expect(hidden).not.toContain('Fünftel')
  })

  it('prüft die Felder beim Build', () => {
    expect(checkConverter({ ...pressure, ...blank, kind: 'fractions', rare: ['7'] })).toEqual([
      'rare: "7" gibt es bei kind "fractions" nicht',
    ])
  })
})
