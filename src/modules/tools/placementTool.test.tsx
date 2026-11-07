import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PlacementLookup } from './PlacementLookup'
import { checkPlacementTool, exampleZoneMeters, placementResult, placementToolSchema, type PlacementTool } from './placementTool'
import { isPlacementTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.aufstellung-aussengeraet')
if (!entry || !isPlacementTool(entry)) throw new Error('Aufstellungs-Tool erwartet')
const tool: PlacementTool = entry
const guide = tool.guide.rules
const idm = tool.examples.find((example) => example.key === 'idmAeroAlm218')!

const render = (props: { refrigerant?: string; location?: string; features?: string[]; type?: string } = {}) =>
  renderToStaticMarkup(
    <PlacementLookup
      tool={tool}
      initialType={props.type}
      initialRefrigerant={props.refrigerant}
      initialLocation={props.location}
      initialFeatures={props.features}
    />,
  )

describe('Aufstellung Außengerät', () => {
  it('ist fehlerfrei, intern und noch ungeprüft', () => {
    expect(checkPlacementTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.visibility).toBe('internal')
    expect(tool.category).toBe('Montage')
  })

  it('stützt die allgemeinen Vorgaben auf den BWP-Leitfaden und nennt dort keine Maße', () => {
    expect(tool.guide.source).toContain('Stand 26.07.2021')
    expect(tool.guide.zone?.refrigerants).toEqual(['a3'])
    expect(tool.guide.zone?.description).toContain('herstellerspezifisch')
    for (const rule of guide) {
      expect(rule.page).toMatch(/^S\. \d/)
      // Keine Meterangaben im Leitfaden-Teil: Maße legt der Hersteller fest
      expect(rule.text).not.toMatch(/\d\s?(m|mm|cm)\b/)
    }
    expect(tool.refrigerants.map((refrigerant) => refrigerant.key)).toEqual(['a3', 'a2l', 'a1'])
  })

  it('hat keine Gerätewahl mehr; Herstellerwerte stehen nur im Beispiel', () => {
    const html = render({ refrigerant: 'a3', location: 'free' })
    expect(html).not.toContain('Hersteller und Geräteserie')
    expect(html).toContain('Beispiel aus einer Herstelleranleitung: iDM AERO ALM 2-18 (R290)')
    expect(exampleZoneMeters(idm, 'free')).toBe(1)
    expect(exampleZoneMeters(idm, 'corner')).toBe(1.5)
    const clearance = (label: string) => idm.clearances.find((item) => item.label === label)
    expect(clearance('Mehrere Wärmepumpen hintereinander')?.value).toBe('≥ 1 m')
    expect(clearance('Mehrere Wärmepumpen nebeneinander')?.value).toBe('≥ 0,6 m')
  })

  it('hat für Klimageräte noch keine Quelle und sagt das deutlich', () => {
    const html = render({ type: 'airConditioner' })
    expect(html).toContain('Noch keine Vorgaben')
    expect(html).toContain('TODO: Inhalt fehlt')
  })

  it('unterscheidet nach Kältemittel: Schutzbereich-Vorgaben nur bei A3', () => {
    const a3 = placementResult(guide, 'a3', 'wall', ['opening', 'ignition'])
    expect(a3.excluded.map((rule) => rule.features)).toEqual([['opening'], ['ignition']])
    const a2l = placementResult(guide, 'a2l', 'wall', ['opening', 'ignition'])
    expect(a2l.excluded).toEqual([])
    expect(a2l.general.some((rule) => rule.text.includes('nur für A3-Kältemittel'))).toBe(true)
    // Gasdichte Durchführungen gelten für brennbare Kältemittel (A2L und A3), nicht für A1
    const gastight = (refrigerant: string) => placementResult(guide, refrigerant, 'free', []).general.some((rule) => rule.text.includes('gasdicht'))
    expect([gastight('a3'), gastight('a2l'), gastight('a1')]).toEqual([true, true, false])
  })

  it('zeigt Vorgaben für Dach und Garage nur dort und doppelte Vorgaben nur einmal', () => {
    expect(placementResult(guide, 'a3', 'flatRoof', ['gutter']).excluded.map((rule) => rule.page)).toEqual(['S. 8'])
    expect(placementResult(guide, 'a3', 'free', ['gutter']).excluded).toEqual([])
    const garage = placementResult(guide, 'a3', 'garage', ['parking'])
    expect(garage.matching.filter((rule) => rule.text.startsWith('Rammschutz außerhalb'))).toHaveLength(1)
    expect(garage.matching.some((rule) => rule.text.includes('Garagen- und Stellplatzverordnung'))).toBe(true)
    expect(placementResult(guide, 'a1', 'garage', []).matching.map((rule) => rule.level)).toEqual(['required', 'recommended'])
  })

  it('wertet das Beispiel getrennt aus', () => {
    expect(placementResult(idm.rules, 'a3', 'garage', []).excluded.map((rule) => rule.page)).toEqual(['S. 39'])
    expect(placementResult(idm.rules, 'a3', 'free', ['coast']).excluded.map((rule) => rule.page)).toEqual(['S. 47'])
    // Küste steht nur im Beispiel, nicht im Leitfaden
    expect(placementResult(guide, 'a3', 'free', ['coast']).excluded).toEqual([])
  })

  it('zeigt Ausschlüsse, Skizze ohne Maße und das Beispiel mit Maßen', () => {
    const html = render({ refrigerant: 'a3', location: 'corner', features: ['opening'] })
    expect(html).toContain('Laut BWP-Leitfaden: nicht zulässig')
    expect(html).toContain('Keine Gebäudeöffnungen im Schutzbereich')
    expect(html).toContain('Maße laut Herstelleranleitung')
    expect(html).toContain('Schutzbereich: 1,5 m')
    expect(html).toContain('Wand seitlich im Abstand 0,6 m')
    expect(html).toContain('aria-pressed="true"')

    const a1 = render({ refrigerant: 'a1', location: 'free' })
    expect(a1).toContain('Laut BWP-Leitfaden: Keine deiner Angaben ist als nicht zulässig genannt.')
    expect(a1).not.toContain('role="img"')
    expect(a1).not.toContain('Beispiel aus einer Herstelleranleitung')

    expect(render()).toContain('Kältemittel wählen.')
    expect(render({ refrigerant: 'a3' })).toContain('Aufstellort wählen.')
  })

  it('meldet unbekannte keys, doppelte keys und Merkmale ohne Vorgabe', () => {
    const broken: PlacementTool = {
      ...tool,
      features: [...tool.features, { key: 'unused', group: 'Test', label: 'Unbenutzt', note: '', aliases: [] }],
      guide: { ...tool.guide, rules: [...guide, { ...guide[0]!, refrigerants: ['r999'], locations: ['mars'], features: ['nope'] }] },
      examples: [idm, { ...idm, type: 'boiler', refrigerant: 'b2', zone: { ...idm.zone!, byLocation: { cellar: 2 } } }],
    }
    const issues = checkPlacementTool(broken)
    const last = `guide, rules[${guide.length}]`
    expect(issues).toContain('examples: key "idmAeroAlm218" doppelt vergeben')
    expect(issues).toContain(`${last}: unbekanntes Kältemittel "r999"`)
    expect(issues).toContain(`${last}: unbekannter Aufstellort "mars"`)
    expect(issues).toContain(`${last}: unbekanntes Merkmal "nope"`)
    expect(issues).toContain('examples (idmAeroAlm218): unbekannter Gerätetyp "boiler"')
    expect(issues).toContain('examples (idmAeroAlm218): unbekanntes Kältemittel "b2"')
    expect(issues).toContain('examples (idmAeroAlm218): zone.byLocation mit unbekanntem Aufstellort "cellar"')
    expect(issues).toContain('features (unused): kommt in keiner Vorgabe vor')

    const noTodo: PlacementTool = { ...tool, deviceTypes: tool.deviceTypes.map((type) => ({ ...type, todo: '' })) }
    expect(checkPlacementTool(noTodo)).toContain('deviceTypes (airConditioner): nicht im Leitfaden; todo muss mit „TODO: Inhalt fehlt“ beginnen')
    expect(checkPlacementTool({ ...tool, status: 'verified' })).toContain('deviceTypes (airConditioner): todo bei verified nicht erlaubt')
    expect(placementToolSchema.safeParse({ ...tool, refrigerants: [] }).success).toBe(false)
  })

  it('erscheint auf der Tool-Seite als ungeprüft und ist über Kältemittel und Begriffe auffindbar', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/aufstellung-aussengeraet']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Aufstellung Außengerät Wärmepumpe und Klimagerät')
    expect(html).toContain('Kältemittel')
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.aufstellung-aussengeraet')!
    for (const keyword of ['R290', 'R32', 'Schutzbereich', 'Flachdach', 'Klimagerät', 'BWP-Leitfaden']) expect(doc.keywords).toContain(keyword)
  })
})
