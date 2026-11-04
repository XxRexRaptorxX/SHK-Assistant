import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FactorCalculator } from './FactorCalculator'
import {
  checkFactorTool,
  computeFactorTool,
  normalizeSelection,
  visibleInputs,
  visibleResults,
  type FactorTool,
} from './factorTool'
import { toolEntries, toolSearchDocuments } from './tools'

const tool = toolEntries.find((entry) => entry.id === 'tool.solar-mag') as FactorTool
const flat = { hersteller: 'buderus', kollektor: 'flach', rohr: 'cu15' }
const vacuum = { hersteller: 'buderus', kollektor: 'vakuum', rohr: 'cu15' }
const vaillant = { hersteller: 'vaillant', methode: 'formel', rohr: 'vflex20' }
const quickFlat = { hersteller: 'vaillant', methode: 'tabelle', kollektor: 'vfk' }
const quickTube = { hersteller: 'vaillant', methode: 'tabelle', kollektor: 'vtk' }
const sizing = { n: 4, VK: 1.61, Lr: 15, VWT: 16.4 }
const vaillantSizing = { n: 6, VK: 2.16, Lr: 15, VWT: 17.5 }

/** Tabelle 77 der Buderus-Planungsunterlage: Höhe → AG-Vordruck, Fülldruck */
const TABLE_77: [number, number, number][] = [
  [2, 1.9, 2.2],
  [3, 2.0, 2.3],
  [4, 2.1, 2.4],
  [5, 2.2, 2.5],
  [6, 2.3, 2.6],
  [7, 2.4, 2.7],
  [8, 2.5, 2.8],
  [9, 2.6, 2.9],
  [10, 2.7, 3.0],
  [11, 2.8, 3.1],
  [12, 2.9, 3.2],
  [13, 3.0, 3.3],
  [14, 3.1, 3.4],
  [15, 3.2, 3.5],
  [16, 3.3, 3.6],
  [17, 3.4, 3.7],
  [18, 3.5, 3.8],
  [19, 3.6, 3.9],
  [20, 3.7, 4.0],
]

