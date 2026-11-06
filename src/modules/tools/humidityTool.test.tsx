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
    expect(tool.examples.filter((example) => 'tauI' in example.expected)).toHaveLength(3)
  })

  it('fragt je nach Auswahl die relative oder die absolute Feuchte ab', () => {
    expect(visibleInputs(tool, relative).map((input) => input.symbol)).toEqual(['t', 'phi'])
    expect(visibleInputs(tool, absolute).map((input) => input.symbol)).toEqual(['t', 'rho'])
    expect(visibleResults(tool, relative).map((result) => result.symbol)).toEqual(['rhoW', 'tau', 'tauI', 'rhoMax', 'ps', 'pD'])
    expect(visibleResults(tool, absolute).map((result) => result.symbol)).toEqual(['phiOut', 'tau', 'tauI', 'rhoMax', 'ps', 'pD'])
  })

  it('zeigt unter 0 °C einen Reifpunkt über dem Taupunkt, darüber „Kein Reif“', () => {
    const frost = computeFactorTool(tool, { t: -5, phi: 80 }, relative)
    expect(frost.tauI?.value).toBeLessThan(0)
    expect(frost.tauI!.value!).toBeGreaterThan(frost.tau!.value!)
    // Taupunkt genau 0 °C: Reifpunkt ebenfalls 0 °C (Tripelpunkt, beide Magnus-Formeln geben 6,112 hPa)
    const atZero = computeFactorTool(tool, { t: 0, phi: 100 }, relative)
    expect(atZero.tauI?.value).toBeCloseTo(0, 9)
    const dew = computeFactorTool(tool, { t: 20, phi: 50 }, relative)
    expect(dew.tauI?.text).toBe('Kein Reif')
  })

  it('nennt Tau- und Reifpunkte außerhalb des Gültigkeitsbereichs statt einer Zahl', () => {
    const veryDry = computeFactorTool(tool, { t: -40, phi: 10 }, relative)
    expect(veryDry.tau?.text).toBe('Unter −45 °C')
    expect(veryDry.tauI?.value).toBeGreaterThan(-65)
    expect(computeFactorTool(tool, { t: -45, phi: 1 }, relative).tauI?.text).toBe('Unter −65 °C')
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

  it('versteckt den Rechenweg je Ergebnis hinter einem Info-Knopf, beim Drucken bleibt er sichtbar', () => {
    const html = renderToStaticMarkup(
      <FactorCalculator tool={tool} initialInputs={{ t: '20', phi: '50' }} initialSelection={relative} />,
    )
    // Ein Knopf je angezeigtem Ergebnis, zugeklappt
    expect(html.match(/aria-label="Rechenweg zu /g)).toHaveLength(visibleResults(tool, relative).length)
    expect(html).toContain('aria-label="Rechenweg zu Taupunkt" aria-expanded="false"')
    const rules = html.match(/<p id="[^"]*-rule-[^"]*" class="([^"]*)"/g) ?? []
    expect(rules).toHaveLength(visibleResults(tool, relative).length)
    for (const rule of rules) expect(rule).toContain('hidden print:block')
  })

  it('zeigt den Rechenweg ohne die Option wie bisher direkt an', () => {
    const plain = { ...tool, rulesBehindInfo: undefined }
    const html = renderToStaticMarkup(
      <FactorCalculator tool={plain} initialInputs={{ t: '20', phi: '50' }} initialSelection={relative} />,
    )
    expect(html).not.toContain('Rechenweg zu')
    expect(html).not.toContain('hidden print:block')
    expect(html).toContain('Magnus-Formel')
  })

  it('zeigt ohne Werte keine Info-Knöpfe, weil es noch keinen Rechenweg gibt', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={relative} />)
    expect(html).not.toContain('Rechenweg zu')
  })

  it('stellt den Index im Eingabefeld der absoluten Feuchte tief', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={absolute} />)
    expect(html).toContain('(ρ<sub>w</sub>)')
    expect(html).not.toContain('ρ_w')
  })
})
