import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { alternativeUnits } from '../units/alternatives'
import { ensureCustomUnits } from '../units/customUnits'
import { Calculator } from '../formulas/Calculator'
import { formulaEntries } from '../formulas/formulas'
import { MaterialPicker } from './MaterialPicker'
import { presetInput, presetsFor } from './materials'

ensureCustomUnits()

const formula = (id: string) => {
  const entry = formulaEntries.find((candidate) => candidate.id === id)
  if (!entry) throw new Error(`Formel ${id} fehlt`)
  return entry
}

describe('Stoffwerte', () => {
  it('passt über Namen oder Lexikon-Begriff zur Variable', () => {
    const c = formula('formula.thermodynamik.waermemenge').variables.find((v) => v.symbol === 'c')!
    expect(presetsFor(c).map((p) => `${p.name} ${p.note}`.trim())).toContain('Wasser')
    const ck = formula('formula.thermodynamik.mischtemperatur-verschiedene-stoffe').variables.find((v) => v.symbol === 'ck')!
    expect(presetsFor(ck).length).toBeGreaterThan(0)
    const m = formula('formula.thermodynamik.waermemenge').variables.find((v) => v.symbol === 'm')!
    expect(presetsFor(m)).toEqual([])
  })

  it('lässt sich in jedes passende Formelfeld eintragen (Einheiten passen)', () => {
    let checked = 0
    for (const entry of formulaEntries) {
      for (const variable of entry.variables) {
        for (const preset of presetsFor(variable)) {
          const units = alternativeUnits(variable.unit, variable.units)
          expect(() => presetInput(preset, variable.unit, units), `${entry.id}:${variable.symbol} ${preset.name}`).not.toThrow()
          checked += 1
        }
      }
    }
    expect(checked).toBeGreaterThan(50)
  })

  it('nutzt jede Sammlung bei mindestens einer Formel', () => {
    const used = content.materials.filter((set) =>
      formulaEntries.some((entry) => entry.variables.some((v) => presetsFor(v, [set]).length > 0)),
    )
    expect(used.map((set) => set.id)).toEqual(content.materials.map((set) => set.id))
  })

  it('übernimmt die Einheit des Werts, wenn das Feld sie anbietet, sonst rechnet es um', () => {
    expect(presetInput({ value: 1.003, unit: 'mm^2/s' }, 'm^2/s', ['m^2/s', 'mm^2/s'])).toEqual({ text: '1,003', unit: 'mm^2/s' })
    expect(presetInput({ value: 998.2067, unit: 'kg/m^3' }, 'kg/dm^3', ['kg/dm^3'])).toEqual({ text: '0,9982067', unit: 'kg/dm^3' })
    expect(presetInput({ value: 11e-6, unit: '1/K' }, '1/K', ['1/K'])).toEqual({ text: '0,000011', unit: '1/K' })
    expect(presetInput({ value: 1, unit: '' }, '', [''])).toEqual({ text: '1', unit: '' })
  })
})

describe('Auswahlfeld', () => {
  it('zeigt bei Stoffwert-Feldern rechts einen Pfeil, sonst nicht', () => {
    const html = renderToStaticMarkup(<Calculator formula={formula('formula.thermodynamik.waermemenge')} />)
    expect(html).toContain('aria-label="Bekannte Werte für Spezifische Wärmekapazität"')
    expect(html.match(/Bekannte Werte für/g)).toHaveLength(1)
    expect(html).toContain('aria-expanded="false"')
  })

  it('lässt freie Eingabe zu und öffnet die Liste erst auf Antippen', () => {
    const html = renderToStaticMarkup(
      <MaterialPicker label="Dichte" presets={presetsFor({ name: 'Dichte' })} onPick={() => {}}>
        <input aria-label="Dichte" />
      </MaterialPicker>,
    )
    expect(html).toContain('<input aria-label="Dichte"/>')
    expect(html).not.toContain('role="listbox"')
  })
})
