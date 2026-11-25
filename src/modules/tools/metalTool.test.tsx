import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { MetalLookup } from './MetalLookup'
import { checkMetalTool, metalsByGroup, metalToolSchema, selectedPairs, type MetalTool } from './metalTool'
import { isMetalTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.metalle')
if (!entry || !isMetalTool(entry)) throw new Error('Metall-Tool erwartet')
const tool: MetalTool = entry

// Testdaten, keine Fachinhalte
const sample = metalToolSchema.parse({
  id: 'tool.test',
  visibility: 'internal',
  status: 'draft',
  source: 'Test',
  verifiedBy: '',
  verifiedAt: '',
  kind: 'metals',
  title: 'Test',
  summary: 'Test',
  description: 'Test',
  tags: ['heizung'],
  metals: [
    { key: 'a', name: 'Alpha', group: 'noble', potential: 0.5, potentialNote: 'Test', source: 'Test' },
    { key: 'b', name: 'Beta', group: 'base', potential: -1, potentialNote: 'Test', source: 'Test' },
    { key: 'c', name: 'Gamma', group: 'noble', potential: 1, potentialNote: 'Test', source: 'Test' },
    { key: 'd', name: 'Delta', note: 'TODO: Inhalt fehlt' },
  ],
  pairs: [
    {
      metals: ['b', 'a'],
      rating: 'avoid',
      corrodes: 'b',
      text: 'Testreaktion',
      source: 'Testquelle',
      flow: { first: 'b', text: 'Testfluss', source: 'Q' },
      ions: { text: 'Testionen', source: 'Q' },
    },
  ],
  ionExchange: { text: 'Testmechanismus', source: 'Q' },
  derivation: {
    anode: { text: 'Anodenregel', source: 'QA' },
    flow: { text: 'Flussregel', source: 'QF' },
    caveat: { text: 'Grenze', source: 'QC' },
  },
})

const withBlocked = metalToolSchema.parse({
  ...sample,
  metals: [...sample.metals, { key: 'e', name: 'Epsilon', group: 'base', potential: -2, potentialNote: 'T', source: 'T', noDerivation: { text: 'Passiv', source: 'QP' } }],
})

describe('Edle und unedle Metalle', () => {
  it('Inhalt ist fehlerfrei und in der Suche', () => {
    expect(checkMetalTool(tool)).toEqual([])
    const doc = toolSearchDocuments().find((candidate) => candidate.id === 'tool.metalle')
    expect(doc?.keywords).toContain('Kupfer')
  })

  it('ordnet nach Gruppe, edelstes zuerst', () => {
    const groups = metalsByGroup(sample)
    expect(groups.noble.map((m) => m.key)).toEqual(['c', 'a'])
    expect(groups.base.map((m) => m.key)).toEqual(['b'])
    expect(groups.unknown.map((m) => m.key)).toEqual(['d'])
  })

  it('findet Paare unabhängig von der Reihenfolge', () => {
    const pairs = selectedPairs(sample, ['a', 'b', 'd'])
    expect(pairs.map((p) => `${p.a.key}${p.b.key}:${p.pair?.rating ?? '-'}`)).toEqual(['ab:avoid', 'ad:-', 'bd:-'])
  })

  it('zeigt Reaktion mit Quelle und markiert fehlende Angaben', () => {
    const html = renderToStaticMarkup(<MetalLookup tool={sample} initialSelected={['a', 'b', 'd']} />)
    expect(html).toContain('Vermeiden')
    expect(html).toContain('Angegriffen wird: Beta (Anode')
    expect(html).toContain('geschützt: Alpha (Kathode)')
    expect(html).toContain('Zuerst Beta → dann Alpha.')
    expect(html).toContain('Testionen')
    expect(html).toContain('Testmechanismus')
    expect(html).toContain('Testquelle')
    expect(html).toContain('Bewertung: TODO: Inhalt fehlt, keine belegte Angabe')
    expect(html).toContain('Edle Metalle')
  })

  it('leitet ohne Quelle zum Paar Anode und Fließrichtung aus dem Potential ab, aber keine Bewertung', () => {
    const [result] = selectedPairs(sample, ['c', 'a'])
    expect(result!.pair).toBeUndefined()
    expect(result!.derivedLessNoble?.key).toBe('a')
    const html = renderToStaticMarkup(<MetalLookup tool={sample} initialSelected={['c', 'a']} />)
    expect(html).toContain('Abgeleitet')
    expect(html).toContain('Angegriffen wird: Alpha (Anode) · geschützt: Gamma (Kathode).')
    expect(html).toContain('Zuerst Alpha → dann Gamma.')
    expect(html).toContain('Flussregel')
    expect(html).toContain('Grenze')
    expect(html).toContain('Bewertung: TODO: Inhalt fehlt')
    expect(html).not.toContain('Vermeiden')
  })

  it('Quelle zum Paar geht vor der Ableitung', () => {
    const html = renderToStaticMarkup(<MetalLookup tool={sample} initialSelected={['a', 'b']} />)
    expect(html).not.toContain('Abgeleitet')
  })

  it('leitet nicht ab bei gesperrtem Metall oder fehlendem Potential', () => {
    const [blocked] = selectedPairs(withBlocked, ['e', 'a'])
    expect(blocked!.derivedLessNoble).toBeUndefined()
    expect(blocked!.derivationBlocked?.metal.key).toBe('e')
    const html = renderToStaticMarkup(<MetalLookup tool={withBlocked} initialSelected={['e', 'a']} />)
    expect(html).toContain('Nicht aus der Spannungsreihe ableitbar (Epsilon)')
    expect(selectedPairs(sample, ['a', 'd'])[0]!.derivedLessNoble).toBeUndefined()
    expect(selectedPairs({ ...sample, derivation: undefined }, ['c', 'a'])[0]!.derivedLessNoble).toBeUndefined()
  })

  it('leitet ohne Potentiale aus der Einteilung edel/unedel ab', () => {
    const grouped = metalToolSchema.parse({
      ...sample,
      metals: [...sample.metals, { key: 'f', name: 'Phi', group: 'noble', source: 'T' }, { key: 'g', name: 'Gamma2', group: 'base', source: 'T' }],
    })
    expect(selectedPairs(grouped, ['f', 'g'])[0]!.derivedLessNoble?.key).toBe('g')
    expect(selectedPairs(tool, ['messing', 'stahl'])[0]!.derivedLessNoble?.key).toBe('stahl')
  })

  it('praktisches Potential geht vor; überlappende Bereiche werden nicht abgeleitet', () => {
    const lessNoble = (a: string, b: string) => selectedPairs(tool, [a, b])[0]!.derivedLessNoble?.key
    expect(lessNoble('messing', 'rotguss')).toBe('messing')
    expect(lessNoble('stahl', 'verzinkterStahl')).toBe('verzinkterStahl')
    expect(lessNoble('kupfer', 'edelstahl')).toBeUndefined()
    const html = renderToStaticMarkup(<MetalLookup tool={tool} />)
    expect(html).toMatch(/Praxis: ca\.(<!-- -->)?\s*(<!-- -->)?-0,55 V bis -0,75 V/)
  })

  it('Fließrichtung ohne vorgeschriebene Reihenfolge zeigt nur den Text', () => {
    const free = metalToolSchema.parse({ ...sample, pairs: [{ ...sample.pairs[0]!, flow: { text: 'Beliebig', source: 'Q' } }] })
    const html = renderToStaticMarkup(<MetalLookup tool={free} initialSelected={['a', 'b']} />)
    expect(html).toContain('Beliebig')
    expect(html).not.toContain('Zuerst')
  })

  it('Titan und Aluminium werden im Inhalt nicht abgeleitet', () => {
    expect(tool.metals.find((m) => m.key === 'titan')?.noDerivation).toBeDefined()
    expect(tool.metals.find((m) => m.key === 'aluminium')?.noDerivation).toBeDefined()
    expect(selectedPairs(tool, ['zink', 'kupfer'])[0]!.derivedLessNoble?.key).toBe('zink')
  })

  it('meldet fehlerhafte Inhalte', () => {
    const broken = {
      ...sample,
      pairs: [{ ...sample.pairs[0]!, metals: ['a', 'x'] as [string, string], corrodes: 'b', flow: { first: 'c', text: 'T', source: 'Q' } }],
    }
    expect(checkMetalTool(broken)).toEqual(
      expect.arrayContaining([
        'pairs (a + x): unbekanntes Metall "x"',
        'pairs (a + x): corrodes gehört nicht zum Paar',
        'pairs (a + x): flow.first gehört nicht zum Paar',
      ]),
    )
  })
})
