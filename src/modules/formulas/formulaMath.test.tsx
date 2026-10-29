import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { FormulaLine } from './FormulaDetailPage'
import { Calculator } from './Calculator'
import { constantSubstitution, FormulaMath, quantitySubstitution } from './FormulaMath'
import { formulaEntries } from './formulas'
import type { FormulaEntry } from './schema'

vi.mock('../figures/FigureView', () => ({ FigureView: () => null }))

const formula = (id: string) => {
  const entry = formulaEntries.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`Formel ${id} fehlt`)
  return entry
}

/** Sichtbarer Text mit | als Bruchstrich: Zähler|Nenner */
function plain(entry: FormulaEntry, substitutions?: Parameters<typeof FormulaMath>[0]['substitutions']): string {
  return renderToStaticMarkup(<FormulaMath formula={entry} substitutions={substitutions} />)
    .replace(/<span class="w-full border-t-2[^>]*>/g, '|')
    .replace(/<sup[^>]*>/g, '^')
    .replace(/<[^>]+>/g, '')
}

describe('Bruchschreibweise', () => {
  it('fasst Produkte und Quotienten zu einem Bruch zusammen, Zahlen zuerst', () => {
    expect(plain(formula('formula.hydraulik.fliessgeschwindigkeit-rohr'))).toBe('4·V̇|π·d^2')
    expect(plain(formula('formula.gastechnik.zustandszahl'))).toBe('Tₙ·(pamb+pₑ−φ·pₛ)|T·pₙ·K')
  })

  it('lässt eingeklammerte Brüche als eigene Brüche stehen (Lehrbuchform)', () => {
    expect(plain(formula('formula.hydraulik.druckverlust-rohr'))).toBe('λ·l|d·ρ|2·v^2')
  })

  it('zeigt Wurzeln mit Strich, ln und Brüche im Nenner einer Summe', () => {
    expect(plain(formula('formula.geometrie.kreisdurchmesser'))).toBe('√4·A|π')
    expect(plain(formula('formula.heizungstechnik.logarithmische-temperaturdifferenz'))).toBe('ΔT₁−ΔT₂|ln(ΔT₁|ΔT₂)')
    expect(plain(formula('formula.thermodynamik.u-wert-einschichtig'))).toBe('1|Rₛᵢ+d|λ+Rₛₑ')
  })

  it('stellt Klammern um Summen in Produkten dar, nicht um alleinstehende Zähler', () => {
    expect(plain(formula('formula.geometrie.kreisring-flaeche'))).toBe('π·(D^2−d^2)|4')
    expect(plain(formula('formula.thermodynamik.mischtemperatur-gleicher-stoff'))).toBe('mk·Tk+mw·Tw|mk+mw')
  })

  it('kann jede Formel darstellen', () => {
    for (const entry of formulaEntries) {
      if (entry.expression) expect(() => renderToStaticMarkup(<FormulaMath formula={entry} />)).not.toThrow()
    }
  })
})

describe('Formelzeile', () => {
  const kreis = formula('formula.geometrie.kreisflaeche')

  it('zeigt standardmäßig den Bruch und einen Knopf für die lineare Schreibweise', () => {
    const html = renderToStaticMarkup(<FormulaLine formula={kreis} resultLabel="A○" />)
    expect(html).toContain('border-t-2 border-current')
    expect(html).toContain('aria-label="Linear anzeigen"')
  })

  it('zeigt linear die bisherige Zeile und einen Knopf zurück zum Bruch', () => {
    const html = renderToStaticMarkup(<FormulaLine formula={kreis} resultLabel="A○" linear />)
    expect(html).toContain('A○ = π · d ^ 2 / 4')
    expect(html).toContain('aria-label="Als Bruch anzeigen"')
    expect(html).toContain('font-mono')
  })
})

describe('Rechenweg', () => {
  it('setzt Werte mit Einheit ein, klammert sie als Potenzbasis und lässt fehlende Symbole stehen', () => {
    const pipe = formula('formula.hydraulik.fliessgeschwindigkeit-rohr')
    const both = new Map([
      ['Vdot', quantitySubstitution(2, 'm^3/h')],
      ['d', quantitySubstitution(25, 'mm')],
    ])
    expect(plain(pipe, both)).toBe('4·2 m³/h|π·(25 mm)^2')
    expect(plain(pipe, new Map([['d', quantitySubstitution(25, 'mm')]]))).toBe('4·V̇|π·(25 mm)^2')
  })

  it('klammert negative Zahlen und setzt Konstanten mit Zahlenwert ein, Ausdrücke wie √3 nicht', () => {
    expect(renderToStaticMarkup(<>{quantitySubstitution(-3, '').node}</>)).toBe('(−3)')
    expect(renderToStaticMarkup(<>{constantSubstitution('9.80665 m/s^2')!.node}</>)).toContain('9,80665')
    expect(constantSubstitution('sqrt(3)')).toBeUndefined()
    expect(renderToStaticMarkup(<>{constantSubstitution('360 deg')!.node}</>).replace(/<[^>]+>/g, '')).toBe('360°')
  })

  it('schaltet im Ergebnis zwischen Ergebnis und Rechenweg um', () => {
    const pressure = formula('formula.hydraulik.hydrostatischer-druck')
    const plainResult = renderToStaticMarkup(<Calculator formula={pressure} showWorking={false} />)
    expect(plainResult).toContain('aria-label="Rechenweg anzeigen"')
    expect(plainResult).not.toContain('9,80665')
    const working = renderToStaticMarkup(<Calculator formula={pressure} showWorking />)
    expect(working).toContain('aria-pressed="true" title="Nur Ergebnis anzeigen"')
    expect(working).toContain('9,80665')
  })
})
