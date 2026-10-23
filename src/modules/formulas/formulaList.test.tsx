import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { FormulaListPage } from './FormulaListPage'
import { FormulaTitle } from './FormulaTitle'

describe('Formelliste', () => {
  it('zeigt hinter dem Namen grau das Formelzeichen des Ergebnisses', () => {
    const html = renderToStaticMarkup(
      <FormulaTitle entry={{ title: 'Kreisfläche', result: { symbol: 'A', name: 'Fläche', unit: 'm^2', units: [], decimals: 2 } }} />,
    )
    expect(html).toBe('Kreisfläche<span class="ml-2 font-normal text-muted">A</span>')
  })

  it('nutzt die Anzeige-Bezeichnung und lässt Formeln ohne Ergebnis unverändert', () => {
    const withLabel = { symbol: 'dTm', label: 'ΔTₘ', name: 'x', unit: 'K', units: [], decimals: 2 }
    expect(renderToStaticMarkup(<FormulaTitle entry={{ title: 'T', result: withLabel }} />)).toContain('>ΔTₘ</span>')
    expect(renderToStaticMarkup(<FormulaTitle entry={{ title: 'Entwurf', result: undefined }} />)).toBe('Entwurf')
  })

  it('zeigt die Zustandszahl in der Liste mit ihrem Zeichen', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FormulaListPage hiddenIds={new Set()} />
      </MemoryRouter>,
    )
    expect(html).toContain('Zustandszahl<span class="ml-2 font-normal text-muted">Z</span>')
    expect(html).toContain('>Gastechnik</h2>')
  })
})
