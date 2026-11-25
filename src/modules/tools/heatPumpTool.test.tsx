import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HeatPumpBivalence } from './HeatPumpBivalence'
import {
  bivalencePoint,
  capacityAt,
  checkHeatPumpTool,
  coverageAt,
  evaluateBivalence,
  heatPumpRefText,
  heatPumpToolSchema,
  loadAt,
  typicalRange,
  type BivalenceInputs,
  type HeatPumpTool,
} from './heatPumpTool'
import { isHeatPumpTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.waermepumpe-bivalenzpunkt')
if (!entry || !isHeatPumpTool(entry)) throw new Error('Wärmepumpen-Tool erwartet')
const tool: HeatPumpTool = entry
const mode = (key: string) => tool.modes.find((candidate) => candidate.key === key)!

const inputs: BivalenceInputs = { heatLoad: 10, designOutdoor: -12, heatingLimit: 20, lowerLimit: -10 }
// Gerade Leistungskurve: 4 kW bei −12 °C, 8 kW bei +8 °C (0,2 kW/K) – Testwerte, keine Herstellerangabe
const points = [
  { outdoor: -12, power: 4 },
  { outdoor: 8, power: 8 },
]

describe('Wärmepumpe: Rechnung', () => {
  it('Inhalt ist gültig', () => {
    expect(checkHeatPumpTool(tool)).toEqual([])
  })

  it('Heizlastgerade: Norm-Heizlast bei Norm-AT, 0 an der Heizgrenze, linear dazwischen', () => {
    expect(loadAt(inputs, -12)).toBe(10)
    expect(loadAt(inputs, 20)).toBe(0)
    expect(loadAt(inputs, 25)).toBe(0)
    expect(loadAt(inputs, 4)).toBeCloseTo(5, 9)
  })

  it('Leistung linear zwischen den Punkten, außerhalb verlängert', () => {
    expect(capacityAt(points, -2)).toEqual({ power: 6, extrapolated: false })
    expect(capacityAt(points, -17)).toEqual({ power: 3, extrapolated: true })
    expect(capacityAt([points[0]!], 0)).toBeNull()
  })

  it('Bivalenzpunkt ist der Schnittpunkt', () => {
    // Last 10·(20−t)/32 = 4 + 0,2·(t+12) → t = (6,25 − 6,4)/(0,3125 + 0,2)
    const expected = (6.25 - 6.4) / (0.3125 + 0.2)
    const bivalence = bivalencePoint(inputs, points)!
    expect(bivalence).toBeCloseTo(expected, 3)
    expect(loadAt(inputs, bivalence)).toBeCloseTo(capacityAt(points, bivalence)!.power, 3)
  })

  it('kein Bivalenzpunkt, wenn die Wärmepumpe bis zur Norm-AT reicht', () => {
    expect(bivalencePoint(inputs, [{ outdoor: -12, power: 11 }, { outdoor: 7, power: 14 }])).toBeNull()
  })

  it('Deckungsanteil aus der Tabelle, linear dazwischen, null außerhalb', () => {
    expect(coverageAt(tool, -5)).toEqual({ powerShare: 0.58, parallel: 0.98, alternative: 0.91 })
    expect(coverageAt(tool, -4.5)!.alternative).toBeCloseTo(0.89, 9)
    expect(coverageAt(tool, -11)).toBeNull()
    expect(coverageAt(tool, 6)).toBeNull()
  })

  it('Betriebsweisen: zweiter Erzeuger und Abschalten der Wärmepumpe', () => {
    const parallel = evaluateBivalence(tool, mode('parallel'), inputs, points)!
    expect(parallel.heatPumpAtDesign).toBe(4)
    expect(parallel.secondAtDesign).toBe(6)
    expect(parallel.coverage).toBeCloseTo(coverageAt(tool, parallel.bivalence!)!.parallel, 9)

    const alternativ = evaluateBivalence(tool, mode('alternativ'), inputs, points)!
    expect(alternativ.heatPumpOffAtDesign).toBe(true)
    expect(alternativ.secondAtDesign).toBe(10)
    expect(alternativ.coverage).toBeCloseTo(coverageAt(tool, alternativ.bivalence!)!.alternative, 9)

    const teilparallel = evaluateBivalence(tool, mode('teilparallel'), inputs, points)!
    expect(teilparallel.heatPumpOffBelow).toBe(-10)
    expect(teilparallel.secondAtDesign).toBe(10)
    expect(teilparallel.coverage).toBeNull()

    const monovalent = evaluateBivalence(tool, mode('monovalent'), inputs, points)!
    expect(monovalent.monovalentGap).toBe(6)
    expect(monovalent.secondAtDesign).toBe(0)
  })

  it('übliche Spanne: nächstgelegene Norm-Außentemperatur', () => {
    expect(typicalRange(tool, -12)).toMatchObject({ from: -3, to: -6 })
    expect(typicalRange(tool, -15)).toMatchObject({ designOutdoor: -16 })
  })

  it('Build-Prüfung findet Fehler', () => {
    const broken = heatPumpToolSchema.parse({
      ...tool,
      modes: [{ ...mode('parallel'), ref: { source: 'gibtsnicht', where: 'x' } }, mode('alternativ')],
      typicalRanges: { ...tool.typicalRanges, rows: [{ designOutdoor: -12, from: -6, to: -3 }] },
      problems: [tool.problems[0], tool.problems[0]],
    })
    const issues = checkHeatPumpTool(broken)
    expect(issues.some((issue) => issue.includes('unbekannte Quelle "gibtsnicht"'))).toBe(true)
    expect(issues.some((issue) => issue.startsWith('typicalRanges.rows[0]'))).toBe(true)
    expect(issues).toContain('problems: key doppelt vergeben')
  })

  it('ist in der Suche zu finden', () => {
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    expect(document.keywords).toEqual(expect.arrayContaining(['Bivalenzpunkt', 'Bivalent-alternativ']))
  })
})

describe('Wärmepumpe: Anzeige', () => {
  const rows: [string, string][] = [
    ['-12', '4'],
    ['8', '8'],
  ]

  it('startet mit Beispielpunkten, Bivalenzpunkt und vorausgewählter Betriebsweise', () => {
    const html = renderToStaticMarkup(<HeatPumpBivalence tool={tool} />)
    expect(html).toContain('Beispielwerte zum Ausprobieren')
    expect(html).toContain('Bivalenzpunkt -3,0 °C')
    expect(html).toMatch(/aria-pressed="true"[^>]*><span aria-hidden="true">✓ <\/span>Monoenergetisch/)
    expect(html).not.toContain('außerhalb der eingetragenen Datenblattpunkte')
  })

  it('Norm-Außentemperatur: Link zur Klimakarte nach Postleitzahl', () => {
    const html = renderToStaticMarkup(<HeatPumpBivalence tool={tool} />)
    expect(html).toContain('href="https://www.waermepumpe.de/normen-technik/klimakarte/"')
    expect(html).toContain('Per PLZ nachschlagen')
  })

  it('ohne Datenblatt: Hinweis statt Ergebnis', () => {
    const html = renderToStaticMarkup(<HeatPumpBivalence tool={tool} initialRows={[['', ''], ['', '']]} />)
    expect(html).toContain('Mindestens zwei Datenblattpunkte eingeben')
    expect(html).toContain('Norm-Heizlast 10,0 kW')
  })

  it('zeigt Bivalenzpunkt, Leistungen und Deckungsanteil', () => {
    const html = renderToStaticMarkup(<HeatPumpBivalence tool={tool} initialRows={rows} initialMode="parallel" />)
    expect(html).toContain('Bivalenzpunkt -0,3 °C')
    expect(html).toContain('6,0 kW')
    expect(html).toMatch(/Deckungsanteil der Wärmepumpe an der Jahresheizarbeit: <strong[^>]*>9\d %/)
  })

  it('monovalent: warnt, wenn die Wärmepumpe nicht reicht', () => {
    const html = renderToStaticMarkup(<HeatPumpBivalence tool={tool} initialRows={rows} initialMode="monovalent" />)
    expect(html).toContain('fehlen 6,0 kW')
  })

  it('„Was ist das Problem?“: Auswahl zeigt Regel, Richtung und Quelle', () => {
    const empty = renderToStaticMarkup(<HeatPumpBivalence tool={tool} />)
    expect(empty).toContain('Was ist das Problem?')
    expect(empty).not.toContain('Regel</p>')
    const problem = tool.problems.find((candidate) => candidate.bivalence === 'up')!
    const html = renderToStaticMarkup(<HeatPumpBivalence tool={tool} initialProblem={problem.key} />)
    expect(html).toContain('Bivalenzpunkt höher (wärmer) wählen')
    expect(html).toContain(`Quelle: ${heatPumpRefText(tool, problem.ref)}`)
    expect(html).toContain('Jetzt im Tool: Bivalenzpunkt -3,0 °C')
  })

  it('teilparallel: Abschaltpunkt einstellbar, kein Deckungsanteil', () => {
    const html = renderToStaticMarkup(<HeatPumpBivalence tool={tool} initialRows={rows} initialMode="teilparallel" />)
    expect(html).toContain('Abschaltpunkt der Wärmepumpe')
    expect(html).toContain('Für teilparallel hat die Tabelle der Quelle keine Spalte')
  })
})
