import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import FormulaDetailPage from './FormulaDetailPage'
import { formulaEntries, relatedFormulas } from './formulas'

const related = (id: string) => {
  const formula = formulaEntries.find((entry) => entry.id === id)
  if (!formula) throw new Error(`Formel ${id} fehlt`)
  return relatedFormulas(formula, formulaEntries).map((entry) => entry.id)
}

describe('Verwandte Formeln', () => {
  it('nennt zuerst die Formeln mit derselben Skizze', () => {
    expect(related('formula.elektrotechnik.ohmsches-gesetz-spannung').slice(0, 6)).toEqual(
      expect.arrayContaining(['formula.elektrotechnik.ohmsches-gesetz-stromstaerke', 'formula.elektrotechnik.ohmsches-gesetz-widerstand']),
    )
  })

  it('verweist auf Formeln, die eine Eingabe berechnen, auch aus der Geometrie', () => {
    const list = related('formula.hydraulik.druckverlust-rohr')
    expect(list).toContain('formula.hydraulik.fliessgeschwindigkeit-rohr')
    expect(related('formula.lueftung.luftwechselzahl')).toContain('formula.geometrie.quader-volumen')
  })

  it('verbindet keine fremden Gruppen über allgemeine Größen wie Zeit', () => {
    expect(related('formula.elektrotechnik.elektrische-arbeit-wh')).not.toContain('formula.hydraulik.ausflusszeit')
    expect(related('formula.geometrie.kugel-volumen')).not.toContain('formula.gastechnik.energiemenge-gas')
  })

  it('findet Geschwister mit gemeinsamen Eingaben und nie die Formel selbst', () => {
    expect(related('formula.heizungstechnik.massenstrom-aus-waermeleistung')).toContain(
      'formula.heizungstechnik.volumenstrom-aus-waermeleistung',
    )
    for (const formula of formulaEntries) {
      const list = relatedFormulas(formula, formulaEntries)
      expect(list.map((entry) => entry.id)).not.toContain(formula.id)
      expect(new Set(list).size).toBe(list.length)
      expect(list.length).toBeLessThanOrEqual(8)
    }
  })

  it('zeigt die Liste unter dem Rechner mit Formelzeichen', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/formeln/geometrie.kreisflaeche']}>
        <Routes>
          <Route path="/formeln/:slug" element={<FormulaDetailPage />} />
        </Routes>
      </MemoryRouter>,
    )
    const section = html.slice(html.indexOf('Verwandte Formeln'))
    expect(html.indexOf('Verwandte Formeln')).toBeGreaterThan(html.indexOf('Rechner'))
    expect(section).toContain('href="/formeln/geometrie.kreisumfang"')
    expect(section).toContain('Kreisumfang<span class="ml-2 font-normal text-muted">U○</span>')
    expect(html).toContain('A○ = π · d ^ 2 / 4')
  })
})
