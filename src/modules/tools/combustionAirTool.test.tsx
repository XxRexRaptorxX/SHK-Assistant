import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { CombustionAirSizing, initialCombustionAirState } from './CombustionAirSizing'
import {
  checkCombustionAirTool,
  checkCompound,
  checkOpenings,
  compoundRequirement,
  openingArea,
  openingRequirement,
  volumeFlowRequirement,
  type CombustionAirTool,
} from './combustionAirTool'
import { isCombustionAirTool } from './schema'
import { filterTools, toolEntries } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.verbrennungsluft')
if (!entry || !isCombustionAirTool(entry)) throw new Error('Verbrennungsluft-Tool erwartet')
const tool: CombustionAirTool = entry
const regulation = (key: string) => tool.regulations.find((candidate) => candidate.key === key)!
const mfeuv = regulation('mfeuv')
const bayern = regulation('bayern')

// Referenzwerte direkt aus dem Verordnungstext (MFeuV § 3, BayFeuV § 3)
describe('Verbrennungsluft: Anforderungen', () => {
  it('ist fehlerfrei, öffentlich und als ungeprüft markiert', () => {
    expect(checkCombustionAirTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.visibility).toBe('public')
    expect(tool.category).toBe('Auslegung')
  })

  it('bis 50 kW: eine Öffnung 150 cm² oder zwei je 75 cm²', () => {
    expect(openingRequirement(mfeuv, 24)).toEqual({ kind: 'small', single: 150, pairEach: 75, maxOpenings: 2 })
    expect(openingRequirement(mfeuv, 50).kind).toBe('small')
  })

  it('über 50 kW: 150 cm² plus 2 cm² je kW darüber, angefangene kW zählen voll', () => {
    expect(openingRequirement(mfeuv, 60)).toEqual({ kind: 'large', area: 170, maxOpenings: 2 })
    expect(openingRequirement(bayern, 100)).toEqual({ kind: 'large', area: 250, maxOpenings: 2 })
    expect(openingRequirement(mfeuv, 50.5)).toEqual({ kind: 'large', area: 152, maxOpenings: 2 })
  })

  it('MFeuV: 1,6 m³/h je kW, kein Verbrennungsluftverbund', () => {
    expect(volumeFlowRequirement(mfeuv, 24)).toBeCloseTo(38.4, 6)
    expect(compoundRequirement(mfeuv, 24)).toEqual({ kind: 'none' })
  })

  it('Bayern: 4 m³ je kW bis 35 kW, darüber kein Rauminhalt-Nachweis, kein Volumenstrom-Wert', () => {
    expect(compoundRequirement(bayern, 20)).toEqual({ kind: 'volume', volume: 80 })
    expect(compoundRequirement(bayern, 35)).toEqual({ kind: 'volume', volume: 140 })
    expect(compoundRequirement(bayern, 36)).toEqual({ kind: 'overLimit', upTo: 35 })
    expect(volumeFlowRequirement(bayern, 20)).toBeUndefined()
  })
})

