import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { isWireColorTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'
import { WireColorLookup } from './WireColorLookup'
import { assignmentsFor, cablesForSystem, checkWireColorTool, coresKey, WIRE_COLORS, wireColorToolSchema, type WireColorTool } from './wireColorTool'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.aderfarben')
if (!entry || !isWireColorTool(entry)) throw new Error('Aderfarben-Tool erwartet')
const tool: WireColorTool = entry

/** Farbe → Nutzung, in der Reihenfolge der Anzeige */
const wires = (system: string, cable: string, cores: string) => {
  const found = assignmentsFor(tool, system, cable).find((assignment) => coresKey(assignment) === cores)
  if (!found) throw new Error(`Keine Belegung für ${system}, ${cable}, ${cores}`)
  return found.wires.map((wire) => [wire.color, wire.use])
}
const render = (system: string, cable = '', cores = '') =>
  renderToStaticMarkup(<WireColorLookup tool={tool} initialSystem={system} initialCable={cable} initialCores={cores} />)

describe('Aderfarben', () => {
  it('ist fehlerfrei und bleibt ungeprüft, bis der Inhaber freigibt', () => {
    expect(checkWireColorTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
  })

  it('zeigt NYM-J 3-adrig bei Wechselstrom wie in DIN VDE 0293-308', () => {
    expect(wires('wechselstrom', 'nymJ', '3')).toEqual([
      ['gruenGelb', 'Schutzleiter (PE)'],
      ['blau', 'Neutralleiter (N)'],
      ['braun', 'Außenleiter (L)'],
    ])
  })

  it('nennt Schwarz bei 230 V als häufigen Schaltdraht, bei Starkstrom nicht', () => {
    const black = (system: string) =>
      tool.assignments
        .filter((assignment) => assignment.system === system)
        .flatMap((assignment) => assignment.wires.filter((wire) => wire.color === 'schwarz' && !wire.use.startsWith('Alle')))
    expect(black('wechselstrom').length).toBeGreaterThan(0)
    for (const wire of black('wechselstrom')) expect(wire.note).toBe('Oft als Schaltdraht genutzt.')
    for (const wire of black('drehstrom')) expect(wire.note).not.toContain('Schaltdraht')
    const html = render('wechselstrom', 'nymJ', '5')
    expect(html).toContain('Oft als Schaltdraht genutzt.')
    expect(html).toContain('Schaltdraht: Angabe des Inhabers')
  })

  it('ordnet bei Starkstrom L1 bis L3 nach der ZVEH-Empfehlung zu und sagt, dass es eine Empfehlung ist', () => {
    expect(wires('drehstrom', 'nymJ', '5')).toEqual([
      ['gruenGelb', 'Schutzleiter (PE)'],
      ['blau', 'Neutralleiter (N)'],
      ['braun', 'Außenleiter L1'],
      ['schwarz', 'Außenleiter L2'],
      ['grau', 'Außenleiter L3'],
    ])
    expect(wires('drehstrom', 'nymJ', '4 ohne N').map(([color]) => color)).toEqual(['gruenGelb', 'braun', 'schwarz', 'grau'])
    const html = render('drehstrom', 'nymJ', '5')
    expect(html).toContain('L1 bis L3: Empfehlung des ZVEH')
    expect(html).toContain('Die Norm legt L1, L2 und L3 auf keine Farbe fest.')
    expect(html).toContain('Belegung: de 5/2015')
  })

  it('nennt jede Zuordnung zu L1, L2 oder L3 als Empfehlung', () => {
    for (const assignment of tool.assignments.filter((item) => item.wires.some((wire) => /L1/.test(wire.use)))) {
      expect(assignment.wires.find((wire) => /L1/.test(wire.use))!.note).toContain('Empfehlung des ZVEH')
    }
  })

  it('zeigt bei Adern mit Ziffern und bei Leitungen ohne Schutzleiter die eigene Belegung', () => {
    expect(wires('drehstrom', 'nymJ', '6+')[1]).toEqual(['schwarz', 'Alle übrigen Adern, mit Zahlenaufdruck'])
    expect(wires('drehstrom', 'nymO', '3').map(([color]) => color)).toEqual(['braun', 'schwarz', 'grau'])
    // Grün-Gelb gibt es bei O-Leitungen nie
    for (const assignment of tool.assignments.filter((item) => item.cables.includes('nymO'))) {
      expect(assignment.wires.map((wire) => wire.color)).not.toContain('gruenGelb')
    }
  })

  it('bietet bei Gleichstrom nur belegte Kabeltypen an, nicht NYM-J', () => {
    expect(cablesForSystem(tool, 'gleichstrom').map((cable) => cable.name)).toEqual(['H07V-K', 'H07V-U', 'H1Z2Z2-K'])
    expect(wires('gleichstrom', 'h07vK', 'Einzeln')).toEqual([
      ['rot', 'Positiver Außenleiter (L+)'],
      ['weiss', 'Negativer Außenleiter (L−)'],
    ])
    const html = render('gleichstrom')
    expect(html).not.toContain('value="nymJ"')
    expect(html).toContain('Für mehradrige Leitungen wie NYM-J')
  })

  it('führt durch die Auswahl: Kabeltyp, dann Aderzahl, bei nur einer Option direkt die Belegung', () => {
    expect(render('wechselstrom')).toContain('Kabeltyp wählen.')
    const noCores = render('wechselstrom', 'nymJ')
    expect(noCores).toContain('Aderzahl wählen.')
    expect(noCores).toContain('aria-label="Aderzahl"')
    // Nur eine Aderzahl: keine Leiste, Belegung sofort
    const single = render('gleichstrom', 'h1z2z2K')
    expect(single).not.toContain('aria-label="Aderzahl"')
    expect(single).toContain('Plus')
    // Kabeltyp passt nicht zum System: Auswahl gilt als leer
    expect(render('gleichstrom', 'nymJ', '3')).toContain('Kabeltyp wählen.')
  })

  it('zeigt Farbname und Farbfeld, damit es auch ohne Farbensehen lesbar ist', () => {
    const html = render('wechselstrom', 'nymJ', '3')
    expect(html).toContain('Grün-Gelb')
    expect(html).toContain('Neutralleiter (N)')
    expect(html).toContain('aria-hidden="true"')
    expect(html).toContain('background:#2271b3')
    expect(Object.keys(WIRE_COLORS)).toHaveLength(11)
  })

  it('zeigt alle fünf Systeme in zwei Zeilen', () => {
    expect(tool.systems.map((system) => system.label)).toEqual([
      'Wechselstrom',
      'Starkstrom',
      'Gleichstrom',
      'Kleinspannung',
      'Altanlage',
    ])
    const html = render('wechselstrom')
    expect(html).toContain('flex-wrap')
    expect(html).toContain('basis-[30%]')
  })

  it('warnt bei Altanlagen und zeigt den alten Farbcode', () => {
    const html = render('altanlage')
    expect(html).toContain('role="note"')
    expect(html).toContain('Alte Farben belegen die Funktion nicht.')
    expect(render('wechselstrom')).not.toContain('Alte Farben belegen')
    expect(wires('altanlage', 'nymJ', '3').map(([color]) => color)).toEqual(['gruenGelb', 'schwarz', 'blau'])
    expect(wires('altanlage', 'nymJ', '5').map(([color]) => color)).toEqual(['gruenGelb', 'schwarz', 'blau', 'braun', 'schwarz'])
    expect(wires('altanlage', 'nymhy', '3').map(([color]) => color)).toEqual(['gruenGelb', 'braun', 'blau'])
    expect(wires('altanlage', 'nymO', '2').map(([color]) => color)).toEqual(['schwarz', 'blau'])
    // Vor 1965: Rot ist ausdrücklich nicht sicher der Schutzleiter
    const before1965 = render('altanlage', 'unbekannt')
    expect(before1965).toContain('Früherer Schutzleiter')
    expect(before1965).toContain('Kann auch ein geschalteter Draht')
    expect(before1965).toContain('Früherer Neutralleiter (PEN)')
    expect(render('altanlage', 'nya')).toContain('aria-label="Aderzahl"')
    expect(render('altanlage', 'nya', 'Einzeln vor 1965')).toContain('Früherer Schutzleiter')
    expect(render('altanlage', 'nya', 'Einzeln ab 1965')).toContain('Grau als Außenleiter kam erst 2003 dazu.')
  })

  it('nennt alte Typen mit ihrem heutigen Namen', () => {
    const names = cablesForSystem(tool, 'altanlage').map((cable) => cable.name)
    for (const name of ['NYA (heute H07V-U)', 'NYAF (heute H07V-K)', 'NYMHY (heute H05VV-F)', 'NMH (heute H05RN-F)', 'NMHöu (heute H07RN-F)', 'NLH (heute H05RR-F)']) {
      expect(names).toContain(name)
    }
  })

  it('führt die Stegleitung in heutigen und alten Farben, mit Hinweis zur Verlegung', () => {
    expect(wires('wechselstrom', 'nyifJ', '3')).toEqual(wires('wechselstrom', 'nymJ', '3'))
    expect(wires('altanlage', 'nyifJ', '3').map(([color]) => color)).toEqual(['gruenGelb', 'schwarz', 'blau'])
    const html = render('wechselstrom', 'nyifJ')
    expect(html).toContain('NYIF-J (Stegleitung)')
    expect(html).toContain('Flachkabel: nur im oder unter Putz in trockenen Räumen')
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.aderfarben')!
    expect(doc.keywords).toContain('Flachkabel')
  })

  it('zeigt bei Kleinspannung die Aderfolge und keine Funktion', () => {
    expect(cablesForSystem(tool, 'kleinspannung').map((cable) => cable.name)).toEqual(['LiYCY', 'J-Y(St)Y'])
    expect(wires('kleinspannung', 'liycy', 'Bis 10').map(([color]) => color)).toEqual([
      'weiss',
      'braun',
      'gruen',
      'gelb',
      'grau',
      'rosa',
      'blau',
      'rot',
      'schwarz',
      'violett',
    ])
    expect(wires('kleinspannung', 'jyStY', '2 Paare').map(([color]) => color)).toEqual(['rot', 'schwarz', 'weiss', 'gelb'])
    const uses = tool.assignments.filter((item) => item.system === 'kleinspannung').flatMap((item) => item.wires.map((wire) => wire.use))
    for (const use of uses) expect(use).not.toMatch(/Neutral|Schutz|Außenleiter|Plus|Minus/)
    const html = render('kleinspannung', 'liycy')
    expect(html).toContain('sagen nichts über die Funktion')
    expect(html).not.toContain('aria-label="Aderzahl"')
    expect(render('kleinspannung', 'jyStY')).toContain('Nicht für Starkstromanwendungen')
  })

  it('meldet Fehler im Inhalt', () => {
    const first = tool.assignments[0]!
    const broken: WireColorTool = {
      ...tool,
      assignments: [
        { ...first, system: 'gibtEsNicht', cables: ['gibtEsAuchNicht'], cores: '3' },
        { ...first, cables: [first.cables[0]!] },
        { ...first, cables: [first.cables[0]!] },
      ],
    }
    const issues = checkWireColorTool(broken).join(' | ')
    expect(issues).toContain('unbekanntes System')
    expect(issues).toContain('unbekannter Kabeltyp "gibtEsAuchNicht"')
    expect(issues).toContain('2 Adern eingetragen')
    expect(issues).toContain('doppelt belegt')
    expect(issues).toContain('keine Belegung')
    expect(wireColorToolSchema.safeParse({ ...tool, systems: tool.systems.slice(0, 1) }).success).toBe(false)
    const badColor = { ...first, wires: [{ color: 'lila', use: 'x' }] }
    expect(wireColorToolSchema.safeParse({ ...tool, assignments: [badColor] }).success).toBe(false)
  })

  it('zeigt Quelle und Prüfstand auf der Tool-Seite', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/aderfarben']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Aderfarben')
    expect(html).toContain('noch nicht geprüft')
    expect(html).toContain('de 5/2015')
  })

  it('ist über die globale Suche auffindbar', () => {
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.aderfarben')!
    for (const keyword of ['Starkstrom', 'NYM-J', 'Neutralleiter (N)', 'Schutzleiter (PE)']) expect(doc.keywords).toContain(keyword)
  })
})
