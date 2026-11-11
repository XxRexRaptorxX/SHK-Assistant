import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HazmatPoints, type LoadLine } from './HazmatPoints'
import {
  checkHazmatPointsTool,
  hazmatPointsKeywords,
  hazmatPointsToolSchema,
  rulesForLoad,
  summarizeLoad,
  type HazmatPointsTool,
} from './hazmatPointsTool'
import { isHazmatPointsTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.gefahrgut-1000-punkte')
if (!entry || !isHazmatPointsTool(entry)) throw new Error('Gefahrgut-Tool erwartet')
const tool: HazmatPointsTool = entry

const render = (...lines: LoadLine[]) => renderToStaticMarkup(<HazmatPoints tool={tool} initialLines={lines} />)
const ruleKeys = (substances: string[], exempt: boolean) => rulesForLoad(tool, substances, exempt).map((rule) => rule.key)

describe('Gefahrgut: 1000-Punkte-Regel', () => {
  it('ist fehlerfrei und bleibt ungeprüft, bis der Inhaber freigibt', () => {
    expect(checkHazmatPointsTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
  })

  it('ergibt die Punkte der Beispiele aus den Quellen', () => {
    for (const example of tool.examples) {
      expect(summarizeLoad(tool, example.items).total, example.label).toBeCloseTo(example.expected, 9)
    }
  })

  it('rechnet Menge × Faktor der Beförderungskategorie und summiert je Kategorie', () => {
    const summary = summarizeLoad(tool, [
      { substance: 'acetylen', quantity: 20 },
      { substance: 'sauerstoff', quantity: 50 },
      { substance: 'heizoelDiesel', quantity: 20 },
    ])
    expect(summary.positions.map((position) => position.points)).toEqual([60, 50, 20])
    expect(summary.total).toBe(130)
    expect(summary.exempt).toBe(true)
    expect(summary.categories.map((category) => [category.category.category, category.quantities, category.points])).toEqual([
      [2, { kg: 20 }, 60],
      [3, { l: 70 }, 70],
    ])
  })

  it('erlaubt genau 1000 Punkte, aber nicht mehr', () => {
    expect(summarizeLoad(tool, [{ substance: 'sauerstoff', quantity: 1000 }]).exempt).toBe(true)
    const over = summarizeLoad(tool, [{ substance: 'fluessiggas', quantity: 334 }])
    expect(over.total).toBe(1002)
    expect(over.exempt).toBe(false)
    // Kleine Dezimalmengen dürfen durch Rundungsfehler nicht über die Grenze rutschen
    expect(summarizeLoad(tool, Array.from({ length: 10 }, () => ({ substance: 'sauerstoff', quantity: 100 }))).exempt).toBe(true)
  })

  it('zählt Leergut mit 0 Punkten', () => {
    const summary = summarizeLoad(tool, [
      { substance: 'leergut', quantity: 4 },
      { substance: 'r32', quantity: 10 },
    ])
    expect(summary.total).toBe(30)
    expect(summary.categories.find((category) => category.category.category === 4)?.points).toBe(0)
  })

  it('verweigert die Freistellung bei Kategorie 0 unabhängig von den Punkten', () => {
    const withZero: HazmatPointsTool = {
      ...tool,
      substances: [...tool.substances, { ...tool.substances[0]!, key: 'testKategorieNull', name: 'Test', transportCategory: 0 }],
    }
    const summary = summarizeLoad(withZero, [{ substance: 'testKategorieNull', quantity: 1 }])
    expect(summary.hasCategoryZero).toBe(true)
    expect(summary.exempt).toBe(false)
  })

  it('zeigt je nach Grenze und gewählten Stoffen die passenden Vorschriften', () => {
    const within = ruleKeys(['fluessiggas'], true)
    expect(within).toEqual(expect.arrayContaining(['feuerloescher', 'befoerderungspapier', 'ladungssicherung', 'gasflaschen']))
    expect(within).not.toContain('ueberGrenze')
    expect(within).not.toContain('lithium')

    const over = ruleKeys(['fluessiggas'], false)
    expect(over[0]).toBe('ueberGrenze')
    expect(over).not.toContain('feuerloescher')

    expect(ruleKeys(['lithiumAkkus', 'spraydosenEntzuendbar'], true)).toEqual(expect.arrayContaining(['lithium', 'spraydosen']))
    // Kältemittelflaschen bekommen zusätzlich die Hinweise für Pkw und Parken
    expect(ruleKeys(['r32'], true)).toEqual(expect.arrayContaining(['gasflaschen', 'belueftung', 'kaeltemittelflaschen']))
    // Jede Gasflasche bekommt Befestigung und Belüftung
    for (const substance of tool.substances.filter((candidate) => candidate.rules.includes('gasflaschen'))) {
      expect(substance.rules, substance.name).toContain('belueftung')
    }
    expect(ruleKeys(['acetylen'], true)).not.toContain('kaeltemittelflaschen')
    // Jede Vorschrift nur einmal, auch wenn mehrere Gasflaschen gewählt sind
    const gases = ruleKeys(['acetylen', 'sauerstoff', 'stickstoff'], true)
    expect(gases.filter((key) => key === 'gasflaschen')).toHaveLength(1)
  })

  it('führt die typischen Güter mit Kategorie und Zählweise', () => {
    const substance = (key: string) => tool.substances.find((candidate) => candidate.key === key)!
    expect([substance('fluessiggas').un, substance('fluessiggas').transportCategory, substance('fluessiggas').unit]).toEqual(['1965', 2, 'kg'])
    expect([substance('acetylen').un, substance('acetylen').transportCategory]).toEqual(['1001', 2])
    expect([substance('sauerstoff').un, substance('sauerstoff').transportCategory, substance('sauerstoff').unit]).toEqual(['1072', 3, 'l'])
    expect(substance('heizoelDiesel').transportCategory).toBe(3)
    expect(substance('benzin').transportCategory).toBe(2)
    for (const candidate of tool.substances) expect(candidate.source, candidate.name).not.toBe('')
  })

  it('meldet Fehler im Inhalt', () => {
    const broken: HazmatPointsTool = {
      ...tool,
      substances: [
        ...tool.substances,
        { ...tool.substances[0]!, key: 'kaputt', name: 'Kaputt', group: 'fehlt', rules: ['unbekannt', 'ladungssicherung'] },
      ],
      examples: [{ ...tool.examples[0]!, expected: 1 }],
    }
    const issues = checkHazmatPointsTool(broken)
    expect(issues).toEqual(
      expect.arrayContaining([
        'substances (Kaputt): unbekannte Gruppe "fehlt"',
        'substances (Kaputt): unbekannte Vorschrift "unbekannt"',
        'substances (Kaputt): Vorschrift "ladungssicherung" gilt schon allgemein (when "always")',
      ]),
    )
    expect(issues.some((issue) => issue.includes('ergibt 160 Punkte statt 1'))).toBe(true)
    expect(hazmatPointsToolSchema.safeParse({ ...tool, categories: tool.categories.slice(1) }).success).toBe(false)
  })

  it('wird über Stoffnamen und UN-Nummern gefunden', () => {
    const keywords = hazmatPointsKeywords(tool)
    expect(keywords).toEqual(expect.arrayContaining(['Propan / Flüssiggas', 'UN 1001', 'Acetylen, gelöst']))
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    expect(document.keywords).toContain('UN 1965')
  })

  it('zeigt ohne Auswahl nur die Stoffliste', () => {
    const html = render()
    expect(html).toContain('Propan / Flüssiggas')
    expect(html).toContain('aria-pressed="false"')
    expect(html).not.toContain('Punktsumme')
    expect(html).not.toContain('Vorschriften für diese Ladung')
  })

  it('rechnet mehrere gewählte Güter zusammen und zeigt die Vorschriften', () => {
    const html = render(
      { substance: 'fluessiggas', count: '2', size: '11' },
      { substance: 'sauerstoff', count: '1', size: '10' },
      { substance: 'lithiumAkkus', count: '4', size: '0,5' },
    )
    expect(html).toContain('2 × 11 kg = 22 kg × 3 = 66 Punkte')
    expect(html).toContain('1 × 10 l = 10 l × 1 = 10 Punkte')
    expect(html).toContain('4 × 0,5 kg = 2 kg × 3 = 6 Punkte')
    expect(html).toMatch(/82 <span[^>]*>von 1000 Punkten/)
    expect(html).toContain('Freistellung nach ADR 1.1.3.6 möglich. Noch 918 Punkte frei.')
    expect(html).toContain('Für das Beförderungspapier')
    expect(html).toContain('Feuerlöscher mit 2 kg')
    expect(html).toContain('Gasflaschen')
    expect(html).toContain('Lithium-Akkus')
    expect(html).toContain('Handwerkerregelung')
  })

  it('warnt über 1000 Punkten', () => {
    const html = render({ substance: 'fluessiggas', count: '11', size: '33' })
    expect(html).toContain('Über 1000 Punkte: keine Freistellung')
    expect(html).toContain('Über der Grenze: volle ADR-Pflichten')
    expect(html).not.toContain('Feuerlöscher mit 2 kg')
  })

  it('meldet ungültige Eingaben und lässt sie nicht mitzählen', () => {
    const html = render({ substance: 'acetylen', count: '1,5', size: '8' }, { substance: 'sauerstoff', count: '1', size: '50' })
    expect(html).toContain('Ganze Zahl ab 1 eingeben')
    expect(html).toContain('Unvollständige Positionen zählen noch nicht mit.')
    expect(html).toMatch(/50 <span[^>]*>von 1000 Punkten/)
  })
})
