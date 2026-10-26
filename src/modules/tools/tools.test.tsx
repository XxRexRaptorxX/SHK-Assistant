import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { homeTileModules, modules } from '../../app/modules'
import { checkFormula, evaluateFormula } from '../formulas/engine'
import { presetsFor } from '../materials/materials'
import { ensureCustomUnits } from '../units/customUnits'
import ToolPage from './ToolPage'
import { checkChoiceTool, checkTableTool, isChoiceTool, isTableTool } from './schema'
import { ChoiceLookup } from './ChoiceLookup'
import { FactorCalculator } from './FactorCalculator'
import { checkFactorTool, computeFactorTool } from './factorTool'
import { isFactorTool } from './schema'
import { matchingRows, TableLookup } from './TableLookup'
import { Calculator } from '../formulas/Calculator'
import { formulaToolEntries, toolEntries } from './tools'

ensureCustomUnits()

const rollenlaenge = formulaToolEntries.find((entry) => entry.id === 'tool.rollenlaenge')!

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
    const exakt = formulaToolEntries.find((entry) => entry.id === 'tool.rollenlaenge-exakt')!
    expect(checkFormula(exakt)).toEqual([])
    const length = evaluateFormula(exakt, {
      D: { value: 80, unit: 'cm' },
      dK: { value: 40, unit: 'cm' },
      t: { value: 20, unit: 'mm' },
    })
    expect(length).toBeCloseTo(6 * Math.PI, 6)
    expect(toolEntries.map((entry) => entry.title)).toEqual([
      'Ausgerollte Länge einer Rohr- oder Kabelrolle',
      'Exakte ausgerollte Länge einer Rohr- oder Kabelrolle',
      'Heizlast pro Quadratmeter – überschlägig',
      'Heizlast überschlägig aus Fläche und Gebäudestandard',
      'Heizlast und Wärmebedarf nach Baujahr',
      'Leistungsminderung durch Kalk am Wärmetauscher',
      'Leistungsminderung durch Ruß im Kessel',
      'Material zurückschreiben',
      'Mindestdämmdicke von Rohrleitungen',
      'Rohrlänge einer Fußbodenheizung',
      'Solaranlage: Kollektorfläche und Speichergröße',
      'Thermostatkopf-Einstellung und Raumtemperatur',
      'Verbaute Länge aus mehreren Rollen (bei Abrollern)',
    ])
  })

  it('rechnet die verbaute Länge aus angefangener, vollen und letzter Rolle', () => {
    const verbaut = formulaToolEntries.find((entry) => entry.id === 'tool.verbaute-laenge')!
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

  it('rechnet die Heizlast pro Quadratmeter und zurück mit Richtwerten für q', () => {
    const proFlaeche = formulaToolEntries.find((entry) => entry.id === 'tool.heizlast-pro-flaeche')!
    const heizlast = formulaToolEntries.find((entry) => entry.id === 'tool.heizlast-ueberschlaegig')!
    expect(checkFormula(proFlaeche)).toEqual([])
    expect(checkFormula(heizlast)).toEqual([])
    expect(evaluateFormula(proFlaeche, { P: { value: 10, unit: 'kW' }, A: { value: 125, unit: 'm^2' } })).toBe(80)
    expect(evaluateFormula(heizlast, { q: { value: 80, unit: 'W/m^2' }, A: { value: 125, unit: 'm^2' } })).toBe(10)
    const q = heizlast.variables.find((variable) => variable.symbol === 'q')!
    expect(presetsFor(q).map((preset) => preset.value)).toEqual([170, 100, 80, 50, 40, 30, 20, 10])
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

  it('schlägt Heizlast und Wärmebedarf zum Baujahr nach, ab 2002 auch nach Baustandard', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.heizlast-baujahr')!
    if (!isTableTool(tool)) throw new Error('Tabellen-Tool erwartet')
    expect(checkTableTool(tool)).toEqual([])
    const values = (year: number) => matchingRows(tool, year).map((row) => row.values)
    expect(values(1920)).toEqual([{ heizlast: 'ca. 105', waermebedarf: 'ca. 200' }])
    expect(values(1984)).toEqual([{ heizlast: 'ca. 90', waermebedarf: 'ca. 170' }])
    expect(values(1985)).toEqual([{ heizlast: 'ca. 70', waermebedarf: 'ca. 135' }])
    expect(values(2001)).toEqual([{ heizlast: 'ca. 55', waermebedarf: 'ca. 100' }])
    expect(values(2015)).toEqual([
      { heizlast: 'ca. 45', waermebedarf: 'ca. 70' },
      { heizlast: '36–38', waermebedarf: 'ca. 45' },
    ])
    expect(values(1919)).toEqual([])

    const html = renderToStaticMarkup(<TableLookup tool={tool} initialValue="1975" />)
    expect(html).toContain('q = ca. 90 W/m²')
    expect(html).toContain('qₕ = ca. 170 kWh/(m²·a)')
    expect(html).toContain('Heizlast (q)')
    expect(html).not.toContain('Quelle:')
    expect(html).not.toContain('ungeprüft')
    expect(html.match(/aria-current="true"/g)).toHaveLength(1)
    expect(renderToStaticMarkup(<TableLookup tool={tool} initialValue="1900" />)).toContain('keine Angabe')
  })

  it('meldet Fehler in Tabellen-Tools', () => {
    const tool = toolEntries.find((entry) => entry.id === 'tool.heizlast-baujahr')!
    if (!isTableTool(tool)) throw new Error('Tabellen-Tool erwartet')
    const broken = { ...tool, rows: [{ label: 'x', note: '', values: { heizlast: '1', extra: '2' } }] }
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
      'sections[0] (Norm-Innentemperatur nach Raumart), options[1] (Ausstellungsräume): Wert fehlt für temperatur',
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
    expect(page).toContain('Länge einer Rohr- oder Kabelrolle</h1>')
    expect(page).toMatch(/L = n<span class="mx-1">·<\/span>π<span class="mx-1">·<\/span>d/)
    expect(page).toContain('Anzahl der Wicklungen')
    expect(page).toContain('>Rechner</h2>')
  })
})
