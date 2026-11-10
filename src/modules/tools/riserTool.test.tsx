import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { RiserLookup, riserVelocity } from './RiserLookup'
import {
  airflowsFor,
  checkVentilationRiserTool,
  deviceCounts,
  findSetup,
  riserAirflow,
  selectRiser,
  ventilationRiserToolSchema,
  type VentilationRiserTool,
} from './riserTool'
import { isVentilationRiserTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.strangdimension-bad-luefter')
if (!entry || !isVentilationRiserTool(entry)) throw new Error('Lüftungsstrang-Tool erwartet')
const tool: VentilationRiserTool = entry

const setup = (devices: number, airflow: number) => findSetup(tool, devices, airflow)!
const render = (props: { range?: string; devices?: number; airflow?: number; floors?: number }) =>
  renderToStaticMarkup(
    <RiserLookup
      tool={tool}
      initialRange={props.range}
      initialDevices={props.devices}
      initialAirflow={props.airflow}
      initialFloors={props.floors}
    />,
  )

describe('Strangdimension Bad-Lüfter', () => {
  it('ist fehlerfrei, intern und noch ungeprüft', () => {
    expect(checkVentilationRiserTool(tool)).toEqual([])
    expect(tool.visibility).toBe('internal')
    expect(tool.status).toBe('draft')
    expect(tool.category).toBe('Auslegung')
    expect(tool.ranges.map((range) => range.label)).toEqual(['Normal', 'Komfort'])
  })

  it('enthält die drei Diagramme der Quelle (Seiten D 9 bis D 11)', () => {
    expect(deviceCounts(tool)).toEqual([1, 2])
    expect(airflowsFor(tool, 1)).toEqual([60, 100])
    expect(airflowsFor(tool, 2)).toEqual([60])
    expect(tool.diameters).toEqual([100, 125, 140, 160, 180, 200])
    expect(setup(1, 60).maxFloors).toEqual({ normal: [3, 5, 7, 9, 11, 14], komfort: [2, 4, 5, 6, 8, 10] })
    expect(setup(1, 100).maxFloors).toEqual({ normal: [2, 3, 4, 6, 7, 9], komfort: [1, 2, 3, 4, 5, 6] })
    expect(setup(2, 60).maxFloors).toEqual({ normal: [1, 2, 3, 6, 8, 9], komfort: [1, 2, 3, 4, 5, 7] })
  })

  it('wählt die kleinste Strangdimension, die die Etagen trägt', () => {
    expect(selectRiser(tool, setup(1, 60), 'normal', 1)).toEqual({ kind: 'fits', diameter: 100, maxFloors: 3 })
    expect(selectRiser(tool, setup(1, 60), 'normal', 3)).toEqual({ kind: 'fits', diameter: 100, maxFloors: 3 })
    expect(selectRiser(tool, setup(1, 60), 'normal', 4)).toEqual({ kind: 'fits', diameter: 125, maxFloors: 5 })
    expect(selectRiser(tool, setup(1, 60), 'komfort', 4)).toEqual({ kind: 'fits', diameter: 125, maxFloors: 4 })
    expect(selectRiser(tool, setup(1, 100), 'komfort', 6)).toEqual({ kind: 'fits', diameter: 200, maxFloors: 6 })
    expect(selectRiser(tool, setup(2, 60), 'normal', 4)).toEqual({ kind: 'fits', diameter: 160, maxFloors: 6 })
  })

  it('meldet mehr Etagen als in der Auswahlhilfe', () => {
    expect(selectRiser(tool, setup(1, 60), 'normal', 15)).toEqual({ kind: 'beyond', maxFloors: 14, largest: 200 })
    expect(selectRiser(tool, setup(1, 100), 'komfort', 7)).toEqual({ kind: 'beyond', maxFloors: 6, largest: 200 })
  })

  it('rechnet den Luftdurchsatz mit allen Geräten gleichzeitig', () => {
    expect(riserAirflow(setup(2, 60), 4)).toEqual({ perFloor: 120, total: 480, devices: 8 })
    expect(riserAirflow(setup(1, 100), 3)).toEqual({ perFloor: 100, total: 300, devices: 3 })
  })

  it('rechnet die Strömungsgeschwindigkeit mit der Formel aus der Formelsammlung', () => {
    const formula = content.formulas.find((candidate) => candidate.id === tool.velocityFormula)
    expect(formula).toBeDefined()
    // 180 m³/h in Ø 100 mm: 0,05 m³/s / 0,007854 m² ≈ 6,37 m/s
    expect(riserVelocity(formula, 180, 100, tool.diameterUnit)).toBeCloseTo(6.366, 2)
    expect(riserVelocity(undefined, 180, 100, tool.diameterUnit)).toBeUndefined()
  })

  it('zeigt Strangdimension und technische Daten', () => {
    const html = render({ range: 'normal', devices: 1, airflow: 60, floors: 3 })
    expect(html).toContain('Ø 100 mm')
    expect(html).toContain('trägt laut Auswahlhilfe bis 3 Etagen')
    expect(html).toContain('Luftdurchsatz im Strang')
    expect(html).toContain('180 m³/h')
    expect(html).toContain('6,4 m/s')
    expect(html).toContain('Quelle Seite D 9')
    expect(html).toContain('ersetzt nicht den rechnerischen Nachweis')
    expect(html).toContain('aria-current="true"')
  })

  it('fragt ohne Etagen nach der Eingabe und meldet zu viele Etagen', () => {
    expect(render({})).toContain('Anzahl der Etagen eintragen.')
    const beyond = render({ range: 'komfort', devices: 1, airflow: 100, floors: 8 })
    expect(beyond).toContain('Mehr Etagen als in der Auswahlhilfe')
    expect(beyond).toContain('bis 6 Etagen (Ø 200 mm)')
    expect(beyond).not.toContain('Strömungsgeschwindigkeit')
  })

  it('nimmt bei 2 Geräten den einzigen vorhandenen Volumenstrom', () => {
    const html = render({ devices: 2, airflow: 100, floors: 2 })
    expect(html).toContain('bei 2 Geräten pro Etage mit je 60 m³/h')
    expect(html).toContain('Quelle Seite D 11')
  })

  it('erscheint auf der Tool-Seite und in der Suche', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/strangdimension-bad-luefter']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Strangdimension Bad-Lüfter')
    expect(html).toContain('Auswahlhilfe COSMO EL')
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    expect(document.keywords).toEqual(expect.arrayContaining(['COSMO EL', 'Komfort', 'Normal', 'DIN 18017-3']))
  })

  it('lehnt fehlerhafte Diagrammdaten ab', () => {
    const broken = ventilationRiserToolSchema.parse({
      ...tool,
      diameters: [100, 125],
      setups: [
        { devices: 1, airflow: 60, maxFloors: { normal: [3, 2] } },
        { devices: 1, airflow: 60, maxFloors: { normal: [1, 2], komfort: [1, 2], extra: [1, 2] } },
      ],
    })
    expect(checkVentilationRiserTool(broken)).toEqual([
      'setups: Kombination aus devices und airflow doppelt',
      'setups[0] (1 × 60 m³/h): maxFloors fehlt für komfort',
      'setups[0] (1 × 60 m³/h), normal: Etagenzahl fällt ab',
      'setups[1] (1 × 60 m³/h): unbekannter Bereich extra',
    ])
  })
})
