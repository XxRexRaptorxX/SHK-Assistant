import { afterEach, describe, expect, it } from 'vitest'
import { figureCollection, type FigureEntry } from '../src/modules/figures/schema'
import { formulaCollection } from '../src/modules/formulas/schema'
import { ContentValidationError, loadContent } from '../tools/content-loader'
import { createTempDir } from './helpers/temp-content'

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle class="line" cx="5" cy="5" r="4"/></svg>'

const draft = { visibility: 'public', status: 'draft', source: '', verifiedBy: '', verifiedAt: '' }
const figure = { id: 'figure.test', ...draft, title: 'Testkreis' }
const formula = (ref: string) => ({ id: 'formula.test', ...draft, title: 'Test', description: 'Test', figure: ref })

let cleanup: (() => void) | undefined
afterEach(() => cleanup?.())

function load(files: Record<string, unknown>) {
  const dir = createTempDir(files)
  cleanup = dir.cleanup
  return loadContent({
    contentDir: dir.root,
    edition: 'internal',
    collections: { figures: figureCollection, formulas: formulaCollection },
  })
}

function issues(files: Record<string, unknown>): string[] {
  try {
    load(files)
  } catch (error) {
    expect(error).toBeInstanceOf(ContentValidationError)
    return (error as ContentValidationError).issues
  }
  throw new Error('Erwartete ContentValidationError')
}

describe('Skizzen laden (content/figures)', () => {
  it('liest die SVG-Datei neben der JSON-Datei ein', () => {
    const { data } = load({ 'figures/test.json': figure, 'figures/test.svg': SVG })
    expect((data.figures?.[0] as FigureEntry).svg).toBe(SVG)
  })

  it('meldet eine fehlende SVG-Datei', () => {
    expect(issues({ 'figures/test.json': figure })).toEqual([expect.stringMatching(/^figures\/test\.json: svg: /)])
  })

  it('meldet eine SVG-Datei ohne Metadaten und fremde Dateitypen', () => {
    expect(
      issues({ 'figures/test.json': figure, 'figures/test.svg': SVG, 'figures/rest.svg': SVG, 'figures/bild.png': 'x' }),
    ).toEqual(['figures/bild.png: nur .json- und .svg-Dateien erlaubt', 'figures/rest.svg: zugehörige .json-Datei fehlt'])
  })

  it('prüft die Sicherheitsregeln der SVG beim Build', () => {
    expect(issues({ 'figures/test.json': figure, 'figures/test.svg': '<svg viewBox="0 0 1 1"><script/></svg>' })).toEqual([
      'figures/test.json: svg: <script> ist nicht erlaubt',
    ])
  })

  it('lässt Formeln nur auf vorhandene Skizzen verweisen', () => {
    expect(issues({ 'formulas/test.json': formula('figure.gibt-es-nicht') })).toEqual([
      'formulas/test.json: Verweis auf unbekannte id "figure.gibt-es-nicht"',
    ])
    expect(
      issues({ 'figures/test.json': figure, 'figures/test.svg': SVG, 'formulas/test.json': formula('formula.test') }),
    ).toContain('formulas/test.json: figure: "formula.test" ist keine Skizze (muss mit "figure." beginnen)')
    const { data } = load({ 'figures/test.json': figure, 'figures/test.svg': SVG, 'formulas/test.json': formula('figure.test') })
    expect(data.formulas).toHaveLength(1)
  })
})
