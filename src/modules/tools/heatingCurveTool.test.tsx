import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { HeatingCurveSimulator } from './HeatingCurveSimulator'
import {
  changedParameters,
  checkHeatingCurveTool,
  curveExpressions,
  curveFormulaText,
  comparePoints,
  curveSegments,
  defaultSettings,
  fitCurve,
  flowAt,
  heatingCurveToolSchema,
  limitCrossing,
  pointsFromSettings,
  settingsFromPoints,
  rawFlow,
  roomFor,
  roundToStep,
  symptomObservations,
  toRecommendation,
  type CurveSettings,
  type HeatingCurveTool,
} from './heatingCurveTool'
import { math } from '../../lib/math'
import { isHeatingCurveTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.heizkurve')
if (!entry || !isHeatingCurveTool(entry)) throw new Error('Heizkurven-Tool erwartet')
const tool: HeatingCurveTool = entry
const { model } = tool
const base: CurveSettings = defaultSettings(tool)
const symptom = (key: string) => tool.symptoms.find((candidate) => candidate.key === key)!

describe('Heizkurve: Kennlinie', () => {
  it('liefert die Werte aus der Quelle', () => {
    expect(checkHeatingCurveTool(tool)).toEqual([])
    // ReadMeHeizkurven Abschn. 2.3.1: Neigung 1,4, Niveau 0, RT_soll 17, AT −5 → 50,7 °C
    expect(rawFlow(model, 1.4, 0, 17, -5)).toBeCloseTo(50.65, 1)
    // Abb. 4: Neigung 0,8 → 30 °C, 1,6 → 40 °C
    expect(rawFlow(model, 0.8, 5, 15, 5)).toBeCloseTo(30, 1)
    expect(rawFlow(model, 1.6, 5, 15, 5)).toBeCloseTo(40, 1)
  })

  it('angezeigte Formel rechnet dasselbe wie die Kennlinie', () => {
    const { flow, factor, difference } = curveExpressions(model)
    expect(factor).toContain('247.9 * 10^(-6)')
    for (const [ne, ni, rt, at] of [[1.4, 0, 17, -5], [0.8, 5, 15, 5], [2.2, -4, 21, -18]] as const) {
      const D = math.evaluate(difference, { AT: at, RT: rt }) as number
      const fD = math.evaluate(factor, { D }) as number
      expect(math.evaluate(flow, { RT: rt, Ni: ni, Ne: ne, D, fD })).toBeCloseTo(rawFlow(model, ne, ni, rt, at), 9)
    }
  })

  it('ausgeschriebene Formel und Text stimmen mit den Beiwerten überein', () => {
    const { full, difference } = curveExpressions(model)
    const D = math.evaluate(difference, { AT: -7, RT: 20 }) as number
    expect(math.evaluate(full, { RT: 20, Ni: 2, Ne: 1.3, D })).toBeCloseTo(rawFlow(model, 1.3, 2, 20, -7), 9)
    expect(curveFormulaText(model)).toBe(
      'VL = RT_soll + Niveau − Neigung · D · (1,4347 + 0,021 · D + 247,9 · 10⁻⁶ · D²) mit D = AT − RT_soll',
    )
  })

  it('Fußpunkt: bei AT = Raumsoll liegt der Vorlauf bei Raumsoll + Niveau', () => {
    expect(rawFlow(model, 2.5, 4, 21, 21)).toBe(25)
  })

  it('Niveau verschiebt die Kurve senkrecht um genau die Änderung', () => {
    for (const outdoor of [-15, 0, 12]) {
      expect(rawFlow(model, 1.2, 3, 20, outdoor) - rawFlow(model, 1.2, 0, 20, outdoor)).toBeCloseTo(3, 9)
    }
  })

  it('Raumsoll +1 K hebt den Vorlauf bei Neigung 1 etwa um 2 K', () => {
    const delta = rawFlow(model, 1, 0, 21, -5) - rawFlow(model, 1, 0, 20, -5)
    expect(delta).toBeGreaterThan(1.7)
    expect(delta).toBeLessThan(2.3)
  })

  it('Neigung wirkt bei Kälte stärker als in der Übergangszeit', () => {
    const cold = rawFlow(model, 1.6, 0, 20, -10) - rawFlow(model, 1.4, 0, 20, -10)
    const mild = rawFlow(model, 1.6, 0, 20, 10) - rawFlow(model, 1.4, 0, 20, 10)
    expect(cold).toBeGreaterThan(mild * 2)
  })

  it('Begrenzung und Heizgrenze', () => {
    const settings = { ...base, maxFlow: 50, minFlow: 32, heatingLimit: 16 }
    expect(flowAt(model, settings, -15)).toMatchObject({ flow: 50, limitedBy: 'max' })
    expect(flowAt(model, settings, 15)).toMatchObject({ flow: 32, limitedBy: 'min' })
    expect(flowAt(model, settings, 17).flow).toBeNull()
    expect(flowAt(model, settings, 16).flow).not.toBeNull()
    const crossing = limitCrossing(model, settings, 50, -20, 20)!
    expect(rawFlow(model, settings.neigung, settings.niveau, settings.roomSetpoint, crossing)).toBeCloseTo(50, 3)
    // Heizgrenze trennt die Linie im Diagramm
    const segments = curveSegments(model, settings, -20, 20)
    expect(segments).toHaveLength(1)
    expect(segments[0]!.at(-1)!.outdoor).toBe(16)
  })

  it('reduzierter Betrieb rechnet mit dem reduzierten Raumsoll', () => {
    const settings = { ...base, reducedSetpoint: 17 }
    expect(flowAt(model, settings, 0, true).flow).toBeCloseTo(rawFlow(model, 1.4, 0, 17, 0), 9)
    expect(flowAt(model, { ...base, reducedSetpoint: null }, 0, true).flow).toBeCloseTo(rawFlow(model, 1.4, 0, 20, 0), 9)
  })
})

describe('Heizkurve: Wirkung', () => {
  it('Raumschätzung ist die Umkehrung der Kennlinie', () => {
    const flow = rawFlow(model, base.neigung, base.niveau, 21.5, -3)
    expect(roomFor(model, base, -3, flow)).toBeCloseTo(21.5, 6)
  })

  it('höheres Niveau: gleichmäßig wärmer, Raum wird wärmer', () => {
    const rows = comparePoints(tool, base, { ...base, niveau: 3 })
    for (const row of rows) {
      expect(row.delta).toBeCloseTo(3, 9)
      expect(row.roomDelta!).toBeGreaterThan(0)
    }
    expect(changedParameters(base, { ...base, niveau: 3 })).toEqual(['niveau'])
  })

  it('Raumsoll +1 K: Raum geschätzt genau +1 K', () => {
    for (const row of comparePoints(tool, base, { ...base, roomSetpoint: 21 })) expect(row.roomDelta).toBeCloseTo(1, 4)
  })

  it('Heizgrenze unter dem Vergleichspunkt: kein Vergleich möglich', () => {
    const rows = comparePoints(tool, base, { ...base, heatingLimit: 5 })
    expect(rows.at(-1)!.after.flow).toBeNull()
    expect(rows.at(-1)!.delta).toBeNull()
    expect(rows.at(-1)!.roomDelta).toBeNull()
  })
})

describe('Heizkurve: Einstellung finden', () => {
  it('rechnet das Beispiel der Quelle nach (zwei Messungen)', () => {
    const observations = [
      { outdoor: -5, room: 22.3, flow: rawFlow(model, 1.4, 0, 17, -5) },
      { outdoor: 5, room: 21.7, flow: rawFlow(model, 1.4, 0, 18, 5) },
    ]
    const fit = fitCurve(model, observations, base, 'both')
    expect(fit.ok).toBe(true)
    if (!fit.ok) return
    expect(fit.neigung).toBeCloseTo(1.091, 3)
    expect(fit.niveau).toBeCloseTo(-2.804, 2)
    expect(toRecommendation(tool, fit)).toMatchObject({ neigung: 1.1, niveau: -3, outOfRange: false })
  })

  it('passt das Niveau nach dem Runden der Neigung an die Punkte an', () => {
    const settings = { ...base, neigung: 1.7 }
    const observations = symptomObservations(tool, settings, symptom('kaltUebergang'), 1)
    const fit = fitCurve(model, observations, settings, 'both')
    if (!fit.ok) throw new Error('lösbar erwartet')
    const recommendation = toRecommendation(tool, fit, observations)
    const error = (rec: { neigung: number; niveau: number }) =>
      observations.reduce(
        (sum, observation) =>
          sum + Math.abs(rawFlow(model, rec.neigung, rec.niveau, observation.room, observation.outdoor) - observation.flow),
        0,
      )
    expect(error(recommendation)).toBeLessThanOrEqual(error(toRecommendation(tool, fit)))
    expect(error(recommendation)).toBeLessThan(3)
  })

  it('Wunsch-Vorlauf mit zwei Punkten trifft beide Punkte', () => {
    const observations = [
      { outdoor: -10, flow: 55, room: 20 },
      { outdoor: 10, flow: 32, room: 20 },
    ]
    const fit = fitCurve(model, observations, base, 'both')
    if (!fit.ok) throw new Error('lösbar erwartet')
    for (const observation of observations) {
      expect(rawFlow(model, fit.neigung, fit.niveau, 20, observation.outdoor)).toBeCloseTo(observation.flow, 9)
    }
  })

  it('ein Punkt: nur Niveau oder nur Neigung', () => {
    const observation = [{ outdoor: -10, flow: 60, room: 20 }]
    const niveau = fitCurve(model, observation, base, 'niveau')
    const neigung = fitCurve(model, observation, base, 'neigung')
    if (!niveau.ok || !neigung.ok) throw new Error('lösbar erwartet')
    expect(niveau.neigung).toBe(base.neigung)
    expect(rawFlow(model, niveau.neigung, niveau.niveau, 20, -10)).toBeCloseTo(60, 9)
    expect(neigung.niveau).toBe(base.niveau)
    expect(rawFlow(model, neigung.neigung, neigung.niveau, 20, -10)).toBeCloseTo(60, 9)
  })

  it('meldet unlösbare Eingaben', () => {
    expect(fitCurve(model, [{ outdoor: 20, flow: 25, room: 20 }], base, 'neigung')).toEqual({ ok: false, reason: 'noSlope' })
    const same = [
      { outdoor: 0, flow: 40, room: 20 },
      { outdoor: 0, flow: 42, room: 20 },
    ]
    expect(fitCurve(model, same, base, 'both')).toEqual({ ok: false, reason: 'samePoint' })
  })

  it('Probleme ergeben die Richtung der Quelle', () => {
    const fitFor = (key: string) => {
      const fit = fitCurve(model, symptomObservations(tool, base, symptom(key), 1), base, 'both')
      if (!fit.ok) throw new Error('lösbar erwartet')
      return fit
    }
    expect(fitFor('immerKalt').niveau).toBeGreaterThan(base.niveau)
    expect(fitFor('immerWarm').niveau).toBeLessThan(base.niveau)
    expect(fitFor('kaltBeiFrost').neigung).toBeGreaterThan(base.neigung)
    expect(fitFor('warmBeiFrost').neigung).toBeLessThan(base.neigung)
    const transitionCold = fitFor('kaltUebergang')
    expect(transitionCold.niveau).toBeGreaterThan(base.niveau)
    expect(transitionCold.neigung).toBeLessThan(base.neigung)
    const transitionWarm = fitFor('warmUebergang')
    expect(transitionWarm.niveau).toBeLessThan(base.niveau)
    expect(transitionWarm.neigung).toBeGreaterThan(base.neigung)
  })

  it('rundet auf die Schrittweite und begrenzt auf den Einstellbereich', () => {
    expect(roundToStep(1.449, 0.1)).toBe(1.4)
    expect(roundToStep(1.45, 0.5)).toBe(1.5)
    expect(roundToStep(-2.5, 1)).toBe(-2)
    const recommendation = toRecommendation(tool, { ok: true, neigung: 9, niveau: -40 })
    expect(recommendation).toMatchObject({ neigung: 3.5, niveau: -13, outOfRange: true })
  })
})

describe('Heizkurve: Fußpunkt/Endpunkt', () => {
  it('rechnet zwischen beiden Einstellarten hin und zurück', () => {
    const settings = { ...base, neigung: 1.1, niveau: -3, roomSetpoint: 21 }
    const points = pointsFromSettings(tool, settings, -12)
    expect(points.foot).toBeCloseTo(rawFlow(model, 1.1, -3, 21, tool.twoPoint.footOutdoor), 9)
    const fit = settingsFromPoints(tool, settings, points.foot, points.end, -12)
    if (!fit.ok) throw new Error('lösbar erwartet')
    expect(fit.neigung).toBeCloseTo(1.1, 9)
    expect(fit.niveau).toBeCloseTo(-3, 9)
    expect(changedParameters(settings, { ...settings, ...fit })).toEqual([])
  })

  it('Erklärtexte stimmen: Fußpunkt wirkt in der Übergangszeit, Endpunkt bei Frost', () => {
    const before = pointsFromSettings(tool, base, -10)
    const change = (foot: number, end: number) => {
      const fit = settingsFromPoints(tool, base, foot, end, -10)
      if (!fit.ok) throw new Error('lösbar erwartet')
      const next = { ...base, ...fit }
      return {
        frost: rawFlow(model, next.neigung, next.niveau, 20, -10) - rawFlow(model, base.neigung, base.niveau, 20, -10),
        mild: rawFlow(model, next.neigung, next.niveau, 20, 10) - rawFlow(model, base.neigung, base.niveau, 20, 10),
      }
    }
    const foot = change(before.foot + 5, before.end)
    expect(Math.abs(foot.mild)).toBeGreaterThan(Math.abs(foot.frost) + 1)
    const end = change(before.foot, before.end + 5)
    expect(Math.abs(end.frost)).toBeGreaterThan(Math.abs(end.mild) + 1)
    // Außentemperatur des Endpunkts ändert die Kurve nicht
    const moved = pointsFromSettings(tool, base, -15)
    const fit = settingsFromPoints(tool, base, moved.foot, moved.end, -15)
    if (!fit.ok) throw new Error('lösbar erwartet')
    expect(fit.neigung).toBeCloseTo(base.neigung, 9)
  })

  it('höherer Endpunkt: steilere Kurve, Fußpunkt bleibt', () => {
    const points = pointsFromSettings(tool, base, -10)
    const fit = settingsFromPoints(tool, base, points.foot, points.end + 5, -10)
    if (!fit.ok) throw new Error('lösbar erwartet')
    expect(fit.neigung).toBeGreaterThan(base.neigung)
    expect(pointsFromSettings(tool, { ...base, ...fit }, -10).foot).toBeCloseTo(points.foot, 9)
  })

  it('zeigt Punkte im Diagramm und blendet „Wunsch-Vorlauf“ aus', () => {
    const html = renderToStaticMarkup(<HeatingCurveSimulator tool={tool} initialSettingMode="points" />)
    expect(html).toContain('Fußpunkt (Vorlauf bei +20 °C außen)')
    expect(html).toMatch(/Endpunkt \d+ °C/)
    expect(html).toContain('Entspricht Neigung 1,40 und Niveau 0,0 K')
    expect(html).not.toContain('Wunsch-Vorlauf')
  })
})

describe('Heizkurve: Inhalt', () => {
  it('Build-Prüfung findet Fehler', () => {
    const broken = heatingCurveToolSchema.parse({
      ...tool,
      model: { ...tool.model, examples: [{ ...tool.model.examples[0]!, flow: 60 }] },
      symptoms: [{ ...symptom('kaltUebergang'), neigung: 'up' }],
      infos: [{ ...tool.infos[0]!, ref: { source: 'unbekannt', where: 'S. 1' } }],
    })
    const issues = checkHeatingCurveTool(broken)
    expect(issues.some((issue) => issue.startsWith('model.examples[0]'))).toBe(true)
    expect(issues.some((issue) => issue.includes('Rückrechnung ergibt Neigung down'))).toBe(true)
    expect(issues.some((issue) => issue.includes('unbekannte Quelle "unbekannt"'))).toBe(true)
  })

  it('ist in der Suche zu finden', () => {
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    expect(document.keywords).toEqual(expect.arrayContaining(['Heizkennlinie', 'Neigung', 'Immer zu kalt']))
  })
})

describe('Heizkurve: Anzeige', () => {
  const render = (props: Partial<Parameters<typeof HeatingCurveSimulator>[0]> = {}) =>
    renderToStaticMarkup(<HeatingCurveSimulator tool={tool} {...props} />)

  it('zeigt Diagramm, Einstellung, Hinweise und Rechenweg', () => {
    const html = render()
    expect(html).toContain('role="img"')
    expect(html).toContain('Neigung')
    expect(html).toContain('Niveau')
    expect(html).toContain('Gleich wie die Ausgangseinstellung')
    expect(html).toContain('Wichtig beim Einstellen')
    expect(html).toContain('1,4347')
  })

  it('beschreibt die Wirkung einer steileren Kurve', () => {
    const html = render({ initialSettings: { neigung: 1.8 } })
    expect(html).toContain('vor allem bei Kälte')
    expect(html).toContain('Neue Einstellung')
    expect(html).toContain('Ausgang')
  })

  it('beschreibt die Wirkung des Niveaus', () => {
    expect(render({ initialSettings: { niveau: 3 } })).toContain('Der Vorlauf ändert sich gleichmäßig um etwa +3,0 K')
  })

  it('beschreibt Heizgrenze und Begrenzung', () => {
    const html = render({ initialSettings: { niveau: 3, heatingLimit: 15, maxFlow: 55 } })
    expect(html).toContain('Die Kurve dreht sich: Bei -10 °C (Frost) liegt der Vorlauf 8,2 K niedriger')
    expect(html).toContain('Über 15 °C Außentemperatur schaltet der Heizbetrieb jetzt ab')
    expect(html).toContain('Max. 55 °C')
    expect(html).toContain('Heizgrenze 15 °C')
    expect(html).toContain('Max./Min.-Begrenzung')
    expect(html).toContain('Maximalbegrenzung (maximale Vorlauftemperatur)')
    expect(html).toContain('Die Maximalbegrenzung 55 °C greift unter etwa -1 °C Außentemperatur: Wird es kälter')
  })

  it('Problem „Übergangszeit zu kalt“: Regel und Empfehlung', () => {
    const html = render({ initialSymptom: 'kaltUebergang' })
    expect(html).toContain('Niveau erhöhen und Neigung senken')
    expect(html).toContain('Errechnete Einstellung')
    expect(html).toContain('Übernehmen und Wirkung zeigen')
  })

  it('Messung mit einem Punkt bietet Niveau oder Neigung an', () => {
    const html = render({
      initialMode: 'measurement',
      initialRows: [
        ['-5', '19'],
        ['', ''],
      ],
    })
    expect(html).toContain('Nur Niveau ändern')
    expect(html).toContain('Nur Neigung ändern')
  })

  it('Wunsch-Vorlauf mit zwei Punkten', () => {
    const html = render({
      initialMode: 'target',
      initialRows: [
        ['-10', '55'],
        ['10', '32'],
      ],
    })
    expect(html).toContain('Empfehlung: Neigung und Niveau')
  })
})
