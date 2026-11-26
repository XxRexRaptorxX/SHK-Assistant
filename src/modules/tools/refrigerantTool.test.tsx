import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { RefrigerantLookup } from './RefrigerantLookup'
import {
  checkRefrigerantTool,
  lookupTable,
  refrigerantProperties,
  refrigerantToolSchema,
  tablePoints,
  type RefrigerantTool,
} from './refrigerantTool'
import { isRefrigerantTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.kaeltemittel-dampfdruck')
if (!entry || !isRefrigerantTool(entry)) throw new Error('Kältemittel-Tool erwartet')
const tool: RefrigerantTool = entry

const points = (name: string) => tablePoints(tool, tool.refrigerants.find((refrigerant) => refrigerant.name === name)!)
/** Druck laut Tabelle bei einer Temperatur */
const pressureAt = (name: string, temperature: number) => points(name).find((point) => point.temperature === temperature)?.pressure
const render = (refrigerant: string | undefined, mode: 'pressure' | 'temperature' = 'pressure', value = '') =>
  renderToStaticMarkup(<RefrigerantLookup tool={tool} initialRefrigerant={refrigerant} initialMode={mode} initialValue={value} />)

describe('Dampfdrucktabelle Kältemittel', () => {
  it('ist fehlerfrei, öffentlich und geprüft', () => {
    expect(checkRefrigerantTool(tool)).toEqual([])
    expect(tool.status).toBe('verified')
    expect(tool.verifiedBy).toBe('AI')
    expect(tool.verifiedAt).toBe('2026-11-06')
    expect(tool.visibility).toBe('public')
    expect(tool.category).toBe('Wartung')
  })

  it('enthält alle 22 Kältemittel der Quelle von −60 bis 70 °C in 2-K-Schritten', () => {
    expect(tool.refrigerants.map((refrigerant) => refrigerant.name)).toEqual([
      'R22', 'R23', 'R32', 'R134a', 'R290', 'R404A', 'R407C', 'R407F', 'R410A', 'R417A', 'R422A',
      'R422D', 'R437A', 'R448A', 'R449A', 'R450A', 'R452A', 'R507', 'R513A', 'R600a', 'R1234yf', 'R1234ze',
    ])
    expect(tool.temperatures).toHaveLength(66)
    expect(tool.temperatures[0]).toBe(-60)
    expect(tool.temperatures.at(-1)).toBe(70)
  })

  it('übernimmt die Werte der Quelle (Stichproben aus Seite A/3 und A/4)', () => {
    expect(pressureAt('R410A', 0)).toBe(6.96)
    expect(pressureAt('R134a', 0)).toBe(1.92)
    expect(pressureAt('R32', -10)).toBe(4.83)
    expect(pressureAt('R290', 20)).toBe(7.31)
    expect(pressureAt('R1234yf', 40)).toBe(9.18)
    // Erste und letzte Zeile, ab bzw. bis zu der die Quelle Werte nennt
    expect(points('R32')[0]).toEqual({ temperature: -54, pressure: -0.1 })
    expect(points('R448A')[0]).toEqual({ temperature: -52, pressure: -0.47 })
    expect(points('R600a')[0]).toEqual({ temperature: -40, pressure: -0.73 })
    expect(points('R23').at(-1)).toEqual({ temperature: 24, pressure: 45.27 })
    expect(points('R404A').at(-1)).toEqual({ temperature: 64, pressure: 30.16 })
  })

  it('nennt ausgeschriebene Namen nur dort, wo die Quellen sie nennen', () => {
    const names = Object.fromEntries(tool.refrigerants.filter((r) => r.fullName).map((r) => [r.name, r.fullName]))
    expect(names).toEqual({
      R22: 'Chlordifluormethan',
      R23: 'Trifluormethan',
      R32: 'Difluormethan',
      R134a: '1,1,1,2-Tetrafluorethan',
      R290: 'Propan',
      R600a: 'Isobutan',
    })
    // Gewählt: R-Nummer und grau der Name
    const html = render('R290')
    expect(html).toContain('R290</span><span class="ml-2 text-muted">Propan</span>')
    // Ohne Namen nur die R-Nummer
    expect(render('R410A')).not.toContain('ml-2 text-muted')
  })

  it('übernimmt Sicherheitsgruppe, GWP, Explosionsgrenze und Molmasse aus den Quellen (Stichproben)', () => {
    const find = (name: string) => tool.refrigerants.find((refrigerant) => refrigerant.name === name)!
    // BAFU-Übersicht Stand Februar 2025
    expect(find('R32')).toMatchObject({ safetyGroup: 'A2L', gwp: '675', odp: 0 })
    expect(find('R22')).toMatchObject({ safetyGroup: 'A1', gwp: '1810', odp: 0.055 })
    expect(find('R507')).toMatchObject({ safetyGroup: 'A1', gwp: '3985' })
    expect(find('R1234yf')).toMatchObject({ safetyGroup: 'A2L', gwp: '<1' })
    // WKO/ÖKKV Information Nr. 34f, Seite 2
    expect(find('R290').lowerFlammabilityLimit).toBe(0.038)
    expect(find('R600a').lowerFlammabilityLimit).toBe(0.043)
    expect(find('R1234ze').lowerFlammabilityLimit).toBe(0.303)
    // Wikipedia „List of refrigerants“ bzw. Honeywell (R452A)
    expect(find('R410A').molarMass).toBe(72.6)
    expect(find('R452A').molarMass).toBe(103.5)
    // Danfoss Ref Tools (nur Lücken der übrigen Quellen)
    expect(find('R450A').molarMass).toBe(108.7)
    expect(find('R422D').oil).toBe('MO/AB/POE/PVE')
    expect(find('R1234ze')).toMatchObject({ criticalTemperature: 109.4, criticalPressure: 36.35, autoignitionTemperature: 368 })
    // Wikipedia-Wert bleibt, Danfoss füllt nur den fehlenden kritischen Druck
    expect(find('R449A')).toMatchObject({ criticalTemperature: 81.5, criticalPressure: 45 })
    // Alle brennbaren haben eine Explosionsgrenze, die nicht brennbaren keine
    for (const refrigerant of tool.refrigerants) {
      expect(refrigerant.lowerFlammabilityLimit !== undefined, refrigerant.name).toBe(!refrigerant.safetyGroup!.endsWith('1'))
    }
  })

  it('zeigt die Eigenschaften des gewählten Kältemittels unter der Auswahl', () => {
    const propane = render('R290')
    expect(propane).toContain('Eigenschaften von R290')
    expect(propane).toContain('A3')
    expect(propane).toContain('Stärker brennbar')
    expect(propane).toContain('Klasse 3')
    expect(propane).toContain('Geringere Giftigkeit')
    expect(propane).toContain('0,038 kg/m³')
    expect(propane).toContain('1,5-mal so schwer wie Luft')
    expect(propane).toContain('Molmasse 44,1 g/mol, Luft 28,9 g/mol')
    expect(propane.indexOf('Eigenschaften von R290')).toBeLessThan(propane.indexOf('→ Temperatur'))
    // Erweiterte Stoffdaten erst auf Knopfdruck
    expect(propane).toContain('aria-expanded="false"')
    expect(propane).toContain('Alle Stoffdaten anzeigen')
    expect(propane).not.toContain('Kritische Temperatur')

    const r410a = render('R410A')
    expect(r410a).toContain('Nicht brennbar (keine Flammenausbreitung)')
    expect(r410a).toContain('Keine, nicht brennbar')
    expect(r410a).toContain('Nachfüllen ab 2032 eingeschränkt')
    expect(r410a).toContain('Beschränkungen (EU)')
    expect(r410a).not.toContain('Verboten (EU)')

    // Lange Erläuterung erst über den i-Knopf
    expect(r410a).not.toContain('Art. 13 Abs. 5')
    expect(r410a).toContain('Erläuterung zu „Beschränkungen (EU)“ anzeigen')
    const r22 = refrigerantProperties(tool, tool.refrigerants.find((refrigerant) => refrigerant.name === 'R22')!, String).basic
    expect(r22.find((row) => row.label === 'Beschränkungen (EU)')).toMatchObject({
      value: 'Verboten, auch das Nachfüllen',
      warn: true,
      info: expect.stringContaining('Art. 3 Nr. 6'),
    })
    expect(render('R450A')).toContain('3,8-mal so schwer wie Luft')
    expect(render(undefined)).not.toContain('Eigenschaften von')
  })

  it('ordnet Verbot und Nachfüllen nach Verordnung und GWP-Schwelle ein', () => {
    const groupOf = (name: string) => tool.refrigerants.find((refrigerant) => refrigerant.name === name)!.regulation
    expect(groupOf('R22')).toBe('ods')
    expect(['R290', 'R600a'].map(groupOf)).toEqual(['natural', 'natural'])
    // GWP-Schwellen 2 500 und 750 aus Art. 13 der VO (EU) 2024/573
    for (const refrigerant of tool.refrigerants) {
      if (refrigerant.regulation === 'ods' || refrigerant.regulation === 'natural') continue
      const gwp = refrigerant.gwp === '<1' ? 0 : Number(refrigerant.gwp)
      const expected = gwp >= 2500 ? 'fgas2500' : gwp >= 750 ? 'fgas750' : 'fgasBelow750'
      expect(refrigerant.regulation, refrigerant.name).toBe(expected)
    }
  })

  it('liefert die erweiterten Stoffdaten mit Platzhalter für fehlende Werte', () => {
    const rows = (name: string) =>
      refrigerantProperties(tool, tool.refrigerants.find((refrigerant) => refrigerant.name === name)!, (value, decimals) =>
        value.toFixed(decimals).replace('.', ','),
      ).extended
    const value = (name: string, label: string) => rows(name).find((row) => row.label === label)?.value
    expect(value('R32', 'Chemische Formel')).toBe('CH₂F₂')
    expect(value('R32', 'CAS-Nummer')).toBe('75-10-5')
    expect(value('R32', 'Kritische Temperatur')).toBe('78,1 °C')
    expect(value('R32', 'Kritischer Druck')).toBe('57,82 bar (absolut)')
    expect(value('R32', 'Selbstentzündungstemperatur')).toBe('648 °C')
    expect(value('R404A', 'Zusammensetzung')).toBe('R125/R143a/R134a (44/52/4 %)')
    expect(value('R404A', 'CAS-Nummer')).toBe('Keine (Gemisch)')
    expect(value('R404A', 'Siedepunkt bei 0 bar (Überdruck)')).toBe('−46,6 °C (Siedepunkt) / −45,8 °C (Taupunkt)'.replace(/−/g, '-'))
    expect(value('R290', 'Tripelpunkt')).toBe('-187,7 °C')
    expect(value('R290', 'Öl')).toBe('MO/AB')
    // Auch Danfoss nennt keinen Wert: bleibt offen
    expect(value('R410A', 'Tripelpunkt')).toBe('TODO: Inhalt fehlt')
  })

  it('verlangt bei gesetzten Eigenschaften eine Sicherheitsgruppe und keine Explosionsgrenze bei A1', () => {
    const broken = {
      ...tool,
      refrigerants: [
        { ...tool.refrigerants[0]!, safetyGroup: undefined },
        { ...tool.refrigerants[1]!, lowerFlammabilityLimit: 0.1 },
        ...tool.refrigerants.slice(2),
      ],
    }
    const issues = checkRefrigerantTool(broken)
    expect(issues).toContain('refrigerants (R22): safetyGroup fehlt (properties ist gesetzt)')
    expect(issues).toContain('refrigerants (R23): Explosionsgrenze bei nicht brennbarem Kältemittel')
  })

  it('findet Kältemittel über den ausgeschriebenen Namen', () => {
    expect(toolSearchDocuments().find((doc) => doc.id === tool.id)?.keywords).toContain('Isobutan')
  })

  it('liest Tabellenwerte direkt und rechnet dazwischen linear', () => {
    const r134a = points('R134a')
    expect(lookupTable(r134a, 'temperature', 0)).toEqual({ kind: 'exact', value: 1.92, point: { temperature: 0, pressure: 1.92 } })
    expect(lookupTable(r134a, 'pressure', 1.92)).toMatchObject({ kind: 'exact', value: 0 })
    // 2 bar liegt zwischen 0 °C (1,92 bar) und 2 °C (2,14 bar)
    const between = lookupTable(r134a, 'pressure', 2)
    expect(between.kind).toBe('interpolated')
    if (between.kind !== 'interpolated') return
    expect(between.value).toBeCloseTo((2 * 0.08) / 0.22, 9)
    expect(between.lower).toEqual({ temperature: 0, pressure: 1.92 })
    expect(between.upper).toEqual({ temperature: 2, pressure: 2.14 })
    const warmer = lookupTable(r134a, 'temperature', 1)
    expect(warmer.kind === 'interpolated' && warmer.value).toBeCloseTo(2.03, 9)
  })

  it('rechnet nicht über die Tabelle hinaus', () => {
    const r23 = points('R23')
    expect(lookupTable(r23, 'temperature', 25)).toEqual({ kind: 'outOfRange', first: r23[0], last: r23.at(-1) })
    expect(lookupTable(r23, 'pressure', 2).kind).toBe('outOfRange')
    expect(lookupTable(r23, 'temperature', 24).kind).toBe('exact')
  })

  it('zeigt Ergebnis, Rechenweg und markiert die benutzten Tabellenzeilen', () => {
    const html = render('R134a', 'pressure', '2')
    expect(html).toContain('Sättigungstemperatur')
    expect(html).toContain('≈ 0,7 °C')
    expect(html).toContain('Zwischen 0 °C (1,92 bar) und 2 °C (2,14 bar) linear gerechnet.')
    expect(html.match(/aria-current="true"/g)).toHaveLength(2)
    expect(html).toContain('Alle Werte für R134a')
    expect(html).toContain('Werte gerundet und auf den Taupunkt bezogen.')

    const exact = render('R410A', 'temperature', '0')
    expect(exact).toContain('Sättigungsdruck (Überdruck)')
    expect(exact).toContain('6,96 bar')
    expect(exact).toContain('Wert aus der Tabelle.')
    expect(exact).not.toContain('≈')
    expect(exact.match(/aria-current="true"/g)).toHaveLength(1)
  })

  it('meldet Werte außerhalb der Tabelle, ungültige Eingaben und fehlende Auswahl', () => {
    expect(render('R23', 'temperature', '30')).toContain('Außerhalb der Tabelle. Für R23 reicht sie von -60 °C (2,12 bar) bis 24 °C (45,27 bar).')
    expect(render('R32', 'pressure', 'abc')).toContain('Keine gültige Zahl')
    const empty = render(undefined)
    expect(empty).toContain('Kältemittel wählen.')
    expect(empty).not.toContain('Alle Werte für')
  })

  it('zeigt keine „-0,0“, wenn ein Ergebnis knapp unter null liegt', () => {
    // R1234yf: -30 °C → -0,01 bar, -28 °C → 0,11 bar; bei -29,9 °C sind es rund -0,004 bar
    const html = render('R1234yf', 'temperature', '-29,9')
    expect(html).toContain('≈ 0,00 bar')
    expect(html).not.toContain('-0,00')
  })

  it('verlangt aufsteigende, lückenlose Werte passender Länge und eindeutige Namen', () => {
    const first = tool.refrigerants[0]!
    const pressures = first.pressures
    const broken: RefrigerantTool = {
      ...tool,
      refrigerants: [
        first,
        { ...first, name: 'Lücke', pressures: pressures.map((value, index) => (index === 10 ? null : value)) },
        { ...first, name: 'Fallend', pressures: pressures.map((value, index) => (index === 5 ? 99 : value)) },
        { ...first, name: 'Kurz', pressures: pressures.slice(1) },
        { ...first, name: 'Leer', pressures: pressures.map((value, index) => (index === 0 ? value : null)) },
        first,
      ],
    }
    expect(checkRefrigerantTool(broken)).toEqual([
      'refrigerants: name doppelt vergeben',
      'refrigerants (Lücke): Lücke zwischen den Werten',
      'refrigerants (Fallend): Druck steigt bei -48 °C nicht',
      'refrigerants (Kurz): 65 Drücke für 66 Temperaturen',
      'refrigerants (Leer): weniger als zwei Werte',
    ])
    expect(checkRefrigerantTool({ ...tool, temperatures: [...tool.temperatures].reverse() })).toContain('temperatures: nicht aufsteigend')
    expect(refrigerantToolSchema.safeParse({ ...tool, refrigerants: [] }).success).toBe(false)
  })

  it('zeigt Quelle und Prüfstand auf der Tool-Seite und ist über die Kältemittel auffindbar', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/kaeltemittel-dampfdruck']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Dampfdrucktabelle Kältemittel')
    expect(html).not.toContain('noch nicht geprüft')
    expect(html).toContain('(AI)')
    expect(html).toContain('Komponentenkatalog, Ausgabe 2016')
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.kaeltemittel-dampfdruck')!
    for (const keyword of ['R32', 'R1234yf', 'Sättigungsdruck', 'Dampfdruck']) expect(doc.keywords).toContain(keyword)
  })
})
