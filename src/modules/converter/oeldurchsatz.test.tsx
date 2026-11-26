import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import ConverterPage from './ConverterPage'
import { convertByFactors, FactorConverter } from './FactorConverter'
import { checkConverter, type ConverterEntry, type ConverterFactor } from './schema'

// Umrechner „Öldurchsatz“: Heizöl EL in kg/h, l/h, USgal/h und kW (Bezugsgröße 1 kW Feuerungsleistung)

const found = content.converter.find((candidate) => candidate.id === 'converter.oeldurchsatz')
if (!found) throw new Error('Umrechner Öldurchsatz erwartet')
const entry: ConverterEntry = found
const factor = (key: string): ConverterFactor => {
  const match = entry.factors.find((candidate) => candidate.key === key)
  if (!match) throw new Error(`Faktor ${key} erwartet`)
  return match
}
const convert = (value: number, from: string, to: string) => convertByFactors(value, factor(from), factor(to))

describe('Umrechner Öldurchsatz', () => {
  it('ist fehlerfrei, öffentlich und geprüft, mit Quelle je Größe', () => {
    expect(checkConverter(entry)).toEqual([])
    expect(entry.visibility).toBe('public')
    expect(entry.status).toBe('verified')
    expect(entry.kind).toBe('factors')
    expect(entry.base).toBe('kw')
    expect(entry.factors.filter((candidate) => !candidate.source).map((candidate) => candidate.key)).toEqual(['kw'])
  })

  it('rechnet wie das Danfoss-Beispiel: 20 kW = 2 l/h = 1,68 kg/h', () => {
    expect(convert(20, 'kw', 'l-h')).toBeCloseTo(2, 9)
    expect(convert(20, 'kw', 'kg-h')).toBeCloseTo(1.68, 9)
    expect(convert(1.68, 'kg-h', 'kw')).toBeCloseTo(20, 9)
    expect(convert(1, 'l-h', 'kg-h')).toBeCloseTo(0.84, 9)
  })

  it('rechnet USgal/h über 3,785411784 l je US-Gallone', () => {
    expect(convert(1, 'usgal-h', 'l-h')).toBeCloseTo(3.785411784, 9)
    expect(convert(0.6, 'usgal-h', 'kw')).toBeCloseTo(22.712, 3)
    expect(convert(1, 'usgal-h', 'kg-h')).toBeCloseTo(3.18, 2)
  })

  it('weist auf die verschiedenen Prüfdrücke der Düsenangaben hin', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FactorConverter entry={entry} initialValue="1,68" />
      </MemoryRouter>,
    )
    expect(html).toContain('1 Einheit in kW')
    expect(entry.description).toContain('Öldüse auslegen')
  })

  it('verlinkt unten das Tool „Öldüse auslegen“', () => {
    expect(entry.tools).toEqual(['tool.oelduese'])
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/umrechner/oeldurchsatz']}>
        <Routes>
          <Route path="/umrechner/:slug" element={<ConverterPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Verwandte Tools')
    expect(html).toContain('Öldüse auslegen')
  })
})
