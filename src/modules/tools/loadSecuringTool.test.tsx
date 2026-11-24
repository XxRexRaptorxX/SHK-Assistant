import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { LoadSecuringLookup, todoDisplayText, type ForceUnit, type LengthUnit, type WeightUnit } from './LoadSecuringLookup'
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
  weightUnit: WeightUnit
  forceUnit: ForceUnit
  heightUnit: LengthUnit
  distanceUnit: LengthUnit
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
      initialWeightUnit={props.weightUnit}
      initialForceUnit={props.forceUnit}
      initialHeightUnit={props.heightUnit}
      initialDistanceUnit={props.distanceUnit}
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

  it('zeigt bei Schweißgasflaschen den Hinweis auf fehlende Inhalte ohne TODO-Kennung', () => {
    const html = render({ cargo: 'gasCylinders' })
    expect(html).toContain('Vorgaben speziell für Acetylen, Sauerstoff und andere Druckgase')
    expect(html).not.toContain('TODO: Inhalt fehlt')
    expect(todoDisplayText('TODO: Inhalt fehlt – Herstellerangaben')).toBe('Herstellerangaben')
    expect(todoDisplayText('TODO: Inhalt fehlt')).toBe('')
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

  it('bietet Auswahllisten für die Einheiten an, Vorgabe kg, daN und m', () => {
    const html = render({ weight: '2000', vehicle: 'upTo35' })
    for (const label of ['Einheit des Gewichts', 'Einheit der Kraft', 'Einheit der Schwerpunkthöhe', 'Einheit des Abstands']) {
      expect(html).toContain(`<select aria-label="${label}"`)
    }
    expect(html).not.toContain('aria-pressed="true">kg')
    expect(html).not.toContain('Längen in')
    for (const unit of ['kg', 'daN', 'm']) expect(html).toContain(`<option value="${unit}" selected="">`)
    expect(html).toContain('<option value="t">')
  })

  it('rechnet das Gewicht in t um und zeigt die Kraft in kN oder N', () => {
    const tonnes = render({ weight: '2', weightUnit: 't', vehicle: 'upTo35' })
    expect(tonnes).toContain('1.600 daN')
    expect(tonnes).toContain('1.200 daN')
    const kilonewton = render({ weight: '2000', vehicle: 'upTo35', forceUnit: 'kN' })
    expect(kilonewton).toContain('16 kN')
    expect(kilonewton).toContain('12 kN')
    expect(render({ weight: '0,5', weightUnit: 't', vehicle: 'upTo2', forceUnit: 'N' })).toContain('4.500 N')
    // Nachkommastellen in kN: 0,9 × 333 kg = 299,7 daN = 3 kN (2 Stellen: 3)
    expect(render({ weight: '333', vehicle: 'upTo2', forceUnit: 'kN' })).toContain('3 kN')
  })

  it('prüft die Standsicherheit auch in cm', () => {
    const tipping = render({ height: '100', distance: '40', heightUnit: 'cm', distanceUnit: 'cm' })
    expect(tipping).toContain('Kippgefährdet')
    expect(tipping).toContain('= 60 cm')
    expect(render({ height: '40', distance: '40', heightUnit: 'cm', distanceUnit: 'cm' })).toContain('Standsicher')
    // Gemischt: Höhe 1 m, Abstand 40 cm → Grenze 60 cm in der Einheit des Abstands
    const mixed = render({ height: '1', distance: '40', distanceUnit: 'cm' })
    expect(mixed).toContain('Kippgefährdet')
    expect(mixed).toContain('= 60 cm')
    expect(render({ height: '1', distance: '70', distanceUnit: 'cm' })).toContain('Standsicher')
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
