import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { presetsFor } from '../materials/materials'
import { toolEntries } from './tools'
import { VariantCalculator } from './VariantCalculator'
import { checkVariantTool, variantAfterModeChange, variantsInMode, type VariantTool } from './variantTool'

const tool = toolEntries.find((entry) => entry.id === 'tool.oelduese') as VariantTool
const variant = (key: string) => tool.variants.find((item) => item.key === key)!
const input = (key: string, symbol: string) => variant(key).variables.find((item) => item.symbol === symbol)!

describe('Öldüse auslegen', () => {
  it('hat je Angabe auf der Düse (kg/h, USgal/h) die Rechenwege Düsengröße, Durchsatz und Pumpendruck', () => {
    expect(tool.modes?.options.map((option) => option.label)).toEqual(['kg/h', 'USgal/h'])
    expect(variantsInMode(tool, 'kg').map((item) => item.key)).toEqual(['duesengroesse', 'durchsatz', 'pumpendruck'])
    expect(variantsInMode(tool, 'gal').map((item) => item.key)).toEqual(['duesengroesseGal', 'durchsatzGal', 'pumpendruckGal'])
    expect(checkVariantTool(tool)).toEqual([])
  })

  it('bleibt beim Umschalten der Angabe im gleichen Rechenweg', () => {
    expect(variantAfterModeChange(tool, 'durchsatz', 'gal')).toBe('durchsatzGal')
    expect(variantAfterModeChange(tool, 'pumpendruckGal', 'kg')).toBe('pumpendruck')
    expect(variantAfterModeChange(tool, 'duesengroesse', 'gal')).toBe('duesengroesseGal')
  })

  it('zeigt die Modus-Leiste und nur die Rechenwege des gewählten Modus', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <VariantCalculator tool={tool} initialVariant="durchsatzGal" />
      </MemoryRouter>,
    )
    expect(html).toContain('Angabe auf der Düse')
    expect(html).toContain('Durchsatz in USgal/h bei anderem Pumpendruck')
    expect(html.match(/aria-pressed="true"/g)).toHaveLength(2)
  })

  it('bietet bei kg/h die Danfoss-OD-Größen mit ihrem kg/h-Wert an', () => {
    for (const key of ['durchsatz', 'pumpendruck']) {
      const presets = presetsFor(input(key, 'V1'))
      expect(presets).toHaveLength(48)
      expect(presets.every((preset) => preset.unit === 'kg/h' && preset.name.endsWith('USgal/h'))).toBe(true)
      // Stichproben aus der Tabelle des Datenblatts 520F0461
      const byName = Object.fromEntries(presets.map((preset) => [preset.name, preset.value]))
      expect(byName['0,60 USgal/h']).toBe(2.37)
      expect(byName['1,00 USgal/h']).toBe(3.72)
      expect(byName['1,35 USgal/h']).toBe(5.17)
      expect(byName['35,00 USgal/h']).toBe(133.5)
    }
  })

  it('bietet bei USgal/h dieselben Größen in USgal/h an, mit dem kg/h-Wert von Danfoss als Zusatz', () => {
    const kg = presetsFor(input('durchsatz', 'V1'))
    for (const key of ['durchsatzGal', 'pumpendruckGal']) {
      const presets = presetsFor(input(key, 'V1'))
      expect(presets.map((preset) => preset.name)).toEqual(kg.map((preset) => preset.name))
      expect(presets.every((preset) => preset.unit === 'USgal/h')).toBe(true)
      const sixty = presets.find((preset) => preset.name === '0,60 USgal/h')!
      expect(sixty.value).toBe(0.6)
      expect(sixty.note).toBe('Danfoss OD: 2,37 kg/h bei 10 bar')
    }
  })

  it('belegt den Prüfdruck je Angabe vor und bietet 10 bar (kg/h) und 7 bar (USgal/h) an', () => {
    expect(input('durchsatz', 'p1').default).toBe(10)
    expect(input('durchsatzGal', 'p1').default).toBe(7)
    for (const key of ['durchsatz', 'pumpendruck', 'durchsatzGal', 'pumpendruckGal']) {
      expect(presetsFor(input(key, 'p1')).map((preset) => [preset.name, preset.value, preset.unit])).toEqual([
        ['kg/h-Angabe', 10, 'bar'],
        ['USgal/h-Angabe', 7, 'bar'],
      ])
    }
  })

  it('führt die Größen aufsteigend nach USgal/h und kg/h', () => {
    const presets = presetsFor(input('durchsatz', 'V1'))
    const gal = presets.map((preset) => Number(preset.name.replace(' USgal/h', '').replace(',', '.')))
    const kg = presets.map((preset) => preset.value)
    expect(gal).toEqual([...gal].sort((a, b) => a - b))
    expect(kg).toEqual([...kg].sort((a, b) => a - b))
  })
})

describe('Modus-Leiste der Varianten-Tools', () => {
  const plain = toolEntries.find((entry) => entry.id === 'tool.rollenlaenge') as VariantTool

  it('lässt Tools ohne Modus-Leiste unverändert', () => {
    expect(plain.modes).toBeUndefined()
    expect(variantsInMode(plain, undefined)).toHaveLength(plain.variants.length)
    expect(checkVariantTool(plain)).toEqual([])
  })

  it('meldet Varianten ohne gültigen Modus und Modi ohne Variante', () => {
    const broken = {
      ...tool,
      variants: tool.variants.map((item) => (item.key === 'durchsatzGal' ? { ...item, mode: 'liter' } : item)).filter((item) => item.mode !== 'gal'),
    }
    const issues = checkVariantTool(broken).join(' ')
    expect(issues).toContain('mode muss einer von kg, gal sein')
    expect(issues).toContain('keine Variante für "gal"')
    expect(checkVariantTool({ ...plain, variants: plain.variants.map((item) => ({ ...item, mode: 'kg' })) })).toContain(
      'variants: mode nur zusammen mit modes',
    )
  })
})