describe('Solaranlage: Anlagendruck und MAG', () => {
  it('besteht die Inhaltsprüfung samt Rechenbeispielen der Planungsunterlage', () => {
    expect(checkFactorTool(tool)).toEqual([])
    expect(tool.examples.length).toBeGreaterThanOrEqual(2)
  })

  it('trifft bei Vakuumröhren jede Zeile der Buderus-Tabelle', () => {
    for (const [h, vordruck, fuelldruck] of TABLE_77) {
      const values = computeFactorTool(tool, { h }, vacuum)
      expect(values.pV?.value).toBeCloseTo(vordruck, 6)
      expect(values.p0?.value).toBeCloseTo(fuelldruck, 6)
    }
  })

  it('hält bei Flachkollektoren den Mindestvordruck ein', () => {
    expect(computeFactorTool(tool, { h: 0 }, flat).pV?.value).toBeCloseTo(1.2, 6)
    expect(computeFactorTool(tool, { h: 8 }, flat).pV?.value).toBeCloseTo(1.2, 6)
    expect(computeFactorTool(tool, { h: 9 }, flat).pV?.value).toBeCloseTo(1.3, 6)
    expect(computeFactorTool(tool, { h: 0 }, flat).p0?.value).toBeCloseTo(1.5, 6)
  })

  it('zeigt die Drücke schon allein aus der Höhe, die MAG-Größe erst mit allen Angaben', () => {
    const onlyHeight = computeFactorTool(tool, { h: 10 }, flat)
    expect(onlyHeight.pV?.value).toBeCloseTo(1.4, 6)
    expect(onlyHeight.Vmin).toBeUndefined()
    expect(computeFactorTool(tool, { h: 10, n: 4, VK: 1.61, Lr: 15 }, flat).Vmin).toBeUndefined()
    expect(computeFactorTool(tool, { h: 10, ...sizing }, flat).Vmin?.value).toBeCloseTo(21.37, 1)
    // Vakuumröhren brauchen zusätzlich die Rohrlänge im Dampfbereich
    expect(computeFactorTool(tool, { h: 10, ...sizing }, vacuum).Vmin).toBeUndefined()
  })

  it('rechnet mit der Wasservorlage von mindestens 3 l, bei großen Anlagen mit 2 %', () => {
    expect(computeFactorTool(tool, { h: 10, ...sizing }, flat).VV?.value).toBe(3)
    const large = computeFactorTool(tool, { h: 10, n: 100, VK: 1.61, Lr: 100, VWT: 30 }, flat)
    const volume = large.Vsum!.value! + large.VV!.value!
    expect(large.VV?.value).toBeCloseTo(volume * 0.02, 6)
  })

  it('nimmt bei Vakuumröhren zwischen zwei Tabellenzeilen die höhere', () => {
    const between = computeFactorTool(tool, { h: 9.5, n: 5, VK: 0.85, Lr: 15, Ld: 1, VWT: 5.4 }, vacuum)
    expect(between.DF?.value).toBe(2.88)
  })

  it('rechnet keine MAG-Größe außerhalb der Quelle', () => {
    expect(computeFactorTool(tool, { h: 21, n: 5, VK: 0.85, Lr: 15, Ld: 1, VWT: 5.4 }, vacuum).Vmin?.text).toBe(
      'Nicht in der Tabelle',
    )
    expect(computeFactorTool(tool, { h: 50, ...sizing }, flat).Vmin?.text).toBe('Nicht auslegbar')
    // Genau am Enddruck wäre der Druckfaktor unendlich: lieber kein Ergebnis als ein falsches
    expect(computeFactorTool(tool, { h: 47, ...sizing }, flat).Vmin?.value).toBeUndefined()
  })

  it('fragt die Rohrlänge im Dampfbereich nur bei Vakuumröhren ab', () => {
    expect(visibleInputs(tool, flat).map((input) => input.symbol)).not.toContain('Ld')
    expect(visibleInputs(tool, vacuum).map((input) => input.symbol)).toContain('Ld')
  })

  it('zeigt nur Drücke und MAG-Größe, keine Zwischenwerte', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialInputs={{ h: '10' }} initialSelection={flat} />)
    expect(html).toContain('1,4')
    expect(html).toContain('1,7')
    expect(html).toContain('Für die MAG-Größe alle Felder oben ausfüllen.')
    expect(html).not.toContain('Alle Werte eingeben.')
    expect(html).not.toContain('Druckfaktor</p>')
    expect(html).not.toContain('Wasservorlage</p>')
  })

  it('zeigt das Mindestvolumen, sobald alles ausgefüllt ist', () => {
    const html = renderToStaticMarkup(
      <FactorCalculator
        tool={tool}
        initialInputs={{ h: '10', n: '4', VK: '1,61', Lr: '15', VWT: '16,4' }}
        initialSelection={flat}
      />,
    )
    expect(html).toContain('21,4')
    expect(html).toContain('Das nächstgrößere Gefäß wählen.')
    expect(html).not.toContain('Für die MAG-Größe alle Felder')
  })

  it('verlangt ohne Höhe weiterhin eine Eingabe', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={flat} />)
    expect(html).toContain('Alle Werte eingeben.')
  })

  describe('Rechenweg Vaillant', () => {
    it('setzt den Vordruck ohne Zuschlag und füllt mit mindestens 2 bar', () => {
      const low = computeFactorTool(tool, { h: 10 }, vaillant)
      expect(low.pV?.value).toBeCloseTo(1, 6)
      expect(low.p0?.value).toBeCloseTo(2, 6)
      const high = computeFactorTool(tool, { h: 20 }, vaillant)
      expect(high.pV?.value).toBeCloseTo(2, 6)
      expect(high.p0?.value).toBeCloseTo(2.5, 6)
    })

    it('rechnet die Beispielanlage der Unterlage nach', () => {
      const values = computeFactorTool(tool, { h: 14, ...vaillantSizing }, vaillant)
      // Vaillant: Dampfvolumen 23,8 l, Wasservorlage 3 l; mit gerundeten Werten und 5,5 bar Enddruck 57 l
      expect(values.VD?.value).toBeCloseTo(23.76, 2)
      expect(values.VV?.value).toBe(3)
      expect(values.Vmin?.value).toBeCloseTo(57.45, 1)
    })

    it('braucht in der Berechnung keine Rohrlänge im Dampfbereich und keine Kollektorart', () => {
      const selection = normalizeSelection(tool, { ...vacuum, hersteller: 'vaillant', methode: 'formel' })
      expect(selection.kollektor).toBeUndefined()
      expect(selection.rohr).toBe('vcu12')
      expect(visibleInputs(tool, selection).map((input) => input.symbol)).not.toContain('Ld')
      const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={selection} />)
      expect(html).not.toContain('Flachkollektor')
      expect(html).toContain('Flexrohr DN 20')
      expect(html).not.toContain('Rohr 35')
    })

    it('gibt beim Zurückschalten wieder eine Buderus-Auswahl', () => {
      const selection = normalizeSelection(tool, { ...vaillant, hersteller: 'buderus' })
      expect(selection).toEqual({ hersteller: 'buderus', kollektor: 'flach', rohr: 'cu15' })
    })

    it('rechnet keine MAG-Größe über dem Enddruck', () => {
      expect(computeFactorTool(tool, { h: 60, ...vaillantSizing }, vaillant).Vmin?.text).toBe('Nicht auslegbar')
    })
  })

  describe('Schnellauswahl Vaillant', () => {
    const quick = (selection: Record<string, string>, inputs: Record<string, number>) =>
      computeFactorTool(tool, inputs, selection).Vtab

    it('liest das Beispiel der Unterlage und nimmt die einfache Rohrlänge doppelt', () => {
      expect(quick(quickFlat, { h: 20, n: 8, Lr: 25 })?.value).toBe(80)
    })

    it('trifft die Stellen, an denen die Rohrlänge den Wert ändert', () => {
      expect(quick(quickFlat, { h: 20, n: 2, Lr: 25 })?.value).toBe(18)
      expect(quick(quickFlat, { h: 20, n: 2, Lr: 30 })?.value).toBe(25)
      expect(quick(quickTube, { h: 20, A: 13, Lr: 25 })?.value).toBe(80)
      expect(quick(quickTube, { h: 20, A: 13, Lr: 30 })?.value).toBe(100)
    })

    it('trifft Eckwerte beider Tabellen', () => {
      expect(quick(quickFlat, { h: 10, n: 14, Lr: 15 })?.value).toBe(125)
      expect(quick(quickFlat, { h: 30, n: 14, Lr: 40 })?.value).toBe(250)
      expect(quick(quickTube, { h: 10, A: 4, Lr: 15 })?.value).toBe(18)
      expect(quick(quickTube, { h: 30, A: 20, Lr: 40 })?.value).toBe(280)
    })

    it('nimmt bei Zwischenwerten den nächsthöheren Tabellenwert', () => {
      expect(quick(quickFlat, { h: 11, n: 4, Lr: 20 })?.value).toBe(35)
      expect(quick(quickTube, { h: 10, A: 7.5, Lr: 15 })?.value).toBe(35)
    })

    it('nennt Werte außerhalb der Tabelle, statt zu schätzen', () => {
      expect(quick(quickFlat, { h: 31, n: 4, Lr: 15 })?.text).toBe('Nicht in der Tabelle')
      expect(quick(quickFlat, { h: 10, n: 15, Lr: 15 })?.text).toBe('Nicht in der Tabelle')
      expect(quick(quickFlat, { h: 10, n: 4, Lr: 26 })?.text).toBe('Nicht in der Tabelle')
      expect(quick(quickTube, { h: 10, A: 21, Lr: 15 })?.text).toBe('Nicht in der Tabelle')
    })

    it('bleibt offen, solange Angaben fehlen, und zeigt die Drücke trotzdem', () => {
      const values = computeFactorTool(tool, { h: 10 }, quickFlat)
      expect(values.Vtab).toBeUndefined()
      expect(values.p0?.value).toBeCloseTo(2, 6)
    })

    it('fragt nur ab, was die Tabelle braucht', () => {
      const symbols = (selection: Record<string, string>) => visibleInputs(tool, selection).map((input) => input.symbol)
      expect(symbols(quickFlat)).toEqual(['h', 'n', 'Lr'])
      expect(symbols(quickTube)).toEqual(['h', 'A', 'Lr'])
      expect(symbols(vaillant)).toEqual(['h', 'n', 'VK', 'Lr', 'VWT'])
      expect(symbols(flat)).toEqual(['h', 'n', 'VK', 'Lr', 'VWT'])
    })

    it('zeigt je Verfahren nur das passende Ergebnis', () => {
      const names = (selection: Record<string, string>) => visibleResults(tool, selection).map((result) => result.symbol)
      expect(names(quickFlat)).toEqual(['pV', 'p0', 'Vtab'])
      expect(names(vaillant)).toEqual(['pV', 'p0', 'Vmin'])
      expect(names(flat)).toEqual(['pV', 'p0', 'Vmin'])
    })

    it('ist bei Vaillant vorausgewählt und zeigt keine Rohrauswahl', () => {
      const selection = normalizeSelection(tool, { hersteller: 'vaillant' })
      expect(selection).toEqual({ hersteller: 'vaillant', methode: 'tabelle', kollektor: 'vfk' })
      const html = renderToStaticMarkup(
        <FactorCalculator tool={tool} initialInputs={{ h: '20', n: '8', Lr: '25' }} initialSelection={selection} />,
      )
      expect(html).toContain('80 l')
      expect(html).not.toContain('Rohrleitung (für die MAG-Größe)')
    })
  })

  it('rechnet die Flexrohre von Buderus je Einzelrohr über die einfache Länge', () => {
    const values = computeFactorTool(tool, { h: 10, ...sizing }, { ...flat, rohr: 'bflex20' })
    expect(values.Vsum?.value).toBeCloseTo(4 * 1.61 + 16.4 + 1 + 2 * 15 * 0.41, 6)
    expect(values.VD?.value).toBeCloseTo(4 * 1.61 + 5 * 0.41, 6)
  })

  it('nennt Rohre ohne das Wort Kupfer', () => {
    const rohr = tool.choices.find((choice) => choice.key === 'rohr')!
    expect(rohr.options.some((option) => option.label.includes('Kupfer'))).toBe(false)
    expect(rohr.options.map((option) => option.label)).toContain('Rohr 15 × 1,0')
  })

  it('meldet eine Tabelle, die nicht zu ihren Zeilen passt', () => {
    const broken = structuredClone(tool)
    const result = broken.results.find((item) => item.symbol === 'Vtab')!
    result.cases[0]!.table!.values.pop()
    expect(checkFactorTool(broken).join(' ')).toContain('12 Zeilen, erwartet 13')
  })

  it('zeigt keine Überschrift „Rechner“, der Löschen-Knopf steht im Ergebnisfeld', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialInputs={{ h: '10' }} initialSelection={flat} />)
    expect(html).toMatch(/<h2[^>]*class="sr-only"[^>]*>Rechner<\/h2>/)
    expect(html.indexOf('aria-live')).toBeLessThan(html.indexOf('Alle Eingaben löschen'))
    expect(html.indexOf('MAG-Vordruck')).toBeLessThan(html.indexOf('Alle Eingaben löschen'))
  })

  it('zeigt andere Faktor-Tools weiter mit Überschrift', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={{ ...tool, hideHeading: undefined }} initialSelection={flat} />)
    expect(html).not.toContain('sr-only')
    expect(html.indexOf('Alle Eingaben löschen')).toBeLessThan(html.indexOf('aria-live'))
  })

  it('hat im Rechenweg-Schalter je einen Info-Knopf, die Erklärung bleibt zu', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={flat} />)
    expect(html).toContain('aria-label="Info zu Buderus"')
    expect(html).toContain('aria-label="Info zu Vaillant"')
    expect(html).toContain('aria-expanded="false"')
    expect(html).not.toContain('Leitungssack')
    expect(html).not.toContain('auroTHERM')
    // Kein Knopf im Knopf: Auswahl und Info stehen nebeneinander
    expect(html).not.toMatch(/<button(?:(?!<\/button>).)*<button/)
  })

  it('erklärt die Systeme hinter den Knöpfen statt in der Beschreibung und bleibt damit auffindbar', () => {
    expect(tool.description).not.toContain('auroTHERM')
    expect(tool.description).not.toContain('Logasol')
    const hersteller = tool.choices.find((choice) => choice.key === 'hersteller')!
    expect(hersteller.options.map((option) => option.info?.slice(0, 12))).toEqual(['**Buderus (L', '**Vaillant ('])
    const keywords = toolSearchDocuments([tool])[0]!.keywords.join(' ')
    expect(keywords).toContain('auroTHERM')
    expect(keywords).toContain('Logasol')
  })

  it('nennt die Rohrlänge ohne Klammerzusatz', () => {
    expect(tool.inputs.find((input) => input.symbol === 'Lr')?.name).toBe('Einfache Rohrlänge')
  })

  it('zeigt die Umschalter über den Eingabefeldern, die Rohrauswahl darunter', () => {
    const html = renderToStaticMarkup(<FactorCalculator tool={tool} initialSelection={flat} />)
    expect(html.indexOf('Rechenweg')).toBeLessThan(html.indexOf('Flachkollektor'))
    expect(html.indexOf('Flachkollektor')).toBeLessThan(html.indexOf('Statische Höhe'))
    expect(html.indexOf('Statische Höhe')).toBeLessThan(html.indexOf('Rohrleitung (für die MAG-Größe)'))
  })
})
