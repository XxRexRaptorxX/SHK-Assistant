import { describe, expect, it } from 'vitest'
import { checkFactorTool, computeFactorTool, visibleResults, type FactorTool } from './factorTool'
import { content } from '../../content'
import {
  activeBarSelection,
  checkChoiceTool,
  choiceFigures,
  defaultBarSelection,
  sectionVisible,
  visibleBars,
  type ChoiceTool,
} from './schema'
import { toolEntries } from './tools'

const ventilation = toolEntries.find((entry) => entry.id === 'tool.belueftung-anschlussleitung') as FactorTool
const choiceTools = [
  'tool.abwasser-leitungsfuehrung',
].map((id) => toolEntries.find((entry) => entry.id === id) as ChoiceTool)

describe('Abwasser Belüftung von Anschlussleitungen', () => {
  const decide = (inputs: Record<string, number>, dn: 'bis75' | 'ab90') => computeFactorTool(ventilation, inputs, { dn })

  it('ist gültig und zeigt die Zwischenwerte nicht an', () => {
    expect(checkFactorTool(ventilation)).toEqual([])
    expect(visibleResults(ventilation, { dn: 'bis75' }).map((result) => result.symbol)).toEqual(['E', 'A', 'B'])
  })

  it('lässt die Grenzwerte selbst noch zu', () => {
    expect(decide({ L_E: 4, n: 3, h: 1, L_A: 4 }, 'bis75').B?.text).toBe('Keine Belüftung notwendig')
    expect(decide({ L_E: 4, n: 3, h: 1, L_A: 10 }, 'ab90').B?.text).toBe('Keine Belüftung notwendig')
  })

  it('prüft jede Grenze der Einzelanschlussleitung einzeln', () => {
    const base = { L_E: 2, n: 1, h: 0.5, L_A: 3 }
    for (const over of [{ L_E: 4.1 }, { n: 4 }, { h: 1.1 }]) {
      const values = decide({ ...base, ...over }, 'bis75')
      expect(values.E?.text).toBe('Ja')
      expect(values.B?.text).toBe('Belüftung der Einzelanschlussleitung')
    }
  })

  it('setzt die Längengrenze der gesamten Leitung nach Nennweite', () => {
    const inputs = { L_E: 2, n: 1, h: 0.5, L_A: 6 }
    expect(decide(inputs, 'bis75').B?.text).toBe('Belüftung der gesamten Anschlussleitung')
    expect(decide(inputs, 'ab90').B?.text).toBe('Keine Belüftung notwendig')
  })

  it('belüftet die gesamte Leitung, wenn beides zu lang ist', () => {
    expect(decide({ L_E: 5, n: 1, h: 0.5, L_A: 11 }, 'ab90').B?.text).toBe('Belüftung der gesamten Anschlussleitung')
  })

  it('bleibt offen, solange eine Eingabe fehlt', () => {
    expect(decide({ L_E: 5, n: 1, h: 0.5 }, 'ab90').B).toBeUndefined()
  })
})

describe('Abwasser-Verlegetools', () => {
  it('sind gültig und zeigen für jede Stellung der Leiste Abschnitte', () => {
    for (const tool of choiceTools) {
      expect(checkChoiceTool(tool), tool.id).toEqual([])
      const bar = tool.bars[0]!
      for (const option of bar.options) {
        const selection = { ...defaultBarSelection(tool), [bar.key]: option.key }
        expect(tool.sections.some((section) => sectionVisible(section, selection)), `${tool.id} ${option.key}`).toBe(true)
      }
    }
  })

  it('verweisen nur auf vorhandene Tools und nie auf sich selbst', () => {
    for (const tool of [...choiceTools, ventilation]) {
      expect(tool.related.length, tool.id).toBeGreaterThan(0)
      for (const id of tool.related) {
        expect(id).not.toBe(tool.id)
        expect(toolEntries.some((entry) => entry.id === id), `${tool.id} → ${id}`).toBe(true)
      }
    }
  })

  it('nennen Herstellerempfehlungen kurz „empfohlen“', () => {
    for (const tool of choiceTools) expect(JSON.stringify(tool), tool.id).not.toMatch(/Empfehlung POLOPLAST/)
  })

  it('zeigen Text-Abschnitte einheitlich mit der Bezeichnung über dem Wert', () => {
    for (const tool of choiceTools) {
      for (const section of tool.sections) expect(section.stacked, `${tool.id}: ${section.title}`).toBe(true)
    }
  })
})

