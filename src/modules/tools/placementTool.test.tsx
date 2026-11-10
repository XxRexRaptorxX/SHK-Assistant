import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { PlacementLookup } from './PlacementLookup'
import {
  checkPlacementTool,
  clearancesAt,
  manufacturersFor,
  placementResult,
  placementToolSchema,
  zoneRowsAt,
  type PlacementSeries,
  type PlacementTool,
} from './placementTool'
import { isPlacementTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.aufstellung-aussengeraet')
if (!entry || !isPlacementTool(entry)) throw new Error('Aufstellungs-Tool erwartet')
const tool: PlacementTool = entry
const guide = tool.guide.rules
const seriesOf = (manufacturer: string) => tool.manufacturers.find((item) => item.key === manufacturer)!.series[0]!
const idm = seriesOf('idm')
const buderus = seriesOf('buderus')
const vaillant = seriesOf('vaillant')

const render = (
  props: { refrigerant?: string; manufacturer?: string; location?: string; features?: string[]; type?: string } = {},
) =>
  renderToStaticMarkup(
    <PlacementLookup
      tool={tool}
      initialType={props.type}
      initialRefrigerant={props.refrigerant}
      initialManufacturer={props.manufacturer}
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

  it('bietet iDM, Buderus und Vaillant an, nur passend zum Kältemittel', () => {
    expect(manufacturersFor(tool, 'heatPump', 'a3').map((item) => item.name)).toEqual(['iDM', 'Buderus', 'Vaillant'])
    expect(manufacturersFor(tool, 'heatPump', 'a2l')).toEqual([])
    expect(render({ refrigerant: 'a2l', location: 'free' })).toContain('Für A2L sind noch keine Herstellerangaben hinterlegt.')
    const none = render({ refrigerant: 'a3', location: 'free' })
    expect(none).toContain('Kein bestimmter Hersteller')
    expect(none).toContain('Hersteller wählen, um sie zu sehen.')
    expect(none).not.toContain('Laut iDM')
    // Jede Baureihe nennt ihre Quelle mit Seiten
    for (const series of [idm, buderus, vaillant]) {
      expect(series.source).toMatch(/S\. \d/)
      for (const rule of series.rules) expect(rule.page).toMatch(/^S\. \d/)
      for (const row of series.zones) expect(row.page).toMatch(/^S\. \d/)
    }
  })

  it('übernimmt die Schutzbereiche je Hersteller und Aufstellort', () => {
    const values = (series: PlacementSeries, location: string) => zoneRowsAt(series, location).map((row) => row.value)
    expect(values(idm, 'corner')).toEqual(['1,5 m zu den offenen Seiten', 'Unter dem Gerät immer, auch wenn es mehr als 1 m über dem Boden steht'])
    expect(values(buderus, 'corner')).toEqual(['1.000 mm zur offenen Seite und 2.000 mm nach vorn'])
    expect(values(buderus, 'free')).toEqual(['1.000 mm seitlich und 1.000 mm nach vorn, rund um das Gerät'])
    // Vaillant: abhängig von Montagehöhe und Flexible Space
    expect(zoneRowsAt(vaillant, 'free').map((row) => `${row.condition}: ${row.value}`)).toEqual([
      'Werkseinstellung, Montagehöhe unter 400 mm: 1.000 mm rundum',
      'Werkseinstellung, Montagehöhe ab 400 mm: 500 mm rundum',
      'Flexible Space Funktion aktiviert: deutlich kleiner, im Wesentlichen 500 mm an der rechten Geräteseite',
    ])
    expect(values(buderus, 'garage')).toEqual([])
    // Abstände mit Aufstellort erscheinen nur dort
    expect(clearancesAt(vaillant, 'free').map((item) => item.label)).toContain('Hinten (D)')
    expect(clearancesAt(vaillant, 'wall').map((item) => item.label)).not.toContain('Hinten (D)')
    const clearance = (label: string) => idm.clearances.find((item) => item.label === label)
    expect(clearance('Mehrere Wärmepumpen hintereinander')?.value).toBe('≥ 1 m')
    expect(clearance('Mehrere Wärmepumpen nebeneinander')?.value).toBe('≥ 0,6 m')
  })

  it('zeigt die Abweichungen der Hersteller, z. B. beim Abstand zur Küste', () => {
    const coast = (series: PlacementSeries) => placementResult(series.rules, 'a3', 'free', ['coast'])
    expect(coast(idm).excluded.map((rule) => rule.text)).toEqual(['Mindestens 5 km Abstand zur Küste.'])
    expect(coast(buderus).matching.map((rule) => rule.text)).toContain('Mindestens 500 m Abstand zum Meer, in Frankreich und Irland 1.000 m.')
    expect(coast(vaillant).matching.some((rule) => rule.text.includes('Spritzwasser'))).toBe(true)
    // Küste steht nur bei den Herstellern, nicht im Leitfaden
    expect(placementResult(guide, 'a3', 'free', ['coast']).excluded).toEqual([])
    expect(placementResult(idm.rules, 'a3', 'garage', []).excluded.map((rule) => rule.page)).toEqual(['S. 39'])
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

  it('zeigt Ausschlüsse und die Skizze ohne Maße', () => {
    const html = render({ refrigerant: 'a3', location: 'corner', features: ['opening'] })
    expect(html).toContain('Laut BWP-Leitfaden: nicht zulässig')
    expect(html).toContain('Keine Gebäudeöffnungen im Schutzbereich')
    expect(html).toContain('Maße laut Herstelleranleitung')
    expect(html).toContain('Wand seitlich')
    expect(html).toContain('aria-pressed="true"')

    const a1 = render({ refrigerant: 'a1', location: 'free' })
    expect(a1).toContain('Laut BWP-Leitfaden: Keine deiner Angaben ist als nicht zulässig genannt.')
    expect(a1).not.toContain('role="img"')

    expect(render()).toContain('Kältemittel wählen.')
    expect(render({ refrigerant: 'a3' })).toContain('Aufstellort wählen.')
  })

  it('zeigt einen gewählten Hersteller mit Schutzbereich, Abständen und eigener Auswertung', () => {
    const html = render({ refrigerant: 'a3', manufacturer: 'buderus', location: 'corner', features: ['opening'] })
    expect(html).toContain('Laut Buderus Logatherm WLW MB AR (R290)')
    expect(html).toContain('Schutzbereich bei „In einer Ecke“')
    expect(html).toContain('1.000 mm zur offenen Seite und 2.000 mm nach vorn')
    expect(html).toContain('Laut Buderus: nicht zulässig')
    expect(html).toContain('Angaben aus der Anleitung Logatherm WLW MB AR.')
    expect(render({ refrigerant: 'a3', manufacturer: 'buderus', location: 'garage' })).toContain(
      'Die Anleitung nennt für diesen Aufstellort keinen Schutzbereich.',
    )
  })

  it('meldet unbekannte keys, doppelte keys und Merkmale ohne Vorgabe', () => {
    const idmMaker = tool.manufacturers[0]!
    const broken: PlacementTool = {
      ...tool,
      features: [...tool.features, { key: 'unused', group: 'Test', label: 'Unbenutzt', note: '', aliases: [] }],
      guide: { ...tool.guide, rules: [...guide, { ...guide[0]!, refrigerants: ['r999'], locations: ['mars'], features: ['nope'] }] },
      manufacturers: [
        ...tool.manufacturers,
        { ...idmMaker, series: [idm, { ...idm, type: 'boiler', refrigerant: 'b2', zones: [{ ...idm.zones[0]!, locations: ['cellar'] }] }] },
      ],
    }
    const issues = checkPlacementTool(broken)
    const last = `guide, rules[${guide.length}]`
    expect(issues).toContain('manufacturers: key "idm" doppelt vergeben')
    expect(issues).toContain('manufacturers (idm): Baureihe "aeroAlm218" doppelt vergeben')
    expect(issues).toContain(`${last}: unbekanntes Kältemittel "r999"`)
    expect(issues).toContain(`${last}: unbekannter Aufstellort "mars"`)
    expect(issues).toContain(`${last}: unbekanntes Merkmal "nope"`)
    expect(issues).toContain('manufacturers (idm/aeroAlm218): unbekannter Gerätetyp "boiler"')
    expect(issues).toContain('manufacturers (idm/aeroAlm218): unbekanntes Kältemittel "b2"')
    expect(issues).toContain('manufacturers (idm/aeroAlm218): unbekannter Aufstellort "cellar" bei Schutzbereich oder Abstand')
    expect(issues).toContain('features (unused): kommt in keiner Vorgabe vor')

    const noTodo: PlacementTool = { ...tool, deviceTypes: tool.deviceTypes.map((type) => ({ ...type, todo: '' })) }
    expect(checkPlacementTool(noTodo)).toContain('deviceTypes (airConditioner): nicht im Leitfaden; todo muss mit „TODO: Inhalt fehlt“ beginnen')
    expect(checkPlacementTool({ ...tool, status: 'verified' })).toContain('deviceTypes (airConditioner): todo bei verified nicht erlaubt')
    expect(placementToolSchema.safeParse({ ...tool, refrigerants: [] }).success).toBe(false)
  })

  it('erscheint auf der Tool-Seite als ungeprüft und ist über Kältemittel, Hersteller und Begriffe auffindbar', () => {
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
    for (const keyword of ['R290', 'R32', 'Schutzbereich', 'Flachdach', 'Klimagerät', 'BWP-Leitfaden', 'Vaillant aroTHERM plus/8', 'Buderus', 'iDM AERO ALM 2-18']) {
      expect(doc.keywords).toContain(keyword)
    }
  })
})
