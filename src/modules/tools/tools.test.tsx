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
      const values = computeFactorTool(tool, n, { nutzung, kollektor })
      return [values.A?.value, values.V?.value]
    }
    expect(solar(4, 'warmwasser', 'flach')).toEqual([6, 320])
    expect(solar(4, 'warmwasser', 'vakuum')).toEqual([4, 320])
    expect(solar(4, 'heizung', 'flach')).toEqual([16, 960])
    expect(solar(4, 'heizung', 'vakuum')).toEqual([12, 720])

    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialInput="4" />)
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
      const values = computeFactorTool(tool, 1, { nutzung, kollektor: 'flach', ausrichtung, standort: 'mitte' })
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
      computeFactorTool(tool, 1, { nutzung: 'heizung', kollektor: 'flach', ausrichtung: 'sued', standort })
    expect(winter('sh').beta?.value).toBe(60)
    expect(winter('by').beta?.value).toBe(60)
    expect(winter('sh').H?.value).toBe(343)
    expect(winter('by').H?.value).toBe(529)

    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialInput="4" />)
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
      examples: [{ input: 1, choices: { nutzung: 'warmwasser', kollektor: 'vakuum' }, expected: { A: 2 } }],
    }
    expect(checkFactorTool(broken)).toEqual([
      'results (A): kein Faktor für warmwasser + flach',
      'results (V), cases[0]: per "X" ist weder die Eingabe noch ein vorheriges Ergebnis',
      'examples[0]: A ergibt 1, erwartet 2',
    ])
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
