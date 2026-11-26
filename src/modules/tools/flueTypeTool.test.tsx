import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
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
