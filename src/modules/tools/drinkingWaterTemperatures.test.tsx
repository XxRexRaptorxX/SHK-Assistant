import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChoiceLookup } from './ChoiceLookup'
import { checkChoiceTool, isChoiceTool } from './schema'
import { toolEntries } from './tools'

const tool = toolEntries.find((entry) => entry.id === 'tool.trinkwasser-temperaturen')!
if (!isChoiceTool(tool)) throw new Error('Auswahl-Tool erwartet')

const render = (leitung: string, selection: Record<number, string> = {}) =>
  renderToStaticMarkup(<ChoiceLookup tool={tool} initialBars={{ leitung }} initialSelection={selection} />)

describe('Trinkwasser-Temperaturen', () => {
  it('ist ein gültiges Auswahl-Tool mit Kaltwasser, Warmwasser und Zirkulation', () => {
    expect(checkChoiceTool(tool)).toEqual([])
    expect(tool.bars[0]!.options.map((option) => option.label)).toEqual(['Kaltwasser', 'Warmwasser', 'Zirkulation'])
  })

  it('zeigt Kaltwasser ohne Auswahlliste, weil es nur eine Option gibt', () => {
    const html = render('kalt')
    expect(html).not.toContain('<select')
    expect(html).toContain('An der Entnahmestelle, 30 s nach vollem Öffnen')
    expect(html).toContain('höchstens 25 °C')
    expect(html).not.toContain('Austritt Trinkwassererwärmer')
  })

  it('fragt beim Warmwasser nach der Anlagenart und zeigt dann deren Werte', () => {
    expect(render('warm')).toContain('Anlagenart wählen')
    const large = render('warm', { 1: 'Großanlage (zentraler Trinkwassererwärmer)' })
    expect(large).toContain('mindestens 60 °C')
    expect(large).toContain('mindestens 55 °C')
    const small = render('warm', { 1: 'Kleinanlage im Ein- oder Zweifamilienhaus' })
    expect(small).toContain('mindestens 50 °C')
    expect(small).not.toContain('In der gesamten Zirkulation')
  })

  it('zeigt bei der Zirkulation Mindesttemperatur und höchste Abkühlung', () => {
    const html = render('zirkulation')
    expect(html).not.toContain('<select')
    expect(html).toContain('mindestens 55 °C')
    expect(html).toContain('höchstens 5 K')
  })
})
