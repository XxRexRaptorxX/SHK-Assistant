import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { lexiconPathFor } from '../lexicon/termLinks'
import FormulaDetailPage from './FormulaDetailPage'
import { formulaEntries } from './formulas'

const legendAt = (slug: string) => {
  const html = renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/formeln/${slug}`]}>
      <Routes>
        <Route path="/formeln/:slug" element={<FormulaDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )
  return html.slice(html.indexOf('<dl'), html.indexOf('</dl>'))
}

describe('Legende der Formeln', () => {
  it('verweist mit jedem „term“ auf einen vorhandenen Lexikon-Eintrag', () => {
    const broken = formulaEntries.flatMap((formula) =>
      [formula.result, ...formula.variables, ...formula.constants]
        .filter((item) => item?.term && !lexiconPathFor([item.term]))
        .map((item) => `${formula.id}: ${item?.term}`),
    )
    expect(broken).toEqual([])
  })

  it('verlinkt Größen und Einheiten im ohmschen Gesetz', () => {
    const legend = legendAt('elektrotechnik.ohmsches-gesetz-spannung')
    expect(legend).toContain('href="/lexikon/elektrische-spannung"')
    expect(legend).toContain('href="/lexikon/elektrischer-widerstand"')
    expect(legend).toContain('href="/lexikon/elektrische-stromstaerke"')
    expect(legend).toContain('href="/lexikon/volt"')
  })

  it('verlinkt genauere Namen über „term“ auf den Grundbegriff', () => {
    const legend = legendAt('thermodynamik.mischtemperatur-gleicher-stoff')
    expect(legend).toMatch(/href="\/lexikon\/masse"[^>]*>Masse des kalten Stoffes</)
    expect(legend).toMatch(/href="\/lexikon\/temperatur"[^>]*>Temperatur des warmen Stoffes</)
  })
})