describe('Verbrennungsluft: Prüfung', () => {
  const small = openingRequirement(mfeuv, 24)
  const large = openingRequirement(mfeuv, 60)

  it('prüft Öffnungen bis 50 kW: eine große oder zwei je 75 cm²', () => {
    expect(checkOpenings(small, [150]).kind).toBe('ok')
    expect(checkOpenings(small, [80, 75]).kind).toBe('ok')
    expect(checkOpenings(small, [140]).kind).toBe('tooSmall')
    // Summe 160 cm², aber eine Öffnung unter 75 cm²
    expect(checkOpenings(small, [100, 60]).kind).toBe('tooSmall')
    expect(checkOpenings(small, [50, 50, 50]).kind).toBe('tooMany')
  })

  it('prüft Öffnungen über 50 kW über die Summe', () => {
    expect(checkOpenings(large, [100, 70]).kind).toBe('ok')
    expect(checkOpenings(large, [100, 60])).toEqual({ kind: 'missing', total: 160, missing: 10 })
  })

  it('rechnet lichte Querschnitte', () => {
    expect(openingArea('rect', 15, 10)).toBe(150)
    expect(openingArea('round', 14)).toBeCloseTo(153.94, 2)
    expect(openingArea('area', 120)).toBe(120)
  })

  it('zählt im Verbund nur verbundene Räume mit Verbindung zum Freien', () => {
    const check = checkCompound(80, [
      { volume: 30, toOutside: true, connected: false },
      { volume: 40, toOutside: true, connected: true },
      { volume: 20, toOutside: false, connected: true },
      { volume: 50, toOutside: true, connected: false },
    ])
    expect(check.statuses).toEqual(['counted', 'counted', 'noOutside', 'notConnected'])
    expect(check.counted).toBe(70)
    expect(check.ok).toBe(false)
    expect(checkCompound(80, [{ volume: 80, toOutside: true, connected: false }]).ok).toBe(true)
    // Aufstellraum ohne Fenster zählt nicht, der Verbund mit Räumen mit Verbindung zum Freien schon
    expect(checkCompound(80, [{ volume: 30, toOutside: false, connected: false }, { volume: 90, toOutside: true, connected: true }]).counted).toBe(90)
  })
})

describe('Verbrennungsluft: Seite', () => {
  it('fragt zuerst nach der Nennleistung', () => {
    const html = renderToStaticMarkup(<CombustionAirSizing tool={tool} />)
    expect(html).toContain('Nennleistung eingeben.')
    expect(html).toContain('Muster (MFeuV)')
  })

  it('zeigt Anforderungen und prüft eine Öffnung (MFeuV, 60 kW)', () => {
    const state = initialCombustionAirState(tool)
    const html = renderToStaticMarkup(
      <CombustionAirSizing tool={tool} initial={{ power: '60', openings: [{ ...state.openings[0]!, shape: 'rect', a: '20', b: '8' }] }} />,
    )
    expect(html).toContain('mind. 170 cm²')
    expect(html).toContain('mind. 96,0 m³/h')
    expect(html).toContain('Es fehlen 10 cm²')
    expect(html).toContain('Quelle: MFeuV (Stand 2017), § 3 Abs. 3, S. 2')
  })

  it('bietet Einheiten zur Auswahl an und rechnet sie um', () => {
    const state = initialCombustionAirState(tool)
    const html = renderToStaticMarkup(
      <CombustionAirSizing
        tool={tool}
        initial={{
          power: '60000',
          powerUnit: 'W',
          openings: [{ ...state.openings[0]!, a: '200', b: '80', lengthUnit: 'mm' }],
        }}
      />,
    )
    expect(html).toContain('aria-label="Einheit für Nennleistung insgesamt"')
    expect(html).toContain('aria-label="Einheit für Breite"')
    expect(html).toContain('mind. 170 cm²')
    expect(html).toContain('Es fehlen 10 cm²')
  })

  it('prüft den Verbund (Bayern, 20 kW)', () => {
    const state = initialCombustionAirState(tool)
    const html = renderToStaticMarkup(
      <CombustionAirSizing
        tool={tool}
        initial={{
          regulation: 'bayern',
          power: '20',
          method: 'compound',
          rooms: [
            { ...state.rooms[0]!, length: '3', width: '2,5', height: '2,4' },
            { ...state.rooms[0]!, key: 'room1', name: 'Flur', mode: 'volume', volume: '70' },
          ],
        }}
      />,
    )
    expect(html).toContain('mind. 80,0 m³')
    expect(html).toContain('88,0 m³')
    expect(html).toContain('Reicht aus.')
  })

  it('ist über die Suche zu finden', () => {
    expect(filterTools(toolEntries, 'Verbrennungsluftverbund').map((candidate) => candidate.id)).toContain('tool.verbrennungsluft')
  })
})
