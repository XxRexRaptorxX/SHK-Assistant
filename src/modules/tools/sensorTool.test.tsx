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

  it('enthält alle 10 Standardfühler der Regin-Tabelle von −40 bis 150 °C', () => {
    const standard = tool.sensors.filter((sensor) => sensor.group === 'Standardfühler' && sensor.source === '')
    expect(standard.every((sensor) => sensor.temperatures === undefined)).toBe(true)
    expect(standard.map((sensor) => sensor.name)).toEqual([
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

  it('enthält den KTY81-210 aus der Tabelle von Technische Alternative', () => {
    const kty = tool.sensors.find((sensor) => sensor.name === 'KTY81-210')!
    expect(kty.group).toBe('Standardfühler')
    expect(kty.source).toContain('ta.co.at')
    expect(points('KTY81-210')).toHaveLength(12)
    expect(resistanceAt('KTY81-210', 0)).toBe(1630)
    expect(resistanceAt('KTY81-210', 25)).toBe(2000)
    expect(resistanceAt('KTY81-210', 100)).toBe(3392)
    expect(sensorTrend(points('KTY81-210'))).toBe('rising')
    expect(render('KTY81-210', 'resistance', '2,04', 'kilo')).toContain('27,5 °C')
  })

  it('enthält die Herstellerfühler mit eigenen Temperaturstufen und eigener Quelle', () => {
    const groups = (group: string) => tool.sensors.filter((sensor) => sensor.group === group).map((sensor) => sensor.name)
    expect(groups('Buderus')).toEqual([
      'Buderus Außentemperaturfühler (Logamax plus GB172)',
      'Buderus Vorlauftemperaturfühler (Logamax plus GB172)',
      'Buderus Warmwasser-Temperaturfühler (Logamax plus GB172-24K)',
      'Buderus Speichertemperaturfühler / externer Vorlauftemperaturfühler (Logamax plus GB172)',
    ])
    expect(groups('Vaillant')).toEqual(['Vaillant VR 10 (auroMATIC 560)', 'Vaillant VR 11 (auroMATIC 560)'])
    for (const sensor of tool.sensors.filter((candidate) => candidate.group !== 'Standardfühler')) {
      expect(sensor.temperatures).toBeDefined()
      expect(sensor.source).not.toBe('')
    }
    // Stichproben aus Buderus GB172 S. 59 (Tab. 28–31) und Vaillant auroMATIC 560 (Tab. 10.1/10.2)
    expect(points('Buderus Außentemperaturfühler (Logamax plus GB172)')[0]).toEqual({ temperature: -20, resistance: 95893 })
    expect(resistanceAt('Buderus Außentemperaturfühler (Logamax plus GB172)', 30)).toBe(8060)
    expect(resistanceAt('Buderus Vorlauftemperaturfühler (Logamax plus GB172)', 60)).toBe(3243)
    expect(resistanceAt('Buderus Warmwasser-Temperaturfühler (Logamax plus GB172-24K)', 0)).toBe(33242)
    expect(resistanceAt('Buderus Speichertemperaturfühler / externer Vorlauftemperaturfühler (Logamax plus GB172)', 66)).toBe(2072)
    expect(resistanceAt('Vaillant VR 10 (auroMATIC 560)', 25)).toBe(2692)
    expect(points('Vaillant VR 10 (auroMATIC 560)').at(-1)).toEqual({ temperature: 120, resistance: 105 })
    expect(resistanceAt('Vaillant VR 11 (auroMATIC 560)', 0)).toBe(32650)
    expect(points('Vaillant VR 11 (auroMATIC 560)')).toHaveLength(21)
    // Windhager Infinity TA Heizkreis, S. 10: Werte in kΩ in Ω umgerechnet
    const windhager = 'Windhager NTC 5 kΩ (ZAF 200, ZVF 210, ZTF 222)'
    expect(groups('Windhager')).toEqual([windhager])
    expect(points(windhager)[0]).toEqual({ temperature: -20, resistance: 48500 })
    expect(resistanceAt(windhager, 25)).toBe(5000)
    expect(resistanceAt(windhager, 15)).toBe(7850)
    expect(points(windhager).at(-1)).toEqual({ temperature: 95, resistance: 393 })
  })

  it('zeigt die Hinweise der Quelle zur Messung unter dem Ergebnis', () => {
    expect(render('Buderus Vorlauftemperaturfühler (Logamax plus GB172)', 'temperature', '60')).toContain(
      'Messtoleranz ± 10 % (laut Buderus-Tabelle)',
    )
    const html = render('Windhager NTC 5 kΩ (ZAF 200, ZVF 210, ZTF 222)', 'resistance', '5', 'kilo')
    expect(html).toContain('25,0 °C')
    expect(html).toContain('Messgenauigkeit laut Windhager')
    expect(render('PT1000', 'temperature', '20')).not.toContain('Messtoleranz')
  })

  it('zeigt Gruppen, Zusatz und Quelle eines Herstellerfühlers', () => {
    const html = render('Vaillant VR 10 (auroMATIC 560)', 'temperature', '75')
    expect(html).toContain('<optgroup label="Buderus">')
    expect(html).toContain('<optgroup label="Vaillant">')
    expect(html).toContain('Standardfühler, Bauart NTC 2,7K')
    expect(html).toContain('Quelle: Vaillant, Installationsanleitung auroMATIC 560')
    // 75 °C liegt zwischen 70 °C (463 Ω) und 80 °C (333 Ω)
    expect(html).toContain('≈ 398 Ω')
    expect(html).toContain('Widerstand sinkt mit steigender Temperatur')
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
    const own = tool.sensors.find((sensor) => sensor.name === 'Vaillant VR 10 (auroMATIC 560)')!
    expect(
      checkSensorTool({
        ...tool,
        sensors: [
          { ...own, name: 'Fallend', temperatures: [...own.temperatures!].reverse() },
          { ...own, name: 'Zu kurz', resistances: own.resistances.slice(1) },
        ],
      }),
    ).toEqual(['sensors (Fallend): temperatures nicht aufsteigend', 'sensors (Zu kurz): 11 Widerstände für 12 Temperaturen'])
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
    for (const keyword of ['PT1000', 'NTC 10k', 'Ni1000', 'Temperaturfühler', 'Buderus', 'Vaillant', 'VR10']) {
      expect(doc.keywords).toContain(keyword)
    }
  })
})
