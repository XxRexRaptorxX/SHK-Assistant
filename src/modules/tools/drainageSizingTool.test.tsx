import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { DrainageSizing, type DrainageState } from './DrainageSizing'
import {
  checkDrainageSizingTool,
  designFlow,
  drainageSizingKeywords,
  drainageSizingToolSchema,
  innerDiameter,
  sizeLine,
  sumDu,
  type DrainageSelection,
  type DrainageSizingTool,
} from './drainageSizingTool'
import { isDrainageSizingTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.abwasser-dimensionierung')
if (!entry || !isDrainageSizingTool(entry)) throw new Error('Abwasser-Bemessung erwartet')
const tool: DrainageSizingTool = entry

const size = (selection: Omit<DrainageSelection, 'usage'> & { usage?: string }) =>
  sizeLine(tool, { usage: 'unregelmaessig', ...selection })
const render = (initial: Partial<DrainageState>) => renderToStaticMarkup(<DrainageSizing tool={tool} initial={initial} />)

describe('Abwasser Dimensionierung', () => {
  it('ist fehlerfrei und bleibt ungeprüft, bis der Inhaber freigibt', () => {
    expect(checkDrainageSizingTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
  })

  it('rechnet das Beispiel aus dem Leitfaden nach (Fallleitung 26 WE, Sammelleitung 52 WE)', () => {
    const flat = { badewanne: 1, waschbecken: 2, kuechenspuele: 1, wc6: 1 }
    const stack = designFlow(tool, { line: 'fall', usage: 'unregelmaessig', counts: flat, units: 26 })
    expect(stack.sumDu).toBeCloseTo(119.6, 9)
    expect(stack.qww).toBeCloseTo(5.468, 3)
    const result = size({ line: 'fall', counts: flat, units: 26, ventilation: 'haupt', branchType: 'ohneRadius' })
    expect(result.type === 'stack' && result.row?.dn).toBe(125)

    const collector = size({ line: 'sammel', counts: flat, units: 52, table: 'fill50' })
    expect(collector.type === 'slope' && collector.options.map((option) => [option.dn, option.slope])).toEqual([
      [125, 3.5],
      [160, 0.9],
      [200, 0.5],
    ])
  })

  it('summiert die Sammelanschlussleitung ohne Wurzel und hält die WC-Grenzen ein', () => {
    // ΣDU 2,0 passt in DN 75, aber dort sind keine WCs erlaubt
    const oneWc = size({ line: 'sammelanschluss', counts: { wc6: 1 } })
    expect(oneWc.type === 'branch' && [oneWc.row?.dn, oneWc.skipped.map((entry) => entry.dn)]).toEqual([90, [75]])
    // Drei WCs: DN 90 nur mit höchstens zwei WCs (bei K 0,5 und 0,7)
    const threeWc = size({ line: 'sammelanschluss', counts: { wc6: 3 } })
    expect(threeWc.type === 'branch' && threeWc.row?.dn).toBe(110)
    // Bei häufiger Benutzung gilt die Zwei-WC-Grenze laut Fußnote nicht
    const frequent = size({ line: 'sammelanschluss', usage: 'haeufig', counts: { wc45: 2, waschbecken: 1 } })
    expect(frequent.type === 'branch' && frequent.row?.dn).toBe(90)
  })

  it('meldet Sammelanschlussleitungen über der Tabelle und Gebäudearten ohne Werte', () => {
    const tooMuch = size({ line: 'sammelanschluss', counts: { wc6: 9 } })
    expect(tooMuch.type === 'branch' && [tooMuch.row, tooMuch.noValues]).toEqual([undefined, false])
    const lab = size({ line: 'sammelanschluss', usage: 'speziell', counts: { waschbecken: 1 } })
    expect(lab.type === 'branch' && lab.noValues).toBe(true)
  })

  it('nimmt den größten Anschlusswert, wenn er über dem errechneten Abfluss liegt', () => {
    // 0,5 · √2,5 = 0,79 l/s < 2,5 l/s (WC 9 l)
    const flow = designFlow(tool, { line: 'fall', usage: 'unregelmaessig', counts: { wc9: 1 } })
    expect(flow.largestGoverns).toBe(true)
    expect(flow.flow).toBe(2.5)
    // DN 90 trägt 2,7 l/s, ist aber nicht für WC mit 9-l-Spülkasten zugelassen
    const result = size({ line: 'fall', counts: { wc9: 1 } })
    expect(result.type === 'stack' && [result.row?.dn, result.skipped.map((entry) => entry.dn)]).toEqual([110, [90]])
  })

  it('zählt Dauerabfluss und Hebeanlage dazu', () => {
    const flow = designFlow(tool, { line: 'sammel', usage: 'unregelmaessig', counts: { waschbecken: 4 }, continuous: 0.5, pump: 1.2 })
    expect(flow.qww).toBeCloseTo(0.5 * Math.sqrt(2), 9)
    expect(flow.qtot).toBeCloseTo(0.5 * Math.sqrt(2) + 1.7, 9)
  })

  it('markiert Grundleitungen unter DN 110 und sucht je Tabelle das kleinste Gefälle', () => {
    const inside = size({ line: 'grundInnen', counts: { waschbecken: 4 } })
    expect(inside.type === 'slope' && inside.options.map((option) => [option.dn, option.slope, option.belowRecommended])).toEqual([
      [75, 0.8, true],
      [90, 0.7, true],
      [110, 0.5, false],
    ])
    // Außerhalb nur Füllungsgrad 70 %: DN 110 erst ab 0,9 %
    const outside = size({ line: 'grundAussen', counts: { waschbecken: 4 } })
    expect(outside.type === 'slope' && outside.options[2]).toMatchObject({ dn: 110, slope: 0.9 })
  })

  it('markiert den empfohlenen Füllungsgrad und warnt bei 70 % im Gebäude', () => {
    // Ohne Wahl gilt die empfohlene Tabelle (50 %), 70 % nur hinter einer Hebeanlage
    const result = size({ line: 'sammel', counts: { waschbecken: 4 } })
    expect(result.type === 'slope' && result.table.key).toBe('fill50')
    const recommended = render({ line: 'sammel', counts: { waschbecken: 4 } })
    expect(recommended).toContain('Empfohlen')
    expect(recommended).toContain('Sammelleitung für Schmutzwasser im Gebäude')
    const pumped = render({ line: 'sammel', table: 'fill70', counts: { waschbecken: 4 } })
    expect(pumped).toContain('Nur hinter der Einleitung')
    expect(pumped).toContain('Im Regelfall empfohlen: Füllungsgrad 50 %.')
    // Außerhalb gibt es nur 70 %, ohne Leiste, aber mit Empfehlung
    expect(render({ line: 'grundAussen' })).toContain('Empfohlen: Füllungsgrad 70 %')
  })

  it('verlangt je liegendem Abschnitt eine empfohlene Tabelle', () => {
    const lines = tool.lines.map((line) =>
      line.type === 'slope' ? { ...line, tables: line.tables.map((entry) => ({ ...entry, recommended: false })) } : line,
    )
    expect(checkDrainageSizingTool({ ...tool, lines }).some((issue) => issue.includes('empfohlen'))).toBe(true)
  })

  it('nennt bei der Einzelanschlussleitung die Nennweite je Gegenstand', () => {
    const html = render({ line: 'einzel', counts: { waschbecken: 1, wc9: 1 } })
    expect(html).toContain('DN 40')
    expect(html).toContain('DN 110')
  })

  it('zeigt Rechenweg und Ergebnis der Fallleitung', () => {
    const html = render({ line: 'fall', counts: { badewanne: 1, waschbecken: 2, kuechenspuele: 1, wc6: 1 }, units: 26 })
    expect(html).toContain('DN 125')
    expect(html).toContain('5,47 l/s')
    expect(html).toContain('119,6 l/s')
    expect(html).toContain('26 Einheiten')
  })

  it('bittet ohne Gegenstände ums Zählen', () => {
    expect(render({})).toContain('Gegenstände zählen')
  })

  it('lehnt Tabellen mit falscher Spaltenzahl oder fallenden Werten ab', () => {
    const [first, ...rest] = tool.capacityTables
    const broken: DrainageSizingTool = {
      ...tool,
      capacityTables: [{ ...first!, rows: [{ slope: 0.5, capacity: [1, 0.5] }, ...first!.rows.slice(1)] }, ...rest],
    }
    const issues = checkDrainageSizingTool(broken)
    expect(issues.some((issue) => issue.includes('Werte für'))).toBe(true)
    expect(issues.some((issue) => issue.includes('steigen'))).toBe(true)
    expect(drainageSizingToolSchema.safeParse({ ...tool, usages: [] }).success).toBe(false)
  })

  it('zählt eigene Gegenstände mit, auch bei den WC-Grenzen', () => {
    const custom = [{ key: 'custom0', name: 'Gewerbespülmaschine', du: 1.5, count: 2, wc: false }]
    expect(sumDu(tool, { waschbecken: 1 }, 1, custom)).toBeCloseTo(3.5, 9)
    // Größter DU kann ein eigener Gegenstand sein
    const flow = designFlow(tool, { line: 'fall', usage: 'unregelmaessig', counts: {}, custom: [{ ...custom[0]!, du: 3, count: 1 }] })
    expect(flow.largest?.name).toBe('Gewerbespülmaschine')
    expect(flow.flow).toBe(3)
    // Als WC markiert: DN 75 der Sammelanschlussleitung ist dann nicht erlaubt
    const asWc = size({ line: 'sammelanschluss', counts: {}, custom: [{ key: 'c', name: 'Dusch-WC', du: 2, count: 1, wc: true }] })
    expect(asWc.type === 'branch' && asWc.row?.dn).toBe(90)
    const notWc = size({ line: 'sammelanschluss', counts: {}, custom: [{ key: 'c', name: 'Pumpe', du: 2, count: 1, wc: false }] })
    expect(notWc.type === 'branch' && notWc.row?.dn).toBe(75)
    // Ohne DU oder Anzahl zählt er nicht
    expect(sumDu(tool, {}, 1, [{ key: 'c', name: '', du: 0, count: 3, wc: false }])).toBe(0)
  })

  it('zeigt eigene Gegenstände im Ergebnis und ohne DN den Hinweis auf den Hersteller', () => {
    const html = render({ line: 'einzel', custom: [{ key: 'custom0', name: 'Gewerbespülmaschine', du: '1,5', count: 1, dn: '', wc: false }] })
    expect(html).toContain('Nennweite laut Hersteller')
    expect(html).toContain('Mit eigenen Angaben, nicht aus dem Leitfaden: Gewerbespülmaschine.')
    const withDn = render({ line: 'einzel', custom: [{ key: 'custom0', name: 'Ausguss', du: '0,8', count: 1, dn: '75', wc: false }] })
    expect(withDn).toContain('DN 75')
    const invalid = render({ line: 'sammel', custom: [{ key: 'custom0', name: 'X', du: 'abc', count: 1, dn: '', wc: false }] })
    expect(invalid).toContain('Zahl größer 0 eingeben')
    expect(invalid).toContain('Gegenstände zählen')
  })

  it('klappt die eigenen Gegenstände erst auf, wenn welche da sind', () => {
    expect(render({})).toMatch(/<details class="[^"]*">\s*<summary[^>]*>Eigene Gegenstände/)
    const withRow = render({ custom: [{ key: 'custom0', name: 'X', du: '1', count: 1, dn: '', wc: false }] })
    expect(withRow).toMatch(/<details open="" class="[^"]*">/)
  })

  it('rechnet den Innendurchmesser aus der Querschnittsfläche und schaltet die Anzeige um', () => {
    // POLO-KAL NG DN 110: A = 83,65 cm² → di ≈ 103,2 mm
    expect(innerDiameter(tool, 110)).toBeCloseTo(103.2, 1)
    expect(innerDiameter(tool, 40)).toBeCloseTo(36.4, 1)
    expect(innerDiameter(tool, 100)).toBeUndefined()
    const counts = { badewanne: 1, waschbecken: 2, kuechenspuele: 1, wc6: 1 }
    const outer = render({ line: 'fall', counts, units: 26 })
    expect(outer).toContain('DN 125')
    expect(outer).toContain('Rohraußendurchmesser DN/OD')
    const inner = render({ line: 'fall', counts, units: 26, diameter: 'inner' })
    expect(inner).toContain('di 117,2 mm')
    expect(inner).toContain('(DN 125)')
  })

  it('verlangt eine Querschnittsfläche für jede Nennweite', () => {
    const rows = tool.crossSections.rows.filter((row) => row.dn !== 125)
    const issues = checkDrainageSizingTool({ ...tool, crossSections: { ...tool.crossSections, rows } })
    expect(issues).toContain('crossSections: Querschnitt für DN 125 fehlt')
  })

  it('ist über Gegenstände und Begriffe auffindbar', () => {
    const keywords = drainageSizingKeywords(tool)
    expect(keywords).toContain('Badewanne')
    expect(keywords).toContain('DIN 1986-100')
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)
    expect(document?.keywords).toContain('Fallleitung')
    expect(sumDu(tool, { wc6: 2 }, 3)).toBe(12)
  })
})
