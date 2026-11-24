import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LoadSecuringLookup } from './LoadSecuringLookup'
import {
  checkLoadSecuringTool,
  forcesFor,
  hasTippingForces,
  isStable,
  loadSecuringToolSchema,
  measuresByGroup,
  type LoadSecuringTool,
} from './loadSecuringTool'
import { isLoadSecuringTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.ladungssicherung')
if (!entry || !isLoadSecuringTool(entry)) throw new Error('Ladungssicherungs-Tool erwartet')
const tool: LoadSecuringTool = entry
const vehicle = (key: string) => tool.vehicleClasses.find((candidate) => candidate.key === key)!
const cargo = (key: string) => tool.cargos.find((candidate) => candidate.key === key)!

type RenderProps = Partial<{
  cargo: string
  weight: string
  vehicle: string
  tipping: boolean
  height: string
  distance: string
}>

const render = (props: RenderProps = {}) =>
  renderToStaticMarkup(
    <LoadSecuringLookup
      tool={tool}
      initialCargo={props.cargo}
      initialWeight={props.weight}
      initialVehicle={props.vehicle}
      initialTipping={props.tipping}
      initialHeight={props.height}
      initialDistance={props.distance}
    />,
  )

describe('Ladungssicherung', () => {
  it('ist fehlerfrei, öffentlich und noch ungeprüft', () => {
    expect(checkLoadSecuringTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.visibility).toBe('public')
  })

  it('rechnet die Kräfte als Beiwert × Gewicht in daN (Tabelle 1 der BG BAU)', () => {
    expect(forcesFor(vehicle('upTo35'), 2000, false).map((force) => force.force)).toEqual([1600, 1000, 1200])
    expect(forcesFor(vehicle('upTo2'), 100, false).map((force) => force.force)).toEqual([90, 50, 70])
  })

  it('nimmt bei kippgefährdeter Ladung über 3,5 t die höheren Beiwerte, sonst nicht', () => {
    expect(hasTippingForces(vehicle('over35'))).toBe(true)
    expect(hasTippingForces(vehicle('upTo35'))).toBe(false)
    expect(forcesFor(vehicle('over35'), 1000, false).map((force) => force.factor)).toEqual([0.8, 0.5, 0.5])
    expect(forcesFor(vehicle('over35'), 1000, true).map((force) => force.factor)).toEqual([0.8, 0.6, 0.6])
    // Ohne eigene Kipp-Beiwerte ändert der Schalter nichts
    expect(forcesFor(vehicle('upTo35'), 1000, true)).toEqual(forcesFor(vehicle('upTo35'), 1000, false))
  })

  it('prüft die Standsicherheit wie die Beispiele der Quelle, Gleichstand gilt als kippgefährdet', () => {
    for (const example of tool.tipping.examples) {
      expect(isStable(tool.tipping, example.height, example.distance)).toBe(example.stable)
    }
    expect(isStable(tool.tipping, 1, 0.6)).toBe(false)
    expect(isStable(tool.tipping, 1, 0.61)).toBe(true)
  })

  it('ordnet die Maßnahmen nach Gruppe: Sicherungsart vor Zurrmittel vor Fahrzeug', () => {
    const groups = measuresByGroup(tool, cargo('boxes')).map((group) => group.group.key)
    expect(groups).toEqual(['method', 'gear', 'vehicle'])
    expect(measuresByGroup(tool, cargo('bulk')).map((group) => group.group.key)).toEqual(['method', 'gear'])
  })

  it('markiert fehlende Angaben als TODO und erlaubt dann kein verified', () => {
    expect(tool.cargos.filter((candidate) => candidate.todo).map((candidate) => candidate.key)).toEqual([
      'gasCylinders',
      'tallItems',
    ])
    const verified = loadSecuringToolSchema.parse({ ...tool, status: 'verified', verifiedBy: 'XX', verifiedAt: '2026-11-24' })
    expect(checkLoadSecuringTool(verified)).toContain('cargos (gasCylinders): todo bei verified nicht erlaubt')
  })

  it('erkennt unbekannte Quellen, Maßnahmen und falsche Beispiele', () => {
    const broken = structuredClone(tool)
    broken.cargos[0]!.measures.push('gibtsNicht')
    broken.generalRules[0]!.ref.source = 'fremd'
    broken.tipping.examples[0]!.stable = true
    const issues = checkLoadSecuringTool(broken)
    expect(issues).toContain('cargos (boxes): unbekannte Maßnahme "gibtsNicht"')
    expect(issues).toContain('generalRules[0]: unbekannte Quelle "fremd"')
    expect(issues).toContain('tipping.examples[0] (Holzkiste 2,0 × 0,8 m, Schwerpunkt 1,0 m hoch): ergibt kippgefährdet')
  })

  it('zeigt ohne Auswahl die Ladegüter und fordert die Eingaben an', () => {
    const html = render()
    expect(html).toContain('Was wird geladen?')
    expect(html).toContain('Ladegut wählen.')
    expect(html).toContain('Gewicht eingeben und Fahrzeug wählen.')
    expect(html).toContain('Checkliste vor der Fahrt')
    expect(html).not.toContain('So sicherst du es')
  })

  it('zeigt für Flüssiggasflaschen Schritte, Vorgaben und Fundstellen', () => {
    const html = render({ cargo: 'lpgCylinders' })
    expect(html).toContain('So sicherst du es')
    expect(html).toContain('Ventilschutzkappe')
    expect(html).toContain('je mindestens 100 cm²')
    expect(html).toContain('DGUV Information 210-001, Abschn. 7.3.1, S. 41–42')
    expect(html).toContain('Zurrgurt')
    expect(html).toContain('Nicht zulässig')
    expect(html).not.toContain('TODO: Inhalt fehlt')
  })

  it('zeigt bei Schweißgasflaschen den Hinweis auf fehlende Inhalte', () => {
    expect(render({ cargo: 'gasCylinders' })).toContain('TODO: Inhalt fehlt')
  })

  it('zeigt beim Langgut die zulässigen Überstände', () => {
    const html = render({ cargo: 'longGoods' })
    expect(html).toContain('max. 1,50 m; bei bis zu 100 km Fahrstrecke max. 3,0 m')
  })

  it('zeigt die Kräfte für 2000 kg auf einem Fahrzeug bis 3,5 t', () => {
    const html = render({ weight: '2000', vehicle: 'upTo35' })
    expect(html).toContain('1.600 daN')
    expect(html).toContain('1.000 daN')
    expect(html).toContain('1.200 daN')
    expect(html).not.toContain('Ladung ist kippgefährdet')
  })

  it('bietet den Kipp-Schalter nur über 3,5 t an', () => {
    const html = render({ weight: '1000', vehicle: 'over35', tipping: true })
    expect(html).toContain('Ladung ist kippgefährdet')
    expect(html).toContain('600 daN')
  })

  it('meldet Kippgefahr und ungültige Eingaben', () => {
    expect(render({ height: '1', distance: '0,4' })).toContain('Kippgefährdet')
    expect(render({ height: '0,4', distance: '0,4' })).toContain('Standsicher')
    expect(render({ weight: 'abc' })).toContain('Zahl größer 0 eingeben')
  })

  it('ist über Begriffe aus der Praxis auffindbar', () => {
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    for (const keyword of ['Spanngurt', 'Propanflasche', 'Minibagger', 'Antirutschmatte', 'Leiter']) {
      expect(document.keywords).toContain(keyword)
    }
  })
})
