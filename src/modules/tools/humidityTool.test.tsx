import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FactorCalculator } from './FactorCalculator'
import { checkFactorTool, computeFactorTool, visibleInputs, visibleResults, type FactorTool } from './factorTool'
import { toolEntries } from './tools'

const tool = toolEntries.find((entry) => entry.id === 'tool.luftfeuchte') as FactorTool
const relative = { gegeben: 'relativ' }
const absolute = { gegeben: 'absolut' }

describe('Luftfeuchte und Taupunkt', () => {
  it('besteht die Inhaltsprüfung samt Beispielen aus der Quelle', () => {
    expect(tool.kind).toBe('factor')
    expect(checkFactorTool(tool)).toEqual([])
    expect(tool.examples.length).toBeGreaterThanOrEqual(4)
  })

  it('fragt je nach Auswahl die relative oder die absolute Feuchte ab', () => {
    expect(visibleInputs(tool, relative).map((input) => input.symbol)).toEqual(['t', 'phi'])
    expect(visibleInputs(tool, absolute).map((input) => input.symbol)).toEqual(['t', 'rho'])
    expect(visibleResults(tool, relative).map((result) => result.symbol)).toEqual(['rhoW', 'tau', 'rhoMax', 'ps', 'pD'])
    expect(visibleResults(tool, absolute).map((result) => result.symbol)).toEqual(['phiOut', 'tau', 'rhoMax', 'ps', 'pD'])
  })

  it('rechnet relativ → absolut → relativ ohne Verlust zurück', () => {
    const forward = computeFactorTool(tool, { t: 21, phi: 55 }, relative)
    const back = computeFactorTool(tool, { t: 21, rho: forward.rhoW!.value! }, absolute)
    expect(back.phiOut?.value).toBeCloseTo(55, 9)
    expect(back.tau?.value).toBeCloseTo(forward.tau!.value!, 9)
  })

  it('setzt den Taupunkt bei 100 % gleich der Lufttemperatur, auch unter 0 °C', () => {
    for (const t of [-20, 0, 15, 40]) {
      expect(computeFactorTool(tool, { t, phi: 100 }, relative).tau?.value).toBeCloseTo(t, 9)
    }
  })

  it('meldet eine absolute Feuchte über der Sättigung statt mehr als 100 % anzuzeigen', () => {
    const values = computeFactorTool(tool, { t: 10, rho: 12 }, absolute)
    expect(values.phiOut?.text).toBe('Über 100 %')
    expect(values.rhoMax?.value).toBeCloseTo(9.38, 2)
  })

  it('zeigt ohne Feuchte keinen Taupunkt statt eines unsinnigen Werts', () => {
    expect(computeFactorTool(tool, { t: 20, phi: 0 }, relative).tau).toBeUndefined()
  })

  it('zeigt Ergebnisse mit Einheiten und Rechenweg', () => {
    const html = renderToStaticMarkup(
      <FactorCalculator tool={tool} initialInputs={{ t: '20', phi: '50' }} initialSelection={relative} />,
    )
    expect(html).toContain('Absolute Luftfeuchtigkeit')
    expect(html).toContain('8,62 g/m³')
    expect(html).toContain('9,3 °C')
    expect(html).toContain('Magnus-Formel')
    // Indizes im Rechenweg tiefgestellt wie in den Formelzeichen
    expect(html).toContain('p<sub>s</sub> = 6,112 hPa')
    expect(html).not.toContain('p_s')
  })

  it('stellt den Index im Eingabefeld der absoluten Feuchte tief', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={absolute} />)
    expect(html).toContain('(ρ<sub>w</sub>)')
    expect(html).not.toContain('ρ_w')
  })
})
