import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { FLUE_LAYOUTS, FlueDiagram } from './FlueDiagram'
import { FlueTypeLookup } from './FlueTypeLookup'
import { allTypeCodes, checkFlueTypeTool, flueTypeToolSchema, formatType, lookupType, narrow, parseType, type FlueTypeTool } from './flueTypeTool'
import { isFlueTypeTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.abgasanlagen-arten')
if (!entry || !isFlueTypeTool(entry)) throw new Error('Abgas-Arten-Tool erwartet')
const tool: FlueTypeTool = entry

/** Art aus einer Eingabe, wie sie die Anzeige zeigt */
const shown = (input: string) => {
  const result = lookupType(tool, input)
  return result.group && result.errors.length === 0 ? formatType(result.group, result.digit, result.suffixes) : undefined
}
const findType = (answers: Record<string, string>) => {
  const { candidates } = narrow(tool, answers)
  return candidates.length === 1 ? candidates[0]!.code : candidates.map((group) => group.code)
}
const renderType = (query: string) => renderToStaticMarkup(<FlueTypeLookup tool={tool} initialMode="type" initialQuery={query} />)

describe('Abgasanlagen Arten', () => {
  it('ist fehlerfrei und bleibt ungeprüft, bis der Inhaber freigibt', () => {
    expect(checkFlueTypeTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
  })

  it('enthält genau die Arten aus DIN EN 1749:2020, Abschnitt 4', () => {
    const c = (first: string, digits: string) => [...digits].map((digit) => `C${first}${digit}`)
    expect(allTypeCodes(tool)).toEqual([
      'A1', 'A2', 'A3',
      'B11', 'B12', 'B13', 'B14',
      'B21', 'B22', 'B23',
      'B32', 'B33',
      'B41', 'B42', 'B43', 'B44',
      'B51', 'B52', 'B53',
      ...['1', '2', '3', '4', '5', '6', '7', '8', '9'].flatMap((first) => c(first, '123')),
      ...c('(10)', '23'), ...c('(11)', '23'), ...c('(12)', '23'), ...c('(13)', '23'), ...c('(14)', '23'),
      ...c('(15)', '123'),
    ])
  })

  it('liest Arten in üblichen Schreibweisen', () => {
    expect(shown('C33x')).toBe('C33x')
    expect(shown('c 33 X')).toBe('C33x')
    expect(shown('C(10)3')).toBe('C(10)3')
    expect(shown('C103')).toBe('C(10)3')
    expect(shown('C151')).toBe('C(15)1')
    expect(shown('B11BS')).toBe('B11BS')
    expect(shown('b23p')).toBe('B23P')
    expect(shown('B22D')).toBe('B22D')
    expect(shown('C13R')).toBe('C13R')
    expect(shown('A1AS')).toBe('A1AS')
    expect(parseType(tool, 'C3')).toEqual({ code: 'C3', digit: undefined, suffixes: [], rest: '' })
  })

  it('meldet Arten, die es nicht gibt', () => {
    expect(lookupType(tool, 'B31').errors[0]).toBe('B31 gibt es nicht. Bei B3 sind möglich: B32, B33.')
    expect(lookupType(tool, 'C(10)1').errors).toHaveLength(1)
    expect(lookupType(tool, 'C(16)3').errors).toEqual(['Die Art C(16) gibt es nach DIN EN 1749 nicht.'])
    expect(lookupType(tool, 'D3').errors).toHaveLength(1)
    expect(lookupType(tool, 'C33q').errors).toEqual(['Den Zusatz „q“ kennt das Tool nicht.'])
  })

  it('warnt bei einem Zusatz, den die Quellen für die Art nicht nennen', () => {
    expect(lookupType(tool, 'C(10)3x').warnings).toEqual(['Den Zusatz x nennen die Quellen bei C(10)3 nicht.'])
    expect(lookupType(tool, 'C31x').warnings).toHaveLength(1)
    expect(lookupType(tool, 'B23P').warnings).toEqual([])
  })

  it('findet die Art aus der Einbausituation', () => {
    expect(findType({ basis: 'c', cFlue: 'vertical', cAir: 'sameTerminal' })).toBe('C3')
    expect(findType({ basis: 'c', cFlue: 'vertical', cAir: 'existingShaft' })).toBe('C9')
    expect(findType({ basis: 'c', cFlue: 'naturalDraught', cAir: 'ownDuct' })).toBe('C8')
    expect(findType({ basis: 'c', cFlue: 'positivePressure', cAir: 'commonDuct' })).toBe('C(10)')
    expect(findType({ basis: 'b', bConnection: 'separate', diverter: 'yes' })).toBe('B1')
    expect(findType({ basis: 'b', bConnection: 'concentric' })).toBe('B3')
    expect(findType({ basis: 'a' })).toBe('A')
    // Ohne weitere Antwort bleibt die Auswahl offen und die nächste Frage erscheint
    const { steps } = narrow(tool, { basis: 'c' })
    expect(steps.map((step) => step.question.key)).toEqual(['basis', 'cFlue'])
  })

  it('zeigt zu C33x Merkmale, Gebläse, Zusatz und Einbaukriterien mit Quelle', () => {
    const html = renderType('C33x')
    expect(html).toContain('C33x')
    expect(html).toContain('Senkrecht über Dach')
    expect(html).toContain('Gebläse vor dem Brenner')
    expect(html).toContain('erhöhte Dichtheitsanforderungen')
    expect(html).toContain('Dachgeschoss')
    expect(html).toContain('DIN 18160')
    // Mit x entfällt der Hinweis zur Lüftungsöffnung
    expect(html).not.toContain('150 cm²')
  })

  it('nennt bei C-Geräten mit Gebläse ohne x die Lüftungsöffnung', () => {
    expect(renderType('C33')).toContain('150 cm²')
    expect(renderType('C31')).not.toContain('150 cm²')
  })

  it('markiert veraltete Arten', () => {
    expect(renderType('C23')).toContain('Veraltet')
    expect(renderType('C73')).toContain('Musterfeuerungsverordnung')
  })

  it('beginnt im Modus Einbausituation mit der ersten Frage', () => {
    const html = renderToStaticMarkup(<FlueTypeLookup tool={tool} />)
    expect(html).toContain('Verbrennungsluft und Abgas')
    expect(html).toContain('Raumluftunabhängig')
    expect(html).toContain('Einbausituation wählen.')
  })

  it('prüft beim Build unbekannte Merkmale und nicht eindeutige Arten', () => {
    const broken = flueTypeToolSchema.parse({
      ...tool,
      groups: tool.groups.map((group) =>
        group.code === 'C9' ? { ...group, criteria: { ...group.criteria, cAir: 'sameTerminal' } } : group,
      ),
      suffixes: [...tool.suffixes.slice(1), { ...tool.suffixes[0]!, allowed: ['C99'] }],
    })
    const issues = checkFlueTypeTool(broken)
    expect(issues).toContain('groups (C3): über die Fragen nicht eindeutig erreichbar (C3, C9)')
    expect(issues).toContain('suffixes (x): unbekannte Art "C99"')
    expect(issues).toContain('questions (cAir): Option "existingShaft" hat keine Art')
  })

  it('hat für jede Grundart ein Schema', () => {
    expect(Object.keys(FLUE_LAYOUTS).sort()).toEqual(tool.groups.map((group) => group.code).sort())
    for (const group of tool.groups) {
      for (const fan of group.fans) {
        const html = renderToStaticMarkup(<FlueDiagram code={group.code} digit={fan.digit} title={`${group.code}${fan.digit}`} />)
        expect(html, `${group.code}${fan.digit}`).toContain(`aria-label="Schema ${group.code}${fan.digit}"`)
      }
    }
  })

  it('zeichnet das Gebläse nur, wenn die letzte Ziffer eines nennt', () => {
    const fans = (code: string, digit: string) =>
      renderToStaticMarkup(<FlueDiagram code={code} digit={digit} title="x" />).split('aria-label="Gebläse"').length - 1
    expect(fans('B1', '1')).toBe(0)
    expect(fans('B1', '2')).toBe(1)
    expect(fans('B1', '4')).toBe(1)
    expect(fans('C3', '3')).toBe(1)
    // Modulgerät: ein Gebläse je Modul
    expect(fans('C(11)', '2')).toBe(3)
  })

  it('zeichnet die Strömungssicherung genau bei B1, B4 und C7', () => {
    const withDiverter = tool.groups
      .filter((group) =>
        renderToStaticMarkup(<FlueDiagram code={group.code} digit={group.fans[0]!.digit} title="x" />).includes('aria-label="Strömungssicherung"'),
      )
      .map((group) => group.code)
    expect(withDiverter).toEqual(['B1', 'B4', 'C7'])
  })

  it('zeigt Zuluft bei B und Lüftung bei A, nie bei C', () => {
    const vent = (query: string) => renderType(query).match(/aria-label="(Zuluft|Lüftung)"/)?.[1]
    expect(vent('B23')).toBe('Zuluft')
    expect(vent('B11BS')).toBe('Zuluft')
    expect(vent('A1')).toBe('Lüftung')
    // Zwei Geschosse: je Geschoss eine Öffnung
    expect(renderType('B33').split('aria-label="Zuluft"').length - 1).toBe(2)
    for (const query of ['C53', 'C53x', 'C31', 'C43', 'C(10)3']) expect(vent(query), query).toBeUndefined()
    // Rauminhalt als Alternative zur Öffnung, Schutzziel 1 nur mit Strömungssicherung
    expect(renderType('B23')).toContain('4 m³ Raum je kW Nennleistung')
    expect(renderType('B11')).toContain('Schutzziel 1')
    expect(renderType('B23')).not.toContain('Schutzziel 1')
    expect(renderType('A1')).toContain('mehr als 15 m³')
  })

  it('weist auf Arten hin, die in Deutschland nicht zulässig oder nur als Ausnahme möglich sind', () => {
    const restricted = tool.groups.filter((group) => group.germany).map((group) => [group.code, group.germany!.status])
    expect(restricted).toEqual([
      ['C2', 'notPermitted'],
      ['C7', 'exceptionOnly'],
    ])
    expect(renderType('C23')).toContain('In Deutschland nicht zulässig')
    expect(renderType('C23')).toContain('DVGW-Arbeitsblatt G 627')
    expect(renderType('C73')).toContain('In Deutschland nur als baurechtliche Ausnahme')
    expect(renderType('C33')).not.toContain('⚠ In Deutschland')
    // Liste aller Arten markiert die eingeschränkten, die übrigen nicht
    const list = renderType('')
    expect(list).toContain('aria-label="C21, In Deutschland nicht zulässig"')
    expect(list).toContain('aria-label="C73, In Deutschland nur als baurechtliche Ausnahme"')
    expect(list.match(/aria-label="C\S+, In Deutschland/g)).toHaveLength(6)
  })

  it('bietet bei C3 zwei Ausführungen wie im WOLF-Abgasschema und zeichnet C5 als Außenkamin', () => {
    expect(FLUE_LAYOUTS.C3!.map((variant) => variant.label)).toEqual(['Über Dach', 'Im Schacht'])
    const roof = renderToStaticMarkup(<FlueDiagram code="C3" digit="3" title="C33x" />)
    const shaft = renderToStaticMarkup(<FlueDiagram code="C3" digit="3" title="C33x" initialVariant={1} />)
    expect(roof).toContain('aria-label="Ausführung"')
    expect(roof).toContain('Mündung über Dach')
    expect(shaft).toContain('Leitungsführung')
    expect(shaft).not.toContain('Mündung über Dach')
    // Nur eine Ausführung: kein Umschalter
    expect(renderToStaticMarkup(<FlueDiagram code="C9" digit="3" title="C93" />)).not.toContain('aria-label="Ausführung"')
    expect(renderToStaticMarkup(<FlueDiagram code="C5" digit="3" title="C53x" />)).toContain('Abgasleitung außen an der Fassade')
  })

  it('zeigt unter dem Ergebnis die allgemeinen Abgasvorschriften mit Quelle', () => {
    for (const html of [renderType('C33x'), renderToStaticMarkup(<FlueTypeLookup tool={tool} />)]) {
      expect(html).toContain('Allgemeine Abgasvorschriften')
      expect(html).toContain('First um mindestens 40 cm')
      expect(html).toContain('11 kW zur Raumheizung')
      expect(html).toContain('BayFeuV § 9 Abs. 2')
    }
  })

  it('zeigt das Schema im Ergebnis', () => {
    expect(renderType('C93x')).toContain('aria-label="Schema C93x"')
    expect(renderType('C93x')).toContain('vorhandener Schacht als')
  })

  it('erscheint als Tool-Seite und in der Suche', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/abgasanlagen-arten']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Abgasanlagen Arten')
    expect(html).toContain('noch nicht geprüft')
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.abgasanlagen-arten')!
    for (const keyword of ['C33', 'C(10)3', 'B11', 'raumluftunabhängig']) expect(doc.keywords).toContain(keyword)
  })
})
