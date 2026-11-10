import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { computeHeatingCost, formatAmount, HeatingCostView, parseEfficiency, resolveFromContent } from './HeatingCostComparison'
import { DEFAULT_HEATING_COST_SETTINGS, HEAT_REFERENCE, parseHeatingCostSettings, type HeatingCostSettings } from './heatingCostSettings'
import type { PricesData } from './heatingCostSources'
import {
  checkHeatingCostTool,
  compareSystems,
  convertAmount,
  findFuel,
  findUnit,
  heatingCostToolSchema,
  resolveHeatingCostTool,
  resolvePrice,
  usefulHeat,
  type FuelUnit,
  type HeatingCostTool,
  type HeatingCostToolEntry,
} from './heatingCostTool'
import { isHeatingCostTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const found = toolEntries.find((candidate) => candidate.id === 'tool.heizkostenvergleich')
if (!found || !isHeatingCostTool(found)) throw new Error('Heizkosten-Vergleich erwartet')
const entry: HeatingCostToolEntry = found
const resolved = resolveFromContent(entry)
if (!resolved) throw new Error('Heizwerte aus dem Umrechner erwartet')
const tool: HeatingCostTool = resolved
const heatingValues = content.converter.find((converter) => converter.id === entry.heatingValues)!

/** Feste Preise, damit die Tests nicht vom hinterlegten Stand abhängen */
const PRICES = {
  erdgas: 0.1156,
  fluessiggas: 0.81,
  heizoel: 1.7169,
  strom: 0.3618,
  waermepumpenstrom: 0.26,
  pellets: 464.61,
  hackschnitzel: 153.95,
  buche: 144.66,
}

const fuel = (key: string) => findFuel(tool, key)!
const unit = (fuelKey: string, unitKey: string) => findUnit(fuel(fuelKey), unitKey)!
const row = (rows: ReturnType<typeof compareSystems>, key: string) => rows.find((candidate) => candidate.system.key === key)!

const settings = (change: Partial<HeatingCostSettings>): HeatingCostSettings => ({ ...DEFAULT_HEATING_COST_SETTINGS, ...change })

describe('Heizkosten-Vergleich', () => {
  it('ist fehlerfrei, intern und noch ungeprüft', () => {
    expect(checkHeatingCostTool(entry)).toEqual([])
    expect(tool.visibility).toBe('internal')
    expect(tool.status).toBe('draft')
    expect(tool.category).toBe('Planung')
  })

  it('enthält alle Heizsysteme der Excel-Tabelle des Inhabers', () => {
    expect(tool.systems.map((system) => system.name)).toEqual([
      'Erdgas-Brennwertkessel',
      'Flüssiggas-Brennwertkessel',
      'Heizöl-Brennwertkessel',
      'Luft/Wasser-Wärmepumpe',
      'Sole/Wasser-Wärmepumpe (Erdsonde)',
      'Pelletkessel',
      'Hackschnitzelkessel',
      'Scheitholzkessel',
      'Elektro-Direktheizung',
    ])
    // Anschaffung und Wartung wie in der Tabelle (€ = 1 … €€€ = 3)
    expect(tool.systems.map((system) => [system.purchase, system.maintenance])).toEqual([
      [1, 1],
      [2, 1],
      [1, 2],
      [2, 1],
      [3, 1],
      [2, 3],
      [3, 3],
      [2, 2],
      [1, 1],
    ])
  })

  it('holt die Heizwerte aus dem Umrechner Energieträger', () => {
    expect(entry.heatingValues).toBe('converter.energietraeger')
    expect(heatingValues.kind).toBe('factors')
    expect(heatingValues.base).toBe('kwh')
    // Alle Einheiten verweisen auf vorhandene Faktoren und bringen deren Quelle mit
    for (const candidate of tool.fuels.flatMap((fuelEntry) => fuelEntry.units)) expect(candidate.source).not.toBe('')
    expect(unit('buche', 'rm').note).toBe('Wassergehalt 20 %')
    // Wärmepumpenstrom und Haushaltsstrom nutzen denselben Faktor
    expect(unit('waermepumpenstrom', 'kWh').factor).toBe(unit('strom', 'kWh').factor)

    const withUnit = (factor: string): HeatingCostToolEntry => ({
      ...entry,
      fuels: [{ ...entry.fuels[0]!, units: [{ key: 'x', symbol: 'x', label: 'x', factor }] }],
    })
    expect(() => resolveHeatingCostTool(withUnit('gibt-es-nicht'), heatingValues)).toThrow(
      'Faktor fehlt in „converter.energietraeger“: gibt-es-nicht',
    )
    expect(() => resolveHeatingCostTool(entry, undefined)).toThrow('Heizwerte „converter.energietraeger“ nicht gefunden')
    expect(resolveFromContent({ ...entry, heatingValues: 'converter.gibt-es-nicht' })).toBeUndefined()
  })

  it('rechnet die Heizwerte der Quellen um', () => {
    // HeizkostenV § 9: Heizöl 10 kWh/l, Erdgas H 10 kWh/m³, Faktor 1,11 Brennwert/Heizwert
    expect(usefulHeat(1, unit('heizoel', 'l'), 1)).toBe(10)
    expect(usefulHeat(1, unit('erdgas', 'm3'), 1)).toBe(10)
    expect(usefulHeat(1.11, unit('erdgas', 'kWhHs'), 1)).toBeCloseTo(1, 10)
    // DGUV Regel 110-010: Propan 12,87 kWh/kg bei 1,96 l/kg
    expect(usefulHeat(1.96, unit('fluessiggas', 'l'), 1)).toBeCloseTo(12.87, 10)
    // LWF-Merkblatt 20: Buche bei 20 % Wassergehalt
    expect(usefulHeat(1, unit('buche', 'rm'), 1)).toBe(1885)
    expect(convertAmount(2, unit('pellets', 't'), unit('pellets', 'kg'))).toBe(2000)
    // HeizkostenV: 650 kWh/Srm bei 4 kWh/kg → 162,5 kg je Srm
    expect(convertAmount(1, unit('hackschnitzel', 'srm'), unit('hackschnitzel', 't'))).toBeCloseTo(0.1625, 10)
  })

  it('vergleicht 2.000 l Heizöl (Brennwert, 85 %) mit allen Systemen', () => {
    const heat = usefulHeat(2000, unit('heizoel', 'l'), 0.85)
    expect(heat).toBeCloseTo(17000, 6)
    const rows = compareSystems(tool, { heat, prices: PRICES })
    // Referenz: Menge × Preis
    expect(row(rows, 'oelBrennwert').amount).toBeCloseTo(2000, 6)
    expect(row(rows, 'oelBrennwert').cost).toBeCloseTo(3433.8, 2)
    // Erdgas: 17.000 ÷ 0,9 = 18.889 kWh Heizwert = 20.967 kWh Brennwert
    expect(row(rows, 'gasBrennwert').amount).toBeCloseTo(20966.67, 2)
    expect(row(rows, 'gasBrennwert').cost).toBeCloseTo(2423.75, 2)
    expect(row(rows, 'fluessiggasBrennwert').amount).toBeCloseTo(2876.63, 2)
    expect(row(rows, 'fluessiggasBrennwert').cost).toBeCloseTo(2330.07, 2)
    expect(row(rows, 'luftWasserWp').amount).toBeCloseTo(5000, 6)
    expect(row(rows, 'luftWasserWp').cost).toBeCloseTo(1300, 2)
    expect(row(rows, 'soleWasserWp').cost).toBeCloseTo(1027.91, 2)
    expect(row(rows, 'pelletkessel').amount).toBeCloseTo(3.8636, 4)
    expect(row(rows, 'pelletkessel').cost).toBeCloseTo(1795.08, 2)
    expect(row(rows, 'hackschnitzelkessel').amount).toBeCloseTo(5, 6)
    expect(row(rows, 'hackschnitzelkessel').cost).toBeCloseTo(769.75, 2)
    expect(row(rows, 'scheitholzkessel').amount).toBeCloseTo(10.6101, 4)
    expect(row(rows, 'scheitholzkessel').cost).toBeCloseTo(1534.85, 2)
    expect(row(rows, 'elektro').cost).toBeCloseTo(6150.6, 2)
    // Kosten je kWh Wärme: 0,26 €/kWh ÷ JAZ 3,4
    expect(row(rows, 'luftWasserWp').costPerKWh).toBeCloseTo(0.26 / 3.4, 10)
  })

  it('kommt mit den Werten der Excel-Tabelle auf deren Ergebnisse, Hackschnitzel richtig gerechnet', () => {
    // Werte aus „Heizungsvergleich.xlsx“: Wärme 10.000 kWh, Pellets 4,8 kWh/kg, 95 %, 370 €/t;
    // Luft/Wasser-WP JAZ 4,4 mit 0,35 €/kWh; Elektro 0,35 €/kWh; Hackschnitzel 4 kWh/kg, 230 kg/Srm, 90 %, 33 €/Srm
    const sheetUnit = (key: string, kWh: number): FuelUnit => ({ key, symbol: key, label: key, factor: key, kWh, per: 1, source: 'Tabelle', note: '' })
    const sheetPrice = (unit: string, value: number) => ({ unit, value, period: 'Tabelle', source: 'Tabelle', todo: '' })
    const sheetEfficiency = (value: number, kind: 'efficiency' | 'performanceFactor' = 'efficiency') => ({ value, kind, source: 'Tabelle', todo: '' })
    const sheet: HeatingCostTool = {
      ...tool,
      fuels: [
        { key: 'pellets', name: 'Pellets', units: [sheetUnit('t', 4800)], price: sheetPrice('t', 370) },
        { key: 'strom', name: 'Strom', units: [sheetUnit('kWh', 1)], price: sheetPrice('kWh', 0.35) },
        { key: 'hs', name: 'Hackschnitzel', units: [sheetUnit('srm', 920)], price: sheetPrice('srm', 33) },
      ],
      systems: [
        { key: 'pellet', name: 'Pellets', fuel: 'pellets', efficiency: sheetEfficiency(0.95), purchase: 2, maintenance: 3 },
        { key: 'wp', name: 'WP', fuel: 'strom', efficiency: sheetEfficiency(4.4, 'performanceFactor'), purchase: 2, maintenance: 1 },
        { key: 'el', name: 'Elektro', fuel: 'strom', efficiency: sheetEfficiency(1), purchase: 1, maintenance: 1 },
        { key: 'hs', name: 'Hackschnitzel', fuel: 'hs', efficiency: sheetEfficiency(0.9), purchase: 3, maintenance: 3 },
      ],
    }
    const rows = compareSystems(sheet, { heat: 10000, prices: { pellets: 370, strom: 0.35, hs: 33 } })
    expect(row(rows, 'pellet').cost).toBeCloseTo(811.4, 2) // Tabelle F9
    expect(row(rows, 'wp').cost).toBeCloseTo(795.45, 2) // Tabelle F7
    expect(row(rows, 'el').cost).toBeCloseTo(3500, 2) // Tabelle F12
    // Tabelle F10 bezog sich auf F7 statt F1 und zeigte 31,70 €
    expect(row(rows, 'hs').cost).toBeCloseTo(398.55, 2)
  })

  it('nimmt eigenen Preis vor Marktpreis vor hinterlegtem Preis', () => {
    const live: PricesData = { generatedAt: '2026-11-10T04:00:00Z', prices: { oilBulletin: { value: 1.5, period: 'Woche ab 09.11.2026' } }, failed: [] }
    expect(resolvePrice(fuel('heizoel'), live, 1.2)).toMatchObject({ value: 1.2, origin: 'own' })
    expect(resolvePrice(fuel('heizoel'), live, undefined)).toMatchObject({ value: 1.5, origin: 'live', period: 'Woche ab 09.11.2026' })
    expect(resolvePrice(fuel('heizoel'), undefined, undefined)).toMatchObject({ value: 1.7169, origin: 'content', period: 'Woche ab 02.11.2026' })
    // Wärmepumpenstrom hat keinen Marktpreis: es bleibt beim hinterlegten
    expect(resolvePrice(fuel('waermepumpenstrom'), live, undefined)).toMatchObject({ value: 0.26, origin: 'content' })
  })

  it('rechnet aus den Eingaben: Einheit, eigener Nutzungsgrad, direkte Wärme', () => {
    const gas = computeHeatingCost(tool, settings({ reference: 'gasBrennwert', amount: '22200' }))
    // 22.200 kWh Brennwert ÷ 1,11 × 90 % = 18.000 kWh Wärme
    expect(gas.heat).toBeCloseTo(18000, 6)
    expect(gas.reference?.key).toBe('gasBrennwert')

    const m3 = computeHeatingCost(tool, settings({ reference: 'gasBrennwert', amount: '2000', units: { gasBrennwert: 'm3' }, efficiencies: { gasBrennwert: '80' } }))
    expect(m3.heat).toBeCloseTo(16000, 6)
    expect(m3.rows.find((candidate) => candidate.system.key === 'gasBrennwert')!.efficiency).toBe(0.8)

    const direct = computeHeatingCost(tool, settings({ reference: HEAT_REFERENCE, amount: '15000' }))
    expect(direct.reference).toBeUndefined()
    expect(direct.heat).toBe(15000)

    expect(computeHeatingCost(tool, settings({ amount: 'abc' })).heat).toBeUndefined()
    expect(computeHeatingCost(tool, settings({ amount: '0' })).rows).toEqual([])
    // Ungültiger eigener Preis zählt nicht
    expect(computeHeatingCost(tool, settings({ amount: '1000', prices: { heizoel: 'x' } })).prices.heizoel!.origin).toBe('content')
  })

  it('liest Nutzungsgrad in Prozent und JAZ als Zahl', () => {
    const gas = tool.systems.find((system) => system.key === 'gasBrennwert')!
    const heatPump = tool.systems.find((system) => system.key === 'luftWasserWp')!
    expect(parseEfficiency(gas, '92,5')).toBeCloseTo(0.925, 10)
    expect(parseEfficiency(heatPump, '3,1')).toBe(3.1)
    expect(parseEfficiency(gas, '')).toBeUndefined()
    expect(parseEfficiency(gas, '-5')).toBeUndefined()
    expect(formatAmount(20966.67)).toBe('20.967')
    expect(formatAmount(10.61)).toBe('10,6')
    expect(formatAmount(3.8636)).toBe('3,86')
  })

  it('übersteht kaputte gespeicherte Eingaben', () => {
    expect(parseHeatingCostSettings('kein json')).toEqual(DEFAULT_HEATING_COST_SETTINGS)
    expect(parseHeatingCostSettings('{"reference":3,"amount":"12","prices":{"heizoel":"1,1","x":5}}')).toEqual({
      ...DEFAULT_HEATING_COST_SETTINGS,
      amount: '12',
      prices: { heizoel: '1,1' },
    })
  })

  it('zeigt die Systeme nach Kosten, die Referenz markiert', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <HeatingCostView tool={tool} settings={settings({ reference: 'oelBrennwert', amount: '2000' })} onChange={() => {}} />
      </MemoryRouter>,
    )
    expect(html).toContain('Nutzwärme pro Jahr')
    expect(html).toContain('17.000 kWh')
    expect(html).toContain('Referenz</span>')
    // Mit den hinterlegten Preisen sind Hackschnitzel am günstigsten, Elektro am teuersten
    const order = [...html.matchAll(/<h3 class="text-lg font-bold">([^<]+)/g)].map((match) => match[1])
    expect(order[0]).toBe('Hackschnitzelkessel')
    expect(order.at(-1)).toBe('Elektro-Direktheizung')
    expect(html).toContain('pro Jahr gegenüber der Referenz')
    expect(html).not.toContain('ohne eigene Quelle, vorläufiger Wert')
    expect(html).toContain('Anschaffung')
  })

  it('versteckt die Quellen von Preisen und Nutzungsgraden hinter einem i-Knopf', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <HeatingCostView tool={tool} settings={DEFAULT_HEATING_COST_SETTINGS} onChange={() => {}} />
      </MemoryRouter>,
    )
    expect(html).toContain('aria-label="Quelle Preis Heizöl EL" aria-expanded="false"')
    expect(html).not.toContain('HeizkostenV § 9 Abs. 3')
    expect(html).not.toContain('Weekly Oil Bulletin, Prices with taxes')
    expect(html).toContain('aria-label="Quelle Jahresarbeitszahl Luft/Wasser-Wärmepumpe" aria-expanded="false"')
    expect(html).not.toContain('Fraunhofer ISE, Presseinformation')
    // Keine TODO-Sätze bei den Nutzungsgraden
    expect(html).not.toContain('TODO: Inhalt fehlt')
  })

  it('verweist für die Heizwerte auf den Umrechner', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <HeatingCostView tool={tool} settings={DEFAULT_HEATING_COST_SETTINGS} onChange={() => {}} />
      </MemoryRouter>,
    )
    expect(html).toContain('href="/umrechner/energietraeger"')
    expect(html).toContain('>Energieträger</a>')
    expect(html).not.toContain('1.885 kWh')
  })

  it('bittet ohne Verbrauch um eine Eingabe', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <HeatingCostView tool={tool} settings={DEFAULT_HEATING_COST_SETTINGS} onChange={() => {}} />
      </MemoryRouter>,
    )
    expect(html).toContain('Jahresverbrauch eintragen.')
    expect(html).not.toContain('Vergleich für dieselbe Wärme')
  })

  it('erscheint auf der Tool-Seite und in der Suche', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/heizkostenvergleich']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Heizkosten-Vergleich')
    expect(html).toContain('Referenzheizung')
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    expect(document.keywords).toEqual(expect.arrayContaining(['Heizölpreis', 'Holzpellets', 'Luft/Wasser-Wärmepumpe']))
  })

  it('lehnt widersprüchliche Angaben ab', () => {
    const broken = heatingCostToolSchema.parse({
      ...entry,
      status: 'verified',
      verifiedBy: 'XX',
      verifiedAt: '2026-11-10',
      fuels: [
        { ...entry.fuels[0]!, live: 'oilBulletin' },
        { ...entry.fuels[1]!, price: { unit: 'liter', source: 'x' } },
        ...entry.fuels.slice(2),
      ],
      systems: [...entry.systems, { ...entry.systems[0]!, fuel: 'biogas', efficiency: { value: 1.2, kind: 'efficiency', source: 'x', todo: 'TODO: Inhalt fehlt – x' } }],
    })
    const issues = checkHeatingCostTool(broken)
    expect(issues).toEqual(
      expect.arrayContaining([
        'fuels (erdgas): live „oilBulletin“ liefert Preise je „l“, price.unit ist „kWhHs“',
        'fuels (fluessiggas): price.unit „liter“ ist keine Einheit des Energieträgers',
        'fuels (fluessiggas): ohne price.value muss price.todo mit „TODO: Inhalt fehlt“ beginnen',
        'systems: key „gasBrennwert“ doppelt',
        'systems (gasBrennwert): unbekannter Energieträger „biogas“',
        'systems (gasBrennwert): Nutzungsgrad 1.2 über 1,11 (Brennwert/Heizwert) unplausibel',
        'systems (gasBrennwert): efficiency.todo bei verified nicht erlaubt',
      ]),
    )
  })
})
