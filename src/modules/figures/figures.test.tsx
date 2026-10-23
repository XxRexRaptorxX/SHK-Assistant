import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { FigureView } from './FigureView'
import { checkSvg, type FigureEntry } from './schema'

// Laden und Verweise prüfen: tests/figures-content.test.ts

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle class="line" cx="5" cy="5" r="4"/></svg>'

describe('Sicherheitsprüfung der SVG', () => {
  it('akzeptiert eine schlichte Zeichnung', () => {
    expect(checkSvg(SVG)).toEqual([])
    expect(checkSvg('<svg viewBox="0 0 1 1"><use href="#a"/></svg>')).toEqual([])
  })

  it('lehnt Skripte, Ereignisse, externe Verweise und fehlende viewBox ab', () => {
    expect(checkSvg('<svg viewBox="0 0 1 1"><script>alert(1)</script></svg>')).toContain('svg: <script> ist nicht erlaubt')
    expect(checkSvg('<svg viewBox="0 0 1 1"><rect onclick="x()"/></svg>')).toContain(
      'svg: Ereignis-Attribute (on…) sind nicht erlaubt',
    )
    expect(checkSvg('<svg viewBox="0 0 1 1"><image href="https://example.org/x.png"/></svg>')).toContain(
      'svg: nur Verweise innerhalb der Datei (href="#…") erlaubt',
    )
    expect(checkSvg('<svg viewBox="0 0 1 1"><foreignObject/></svg>')).toContain('svg: <foreignObject> ist nicht erlaubt')
    expect(checkSvg('<svg><rect/></svg>')).toContain('svg: viewBox fehlt (nötig für die Größenanpassung)')
    expect(checkSvg('<div></div>')).toContain('svg: muss mit <svg beginnen')
  })
})

describe('Skizze auf der Formelseite', () => {
  const figure: FigureEntry = {
    id: 'figure.test',
    visibility: 'public',
    status: 'verified',
    source: 'Eigene Skizze',
    verifiedBy: 'RR',
    verifiedAt: '2026-10-22',
    title: 'Testkreis',
    svg: SVG,
  }

  it('bettet die Zeichnung als Bild mit Beschreibung ein', () => {
    const html = renderToStaticMarkup(<FigureView id="figure.test" figures={[figure]} />)
    expect(html).toContain('class="figure-art" role="img" aria-label="Testkreis"')
    expect(html).toContain('<circle class="line"')
    expect(html).not.toContain('Skizze noch nicht fachlich geprüft')
  })

  it('markiert ungeprüfte Skizzen und zeigt nichts ohne Skizze', () => {
    const draft = renderToStaticMarkup(<FigureView id="figure.test" figures={[{ ...figure, status: 'draft' }]} />)
    expect(draft).toContain('Skizze noch nicht fachlich geprüft')
    expect(renderToStaticMarkup(<FigureView id={undefined} figures={[figure]} />)).toBe('')
    expect(renderToStaticMarkup(<FigureView id="figure.andere" figures={[figure]} />)).toBe('')
  })

  it('nutzt jede vorhandene Skizze bei mindestens einer Formel oder einem Tool', () => {
    const used = new Set([...content.formulas, ...content.tools].map((formula) => formula.figure).filter(Boolean))
    for (const entry of content.figures) expect(used).toContain(entry.id)
    expect(content.figures).toHaveLength(37)
  })
})
