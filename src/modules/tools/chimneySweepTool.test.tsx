import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ChimneySweepFinder } from './ChimneySweepFinder'
import {
  checkChimneySweepTool,
  copyText,
  fillQuery,
  findState,
  parseGeocode,
  portalLink,
  portalsFor,
  reverseGeocodeUrl,
  searchGeocodeUrl,
  STATE_CODES,
  type Address,
  type ChimneySweepTool,
} from './chimneySweepTool'
import { isChimneySweepTool } from './schema'
import { filterTools, toolEntries } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.bezirksschornsteinfeger')
if (!entry || !isChimneySweepTool(entry)) throw new Error('Bezirksschornsteinfeger-Tool erwartet')
const tool: ChimneySweepTool = entry

const munich: Address = { street: 'Leopoldstraße', houseNumber: '10', postcode: '80802', city: 'München' }
const kassel: Address = { street: 'Königsplatz', houseNumber: '1', postcode: '34117', city: 'Kassel' }
const state = (code: string) => findState(tool, code)!
const portal = (code: string, key: string) => state(code).portals.find((candidate) => candidate.key === key)!

describe('Bezirksschornsteinfeger finden', () => {
  it('ist fehlerfrei, öffentlich, noch ungeprüft und deckt alle Bundesländer ab', () => {
    expect(checkChimneySweepTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.visibility).toBe('public')
    expect(tool.states.map((candidate) => candidate.code).sort()).toEqual([...STATE_CODES].sort())
  })

  it('meldet fehlende Länder, unbekannte Platzhalter und searchUrl ohne {query}', () => {
    const broken: ChimneySweepTool = {
      ...tool,
      states: [
        {
          ...state('DE-BY'),
          portals: [{ key: 'x', label: 'X', url: 'https://example.org', searchUrl: 'https://example.org/?q=1', query: '{strasse}', cities: [], note: '' }],
        },
      ],
    }
    const issues = checkChimneySweepTool(broken)
    expect(issues).toContain('states: DE-BE fehlt')
    expect(issues).toContain('states (Bayern), x: searchUrl ohne {query}')
    expect(issues).toContain('states (Bayern), x: unbekannter Platzhalter {strasse}')
  })

  it('füllt den Suchtext; ohne Hausnummer geht es, ohne Straße nicht', () => {
    expect(fillQuery('{street} {houseNumber} {city}', munich)).toBe('Leopoldstraße 10 München')
    expect(fillQuery('{street} {houseNumber}', { ...munich, houseNumber: '' })).toBe('Leopoldstraße')
    expect(fillQuery('{street} {houseNumber}', { ...munich, street: ' ' })).toBeUndefined()
  })

  it('übergibt die Adresse an den BayernAtlas und die Suche der Stadt München', () => {
    const atlas = portalLink(portal('DE-BY', 'bayernAtlas'), munich)
    expect(atlas.prefilled).toBe(true)
    expect(atlas.href).toContain('&search=Leopoldstra%C3%9Fe%2010%20M%C3%BCnchen')
    expect(atlas.href).toContain('l=atkis,264bf43b-1083-4914-a6e8-f11e108bc60a')

    const city = portalLink(portal('DE-BY', 'muenchen'), munich)
    expect(city.href).toContain('streetaddress=Leopoldstra%C3%9Fe%2010&mi%240_gdb24=Leopoldstra%C3%9Fe%2010')
  })

  it('öffnet ohne Adresse die Einstiegsseite und zeigt bei Hessen die PLZ zum Eintippen', () => {
    const atlas = portal('DE-BY', 'bayernAtlas')
    expect(portalLink(atlas, { street: '', houseNumber: '', postcode: '', city: '' })).toEqual({ href: atlas.url, prefilled: false })
    const hesse = portal('DE-HE', 'liv')
    expect(portalLink(hesse, kassel)).toEqual({ href: hesse.url, prefilled: false })
    expect(copyText(hesse, kassel)).toBe('34117')
  })

  it('stellt die Suche der eigenen Stadt vor die landesweite, andere Städte nach hinten', () => {
    const inMunich = portalsFor(state('DE-BY'), 'muenchen')
    expect(inMunich.matching.map((candidate) => candidate.key)).toEqual(['muenchen', 'bayernAtlas'])
    expect(inMunich.others.map((candidate) => candidate.key)).toEqual(['coburg'])
    expect(portalsFor(state('DE-BY'), 'Augsburg').matching.map((candidate) => candidate.key)).toEqual(['bayernAtlas'])
  })

  it('liest Adresse, Bundesland und Landkreis aus der Antwort von Nominatim', () => {
    const reverse = {
      address: {
        house_number: '10',
        road: 'Leopoldstraße',
        city: 'München',
        state: 'Bayern',
        'ISO3166-2-lvl4': 'DE-BY',
        postcode: '80802',
      },
    }
    expect(parseGeocode(reverse)).toEqual({ address: munich, stateCode: 'DE-BY', district: 'München' })
    const village = [{ address: { road: 'Dorfstraße', village: 'Beispielhausen', county: 'Landkreis Kassel', 'ISO3166-2-lvl4': 'DE-HE' } }]
    expect(parseGeocode(village)).toMatchObject({ stateCode: 'DE-HE', district: 'Landkreis Kassel' })
    expect(parseGeocode([])).toBeUndefined()
    expect(parseGeocode({ address: { 'ISO3166-2-lvl4': 'AT-9' } })?.stateCode).toBeUndefined()
  })

  it('fragt Nominatim strukturiert und nur in Deutschland', () => {
    const url = new URL(searchGeocodeUrl(munich))
    expect(url.searchParams.get('street')).toBe('10 Leopoldstraße')
    expect(url.searchParams.get('postalcode')).toBe('80802')
    expect(url.searchParams.get('countrycodes')).toBe('de')
    expect(new URL(reverseGeocodeUrl(48.15, 11.58)).searchParams.get('lat')).toBe('48.150000')
  })

  it('zeigt das Ergebnis mit Link, Behörde und TODO', () => {
    const html = renderToStaticMarkup(<ChimneySweepFinder tool={tool} initialAddress={munich} initialState="DE-BY" initialShown />)
    expect(html).toContain('Stadt München: Kaminkehrer-Suche öffnen')
    expect(html).toContain('search=Leopoldstra%C3%9Fe%2010%20M%C3%BCnchen')
    expect(html).toContain('Die Adresse wird an die Suche übergeben.')
    expect(html).toContain('Suchen anderer Städte in Bayern')

    const thuringia = renderToStaticMarkup(<ChimneySweepFinder tool={tool} initialState="DE-TH" initialShown />)
    expect(thuringia).toContain('Für Thüringen ist keine Online-Suche erfasst.')
    expect(thuringia).toContain('TODO: Inhalt fehlt')
  })

  it('zeigt vor dem Suchen kein Ergebnis', () => {
    const html = renderToStaticMarkup(<ChimneySweepFinder tool={tool} initialAddress={munich} initialState="DE-BY" />)
    expect(html).toContain('Standort verwenden (GPS)')
    expect(html).not.toContain('Kaminkehrer-Suche öffnen')
  })

  it('wird über Kaminkehrer und Kehrbezirk gefunden', () => {
    expect(filterTools(toolEntries, 'Kaminkehrer').map((candidate) => candidate.id)).toContain(tool.id)
    expect(filterTools(toolEntries, 'Kehrbezirk').map((candidate) => candidate.id)).toContain(tool.id)
  })
})