describe('Beschreibungen der Abwasser-Tools', () => {
  it('nennen Grundlage und Hersteller nur in der Quelle', () => {
    for (const tool of [...choiceTools, ventilation]) {
      expect(tool.description, tool.id).not.toMatch(/Grundlage|POLOPLAST|DIN 1986/)
      expect(tool.source, tool.id).toMatch(/POLOPLAST/)
      expect(tool.source, tool.id).toMatch(/DIN 1986-100/)
    }
  })
})

describe('Abwasser Leitungsführung und Gefälle', () => {
  const flow = choiceTools.find((tool) => tool.id === 'tool.abwasser-leitungsfuehrung')!
  const visible = (selection: Record<string, string>) =>
    flow.sections.filter((section) => sectionVisible(section, activeBarSelection(flow, selection)))
  const lying = ['einzel', 'einzelBel', 'sammelanschluss', 'sammel', 'grund']
  const values = (leitung: string) => visible({ leitung })[0]!.options[0]!.values

  it('zeigt je liegender Leitung die Lage im Rohrsystem und das maximale Gefälle', () => {
    for (const leitung of lying) {
      const [section] = visible({ leitung })
      expect(section!.options[0]!.figure, leitung).toMatch(/^figure\.abwasser-system-/)
      expect(section!.columns.find((column) => column.key === 'gefaelleMax')!.name).toBe('Maximales Gefälle (empfohlen)')
    }
  })

  it('nennt Höchstlängen und Höhenunterschied nur, wo es eine Vorgabe gibt', () => {
    expect(values('einzel')).toMatchObject({ laenge: '4 m', umlenkungen: '3', fallhoehe: '1 m' })
    expect(values('einzelBel')).toMatchObject({ laenge: '10 m', umlenkungen: 'keine Begrenzung', fallhoehe: '3 m' })
    expect(values('sammelanschluss')).toMatchObject({ laengeKlein: '4 m', laengeGross: '10 m' })
    for (const leitung of ['sammel', 'grund']) {
      const [section] = visible({ leitung })
      expect(section!.columns.some((column) => column.group === 'Länge'), leitung).toBe(false)
    }
    expect(JSON.stringify(flow)).not.toContain('TODO')
  })

  it('zeigt beim Nennweitenwechsel die passende Skizze', () => {
    const reducer = (leitung: string) => visible({ leitung })[0]!.options[0]!.valueFigures.nennweite
    expect(reducer('sammelanschluss')).toBe('figure.nennweite-scheitelgleich')
    expect(reducer('sammel')).toBe('figure.nennweite-scheitelgleich')
    expect(reducer('grund')).toBe('figure.nennweite-sohlgleich')
  })
})

