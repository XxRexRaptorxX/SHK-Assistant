import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FallProtectionLookup } from './FallProtectionLookup'
import {
  bandFor,
  checkFallProtectionTool,
  fallProtectionToolSchema,
  measuresByRank,
  needsHeight,
  type FallProtectionTool,
} from './fallProtectionTool'
import { isFallProtectionTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.absturzsicherung')
if (!entry || !isFallProtectionTool(entry)) throw new Error('Absturzsicherungs-Tool erwartet')
const tool: FallProtectionTool = entry
const situation = (key: string) => tool.situations.find((candidate) => candidate.key === key)!

const render = (props: { situation?: string; height?: string } = {}) =>
  renderToStaticMarkup(<FallProtectionLookup tool={tool} initialSituation={props.situation} initialHeight={props.height} />)

describe('Absturzsicherung', () => {
  it('ist fehlerfrei, öffentlich und noch ungeprüft', () => {
    expect(checkFallProtectionTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.visibility).toBe('public')
  })

  it('trifft die Grenzen der DGUV Vorschrift 38 genau: bis einschließlich, darüber nicht', () => {
    expect(bandFor(situation('workplace'), 2)?.tone).toBe('ok')
    expect(bandFor(situation('workplace'), 2.01)?.tone).toBe('required')
    expect(bandFor(situation('stairs'), 1)?.tone).toBe('ok')
    expect(bandFor(situation('stairs'), 1.01)?.tone).toBe('required')
    expect(bandFor(situation('flatRoof'), 3)?.tone).toBe('limited')
    expect(bandFor(situation('flatRoof'), 3.01)?.tone).toBe('required')
    expect(bandFor(situation('ladder'), 5)?.tone).toBe('limited')
    expect(bandFor(situation('ladder'), 5.01)?.tone).toBe('forbidden')
  })

  it('fragt bei Wasser, Öffnungen und Gerüst keine Höhe ab', () => {
    for (const key of ['water', 'opening', 'scaffold']) {
      expect(needsHeight(situation(key))).toBe(false)
      expect(bandFor(situation(key), undefined)?.tone).toBe('required')
    }
    expect(bandFor(situation('workplace'), undefined)).toBeUndefined()
  })

  it('zeigt Maßnahmen in der Rangfolge: Absturzsicherung vor Auffangeinrichtung vor PSA', () => {
    const ranks = measuresByRank(tool, situation('workplace')).map((group) => group.rank.key)
    expect(ranks).toEqual(['protection', 'catching', 'personal'])
    const roof = measuresByRank(tool, situation('pitchedRoof')).flatMap((group) => group.measures.map((measure) => measure.key))
    expect(roof.slice(0, 2)).toEqual(['roofGuard', 'roofCatch'])
  })

  it('markiert fehlende Angaben als TODO und erlaubt dann kein verified', () => {
    const open = tool.measures.filter((measure) => measure.todo)
    expect(open.map((measure) => measure.key)).toEqual(['cover'])
    const verified = fallProtectionToolSchema.parse({ ...tool, status: 'verified', verifiedBy: 'XX', verifiedAt: '2026-11-24' })
    expect(checkFallProtectionTool(verified)).toContain('measures (cover): todo bei verified nicht erlaubt')
  })

  it('erkennt Lücken in den Höhenbereichen', () => {
    const broken = structuredClone(tool)
    broken.situations[0]!.bands[1]!.above = 2.5
    expect(checkFallProtectionTool(broken)).toContain(
      'situations (workplace), bands[1]: above muss upTo des Bereichs davor sein',
    )
  })

  it('erkennt unbekannte Quellen und Maßnahmen', () => {
    const broken = structuredClone(tool)
    broken.situations[0]!.measures.push('gibtsNicht')
    broken.ranks[0]!.ref.source = 'fremd'
    const issues = checkFallProtectionTool(broken)
    expect(issues).toContain('situations (workplace): unbekannte Maßnahme "gibtsNicht"')
    expect(issues).toContain('ranks (protection): unbekannte Quelle "fremd"')
  })

  it('zeigt ohne Auswahl nur die Arbeitsplätze', () => {
    const html = render()
    expect(html).toContain('Wo wird gearbeitet?')
    expect(html).toContain('Arbeitsplatz wählen.')
    expect(html).not.toContain('Schutzmaßnahmen in dieser Rangfolge')
  })

  it('zeigt Ergebnis, Fundstelle und Maße für einen Deckenrand mit 3 m', () => {
    const html = render({ situation: 'workplace', height: '3' })
    expect(html).toContain('Absturzsicherung erforderlich')
    expect(html).toContain('DGUV Vorschrift 38, § 9 Abs. 2 Nr. 3, S. 12')
    expect(html).toContain('Seitenschutz am Gerüst')
    expect(html).toContain('je ≤ 0,47 m')
    expect(html).toContain('Oberkante ≥ 0,15 m, Dicke ≥ 3,0 cm')
    expect(html).not.toContain('unvollständig')
    // Abdeckungen fehlen noch: dort erscheint der Hinweis
    expect(render({ situation: 'opening' })).toContain('unvollständig')
  })

  it('bietet am Flachdach die Randsicherung mit ihren Maßen an', () => {
    const html = render({ situation: 'flatRoof', height: '4' })
    expect(html).toContain('Randsicherung (Netz an Pfosten)')
    expect(html).toContain('≤ 10,0 m')
    expect(html).toContain('DGUV Information 201-023, Abschn. 4.7.1')
  })

  it('fordert die Höhe an, solange keine eingegeben ist', () => {
    const html = render({ situation: 'ladder' })
    expect(html).toContain('Standhöhe auf der Leiter eingeben.')
  })

  it('meldet ungültige Eingaben', () => {
    expect(render({ situation: 'workplace', height: 'abc' })).toContain('Zahl ab 0 eingeben')
  })

  it('ist über Begriffe aus der Praxis auffindbar', () => {
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    for (const keyword of ['Dachfanggerüst', 'Sicherheitsgeländer', 'Schutznetz', 'Lastklasse', 'PSAgA']) {
      expect(document.keywords).toContain(keyword)
    }
  })
})
