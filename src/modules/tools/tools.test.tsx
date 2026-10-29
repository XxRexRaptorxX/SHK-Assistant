import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { homeTileModules, modules } from '../../app/modules'
import { checkFormula, evaluateFormula } from '../formulas/engine'
import { presetsFor } from '../materials/materials'
import { ensureCustomUnits } from '../units/customUnits'
import ToolPage from './ToolPage'
import { checkChoiceTool, checkTableTool, isChoiceTool, type TableTool } from './schema'
import { ChoiceLookup } from './ChoiceLookup'
import { FactorCalculator } from './FactorCalculator'
import { checkFactorTool, computeFactorTool, normalizeSelection } from './factorTool'
import { isFactorTool, isVariantTool } from './schema'
import { matchingRows, TableLookup } from './TableLookup'
import { shiftFloorHeight } from './floorOffset'
import { Calculator } from '../formulas/Calculator'
import { formulaToolEntries, toolEntries } from './tools'
import { checkVariantTool } from './variantTool'
import { VariantCalculator } from './VariantCalculator'

ensureCustomUnits()

const rollenlaenge = formulaToolEntries.find((entry) => entry.id === 'tool.rollenlaenge.wicklungen')!

describe('Tools', () => {
  it('steht als erste Kachel auf der Startseite', () => {
    expect(homeTileModules[0]).toBe(modules.tools)
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    )
    expect(html.indexOf('Praktische Rechenhelfer')).toBeLessThan(html.indexOf('Formelsammlung mit Rechner'))
  })

  it('rechnet die Rollenlänge wie im Beispiel des Inhabers', () => {
    expect(checkFormula(rollenlaenge)).toEqual([])
    const length = evaluateFormula(rollenlaenge, { n: { value: 50, unit: '' }, d: { value: 80, unit: 'cm' } })
    expect(length).toBeCloseTo(125.66, 2)
  })

  it('rechnet die exakte Rollenlänge aus dem Ringquerschnitt', () => {
    const exakt = formulaToolEntries.find((entry) => entry.id === 'tool.rollenlaenge.querschnitt')!
    expect(checkFormula(exakt)).toEqual([])
    const length = evaluateFormula(exakt, {
      D: { value: 80, unit: 'cm' },
      dK: { value: 40, unit: 'cm' },
      t: { value: 20, unit: 'mm' },
    })
    expect(length).toBeCloseTo(6 * Math.PI, 6)
    expect(toolEntries.map((entry) => entry.title)).toEqual([
      'Abgaswerte je Brennerart',
      'Ausgerollte Länge von Rohr- und Kabelrollen',
      'Badplanung: Montagehöhen, Abstände und Schutzbereiche',
      'Gebäudeklasse',
      'Heizlast überschlägig',
      'Leistungsminderung durch Kalk am Wärmetauscher',
      'Leistungsminderung durch Ruß im Kessel',
      'Material zurückschreiben',
      'Mindestdämmdicke von Rohrleitungen',
      'Rohrlänge einer Fußbodenheizung',
      'Rohrschellenabstand',
      'Solaranlage: Kollektorfläche und Speichergröße',
      'Thermostatkopf-Einstellung und Raumtemperatur',
      'Wartungsintervalle',
    ])
  })

  it('rechnet die verbaute Länge aus angefangener, vollen und letzter Rolle', () => {
    const verbaut = formulaToolEntries.find((entry) => entry.id === 'tool.rollenlaenge.rollen')!
    expect(checkFormula(verbaut)).toEqual([])
    const length = evaluateFormula(verbaut, {
      Ra: { value: 40, unit: 'm' },
      N: { value: 3, unit: '' },
      Lr: { value: 60, unit: 'm' },
      Re: { value: 10, unit: 'm' },
    })
    expect(length).toBe(270)
  })

  it('schreibt Material zurück: mitgenommen minus zurückgegeben', () => {
    const material = formulaToolEntries.find((entry) => entry.id === 'tool.material-zurueck')!
    expect(checkFormula(material)).toEqual([])
    expect(evaluateFormula(material, { Mm: { value: 250, unit: 'm' }, Mr: { value: 40, unit: 'm' } })).toBe(210)
  })

  it('rechnet die FBH-Rohrlänge aus Fläche und Verlegeabstand, auch in mm', () => {
    const fbh = formulaToolEntries.find((entry) => entry.id === 'tool.fbh-rohrlaenge')!
    expect(checkFormula(fbh)).toEqual([])
    expect(evaluateFormula(fbh, { A: { value: 25, unit: 'm^2' }, VA: { value: 15, unit: 'cm' } })).toBeCloseTo(166.67, 2)
    expect(evaluateFormula(fbh, { A: { value: 25, unit: 'm^2' }, VA: { value: 150, unit: 'mm' } })).toBeCloseTo(166.67, 2)
    expect(presetsFor(fbh.variables.find((variable) => variable.symbol === 'VA')!).map((preset) => preset.value)).toEqual([
      5, 10, 15,
    ])
  })

  it('schätzt die Heizlast nach Baujahr oder Gebäudestandard und vergleicht mit der vorhandenen Leistung', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.heizlast')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    expect(checkFactorTool(tool)).toEqual([])
    const load = (A: number, Pv: number, selection: Record<string, string>) => {
      const values = computeFactorTool(tool, { A, Pv }, selection)
      const show = (symbol: string) => values[symbol]?.text ?? values[symbol]?.value
      return [show('q'), show('P'), show('Qh'), show('qv')]
    }
    // Nach Baujahr: Richtwert, Heizlast, Wärmebedarf pro Jahr und Vergleich mit 15 kW
    expect(load(125, 15, { quelle: 'baujahr', baujahr: 'j1970' })).toEqual([90, 11.25, 21250, 120])
    // Ab 2002 nach Baustandard, bei Spannen der obere Wert
    expect(load(100, 0, { quelle: 'baujahr', baujahr: 'j2009' })).toEqual([38, 3.8, 6000, 'keine Angabe'])
    expect(load(100, 0, { quelle: 'baujahr', baujahr: 'j2021' })).toEqual([50, 5, 7500, 'keine Angabe'])
    // Nach Gebäudestandard: kein Wärmebedarf
    expect(load(125, 0, { quelle: 'standard', standard: 's3' })).toEqual([80, 10, 'nur beim Richtwert nach Baujahr', 'keine Angabe'])
    expect(load(150, 0, { quelle: 'standard', standard: 's8' })).toEqual([10, 1.5, 'nur beim Richtwert nach Baujahr', 'keine Angabe'])

    // Nur das Dropdown der gewählten Variante erscheint
    const byYear = renderToStaticMarkup(<FactorCalculator tool={tool} initialInputs={{ A: '125' }} />)
    expect(byYear).toContain('<option value="j1920" selected="">1920 – 1969</option>')
    expect(byYear).not.toContain('value="s1"')
    expect(byYear).toContain('P = 13,1 kW')
    const byStandard = renderToStaticMarkup(
      <FactorCalculator tool={tool} initialInputs={{ A: '125' }} initialSelection={{ quelle: 'standard', standard: 's8' }} />,
    )
    expect(byStandard).toContain('<option value="s8" selected="">Passivhaus</option>')
    expect(byStandard).not.toContain('value="j1920"')
  })

  it('rechnet die Leistungsminderung durch Ruß und Kalk mit dem Faustwert je mm', () => {
    for (const [id, perMm] of [
      ['tool.russ-leistungsminderung', 5],
      ['tool.kalk-leistungsminderung', 10],
    ] as const) {
      const entry = formulaToolEntries.find((candidate) => candidate.id === id)!
      expect(checkFormula(entry)).toEqual([])
      expect(entry.category).toBe('Demonstration')
      const f = entry.variables.find((variable) => variable.symbol === 'f')!
      expect(presetsFor(f).map((preset) => preset.value)).toEqual([perMm])
      expect(f.default).toBe(perMm)
      expect(renderToStaticMarkup(<Calculator formula={entry} />)).toContain(`value="${perMm}"`)
      expect(evaluateFormula(entry, { s: { value: 1.5, unit: 'mm' }, f: { value: perMm, unit: '' } })).toBeCloseTo(1.5 * perMm, 9)
    }
  })

  // Tabellen-Tools werden zurzeit von keinem Inhalt genutzt; Testdaten nach dem früheren Baujahr-Tool
  const tableTool: TableTool = {
    id: 'tool.test-tabelle',
    visibility: 'public',
    status: 'draft',
    source: 'Testdaten',
    verifiedBy: '',
    verifiedAt: '',
    kind: 'table',
    title: 'Testtabelle',
    description: 'Testdaten',
    category: '',
    input: { name: 'Baujahr', unit: '' },
    columns: [
      { key: 'heizlast', name: 'Heizlast', label: 'q', unit: 'W/m²' },
      { key: 'waermebedarf', name: 'Wärmebedarf', label: 'qₕ', unit: 'kWh/(m²·a)' },
    ],
    rows: [
      { label: '1970 – 1984', from: 1970, to: 1984, note: '', values: { heizlast: 'ca. 90', waermebedarf: 'ca. 170' } },
      { label: 'ab 2002', from: 2002, note: '', values: { heizlast: 'ca. 45', waermebedarf: 'ca. 70' } },
      { label: '2014 – 2020', from: 2014, to: 2020, note: 'EnEV 2014', values: { heizlast: '36–38', waermebedarf: 'ca. 45' } },
    ],
  }

  it('schlägt in Tabellen-Tools alle passenden Zeilen nach', () => {
    expect(checkTableTool(tableTool)).toEqual([])
    const values = (year: number) => matchingRows(tableTool, year).map((row) => row.values)
    expect(values(1984)).toEqual([{ heizlast: 'ca. 90', waermebedarf: 'ca. 170' }])
    expect(values(2015)).toEqual([
      { heizlast: 'ca. 45', waermebedarf: 'ca. 70' },
      { heizlast: '36–38', waermebedarf: 'ca. 45' },
    ])
    expect(values(1919)).toEqual([])

    const html = renderToStaticMarkup(<TableLookup tool={tableTool} initialValue="1975" />)
    expect(html).toContain('q = ca. 90 W/m²')
    expect(html).toContain('qₕ = ca. 170 kWh/(m²·a)')
    expect(html).toContain('Heizlast (q)')
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
    expect(renderToStaticMarkup(<TableLookup tool={tableTool} initialValue="1900" />)).toContain('keine Angabe')
  })

  it('meldet Fehler in Tabellen-Tools', () => {
    const broken = { ...tableTool, rows: [{ label: 'x', note: '', values: { heizlast: '1', extra: '2' } }] }
    expect(checkTableTool(broken)).toEqual([
      'rows[0] (x): from oder to fehlt',
      'rows[0] (x): Wert fehlt für waermebedarf',
      'rows[0] (x): unbekannte Spalte extra',
    ])
  })

  it('zeigt zur Thermostatstufe Temperatur und Räume, zur Raumart die Norm-Innentemperatur', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.thermostat-raumtemperatur')!
    if (!isChoiceTool(tool)) throw new Error('Auswahl-Tool erwartet')
    expect(checkChoiceTool(tool)).toEqual([])
    const [thermostat, norm] = tool.sections
    expect(thermostat!.options.map((option) => [option.label, option.values.temperatur])).toEqual([
      ['✻', 'ca. 6'],
      ['1', 'ca. 12'],
      ['☾', 'ca. 14'],
      ['2', 'ca. 16'],
      ['2½', 'ca. 18'],
      ['3', 'ca. 20'],
      ['3½', 'ca. 22'],
      ['4', 'ca. 24'],
      ['5', 'ca. 28'],
    ])
    const normTemperature = (label: string) => norm!.options.find((option) => option.label === label)?.values.temperatur
    expect(normTemperature('WC-Räume')).toBe('20')
    expect(normTemperature('Duschräume')).toBe('24')
    expect(normTemperature('Treppenhäuser')).toBe('15')
    expect(normTemperature('Haupttreppenräume')).toBe('20')
    expect(norm!.options).toHaveLength(20)

    const html = renderToStaticMarkup(<ChoiceLookup tool={tool} initialSelection={{ 0: '☾', 1: 'Flure' }} />)
    // Skala: Stufe in der Leiste gewählt, Karte zeigt Zusatz und Werte
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(html).toContain('aria-label="☾, Nachtabsenkung"')
    expect(html).toContain('θ = ca. 14 °C')
    expect(html).toContain('Alle Räume nachts')
    // Dropdown: Raumart ausgewählt
    expect(html).toContain('<option value="Flure" selected="">')
    expect(html).toContain('θᵢₙₜ = 15 °C')
    const empty = renderToStaticMarkup(<ChoiceLookup tool={tool} />)
    expect(empty).toContain('Einstellung in der Leiste antippen.')
    expect(empty).toContain('Raumart wählen …')
    // Stufe ohne Zusatz: die Zahl als Überschrift
    const four = renderToStaticMarkup(<ChoiceLookup tool={tool} initialSelection={{ 0: '4' }} />)
    expect(four).toContain('<p class="font-semibold">4</p>')
    const half = renderToStaticMarkup(<ChoiceLookup tool={tool} initialSelection={{ 0: '2½' }} />)
    expect(half).toContain('<p class="font-semibold">Skala zwischen 2 und 3</p>')
  })

  it('meldet Fehler in Auswahl-Tools', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.thermostat-raumtemperatur')!
    if (!isChoiceTool(tool)) throw new Error('Auswahl-Tool erwartet')
    const section = tool.sections[1]!
    const broken = {
      ...tool,
      sections: [{ ...section, options: [section.options[0]!, { label: section.options[0]!.label, note: '', values: {} }] }],
    }
    expect(checkChoiceTool(broken)).toEqual([
      'sections[0] (Norm-Innentemperatur nach Raumart): label doppelt vergeben',
      'sections[0] (Norm-Innentemperatur nach Raumart), options[1] (Ausstellungsräume): keine Werte',
    ])
    // Einzelne Spalten dürfen fehlen (Wert gibt es bei dieser Option nicht), unbekannte nicht
    const partial = { ...section.options[0]!, label: 'Neu', values: { unbekannt: '1' } }
    expect(checkChoiceTool({ ...tool, sections: [{ ...section, options: [partial] }] })).toEqual([
      'sections[0] (Norm-Innentemperatur nach Raumart), options[0] (Neu): unbekannte Spalte unbekannt',
    ])
  })

  it('legt die Solaranlage aus: Kollektorfläche je Person, Speicher je Person oder je m²', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.solar-auslegung')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    expect(checkFactorTool(tool)).toEqual([])
    const solar = (n: number, nutzung: string, kollektor: string) => {
      const values = computeFactorTool(tool, { n }, { nutzung, kollektor })
      return [values.A?.value, values.V?.value]
    }
    expect(solar(4, 'warmwasser', 'flach')).toEqual([6, 320])
    expect(solar(4, 'warmwasser', 'vakuum')).toEqual([4, 320])
    expect(solar(4, 'heizung', 'flach')).toEqual([16, 960])
    expect(solar(4, 'heizung', 'vakuum')).toEqual([12, 720])

    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialInputs={{ n: '4' }} />)
    expect(html).toContain('A = 6,0 m²')
    expect(html).toContain('1,5 m² pro Person')
    expect(html).toContain('V = 320 l')
    // Vorauswahl Süddach: optimale Neigung für Warmwasser aus PVGIS
    expect(html).toContain('β = 35 °')
    expect(html).toContain('Eᵣₑₗ = 100 %')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(3)
  })

  it('nennt die optimale Neigung je Dachausrichtung, für Heizungsunterstützung steiler', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.solar-auslegung')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    const tilt = (nutzung: string, ausrichtung: string) => {
      const values = computeFactorTool(tool, { n: 1 }, { nutzung, kollektor: 'flach', ausrichtung, standort: 'mitte' })
      return [values.beta?.value, values.Erel?.value]
    }
    expect(tilt('warmwasser', 'sued')).toEqual([35, 100])
    expect(tilt('heizung', 'sued')).toEqual([60, 100])
    expect(tilt('heizung', 'suedost')).toEqual([50, 85])
    expect(tilt('warmwasser', 'west')).toEqual([0, 86])
    expect(tilt('heizung', 'ost')).toEqual([0, 63])
  })

  it('zeigt je Bundesland die Einstrahlung, im Winter im Süden deutlich mehr als im Norden', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.solar-auslegung')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    const location = tool.choices.find((choice) => choice.key === 'standort')!
    expect(location.display).toBe('dropdown')
    expect(location.options).toHaveLength(17)
    const winter = (standort: string) =>
      computeFactorTool(tool, { n: 1 }, { nutzung: 'heizung', kollektor: 'flach', ausrichtung: 'sued', standort })
    expect(winter('sh').beta?.value).toBe(60)
    expect(winter('by').beta?.value).toBe(60)
    expect(winter('sh').H?.value).toBe(343)
    expect(winter('by').H?.value).toBe(529)

    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialInputs={{ n: '4' }} />)
    expect(html).toContain('<option value="mitte" selected="">Deutschland (Mitte)</option>')
    expect(html).toContain('Bayern (München)')
    expect(html).toContain('H = 1.323 kWh/m²')
  })

  it('meldet Fehler in Faktor-Tools', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.solar-auslegung')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    const [area, storage] = tool.results
    const broken = {
      ...tool,
      choices: tool.choices.filter((choice) => choice.key === 'nutzung' || choice.key === 'kollektor'),
      results: [{ ...area!, cases: area!.cases.slice(1) }, { ...storage!, cases: [{ ...storage!.cases[0]!, when: {}, per: 'X' }] }],
      examples: [{ inputs: { n: 1 }, choices: { nutzung: 'warmwasser', kollektor: 'vakuum' }, expected: { A: 2 } }],
    }
    expect(checkFactorTool(broken)).toEqual([
      'results (A): kein Faktor für warmwasser + flach',
      'results (V), cases[0]: per "X" ist weder eine Eingabe noch ein vorheriges Ergebnis',
      'examples[0]: A ergibt 1, erwartet 2',
    ])
  })

  it('nennt die Mindestdämmdicke von Rohrleitungen nach GModG Anlage 8, auch für andere Dämmstoffe', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.rohrdaemmung')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    expect(checkFactorTool(tool)).toEqual([])
    const insulation = (da: number, t: number, medium: string, leitung: string, lambda = 0.035) => {
      const values = computeFactorTool(tool, { da, t, lambda }, { medium, leitung })
      // auf 0,001 mm runden, damit Gleitkomma-Reste (20,000000000000004) nicht stören
      const round = (value: number | undefined) => (value === undefined ? undefined : Math.round(value * 1000) / 1000)
      return [round(values.di?.value), round(values.s100?.value), values.s?.text ?? round(values.s?.value)]
    }
    // Volle Mindestdicke: Grenzen beim Innendurchmesser 22, 35 und 100 mm
    expect(insulation(24, 1, 'heizung', 'hRegel')).toEqual([22, 20, 20])
    expect(insulation(24, 0.75, 'heizung', 'hRegel')).toEqual([22.5, 30, 30])
    expect(insulation(37, 1, 'heizung', 'hRegel')).toEqual([35, 30, 30])
    expect(insulation(58, 2, 'heizung', 'hRegel')).toEqual([54, 54, 54])
    expect(insulation(104, 2, 'heizung', 'hRegel')).toEqual([100, 100, 100])
    expect(insulation(129, 2, 'heizung', 'hRegel')).toEqual([125, 100, 100])
    // Sonderfälle nach Anlage 8 Nr. 1
    expect(insulation(28, 1.5, 'heizung', 'hDurchbruch')).toEqual([25, 30, 15])
    expect(insulation(28, 1.5, 'heizung', 'hNutzer')).toEqual([25, 30, 15])
    expect(insulation(28, 1.5, 'heizung', 'hFussbodenaufbau')).toEqual([25, 30, 6])
    expect(insulation(28, 1.5, 'warmwasser', 'wwAussenluft')).toEqual([25, 30, 60])
    expect(insulation(28, 1.5, 'heizung', 'hAufputzAbsperrbar')).toEqual([25, 30, 'keine Anforderung'])
    expect(insulation(28, 1.5, 'heizung', 'hAufputzNichtAbsperrbar')).toEqual([25, 30, 30])
    expect(insulation(28, 1.5, 'heizung', 'hBauteilEinNutzer')).toEqual([25, 30, 'keine Anforderung'])
    expect(insulation(28, 1.5, 'warmwasser', 'wwAufputz')).toEqual([25, 30, 30])
    expect(insulation(15, 1, 'warmwasser', 'wwStich')).toEqual([13, 20, 'keine Anforderung'])
    // Kälte nach Anlage 8 Nr. 2: 9 mm bis 22 mm Innendurchmesser, darüber 19 mm
    expect(insulation(22, 1, 'kaelte', 'kRlt')).toEqual([20, 9, 9])
    expect(insulation(28, 1, 'kaelte', 'kRlt')).toEqual([26, 19, 19])
    // Trinkwasser kalt nach DIN 1988-200 Tabelle 8, Richtwerte bei 0,040 W/(m·K)
    expect(insulation(22, 1, 'trinkwasserKalt', 'kwUnbeheizt', 0.04)).toEqual([20, undefined, 9])
    expect(insulation(22, 1, 'trinkwasserKalt', 'kwSchacht', 0.04)).toEqual([20, undefined, 13])
    expect(insulation(22, 1, 'trinkwasserKalt', 'kwVorwand', 0.04)).toEqual([20, undefined, 4])
    expect(insulation(22, 1, 'trinkwasserKalt', 'kwFussboden', 0.04)).toEqual([20, undefined, 4])
    expect(insulation(22, 1, 'trinkwasserKalt', 'kwFussbodenZirkulation', 0.04)).toEqual([20, undefined, 13])
    // Zeile 3: wie Warmwasser, also volle GModG-Dicke bei 0,035 W/(m·K)
    expect(insulation(28, 1.5, 'trinkwasserKalt', 'kwWaermelast')).toEqual([25, 30, 30])
    // Besserer Dämmstoff als 0,040: dünnere Schicht reicht
    const [, , colder] = insulation(22, 1, 'trinkwasserKalt', 'kwSchacht', 0.035)
    expect(colder).toBeCloseTo(11 * ((1 + 26 / 22) ** (0.035 / 0.04) - 1), 3)
    expect(colder).toBeLessThan(13)
    // Ohne Wandstärke (leeres Feld = 0): Außendurchmesser als Innendurchmesser, nie dünner als mit Wandstärke
    expect(insulation(42, 0, 'heizung', 'hRegel')).toEqual([42, 42, 42])
    expect(insulation(42, 1.5, 'heizung', 'hRegel')).toEqual([39, 39, 39])
    expect(insulation(22, 0, 'heizung', 'hRegel')).toEqual([22, 20, 20])
    // Schlechterer Dämmstoff: dicker als linear umgerechnet, weil die Dämmschicht ein Ring ist
    const [, , thicker] = insulation(22, 1, 'heizung', 'hRegel', 0.04)
    expect(thicker).toBeCloseTo(11 * ((1 + 40 / 22) ** (0.04 / 0.035) - 1), 3)
    expect(thicker).toBeGreaterThan((20 * 0.04) / 0.035)

    // Lage der Leitung: nur die zum Medium passenden Einträge
    const warmwater = renderToStaticMarkup(
      <FactorCalculator tool={tool} initialInputs={{ da: '28', t: '1,5' }} initialSelection={{ medium: 'warmwasser', leitung: 'wwStich' }} />,
    )
    expect(warmwater).toContain('value="0,035"')
    expect(warmwater).not.toContain('value="hRegel"')
    expect(warmwater).toContain('<option value="wwStich" selected="">')
    expect(warmwater).toContain('<p class="text-2xl font-bold">keine Anforderung</p>')
    expect(warmwater).toContain('trotzdem dämmen wegen Korrosionsschutz')
    // Wandstärke ist optional
    expect(warmwater).toContain('placeholder="optional"')
    const withoutWall = renderToStaticMarkup(
      <FactorCalculator tool={tool} initialInputs={{ da: '42' }} initialSelection={{ medium: 'heizung', leitung: 'hRegel' }} />,
    )
    expect(withoutWall).toContain('dᵢ = 42,0 mm')
    expect(withoutWall).toContain('Außendurchmesser angesetzt, liegt auf der sicheren Seite')
    // Vier Knöpfe: Heizung, Warmwasser, Kälte (RLT/Klima) und Kaltwasser (Trinkwasser)
    expect(warmwater.match(/aria-pressed=/g)).toHaveLength(4)
    expect(warmwater).toContain('Kalt\u00ADwasser')
    expect(warmwater).not.toContain('Trink\u00ADwasser kalt')
    // Kälte hat eine eigene Lage
    const cold = renderToStaticMarkup(
      <FactorCalculator tool={tool} initialInputs={{ da: '28', t: '1' }} initialSelection={{ medium: 'kaelte', leitung: 'hRegel' }} />,
    )
    expect(cold).toContain('<option value="kRlt" selected="">')
    expect(cold).toContain('s₁₀₀ = 19,0 mm')
    // Passt die Lage nicht zum Medium, nimmt das Tool die erste passende
    const heating = renderToStaticMarkup(
      <FactorCalculator tool={tool} initialInputs={{ da: '28', t: '1,5' }} initialSelection={{ medium: 'heizung', leitung: 'wwStich' }} />,
    )
    expect(heating).toContain('<option value="hRegel" selected="">')
    expect(heating).toContain('s = 30,0 mm')
  })

  it('prüft, dass Bereiche lückenlos aneinander anschließen und Ausdrücke bekannte Größen nutzen', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.rohrdaemmung')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    const results = tool.results.map((result) =>
      result.symbol === 's100'
        ? { ...result, cases: result.cases.filter((_, index) => index !== 1) }
        : result.symbol === 'di'
          ? { ...result, cases: [result.cases[0]!, { ...result.cases[1]!, expression: 'da - 2 * wand' }] }
          : result,
    )
    const issues = checkFactorTool({ ...tool, results, examples: [] })
    expect(issues[0]).toBe('results (di), cases[1]: unbekannte Symbole im Ausdruck: wand')
    expect(issues[1]).toContain('Bereiche schließen nicht aneinander an (upTo 22, above 35)')
  })

  it('nennt den Rohrschellenabstand nach Rohrart und Außendurchmesser', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.rohrschellenabstand')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    expect(checkFactorTool(tool)).toEqual([])
    expect(tool.inputs).toEqual([])
    const distance = (rohr: string, groesse: string) => computeFactorTool(tool, {}, { rohr, groesse }).L?.value
    // Metallrohre nach DIN 1988 Teil 2
    expect(distance('kupfer', 'cu12')).toBe(1.25)
    expect(distance('kupfer', 'cu22')).toBe(2)
    expect(distance('kupfer', 'cu54')).toBe(3.5)
    expect(distance('edelstahl', 'es76p1')).toBe(4.25)
    expect(distance('edelstahl', 'es168p3')).toBe(5)
    // Kunststoff- und Verbundrohre: Anhaltswerte
    expect(distance('verbund', 'vb16')).toBe(1.2)
    expect(distance('pex', 'px20')).toBe(0.9)
    expect(distance('pb', 'pb63')).toBe(1.4)
    expect(distance('pvcc', 'pc25')).toBe(1.05)

    // Größen passend zur Rohrart, Ergebnis ohne Zahleneingabe sofort da
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={{ rohr: 'pex', groesse: 'px32' }} />)
    expect(html).toContain('<option value="px32" selected="">32 mm</option>')
    expect(html).not.toContain('value="cu22"')
    expect(html).toContain('L = 1,00 m')
    expect(html).toContain('verbindlich sind die Angaben des Rohrherstellers')
    expect(html).not.toContain('Alle Werte eingeben.')
  })

  it('zeigt Montagehöhen, Bewegungsflächen und Abstände je Ausführung und Bereich in eigenen Blöcken', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.montagehoehen')!
    if (!isChoiceTool(tool)) throw new Error('Auswahl-Tool erwartet')
    expect(checkChoiceTool(tool)).toEqual([])
    const html = (selection: Record<number, string>, bars?: Record<string, string>) =>
      renderToStaticMarkup(<ChoiceLookup tool={tool} initialSelection={selection} initialBars={bars} />)

    // Zwei Leisten, vorausgewählt „Standard“ und „Sanitärgegenstände“: nur dieser Abschnitt
    const start = html({})
    expect(start).toContain('aria-label="Ausführung"')
    expect(start).toContain('aria-label="Bereich"')
    expect(start).toMatch(/aria-pressed="true"[^>]*><span[^>]*>Standard<\/span><span[^>]*>VDI 6000 Blatt 1<\/span>/)
    expect(start).toMatch(/aria-pressed="true"[^>]*><span[^>]*>Sanitärgegenstände<\/span>/)
    expect(start.match(/<h2 /g)).toHaveLength(1)
    // Titel nur für Screenreader, die Leisten zeigen schon, welcher Abschnitt das ist
    expect(start).toMatch(/<h2 id="[^"]*" class="sr-only">Sanitärgegenstände – Standard<\/h2>/)

    const wc = html({ 0: 'WC' })
    // Jede Gruppe ein eigener Block mit Überschrift
    expect(wc.match(/<div class="mt-4 rounded-2xl border-2 border-accent bg-surface p-4"><div[^>]*><h3/g)).toHaveLength(5)
    expect(wc).toContain('Montagehöhen</h3>')
    expect(wc).toContain('Bewegungsfläche</h3>')
    // Stellflächen nach VDI 6000 Blatt 1, beim WC je nach Spülkasten
    expect(wc).toContain('Stellfläche</h3><span class="text-base text-muted">(Breite × Tiefe)</span>')
    expect(wc).toMatch(/mit Unterputzspülkasten<\/dt><dd[^>]*>40 × 60 cm<\/dd>/)
    expect(wc).toMatch(/mit Aufputzspülkasten<\/dt><dd[^>]*>40 × 75 cm<\/dd>/)
    // Einzelner Wert ohne sichtbare Bezeichnung, links im Block
    expect(html({ 0: 'Badewanne' })).toMatch(/<div class="flex flex-wrap items-baseline gap-x-3 "><dt class="sr-only">Gegenstand<\/dt><dd[^>]*>170 × 75 cm<\/dd>/)
    expect(wc).toContain('Abstandsmaße</h3>')
    expect(wc).toContain('40 cm')
    // „/“ in der Vorlage: kein Eckventil, Zeile ohne Wert wird nicht angezeigt
    expect(wc).not.toContain('>Wasseranschluss<')
    // Legende grau rechts neben der Blocküberschrift, Zeile nur „davor“
    expect(wc).toContain('Bewegungsfläche</h3><span class="text-base text-muted">(Breite × Tiefe)</span>')
    // Maß vorn, „davor“ dahinter
    expect(wc).toMatch(/<div class="flex flex-wrap items-baseline gap-x-3 "><dt class="text-base text-muted">davor<\/dt><dd class="[^"]* order-first">80 × 60 cm<\/dd>/)
    expect(wc).toMatch(/davor<\/dt><dd[^>]*>80 × 60 cm<\/dd>/)
    // Jeder Bezug eine eigene Zeile
    expect(wc).toMatch(/andere Sanitärgegenstände<\/dt><dd[^>]*>20 cm<\/dd>/)
    expect(wc).toMatch(/Bidet<\/dt><dd[^>]*>25 cm<\/dd>/)
    expect(wc).toMatch(/bei Wänden auf beiden Seiten<\/dt><dd[^>]*>25 cm<\/dd>/)
    expect(html({ 0: 'Dusche' })).toMatch(/Waschmaschine, Trockner<\/dt><dd[^>]*>3 cm<\/dd>/)
    // Reihenfolge: einzelne Gegenstände, dann „andere Sanitärgegenstände“, Wände ganz unten
    const rows = (markup: string) => [...markup.matchAll(/<dt class="text-base text-muted">([^<]+)<\/dt>/g)].map((match) => match[1])
    const wcRows = rows(wc)
    expect(wcRows.slice(wcRows.indexOf('Bidet'), wcRows.indexOf('bei Wänden auf beiden Seiten') + 1)).toEqual(['Bidet', 'andere Sanitärgegenstände', 'Türöffnung, Türlaibung', 'Wand', 'bei Wänden auf beiden Seiten'])
    const showerRows = rows(html({ 0: 'Dusche' }))
    expect(showerRows.slice(showerRows.indexOf('Einbauwaschtisch'), showerRows.indexOf('andere Sanitärgegenstände') + 1)).toEqual([
      'Einbauwaschtisch',
      'Bidet',
      'Waschmaschine, Trockner',
      'andere Sanitärgegenstände',
    ])
    // Brausen nur bei Wanne und Dusche
    expect(wc).not.toContain('Kopfbrause')
    const tub = html({ 0: 'Badewanne' })
    expect(tub).toContain('180 cm')
    expect(tub).not.toContain('>Wasseranschluss<')
    // Waschmaschine/Trockner: Flächen nach VDI 6000 Blatt 1, Höhen nach Herstellerangaben
    const washer = html({ 0: 'Waschmaschine, Trockner' })
    expect(washer).toMatch(/Oberkante<\/dt><dd[^>]*>85 cm<\/dd>/)
    expect(washer).toMatch(/Abwasseranschluss<\/dt><dd[^>]*>60–100 cm<\/dd>/)
    expect(washer).toContain('Wasserhahn mit ¾&quot;-Anschlussgewinde')
    expect(washer).toMatch(/Gegenstand<\/dt><dd[^>]*>60 × 60 cm<\/dd>/)
    expect(washer).toMatch(/davor<\/dt><dd[^>]*>90 × 90 cm<\/dd>/)
    expect(washer).toMatch(/Dusche, Badewanne<\/dt><dd[^>]*>3 cm<\/dd>/)
    // Ausgussbecken und Aufsatzwaschbecken (Flächen wie Einbauwaschtisch nach VDI 6000 Blatt 1)
    expect(html({ 0: 'Ausgussbecken' })).toMatch(/Oberkante<\/dt><dd[^>]*>65 cm<\/dd>/)
    const vessel = html({ 0: 'Aufsatzwaschbecken' })
    expect(vessel).toMatch(/Gegenstand<\/dt><dd[^>]*>70 × 60 cm<\/dd>/)
    expect(vessel).toMatch(/Dusche, Badewanne<\/dt><dd[^>]*>15 cm<\/dd>/)
    expect(vessel).toContain('die Platte sitzt um die Beckenhöhe tiefer')
    // Zubehör mit Einheit im Wert, Griffe und Handtuchheizkörper
    const accessory = (label: string, ausfuehrung = 'standard') => html({ 1: label, 3: label, 5: label }, { ausfuehrung, bereich: 'zubehoer' })
    expect(accessory('Seifenhalter an der Badewanne')).toContain('10 cm über Wannenrand')
    expect(accessory('Haltegriff am Bidet, waagerecht')).toContain('Mitte 100 cm')
    expect(accessory('Handtuchheizkörper, elektrisch')).toContain('unterstes beheiztes Rohr mind. 60 cm über Fußboden')
    expect(accessory('Stützklappgriffe am WC', 'rollstuhl')).toContain('Oberkante 28 cm über Sitzhöhe')
    expect(accessory('Haltegriffe in der Dusche', 'barrierefrei')).toContain('Nachrüstung empfohlen')
    // Kinder-WC und Kinderwaschbecken nach Altersgruppen
    const childWc = html({ 0: 'Kinder-WC' })
    expect(childWc).toMatch(/Sitzhöhe, 1–3 Jahre<\/dt><dd[^>]*>26 cm<\/dd>/)
    expect(childWc).toMatch(/Stützklappgriffe, 3–6 Jahre<\/dt><dd[^>]*>55 cm, Abstand 45 cm<\/dd>/)
    expect(html({ 0: 'Kinderwaschbecken' })).toMatch(/Oberkante, 7–14 Jahre<\/dt><dd[^>]*>65–75 cm<\/dd>/)
    expect(accessory('Brausestange in der Dusche')).toContain('OK 209,5 cm über Standfläche')
    expect(accessory('Spiegelschrank')).toContain('UK 115–125 cm, OK ca. 200 cm')
    // Wandarmatur aus der Tabelle des Inhabers (dort in mm: 1010 und 1125)
    expect(html({ 0: 'Waschtisch' })).toMatch(/Wandarmatur<\/dt><dd[^>]*>101 cm<\/dd>/)
    expect(html({ 0: 'Waschtisch' })).toMatch(/Wasseranschluss<\/dt><dd[^>]*>55 cm<\/dd>/)
    expect(html({ 0: 'Spüle' })).toMatch(/Wandarmatur<\/dt><dd[^>]*>112,5 cm<\/dd>/)
    expect(html({ 1: 'Spiegel' }, { bereich: 'zubehoer' })).toContain('UK 115–120 cm')

    // Elektrische Schutzbereiche nach DIN VDE 0100-701:2025-06 als eigener Block
    const shower = html({ 0: 'Dusche' })
    expect(shower).toContain('Schutzbereiche (Elektro)</h3><span class="text-base text-muted">(DIN VDE 0100-701)</span>')
    expect(shower).toMatch(/Bereich 0 ohne Duschwanne<\/dt><dd[^>]*>bis 10 cm über OKFF, im Umkreis von 120 cm/)
    expect(shower).toMatch(/Bereich 2 ohne Duschwanne<\/dt><dd[^>]*>entfällt<\/dd>/)
    expect(shower).toMatch(/Schutzart Bereich 0<\/dt><dd[^>]*>IPX7<\/dd>/)
    expect(shower).toMatch(/entfällt<\/dd><\/div><\/dl><h4 class="mt-4 text-lg font-bold text-accent">Anforderungen Elektroinstallation<\/h4><dl[^>]*><div[^>]*><dt[^>]*>Schutzart Bereich 0/)
    expect(tub).toMatch(/Bereich 1<\/dt><dd[^>]*>über der Wanne bis 225 cm über OKFF/)
    expect(wc).toMatch(/Schutzbereich<\/dt><dd[^>]*>kein eigener;/)
    // Hinweise bleiben der letzte Block
    const blocks = (markup: string) => [...markup.matchAll(/<h3 class="text-lg font-bold text-accent">([^<]+)<\/h3>/g)].map((m) => m[1])
    expect(blocks(html({ 0: 'Dusche' }, { ausfuehrung: 'rollstuhl' }))).toEqual([
      'Montagehöhen',
      'Bewegungsfläche',
      'Abstandsmaße',
      'Schutzbereiche (Elektro)',
      'Hinweise',
    ])

    // Barrierefrei und rollstuhlgerecht nach DIN 18040-2, je mit Sanitärgegenständen und Zubehör
    expect(tool.sections.map((section) => Object.values(section.when).join(' + '))).toEqual([
      'standard + objekte',
      'standard + zubehoer',
      'barrierefrei + objekte',
      'barrierefrei + zubehoer',
      'rollstuhl + objekte',
      'rollstuhl + zubehoer',
    ])
    const wheelchair = html({ 0: 'WC' }, { ausfuehrung: 'rollstuhl' })
    expect(wheelchair).toContain('Sanitärgegenstände – rollstuhlgerecht</h2>')
    expect(wheelchair).toContain('46–48 cm inkl. Sitz')
    expect(wheelchair).toMatch(/Tiefe \(WC-Ausladung\)<\/dt><dd[^>]*>mind. 70 cm<\/dd>/)
    expect(wheelchair).toMatch(/Stützklappgriffe, Oberkante über Sitzhöhe<\/dt><dd[^>]*>28 cm<\/dd>/)
    expect(wheelchair).toMatch(/Stützklappgriffe, lichter Abstand<\/dt><dd[^>]*>65–70 cm<\/dd>/)
    expect(wheelchair).toMatch(/seitlich<\/dt><dd[^>]*>90 × 70 cm, links oder rechts<\/dd>/)
    expect(wheelchair).toContain('Hinweise</h3>')
    // Rutschhemmung im bodengleichen Duschbereich
    for (const ausfuehrung of ['barrierefrei', 'rollstuhl']) {
      expect(html({ 0: 'Dusche' }, { ausfuehrung })).toMatch(/Rutschhemmung<\/dt><dd[^>]*>mind. Bewertungsgruppe B/)
    }
    expect(html({ 0: 'Dusche' })).not.toContain('Rutschhemmung')
    expect(html({ 0: 'Waschtisch' }, { ausfuehrung: 'rollstuhl' })).toMatch(/Vorderkante<\/dt><dd[^>]*>max. 80 cm<\/dd>/)
    expect(html({ 0: 'WC' }, { ausfuehrung: 'barrierefrei' })).toContain('120 × 120 cm')
    expect(html({ 1: 'Spiegel' }, { ausfuehrung: 'rollstuhl', bereich: 'zubehoer' })).toContain(
      'mind. 100 cm hoch, unmittelbar über dem Waschtisch',
    )
  })

  it('rechnet Montagehöhen über OKFF mit Fußbodenaufbau auf OKRFB um', () => {
    expect(shiftFloorHeight('60', 15)).toBe('75')
    expect(shiftFloorHeight('60–100', 15)).toBe('75–115')
    expect(shiftFloorHeight('UK 115–125 cm, OK ca. 200 cm', 7.5)).toBe('UK 122,5–132,5 cm, OK ca. 207,5 cm')
    expect(shiftFloorHeight('mind. 60 cm über Fußboden', 10)).toBe('mind. 70 cm über Fußboden')
    expect(shiftFloorHeight('55 cm, Abstand 45 cm', 10)).toBe('65 cm, Abstand 45 cm')
    // anderer Bezug: unverändert
    expect(shiftFloorHeight('10 cm über Wannenrand', 10)).toBe('10 cm über Wannenrand')
    expect(shiftFloorHeight('Oberkante 28 cm über Sitzhöhe', 10)).toBe('Oberkante 28 cm über Sitzhöhe')
    expect(shiftFloorHeight('individuell', 10)).toBe('individuell')
  })

  it('zeigt mit Fußbodenaufbau die Montagehöhen über OKFF und OKRFB nebeneinander', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.montagehoehen')!
    if (!isChoiceTool(tool)) throw new Error('Auswahl-Tool erwartet')
    const render = (buildUp: string, bars?: Record<string, string>) =>
      renderToStaticMarkup(<ChoiceLookup tool={tool} initialSelection={{ 0: 'WC', 4: 'WC' }} initialBars={bars} initialBuildUp={buildUp} />)
    const empty = render('')
    expect(empty).toContain('Fußbodenaufbau (Estrich und Belag)')
    expect(empty).not.toContain('OKRFB</span>')
    // ohne Aufbau steht nur der Bezug rechts über den Höhen
    expect(empty).toContain('Montagehöhen</h3><span class="text-base text-muted">OKFFB</span>')
    const raised = render('15')
    expect(raised).toContain('Montagehöhen</h3><span aria-hidden="true" class="text-right text-base font-semibold text-muted">OKFFB</span>')
    expect(raised).toMatch(/Oberkante<\/span><span class="text-right text-xl font-bold"><span class="sr-only">OKFFB: <\/span>40 cm<\/span><span class="text-right text-xl font-bold"><span class="sr-only">OKRFB: <\/span>55 cm<\/span>/)
    // Andere Blöcke unverändert
    expect(raised).toContain('80 × 60 cm')
    // Stützklappgriffe über Sitzhöhe: ein Wert über beide Spalten
    const wheelchair = render('15', { ausfuehrung: 'rollstuhl' })
    expect(wheelchair).toMatch(/<span class="col-span-2 text-right text-lg font-semibold">28 cm<\/span>/)
    expect(wheelchair).toContain('61–63 cm inkl. Sitz')
    expect(render('abc')).toContain('Bitte eine Zahl von 0 bis 100 eingeben.')
  })

  it('prüft die Leisten in Auswahl-Tools', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.montagehoehen')!
    if (!isChoiceTool(tool)) throw new Error('Auswahl-Tool erwartet')
    const sections = tool.sections.map((section, index) =>
      index === 5 ? { ...section, when: { ausfuehrung: 'unbekannt', bereich: 'zubehoer' } } : section,
    )
    expect(checkChoiceTool({ ...tool, sections })).toEqual([
      'bars: kein Abschnitt für rollstuhl + zubehoer',
      'sections[5] (Badzubehör – rollstuhlgerecht): unbekannte Option "unbekannt" bei "ausfuehrung"',
    ])
  })

  it('hat in jedem Rechner mit Eingabefeldern einen Knopf zum Löschen der Eingaben', () => {
    const button = /<button type="button" disabled="" aria-label="Alle Eingaben löschen"/
    const enabled = /<button type="button" aria-label="Alle Eingaben löschen"/
    // Formel-Tool: leer, also gesperrt
    expect(renderToStaticMarkup(<Calculator formula={rollenlaenge} />)).toMatch(button)
    // Faktor-Tool: Vorbelegung zählt nicht als Eingabe, eigene Eingabe schon
    const insulation = toolEntries.find((entry) => entry.id === 'tool.rohrdaemmung')!
    if (!isFactorTool(insulation)) throw new Error('Faktor-Tool erwartet')
    expect(renderToStaticMarkup(<FactorCalculator tool={insulation} />)).toMatch(button)
    expect(renderToStaticMarkup(<FactorCalculator tool={insulation} initialInputs={{ da: '22' }} />)).toMatch(enabled)
    // Faktor-Tool ohne Eingabefelder: kein Knopf
    const clamps = toolEntries.find((entry) => entry.id === 'tool.rohrschellenabstand')!
    if (!isFactorTool(clamps)) throw new Error('Faktor-Tool erwartet')
    expect(renderToStaticMarkup(<FactorCalculator tool={clamps} />)).not.toContain('Alle Eingaben löschen')
    // Auswahl-Tool mit Fußbodenaufbau
    const heights = toolEntries.find((entry) => entry.id === 'tool.montagehoehen')!
    if (!isChoiceTool(heights)) throw new Error('Auswahl-Tool erwartet')
    expect(renderToStaticMarkup(<ChoiceLookup tool={heights} initialBuildUp="15" />)).toMatch(enabled)
  })

  it('zeigt Wartungsintervalle je Bereich und Anlagenteil', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.wartungsintervalle')!
    if (!isChoiceTool(tool)) throw new Error('Auswahl-Tool erwartet')
    expect(checkChoiceTool(tool)).toEqual([])
    expect(tool.category).toBe('Wartung')
    const html = (label: string, bereich: string) =>
      renderToStaticMarkup(<ChoiceLookup tool={tool} initialSelection={{ 0: label, 1: label, 2: label }} initialBars={{ bereich }} />)
    const filter = html('Rückspülfilter (80–150 µm)', 'trinkwasser')
    expect(filter).toMatch(/Inspektion<\/dt><dd[^>]*>halbjährlich<\/dd>/)
    expect(filter).toContain('DIN EN 806-5, Anhang A, Tabelle A.1')
    const softener = html('Enthärtungsanlage', 'trinkwasser')
    expect(softener).toMatch(/Inspektion<\/dt><dd[^>]*>alle 2 Monate<\/dd>/)
    const boiler = html('Öl- oder Gaskessel ohne Brennwert (ab 4 kW)', 'heizung')
    expect(boiler).toContain('jedes 3. Kalenderjahr (bis 12 Jahre nach Inbetriebnahme)')
    expect(boiler).toContain('gesetzlich vorgeschrieben')
    const lifting = html('Abwasserhebeanlage', 'abwasser')
    expect(lifting).toContain('gewerblich vierteljährlich, Mehrfamilienhaus halbjährlich, Einfamilienhaus jährlich')
  })

  it('zeigt die Abgaswerte je Brennerart', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.abgaswerte')!
    if (!isChoiceTool(tool)) throw new Error('Auswahl-Tool erwartet')
    expect(checkChoiceTool(tool)).toEqual([])
    expect(tool.sections[0]!.options.map((option) => option.label)).toEqual([
      'Erdgas (Brennwert)',
      'Erdgas (Gebläsebrenner)',
      'Erdgas (atmosphärisch)',
      'Flüssiggas (Propan)',
      'Heizöl (Brennwert, Blaubrenner)',
      'Heizöl (Blaubrenner)',
      'Heizöl (Gelbbrenner)',
      'Heizöl (Verdampfungsbrenner)',
      'Pellet / Holz',
    ])
    // Neue Brennerarten: λ nach Testo, CO₂ = CO₂max / λ, O₂ = 21 · (1 − 1/λ)
    const values = (label: string) => tool.sections[0]!.options.find((option) => option.label === label)!.values
    const range = (text: string) => text.match(/[\d,]+/g)!.slice(0, 2).map((part) => Number(part.replace(',', '.')))
    const check = (label: string, co2max: number) => {
      const [low, high] = range(values(label).lambda!)
      expect(range(values(label).co2!)).toEqual([Math.round((co2max / high!) * 10) / 10, Math.round((co2max / low!) * 10) / 10])
      expect(range(values(label).o2!)).toEqual([Math.round(21 * (1 - 1 / low!) * 10) / 10, Math.round(21 * (1 - 1 / high!) * 10) / 10])
    }
    check('Erdgas (Gebläsebrenner)', 11.7)
    check('Flüssiggas (Propan)', 13.9)
    check('Heizöl (Brennwert, Blaubrenner)', 15.4)
    check('Heizöl (Gelbbrenner)', 15.4)
    check('Heizöl (Verdampfungsbrenner)', 15.4)
    expect(values('Heizöl (Verdampfungsbrenner)').grenzRuss).toBe('max. 2 (bis 11 kW, errichtet vor 1.11.1996: max. 3)')
    expect(values('Heizöl (Gelbbrenner)').grenzRuss).toBe('max. 1')
    // Abgeglichene Richtwerte des Inhabers: O₂ passend zu CO₂, Brennwert unter dem Taupunkt
    expect(values('Erdgas (Brennwert)')).toMatchObject({ co2: '8,5–10,5 Vol.-%', o2: '2–6 Vol.-%', temperatur: '30–60 °C', verlust: '< 3 %' })
    expect(values('Heizöl (Blaubrenner)').o2).toBe('2–4 Vol.-%')
    const html = renderToStaticMarkup(<ChoiceLookup tool={tool} initialSelection={{ 0: 'Heizöl (Blaubrenner)' }} />)
    expect(html).toMatch(/Kohlendioxid \(CO₂\)<\/dt><dd[^>]*>12,5–13,5 Vol.-%<\/dd>/)
    expect(html).toMatch(/Abgastemperatur<\/dt><dd[^>]*>90–160 °C<\/dd>/)
    // Gesetzliche Grenzwerte als eigener Block
    expect(html).toContain('Gesetzliche Grenzwerte</h3>')
    expect(html).toMatch(/Rußzahl<\/dt><dd[^>]*>max. 1<\/dd>/)
    expect(html).toMatch(/Abgasverlust 4–25 kW<\/dt><dd[^>]*>max. 11 %<\/dd>/)
    expect(html).toMatch(/CO, unverdünnt und trocken<\/dt><dd[^>]*>max. 1 000 ppm<\/dd>/)
    const solid = renderToStaticMarkup(<ChoiceLookup tool={tool} initialSelection={{ 0: 'Pellet / Holz' }} />)
    expect(solid).toMatch(/Staub<\/dt><dd[^>]*>max. 0,02 g\/m³<\/dd>/)
    expect(solid).not.toContain('Abgasverlust 4–25 kW')
    // Keine Leisten: Abschnittstitel sichtbar
    expect(html).toContain('<h2 id="')
    expect(html).toContain('class="text-xl font-bold">Abgaswerte</h2>')
  })

  it('ermittelt die Gebäudeklasse nach Art. 2 Abs. 3 BayBO', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.gebaeudeklasse')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    expect(checkFactorTool(tool)).toEqual([])
    const gk = (choices: Record<string, string>) => computeFactorTool(tool, {}, normalizeSelection(tool, choices)).GK?.value
    const above = (hoehe: string, einheiten: string, lage = 'freistehend') =>
      gk({ gebaeude: 'oberirdisch', hoehe, einheiten, lage })
    expect(above('bis7', 'klein')).toBe(1)
    expect(above('bis7', 'klein', 'angebaut')).toBe(2)
    expect(above('bis7', 'jeweils')).toBe(3)
    expect(above('bis7', 'gross')).toBe(3)
    expect(above('bis13', 'klein')).toBe(4)
    expect(above('bis13', 'jeweils')).toBe(4)
    expect(above('bis13', 'gross')).toBe(5)
    expect(above('bis22', 'klein')).toBe(5)
    expect(above('hochhaus', 'klein')).toBe(5)
    // In Bayern ohne Höhen- und Flächengrenze, unterirdisch immer Klasse 5
    expect(gk({ gebaeude: 'landforst' })).toBe(1)
    expect(gk({ gebaeude: 'unterirdisch' })).toBe(5)

    // Ausgeblendete Auswahlen bleiben offen, die Lage erscheint nur, wo sie über 1 oder 2 entscheidet
    expect(normalizeSelection(tool, { gebaeude: 'landforst', hoehe: 'bis7', einheiten: 'klein', lage: 'freistehend' })).toEqual({
      gebaeude: 'landforst',
    })
    const render = (initialSelection: Record<string, string>) =>
      renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={initialSelection} />)
    const small = render({ gebaeude: 'oberirdisch', hoehe: 'bis7', einheiten: 'klein', lage: 'angebaut' })
    expect(small).toContain('GK = 2')
    expect(small).toContain('angebaut (z. B. Doppel- oder Reihenhaus)')
    const tall = render({ gebaeude: 'oberirdisch', hoehe: 'bis13', einheiten: 'klein' })
    expect(tall).toContain('GK = 4')
    expect(tall).not.toContain('freistehend</')
    const farm = render({ gebaeude: 'landforst' })
    expect(farm).toContain('GK = 1')
    expect(farm).not.toContain('über 7 m bis 13 m')
  })

  it('nennt bei Abwasserrohren getrennte Schellenabstände für waagerecht und senkrecht', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.rohrschellenabstand')!
    if (!isFactorTool(tool)) throw new Error('Faktor-Tool erwartet')
    const spacing = (rohr: string, groesse: string) => {
      const values = computeFactorTool(tool, {}, { rohr, groesse })
      return [values.L?.value ?? values.L?.text, values.Lv?.value ?? values.Lv?.text]
    }
    // HT (Ostendorf), POLO-KAL (POLOPLAST), RAUPIANO PLUS (REHAU)
    expect(spacing('ht', 'ht40')).toEqual([0.5, 1.2])
    expect(spacing('ht', 'ht110')).toEqual([1.1, 2])
    expect(spacing('polokal', 'pk110')).toEqual([1.65, 2])
    expect(spacing('polokal', 'pk250')).toEqual([3, 2])
    expect(spacing('raupiano', 'rp32')).toEqual([0.48, 1.5])
    // 1125 mm auf 1,12 m abgerundet, damit die Anzeige den Höchstwert nicht überschreitet
    expect(spacing('raupiano', 'rp75')).toEqual([1.12, 2])
    expect(tool.choices.find((choice) => choice.key === 'rohr')!.options.some((option) => option.key === 'kg')).toBe(false)
    // Druckrohre: Quelle ohne Verlegerichtung
    expect(spacing('kupfer', 'cu22')).toEqual([2, 'keine gesonderte Angabe'])

    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={{ rohr: 'ht', groesse: 'ht110' }} />)
    expect(html).toContain('<option value="ht110" selected="">DN 110</option>')
    expect(html).toContain('L = 1,10 m')
    expect(html).toContain('Lᵥ = 2,00 m')
  })

  it('listet die Tools und zeigt ein Tool mit Formel, Legende und Rechner', () => {
    const list = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools']}>
        <App />
      </MemoryRouter>,
    )
    expect(list).toContain('href="/tools/rollenlaenge"')
    expect(list.indexOf('>Aufmaß</h2>')).toBeGreaterThan(-1)
    expect(list.indexOf('>Aufmaß</h2>')).toBeLessThan(list.indexOf('href="/tools/material-zurueck"'))
    expect(list.indexOf('href="/tools/material-zurueck"')).toBeLessThan(list.indexOf('>Auslegung</h2>'))
    expect(list.indexOf('>Auslegung</h2>')).toBeLessThan(list.indexOf('href="/tools/fbh-rohrlaenge"'))
    const page = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/rollenlaenge']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(page).toContain('Ausgerollte Länge von Rohr- und Kabelrollen</h1>')
    expect(page).toMatch(/L = n<span class="mx-1">·<\/span>π<span class="mx-1">·<\/span>d/)
    expect(page).toContain('Anzahl der Wicklungen')
    expect(page).toContain('>Rechner</h2>')
  })

  it('führt die drei Rollen-Rechnungen in einem Tool mit Umschalter zusammen', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.rollenlaenge')!
    if (!isVariantTool(tool)) throw new Error('Varianten-Tool erwartet')
    expect(checkVariantTool(tool)).toEqual([])
    expect(tool.variants.map((variant) => variant.label)).toEqual(['Wicklungen', 'Ringquerschnitt', 'Mehrere Rollen'])
    // Alte Einzel-Tools gibt es nicht mehr
    expect(toolEntries.some((entry) => entry.id === 'tool.rollenlaenge-exakt' || entry.id === 'tool.verbaute-laenge')).toBe(false)
    const render = (initialVariant?: string) =>
      renderToStaticMarkup(
        <MemoryRouter>
          <VariantCalculator tool={tool} initialVariant={initialVariant} />
        </MemoryRouter>,
      )
    const first = render()
    expect(first).toContain('aria-label="Berechnung"')
    expect(first).toMatch(/aria-pressed="true"[^>]*><span[^>]*>Wicklungen<\/span>/)
    expect(first).toContain('Über die Wicklungen</h2>')
    const rolls = render('rollen')
    expect(rolls).toContain('Verbaute Länge aus mehreren Rollen</h2>')
    expect(rolls).toContain('Restlänge der angefangenen Rolle am Anfang')
    expect(rolls).not.toContain('Anzahl der Wicklungen')
    // Ein Varianten-Tool mit falscher Formel wird gemeldet
    const broken = { ...tool, variants: [{ ...tool.variants[0]!, expression: 'n * pi * x' }, tool.variants[1]!] }
    expect(checkVariantTool(broken).join(' ')).toContain('variants[0] (Wicklungen)')
  })
})