describe('Fallleitung im Tool Leitungsführung', () => {
  const flow = choiceTools.find((tool) => tool.id === 'tool.abwasser-leitungsfuehrung')!
  const titles = (selection: Record<string, string>) =>
    flow.sections
      .filter((section) => sectionVisible(section, activeBarSelection(flow, { leitung: 'fall', ...selection })))
      .map((section) => section.title)

  it('zeigt Thema und Fallhöhe nur bei der Fallleitung bzw. beim Thema Umlenkung', () => {
    const bars = (selection: Record<string, string>) => visibleBars(flow, selection).map((bar) => bar.key)
    expect(bars({ leitung: 'sammel', thema: 'umlenkung', hoehe: 'bis22' })).toEqual(['leitung'])
    expect(bars({ leitung: 'fall', thema: 'einbindung', hoehe: 'bis22' })).toEqual(['leitung', 'thema'])
    expect(bars({ leitung: 'fall', thema: 'umlenkung', hoehe: 'bis22' })).toEqual(['leitung', 'thema', 'hoehe'])
    expect(flow.bars[2]!.options.map((option) => option.label)).toEqual(['bis 10 m', '10–22 m', 'über 22 m'])
  })

  it('blendet bei anderer Leitung oder anderem Thema nichts von der Fallleitung ein', () => {
    expect(titles({ thema: 'fuehrung', hoehe: 'ueber22' })).toEqual(['Schmutzwasserfallleitung'])
    const sammel = flow.sections.filter((section) =>
      sectionVisible(section, activeBarSelection(flow, { leitung: 'sammel', thema: 'umlenkung', hoehe: 'ueber22' })),
    )
    expect(sammel.map((section) => section.title)).toEqual(['Sammelleitung'])
  })

  it('zeigt bei der Führung die Lage der Fallleitung im Rohrsystem', () => {
    const [section] = flow.sections.filter((candidate) => candidate.when.thema === 'fuehrung')
    expect(section!.options[0]!.figure).toBe('figure.abwasser-system-fallleitung')
  })

  it('empfiehlt auch bis 10 m zwei 45°-Bögen', () => {
    const [section] = flow.sections.filter((candidate) => candidate.when.hoehe === 'bis10')
    expect(section!.options[0]!.values.empfohlen).toContain('2 × 45°')
  })

  it('zeigt je Fallhöhe die Fälle aus dem Leitfaden mit Skizze', () => {
    expect(titles({ thema: 'umlenkung', hoehe: 'bis22' })).toEqual([
      'Umlenkung 10–22 m Fallhöhe',
      'Verzug länger als 2 m',
      'Verzug kürzer als 2 m',
    ])
    expect(titles({ thema: 'umlenkung', hoehe: 'ueber22' })).toEqual([
      'Umlenkung über 22 m Fallhöhe',
      'Übergang in die liegende Leitung',
      'Verzug kürzer als 2 m',
    ])
    for (const id of choiceFigures(flow)) expect(content.figures.some((figure) => figure.id === id), id).toBe(true)
  })
})

describe('Lüftungsleitung im Tool Leitungsführung', () => {
  const flow = choiceTools.find((tool) => tool.id === 'tool.abwasser-leitungsfuehrung')!
  const titles = (lueftungThema: string) =>
    flow.sections
      .filter((section) => sectionVisible(section, activeBarSelection(flow, { leitung: 'lueftung', lueftungThema })))
      .map((section) => section.title)

  it('zeigt das Thema der Lüftung nur bei der Lüftungsleitung', () => {
    const bars = (selection: Record<string, string>) => visibleBars(flow, selection).map((bar) => bar.key)
    expect(bars({ leitung: 'lueftung', thema: 'umlenkung', hoehe: 'bis22' })).toEqual(['leitung', 'lueftungThema'])
    expect(bars({ leitung: 'fall', lueftungThema: 'ventil' })).toEqual(['leitung', 'thema'])
  })

  it('übernimmt alle Themen der bisherigen Lüftungsleitungen', () => {
    expect(titles('haupt')).toEqual(['Hauptlüftung'])
    expect(titles('dach')).toEqual(['Austritt über Dach'])
    expect(titles('ventil')).toEqual(['Belüftungsventile'])
    expect(titles('sonder')).toEqual(['Hebeanlage, fäkalhaltig', 'Hebeanlage, fäkalfrei', 'Fettabscheider'])
    expect(toolEntries.some((entry) => entry.id === 'tool.lueftungsleitungen-abwasser')).toBe(false)
  })

  it('zeigt bei der Hauptlüftung die Lage im Rohrsystem', () => {
    const [section] = flow.sections.filter((candidate) => candidate.when.lueftungThema === 'haupt')
    expect(section!.options[0]!.figure).toBe('figure.abwasser-system-lueftung')
  })
})

describe('Skizze im Belüftungs-Rechner', () => {
  it('zeigt die abgefragten Maße der Anschlussleitung', () => {
    expect(ventilation.figure).toBe('figure.anschlussleitung-belueftung-masse')
    expect(content.figures.some((figure) => figure.id === ventilation.figure)).toBe(true)
  })
})
