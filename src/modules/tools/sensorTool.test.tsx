import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { SensorLookup } from './SensorLookup'
import { checkSensorTool, lookupSensor, sensorPoints, sensorToolSchema, sensorTrend, type SensorTool } from './sensorTool'
import { isSensorTool } from './schema'
import ToolPage from './ToolPage'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.temperaturfuehler')
if (!entry || !isSensorTool(entry)) throw new Error('Fühler-Tool erwartet')
const tool: SensorTool = entry

const points = (name: string) => sensorPoints(tool, tool.sensors.find((sensor) => sensor.name === name)!)
/** Widerstand laut Tabelle bei einer Temperatur */
const resistanceAt = (name: string, temperature: number) => points(name).find((point) => point.temperature === temperature)?.resistance
const render = (
  sensor: string | undefined,
  mode: 'temperature' | 'resistance' = 'temperature',
  value = '',
  scale: 'base' | 'kilo' = 'base',
  temperatureUnit: 'degC' | 'degF' | 'K' = 'degC',
) =>
  renderToStaticMarkup(
    <SensorLookup
      tool={tool}
      initialSensor={sensor}
      initialMode={mode}
      initialValue={value}
      initialScale={scale}
      initialTemperatureUnit={temperatureUnit}
    />,
  )

describe('Temperaturfühler Widerstandswerte', () => {
  it('ist fehlerfrei, öffentlich und bis zur Prüfung als Entwurf markiert', () => {
    expect(checkSensorTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.visibility).toBe('public')
    expect(tool.source).toContain('regincontrols.com')
  })

  it('enthält alle 10 Fühler der Quelle von −40 bis 150 °C', () => {
    expect(tool.sensors.map((sensor) => sensor.name)).toEqual([
      'PT100', 'PT1000', 'NTC1,8', 'NTC2,2', 'NTC10-01', 'NTC10-02', 'NTC10-03', 'NTC20', 'NI1000-01', 'NI1000-02',
    ])
    expect(tool.temperatures).toHaveLength(55)
    expect(tool.temperatures[0]).toBe(-40)
    expect(tool.temperatures.at(-1)).toBe(150)
  })

  it('übernimmt die Werte der Quelle (Stichproben)', () => {
    expect(resistanceAt('PT100', 0)).toBe(100)
    expect(resistanceAt('PT100', 25)).toBe(109.7)
    expect(resistanceAt('PT1000', 100)).toBe(1385)
    expect(resistanceAt('NTC10-01', 25)).toBe(10000)
    expect(resistanceAt('NTC10-02', 0)).toBe(27280)
    expect(resistanceAt('NTC20', -40)).toBe(810861)
    expect(resistanceAt('NI1000-02', 100)).toBe(1618)
    // Erste und letzte Zeile, ab bzw. bis zu der die Quelle Werte nennt
    expect(points('PT1000').at(-1)).toEqual({ temperature: 150, resistance: 1573 })
    expect(points('NTC10-02').at(-1)).toEqual({ temperature: 110, resistance: 767 })
    expect(points('NTC1,8').at(-1)).toEqual({ temperature: 140, resistance: 71 })
  })

  it('leitet aus den Werten ab, ob der Widerstand mit der Temperatur steigt', () => {
    for (const name of ['PT100', 'PT1000', 'NI1000-01', 'NI1000-02']) expect(sensorTrend(points(name))).toBe('rising')
    for (const name of ['NTC1,8', 'NTC2,2', 'NTC10-01', 'NTC10-02', 'NTC10-03', 'NTC20']) expect(sensorTrend(points(name))).toBe('falling')
  })

  it('rechnet in beide Richtungen, auch bei fallender Kennlinie', () => {
    const pt = points('PT1000')
    expect(lookupSensor(pt, 'temperature', 20)).toEqual({ kind: 'exact', value: 1078, point: { temperature: 20, resistance: 1078 } })
    const ptBetween = lookupSensor(pt, 'resistance', 1080)
    expect(ptBetween.kind === 'interpolated' && ptBetween.value).toBeCloseTo(20.5, 9)

    const ntc = points('NTC10-01')
    expect(lookupSensor(ntc, 'resistance', 10000)).toMatchObject({ kind: 'exact', value: 25 })
    // 11 000 Ω liegt zwischen 23 °C (10 923 Ω) und 22 °C (11 420 Ω)
    const between = lookupSensor(ntc, 'resistance', 11000)
    expect(between.kind).toBe('interpolated')
    if (between.kind !== 'interpolated') return
    expect(between.value).toBeCloseTo(23 - 77 / 497, 9)
    expect(between.lower).toEqual({ temperature: 22, resistance: 11420 })
    expect(between.upper).toEqual({ temperature: 23, resistance: 10923 })
    const warmer = lookupSensor(ntc, 'temperature', 22.5)
    expect(warmer.kind === 'interpolated' && warmer.value).toBeCloseTo(11171.5, 9)
  })

  it('rechnet nicht über die Tabelle hinaus', () => {
    const ntc = points('NTC10-02')
    expect(lookupSensor(ntc, 'temperature', 120)).toEqual({ kind: 'outOfRange', first: ntc[0], last: ntc.at(-1) })
    expect(lookupSensor(ntc, 'resistance', 500).kind).toBe('outOfRange')
    expect(lookupSensor(ntc, 'resistance', 200000).kind).toBe('outOfRange')
  })

  it('zeigt Ergebnis, Hinweis zur Kennlinie und markiert die benutzten Tabellenzeilen', () => {
    const html = render('NTC10-01', 'resistance', '11000')
    expect(html).toContain('Widerstand sinkt mit steigender Temperatur')
    expect(html).toContain('Temperatur am Fühler')
    expect(html).toContain('≈ 22,8 °C')
    expect(html).toContain('Zwischen 22 °C (11.420 Ω) und 23 °C (10.923 Ω) linear gerechnet.')
    expect(html.match(/aria-current="true"/g)).toHaveLength(2)
    expect(html).toContain('Kennlinie wie bei: Aquatrol')
    expect(html).toContain('Alle Werte für NTC10-01')

    const exact = render('PT100', 'temperature', '25')
    expect(exact).toContain('Widerstand steigt mit der Temperatur')
    expect(exact).toContain('Sollwiderstand')
    expect(exact).toContain('109,7 Ω')
    expect(exact).toContain('Wert aus der Tabelle.')
    expect(exact).not.toContain('≈')

    expect(render('NTC10-01', 'temperature', '25')).toContain('10.000 Ω (10,00 kΩ)')
    // Eingabe in kΩ, wie sie das Messgerät anzeigt
    expect(render('NTC10-01', 'resistance', '10', 'kilo')).toContain('25,0 °C')
  })

  it('nimmt die Temperatur auch in °F oder K entgegen und zeigt das Ergebnis in der gewählten Einheit', () => {
    // 77 °F = 25 °C, 298,15 K = 25 °C
    expect(render('NTC10-01', 'temperature', '77', 'base', 'degF')).toContain('10.000 Ω (10,00 kΩ)')
    expect(render('PT1000', 'temperature', '298,15', 'base', 'K')).toContain('1.097 Ω')
    const html = render('NTC10-01', 'resistance', '10000', 'base', 'degF')
    expect(html).toContain('77,0 °F (25,0 °C)')
    expect(html).toContain('aria-label="Einheit des Widerstands"')
    expect(render('PT100', 'temperature', '', 'base', 'K')).toContain('aria-label="Einheit der Temperatur"')
  })

  it('meldet Werte außerhalb der Tabelle, ungültige Eingaben und fehlende Auswahl', () => {
    expect(render('NTC10-02', 'temperature', '130')).toContain(
      'Außerhalb der Tabelle. Für NTC10-02 reicht sie von -40 °C (188.500 Ω) bis 110 °C (767 Ω).',
    )
    expect(render('PT1000', 'resistance', 'abc')).toContain('Keine gültige Zahl')
    const empty = render(undefined)
    expect(empty).toContain('Fühler wählen.')
    expect(empty).not.toContain('Alle Werte für')
    expect(empty).not.toContain('data-trend')
  })

  it('verlangt durchgehend steigende oder fallende, lückenlose Werte passender Länge und eindeutige Namen', () => {
    const pt = tool.sensors[0]!
    const ntc = tool.sensors.find((sensor) => sensor.name === 'NTC10-01')!
    const broken: SensorTool = {
      ...tool,
      sensors: [
        pt,
        { ...pt, name: 'Lücke', resistances: pt.resistances.map((value, index) => (index === 10 ? null : value)) },
        { ...pt, name: 'Knick', resistances: pt.resistances.map((value, index) => (index === 5 ? 1 : value)) },
        { ...ntc, name: 'NTC-Knick', resistances: ntc.resistances.map((value, index) => (index === 5 ? 999999 : value)) },
        { ...pt, name: 'Kurz', resistances: pt.resistances.slice(1) },
        { ...pt, name: 'Leer', resistances: pt.resistances.map((value, index) => (index === 0 ? value : null)) },
        pt,
      ],
    }
    expect(checkSensorTool(broken)).toEqual([
      'sensors: name doppelt vergeben',
      'sensors (Lücke): Lücke zwischen den Werten',
      'sensors (Knick): Widerstand steigt bei -15 °C nicht',
      'sensors (NTC-Knick): Widerstand fällt bei -15 °C nicht',
      'sensors (Kurz): 54 Widerstände für 55 Temperaturen',
      'sensors (Leer): weniger als zwei Werte',
    ])
    expect(checkSensorTool({ ...tool, temperatures: [...tool.temperatures].reverse() })).toContain('temperatures: nicht aufsteigend')
    expect(sensorToolSchema.safeParse({ ...tool, sensors: [] }).success).toBe(false)
  })

  it('zeigt Quelle und Entwurfs-Hinweis auf der Tool-Seite und ist über die Fühlertypen auffindbar', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/tools/temperaturfuehler']}>
        <Routes>
          <Route path="/tools/:slug" element={<ToolPage />} />
        </Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('Temperaturfühler Widerstandswerte')
    expect(html).toContain('noch nicht geprüft')
    expect(html).toContain('Regin')
    const doc = toolSearchDocuments().find((item) => item.id === 'tool.temperaturfuehler')!
    for (const keyword of ['PT1000', 'NTC 10k', 'Ni1000', 'Temperaturfühler']) expect(doc.keywords).toContain(keyword)
  })
})
