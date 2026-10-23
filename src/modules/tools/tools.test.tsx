import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { homeTileModules, modules } from '../../app/modules'
import { checkFormula, evaluateFormula } from '../formulas/engine'
import { presetsFor } from '../materials/materials'
import { ensureCustomUnits } from '../units/customUnits'
import ToolPage from './ToolPage'
import { toolEntries } from './tools'

ensureCustomUnits()

const rollenlaenge = toolEntries.find((entry) => entry.id === 'tool.rollenlaenge')!

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
    const exakt = toolEntries.find((entry) => entry.id === 'tool.rollenlaenge-exakt')!
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
      'Material zurückschreiben',
      'Rohrlänge einer Fußbodenheizung',
      'Verbaute Länge aus mehreren Rollen (bei Abrollern)',
    ])
  })

  it('rechnet die verbaute Länge aus angefangener, vollen und letzter Rolle', () => {
    const verbaut = toolEntries.find((entry) => entry.id === 'tool.verbaute-laenge')!
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
    const material = toolEntries.find((entry) => entry.id === 'tool.material-zurueck')!
    expect(checkFormula(material)).toEqual([])
    expect(evaluateFormula(material, { Mm: { value: 250, unit: 'm' }, Mr: { value: 40, unit: 'm' } })).toBe(210)
  })

  it('rechnet die FBH-Rohrlänge aus Fläche und Verlegeabstand, auch in mm', () => {
    const fbh = toolEntries.find((entry) => entry.id === 'tool.fbh-rohrlaenge')!
    expect(checkFormula(fbh)).toEqual([])
    expect(evaluateFormula(fbh, { A: { value: 25, unit: 'm^2' }, VA: { value: 15, unit: 'cm' } })).toBeCloseTo(166.67, 2)
    expect(evaluateFormula(fbh, { A: { value: 25, unit: 'm^2' }, VA: { value: 150, unit: 'mm' } })).toBeCloseTo(166.67, 2)
    expect(presetsFor(fbh.variables.find((variable) => variable.symbol === 'VA')!).map((preset) => preset.value)).toEqual([
      5, 10, 15,
    ])
  })

  it('rechnet die Heizlast pro Quadratmeter und zurück mit Richtwerten für q', () => {
    const proFlaeche = toolEntries.find((entry) => entry.id === 'tool.heizlast-pro-flaeche')!
    const heizlast = toolEntries.find((entry) => entry.id === 'tool.heizlast-ueberschlaegig')!
    expect(checkFormula(proFlaeche)).toEqual([])
    expect(checkFormula(heizlast)).toEqual([])
    expect(evaluateFormula(proFlaeche, { P: { value: 10, unit: 'kW' }, A: { value: 125, unit: 'm^2' } })).toBe(80)
    expect(evaluateFormula(heizlast, { q: { value: 80, unit: 'W/m^2' }, A: { value: 125, unit: 'm^2' } })).toBe(10)
    const q = heizlast.variables.find((variable) => variable.symbol === 'q')!
    expect(presetsFor(q).map((preset) => preset.value)).toEqual([170, 100, 80, 50, 40, 30, 20, 10])
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
