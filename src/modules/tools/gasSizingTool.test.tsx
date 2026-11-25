import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { GasSizing } from './GasSizing'
import {
  calculateBalancing,
  calculateGasSizing,
  pipeFlowAt,
  checkGasSizingTool,
  chooseFlowMonitor,
  flowMonitorLoss,
  heightLoss,
  meterLoss,
  pipeFlow,
  valveLoss,
  type GasSizingTool,
} from './gasSizingTool'
import { isGasSizingTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.gasleitung-bemessung')
if (!entry || !isGasSizingTool(entry)) throw new Error('Gasleitungs-Tool erwartet')
const tool: GasSizingTool = entry
const copper = tool.pipeSeries.find((series) => series.key === 'kupfer')!
const size = (key: string) => copper.sizes.find((candidate) => candidate.key === key)!
const gs = (key: string) => tool.flowMonitor.sizes.find((candidate) => candidate.key === key)!
const flow = (kw: number) => kw / tool.gas.heatingValue

describe('Gasleitung und Gasströmungswächter', () => {
  it('Inhalt ist fehlerfrei und in der Suche', () => {
    expect(checkGasSizingTool(tool)).toEqual([])
    const doc = toolSearchDocuments().find((candidate) => candidate.id === 'tool.gasleitung-bemessung')
    expect(doc?.keywords).toContain('Gasströmungswächter')
    expect(doc?.keywords).toContain('GS 6')
  })

  it('wählt den GS nach Nenn- bzw. Summenbelastung', () => {
    expect(chooseFlowMonitor(tool, [24]).size?.key).toBe('gs4')
    expect(chooseFlowMonitor(tool, [17.5]).size?.key).toBe('gs4')
    expect(chooseFlowMonitor(tool, []).size).toBeUndefined()
    // 20 + 15 = 35 kW Summenbelastung: GS 6 (35 bis 51), größtes Gerät 20 kW passt als Einzelgerät
    const several = chooseFlowMonitor(tool, [20, 15])
    expect(several.basis).toBe('multiple')
    expect(several.size?.key).toBe('gs6')
    expect(several.raisedForLargest).toBe(false)
    expect(several.loads.peak).toBeCloseTo(0.5 * (35 + 20), 9)
    const raised = chooseFlowMonitor(tool, [42, 2])
    expect(raised.size?.key).toBe('gs10')
    expect(raised.raisedForLargest).toBe(true)
    expect(chooseFlowMonitor(tool, [100, 39]).size).toBeUndefined()
  })

  // Vergleichswerte aus den Diagrammen des DBI-Berichts (abgelesen, daher mit Spielraum)
  it('trifft die Druckverluste der Bauteile aus dem DBI-Bericht', () => {
    // Abb. 9: GS 4 bei 34 kW Spitzenbelastung, TRGI-Tabelle etwa 50 Pa
    expect(flowMonitorLoss(tool, gs('gs4'), flow(34))).toBeGreaterThan(45)
    expect(flowMonitorLoss(tool, gs('gs4'), flow(34))).toBeLessThan(55)
    // Abb. 10: Absperreinrichtung ohne TAE, Eckform, DN 25 bei 78 kW, Nachrechnung Erdgas L etwa 53 Pa
    expect(valveLoss(tool, { type: 'withoutTae', form: 'angle', dn: 25 }, flow(78))).toBeCloseTo(52.6, 0)
    // Abb. 7: Druckgewinn je Meter Steigung bei Erdgas L etwa −4,4 Pa
    expect(heightLoss(tool, 1)).toBeCloseTo(-4.33, 2)
    // Gleichung (16): bei V = 1,5 · GN genau 30 Pa + b
    const g4 = tool.meters.sizes.find((meter) => meter.key === 'g4')!
    expect(meterLoss(tool, g4, 6)).toBeCloseTo(30 + 109, 9)
    // Eckform ab DN 65 gibt es nicht
    expect(valveLoss(tool, { type: 'withoutTae', form: 'angle', dn: 65 }, 10)).toBeUndefined()
  })

  it('rechnet das Rohrdruckgefälle nahe an der DVGW-Tabelle und darüber', () => {
    // Tab. 15.1.1: 22 × 1 trägt bei R = 10 Pa/m 37 kW
    const pipe = pipeFlow(tool, copper, size('cu22x1'), 37)!
    expect(pipe.r).toBeGreaterThanOrEqual(10)
    expect(pipe.r).toBeLessThan(11)
    expect(pipe.reynolds).toBeGreaterThan(2300)
    expect(pipeFlow(tool, copper, size('cu22x1'), 0)).toBeUndefined()
  })

  it('summiert die Teilstrecke wie das DVGW-Formular', () => {
    const result = calculateGasSizing(tool, {
      appliances: [{ key: 'a', name: 'Therme', load: 24 }],
      meter: 'g4',
      sections: [
        {
          key: 's1',
          lineType: 'standard',
          series: 'kupfer',
          size: 'cu22x1',
          length: 10,
          fittings: { elbow: 2, tee: 1 },
          height: 3,
          appliances: ['a'],
          valves: [{ type: 'withTae', form: 'straight', dn: 15, count: 1 }],
        },
      ],
    })
    const section = result.sections[0]!
    const pipe = pipeFlow(tool, copper, size('cu22x1'), 24)!
    expect(result.usedFlowMonitor?.key).toBe('gs4')
    expect(section.pipeLoss).toBeCloseTo(pipe.r * 10, 9)
    expect(section.fittingLoss).toBeCloseTo((2 * 1.3 + 1.3) * pipe.dynamicPressure, 9)
    expect(section.fittingLength * pipe.r).toBeCloseTo(section.fittingLoss, 9)
    expect(section.valveLoss).toBeCloseTo(0.64 * 100 * (flow(24) / 3.5) ** 2, 9)
    expect(section.flowMonitorLoss).toBeCloseTo(50 * (flow(24) / 4) ** 2, 9)
    expect(section.meterLoss).toBeCloseTo(30 + 109 * (flow(24) / 6) ** 2, 9)
    expect(section.heightLoss).toBeCloseTo(heightLoss(tool, 3), 9)
    expect(section.total).toBeCloseTo(
      section.pipeLoss + section.fittingLoss + section.valveLoss + section.flowMonitorLoss + section.meterLoss + section.heightLoss,
      9,
    )
    expect(result.total).toBeCloseTo(section.total, 9)
    expect(result.incomplete).toBe(false)
    expect(section.firstChoice?.key).toBe('cu22x1')
  })

  it('rechnet GS und Zähler nur in der ersten Teilstrecke und mit allen Geräten', () => {
    const base = { lineType: 'standard', series: 'kupfer', length: 5, fittings: {}, height: 0, valves: [] }
    const result = calculateGasSizing(tool, {
      appliances: [
        { key: 'a', name: 'Therme', load: 20 },
        { key: 'b', name: 'Herd', load: 10 },
      ],
      meter: 'g4',
      flowMonitor: 'gs10',
      sections: [
        { ...base, key: 's1', size: 'cu28x1', appliances: ['a', 'b'] },
        { ...base, key: 's2', size: 'cu18x1', appliances: ['b'] },
      ],
    })
    expect(result.flowMonitor.size?.key).toBe('gs4')
    expect(result.usedFlowMonitor?.key).toBe('gs10')
    expect(result.sections[0]!.loads.peak).toBeCloseTo(25, 9)
    expect(result.sections[1]!.loads.peak).toBeCloseTo(10, 9)
    expect(result.sections[1]!.flowMonitorLoss).toBe(0)
    expect(result.sections[1]!.meterLoss).toBe(0)
    expect(result.sections[1]!.cumulative).toBeCloseTo(result.total, 9)
  })

  it('meldet eine unbekannte Armatur als unvollständig', () => {
    const result = calculateGasSizing(tool, {
      appliances: [{ key: 'a', name: 'Therme', load: 20 }],
      sections: [
        {
          key: 's1',
          lineType: 'standard',
          series: 'kupfer',
          size: 'cu22x1',
          length: 5,
          fittings: {},
          height: 0,
          appliances: ['a'],
          valves: [{ type: 'withoutTae', form: 'angle', dn: 80, count: 1 }],
        },
      ],
    })
    expect(result.incomplete).toBe(true)
    expect(result.sections[0]!.unknownValves).toHaveLength(1)
  })

  it('rechnet den direkten Abgleich mit dem Schließvolumenstrom', () => {
    const input = {
      key: 's1',
      lineType: 'standard',
      series: 'kupfer',
      size: 'cu22x1',
      length: 10,
      fittings: { elbow: 2 },
      height: 3,
      appliances: ['a'],
      valves: [{ type: 'withTae' as const, form: 'straight' as const, dn: 15, count: 1 }],
    }
    const selection = { appliances: [{ key: 'a', name: 'Therme', load: 24 }], meter: 'g4', sections: [input] }
    const k = calculateBalancing(tool, selection, 'k')!
    // GS 4, GS-K: VS = 1,45 · 4 m³/h
    expect(k.size.key).toBe('gs4')
    expect(k.closingFlow).toBeCloseTo(5.8, 9)
    const section = k.sections[0]!
    const pipe = pipeFlowAt(tool, copper, size('cu22x1'), 5.8)!
    expect(section.pipeLoss).toBeCloseTo(pipe.r * 10, 9)
    expect(section.fittingLoss).toBeCloseTo(2 * 1.3 * pipe.dynamicPressure, 9)
    expect(section.flowMonitorLoss).toBeCloseTo(50 * 1.45 ** 2, 9)
    expect(section.meterLoss).toBeCloseTo(30 + 109 * (5.8 / 6) ** 2, 9)
    expect(section.valveLoss).toBeCloseTo(0.64 * 100 * (5.8 / 3.5) ** 2, 9)
    expect(section.heightLoss).toBeCloseTo(heightLoss(tool, 3), 9)
    expect(k.metal).toBe(true)
    expect(k.limit).toBe(2300)
    expect(k.ok).toBe(k.max <= 2300)
    expect(k.typeNotAllowed).toBe(false)
    // GS-M schließt später: mehr Durchfluss, mehr Druckverlust
    const m = calculateBalancing(tool, selection, 'm')!
    expect(m.closingFlow).toBeCloseTo(7.2, 9)
    expect(m.total).toBeGreaterThan(k.total)
    // Lange dünne Leitung: Grenze überschritten
    const long = calculateBalancing(tool, { ...selection, sections: [{ ...input, size: 'cu15x1', length: 40 }] }, 'k')!
    expect(long.ok).toBe(false)
    expect(calculateBalancing(tool, { appliances: [], sections: [input] }, 'k')).toBeUndefined()
  })

  it('zeigt Auswahl und Summe an', () => {
    const html = renderToStaticMarkup(
      <GasSizing
        tool={tool}
        initial={{
          appliances: [{ key: 'a1', name: 'Therme', load: '24' }],
          sections: [
            { key: 's1', lineType: 'standard', series: 'kupfer', size: 'cu22x1', length: '10', height: '', fittings: {}, excluded: [], valves: [] },
          ],
        }}
      />,
    )
    expect(html).toContain('GS 4')
    expect(html).toContain('Gesamtdruckverlust')
    expect(html).toContain('von 300 Pa')
    expect(html).toContain('Direkter Abgleich des GS')
    expect(html).toContain('von 2.300 Pa')
    expect(html).toMatch(/<details[^>]*><summary[^>]*>Rechengrundlage<\/summary>/)
  })
})
