import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { formulaToolEntries } from '../tools/tools'
import { formatExpression } from './engine'
import { renderSymbol } from './SymbolText'

const html = (text: string) => renderToStaticMarkup(<>{renderSymbol(text)}</>)

describe('Indizes in Formelzeichen', () => {
  it('stellt den Teil nach dem Unterstrich tief', () => {
    expect(html('p_amb')).toBe('p<sub>amb</sub>')
    expect(html('ΔT_1')).toBe('ΔT<sub>1</sub>')
    expect(html('V̇_1')).toBe('V̇<sub>1</sub>')
  })

  it('beendet den Index am nächsten Zeichen, das kein Buchstabe und keine Ziffer ist', () => {
    expect(html('φ·p_s')).toBe('φ·p<sub>s</sub>')
    expect(html('(ΔT_1 - ΔT_2) / ln(ΔT_1 / ΔT_2)')).toBe(
      '(ΔT<sub>1</sub> - ΔT<sub>2</sub>) / ln(ΔT<sub>1</sub> / ΔT<sub>2</sub>)',
    )
  })

  it('lässt Text ohne Unterstrich unverändert', () => {
    expect(renderSymbol('Δp/Δh')).toBe('Δp/Δh')
  })

  it('setzt bei der Fußbodenheizung die Zahl vor die Fläche', () => {
    const tool = formulaToolEntries.find((entry) => entry.id === 'tool.fbh-rohrlaenge')!
    expect(formatExpression(tool)).toBe('100 · A / VA')
  })

  it('nutzt in Formelzeichen keine Unicode-Indizes mehr, damit alle gleich aussehen', () => {
    const labels = [...content.formulas, ...formulaToolEntries].flatMap((entry) =>
      [...entry.variables, ...entry.constants, ...(entry.result ? [entry.result] : [])].map((item) => item.label ?? item.symbol),
    )
    expect(labels.filter((label) => /[₀-₉ₐₑₒₓₕₖₗₘₙₚₛₜᵢᵣᵤᵥⱼ]/u.test(label))).toEqual([])
  })
})
