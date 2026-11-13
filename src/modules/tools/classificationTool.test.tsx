import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { ClassificationLookup } from './ClassificationLookup'
import {
  checkClassificationTool,
  classify,
  computeValue,
  hasOpenCondition,
  questionsFor,
  rulesFor,
  type ClassificationTool,
} from './classificationTool'
import { isClassificationTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

function classificationTool(id: string): ClassificationTool {
  const entry = toolEntries.find((candidate) => candidate.id === id)
  if (!entry || !isClassificationTool(entry)) throw new Error(`Einstufungs-Tool ${id} erwartet`)
  return entry
}

const fuelStorage = classificationTool('tool.brennstofflagerung')
const heatingRoom = classificationTool('tool.heizraum')
const tools = [fuelStorage, heatingRoom]

const ruleKeys = (tool: ClassificationTool, regulation: string, fuel: string, quantity: number) =>
  rulesFor(tool, regulation, fuel, quantity).map((rule) => rule.key)

describe.each(tools.map((tool) => [tool.title, tool] as const))('Einstufungs-Tool %s', (_title, tool) => {
  it('ist fehlerfrei und bleibt ungeprüft, bis der Inhaber freigibt', () => {
    expect(checkClassificationTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
  })

  it('stuft die Beispiele aus den Quellen richtig ein und rechnet ihre Werte nach', () => {
    for (const example of tool.examples) {
      expect(classify(tool, example.regulation, example.fuel, example.quantity)?.overLimit, example.label).toBe(example.overLimit)
      const shown = rulesFor(tool, example.regulation, example.fuel, example.quantity, example.answers)
      const shownKeys = shown.map((rule) => rule.key)
      expect(shownKeys, example.label).toEqual(expect.arrayContaining(example.rules))
      for (const ruleKey of example.notRules) expect(shownKeys, `${example.label}: ${ruleKey}`).not.toContain(ruleKey)
      for (const expected of example.values) {
        const rule = shown.find((candidate) => candidate.key === expected.rule)
        expect(rule?.computed, `${example.label}: ${expected.rule}`).toBeDefined()
        expect(computeValue(rule!.computed!, example.quantity)).toBeCloseTo(expected.value, 9)
      }
    }
  })

  it('sortiert nach Thema und innerhalb eines Themas Vorschriften vor Empfehlungen', () => {
    for (const regulation of tool.regulations) {
      for (const limit of regulation.limits) {
        const rules = rulesFor(tool, regulation.key, limit.fuel, limit.above * 2)
        const ranks = rules.map((rule) => [
          tool.topics.findIndex((topic) => topic.key === rule.topic),
          rule.binding === 'pflicht' ? 0 : 1,
        ])
        const sorted = [...ranks].sort((a, b) => a[0]! - b[0]! || a[1]! - b[1]!)
        expect(ranks).toEqual(sorted)
      }
    }
  })

  it('ist über Brennstoffe und Begriffe auffindbar', () => {
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    expect(document.keywords).toEqual(expect.arrayContaining([tool.fuels[0]!.name, tool.topics[0]!.label, 'Bayern (FeuV)']))
  })
})

describe('Brennstofflagerung', () => {
  it('verlangt den Brennstofflagerraum erst über der Grenze', () => {
    expect(classify(fuelStorage, 'mfeuv', 'heizoel', 5000)?.overLimit).toBe(false)
    expect(classify(fuelStorage, 'mfeuv', 'heizoel', 5000.5)?.overLimit).toBe(true)
    expect(classify(fuelStorage, 'mfeuv', 'festeBrennstoffe', 15000)?.overLimit).toBe(false)
    expect(classify(fuelStorage, 'mfeuv', 'festeBrennstoffe', 15001)?.overLimit).toBe(true)
    expect(classify(fuelStorage, 'bayern', 'pellets', 10001)?.overLimit).toBe(true)
  })

  it('meldet mehr als das zulässige Fassungsvermögen je Lagerraum', () => {
    expect(classify(fuelStorage, 'mfeuv', 'heizoel', 100000)?.overMax).toBe(false)
    expect(classify(fuelStorage, 'mfeuv', 'heizoel', 100001)?.overMax).toBe(true)
    expect(classify(fuelStorage, 'mfeuv', 'pellets', 1e9)?.overMax).toBe(false)
  })

  it('zeigt die Heizöl-Stufen der Feuerungsverordnung je Menge', () => {
    expect(ruleKeys(fuelStorage, 'mfeuv', 'heizoel', 100)).toContain('oelWohnung')
    expect(ruleKeys(fuelStorage, 'mfeuv', 'heizoel', 101)).toContain('oelBis1000')
    expect(ruleKeys(fuelStorage, 'mfeuv', 'heizoel', 1001)).toEqual(expect.arrayContaining(['oelBis5000', 'awsvFachbetrieb']))
    expect(ruleKeys(fuelStorage, 'bayern', 'heizoel', 1001)).toContain('oelBis5000Bayern')
    expect(ruleKeys(fuelStorage, 'bayern', 'heizoel', 1001)).not.toContain('notschalter')
  })

  it('zeigt Einstufung, Themen und Quellen an', () => {
    const html = renderToStaticMarkup(<ClassificationLookup tool={fuelStorage} initialFuel="pellets" initialAmount="8000" />)
    expect(html).toContain('Brennstofflagerraum erforderlich')
    expect(html).toContain('8.000 kg')
    expect(html).toContain('Beschilderung')
    expect(html).toContain('Vorschrift')
    expect(html).toContain('Empfehlung')
    expect(html).toContain('MFeuV § 11 Abs. 1 Satz 1 Nr. 1')
  })

  it('fragt erst nach Brennstoff und Menge', () => {
    expect(renderToStaticMarkup(<ClassificationLookup tool={fuelStorage} />)).toContain('Brennstoff wählen.')
    const html = renderToStaticMarkup(<ClassificationLookup tool={fuelStorage} initialFuel="heizoel" />)
    expect(html).toContain('Lagermenge eingeben.')
    expect(html).not.toContain('Einstufung nach')
  })

  it('zählt Pellets in Bayern in Litern', () => {
    const html = renderToStaticMarkup(
      <ClassificationLookup tool={fuelStorage} initialRegulation="bayern" initialFuel="pellets" initialAmount="9000" />,
    )
    expect(html).toContain('Noch kein Brennstofflagerraum nötig')
    expect(html).toContain('9.000 l')
  })
})

describe('Heizraum und Aufstellraum', () => {
  it('verlangt den Heizraum für feste Brennstoffe erst über 50 kW, den Aufstellraum für Öl und Gas über 100 kW', () => {
    expect(classify(heatingRoom, 'mfeuv', 'fest', 50)?.overLimit).toBe(false)
    expect(classify(heatingRoom, 'mfeuv', 'fest', 50.1)?.overLimit).toBe(true)
    expect(classify(heatingRoom, 'mfeuv', 'fluessig', 100)?.overLimit).toBe(false)
    expect(classify(heatingRoom, 'bayern', 'gas', 101)?.overLimit).toBe(true)
  })

  it('rechnet den Querschnitt der Verbrennungsluft nur für den Teil über 50 kW hoch', () => {
    const rule = heatingRoom.rules.find((candidate) => candidate.key === 'luftUeber50')!
    expect(computeValue(rule.computed!, 51)).toBe(152)
    expect(computeValue(rule.computed!, 75.5)).toBe(201)
  })

  it('zeigt Bayerns Regel bis 35 kW nur in Bayern', () => {
    expect(ruleKeys(heatingRoom, 'bayern', 'gas', 35)).toContain('luftBis35Bayern')
    expect(ruleKeys(heatingRoom, 'bayern', 'gas', 35.5)).not.toContain('luftBis35Bayern')
    expect(ruleKeys(heatingRoom, 'mfeuv', 'gas', 20)).not.toContain('luftBis35Bayern')
  })

  it('zeigt Einstufung und errechnete Mindestwerte an', () => {
    const html = renderToStaticMarkup(<ClassificationLookup tool={heatingRoom} initialFuel="fest" initialAmount="60" />)
    expect(html).toContain('Heizraum erforderlich')
    expect(html).toContain('Gesamtnennleistung')
    expect(html).toContain('Mindestquerschnitt ins Freie bei 60 kW:')
    expect(html).toContain('170 cm²')
    expect(html).toContain('Feuerstätte oder Anlage')
  })

  it('zählt beim Umkreis der Mündung jede angefangene Stufe und begrenzt ihn', () => {
    const rule = heatingRoom.rules.find((candidate) => candidate.key === 'muendungUmkreisFest')!
    expect(computeValue(rule.computed!, 30)).toBe(15)
    expect(computeValue(rule.computed!, 50)).toBe(15)
    expect(computeValue(rule.computed!, 50.5)).toBe(17)
    expect(computeValue(rule.computed!, 100)).toBe(17)
    expect(computeValue(rule.computed!, 101)).toBe(19)
    expect(computeValue(rule.computed!, 10000)).toBe(40)
  })

  it('stuft BHKW ab 35 kW und elektrische Wärmepumpen ab 50 kW Antriebsleistung ein', () => {
    expect(classify(heatingRoom, 'mfeuv', 'bhkw', 35)?.overLimit).toBe(false)
    expect(classify(heatingRoom, 'mfeuv', 'bhkw', 36)?.overLimit).toBe(true)
    expect(classify(heatingRoom, 'bayern', 'wpElektrisch', 51)?.overLimit).toBe(true)
    // Für elektrische Wärmepumpen gelten weder Verbrennungsluft noch Abgasregeln
    const rules = ruleKeys(heatingRoom, 'mfeuv', 'wpElektrisch', 80)
    expect(rules).toEqual(expect.arrayContaining(['aufstellraumAnlage', 'wpElektrischHinweis']))
    expect(rules.some((key) => key.startsWith('luft') || key.startsWith('muendung'))).toBe(false)
  })

  it('zeigt Feststoffen einen Schornstein und Öl und Gas die Abgasleitung', () => {
    expect(ruleKeys(heatingRoom, 'mfeuv', 'fest', 20)).toContain('abgasSchornstein')
    expect(ruleKeys(heatingRoom, 'mfeuv', 'fest', 20)).not.toContain('abgasLeitung')
    expect(ruleKeys(heatingRoom, 'mfeuv', 'gas', 20)).toEqual(expect.arrayContaining(['abgasLeitung', 'aussenwandMfeuv']))
  })
})

describe('Einstufungs-Tools: optionale Fragen', () => {
  it('fragt nur, was bei der Auswahl eine Vorschrift betrifft', () => {
    const gas = questionsFor(heatingRoom, 'mfeuv', 'gas', 30).map((question) => question.key)
    expect(gas).toEqual(expect.arrayContaining(['raumluftabhaengig', 'stroemungssicherung', 'aussenwand']))
    // Offener Kamin nur bei festen Brennstoffen, Heizöl-Absperrung erst über der Grenze
    expect(gas).not.toContain('offenerKamin')
    expect(questionsFor(heatingRoom, 'mfeuv', 'fest', 30).map((question) => question.key)).toContain('offenerKamin')
    expect(questionsFor(heatingRoom, 'mfeuv', 'fluessig', 80).map((question) => question.key)).not.toContain('heizoelImRaum')
    expect(questionsFor(heatingRoom, 'mfeuv', 'fluessig', 120).map((question) => question.key)).toContain('heizoelImRaum')
    expect(questionsFor(heatingRoom, 'mfeuv', 'wpElektrisch', 80).map((question) => question.key)).toEqual(['kombination'])
  })

  it('lässt Fragen weg, deren Vorschriften andere Antworten schon ausschließen', () => {
    const keys = (answers: Record<string, boolean>) =>
      questionsFor(heatingRoom, 'mfeuv', 'gas', 30, answers).map((question) => question.key)
    expect(keys({})).toContain('absaugendeAnlage')
    expect(keys({ raumluftabhaengig: false })).not.toContain('absaugendeAnlage')
    // Die beantwortete Frage selbst bleibt, damit man die Antwort ändern kann
    expect(keys({ raumluftabhaengig: false })).toContain('raumluftabhaengig')
  })

  it('blendet bei offenen Fragen nichts aus, bei Nein die Vorschrift und bei Ja nur die Bedingung', () => {
    const open = ruleKeys(heatingRoom, 'mfeuv', 'gas', 30)
    expect(open).toEqual(expect.arrayContaining(['luftBis50Mfeuv', 'aussenwandMfeuv']))

    const independent = rulesFor(heatingRoom, 'mfeuv', 'gas', 30, { raumluftabhaengig: false }).map((rule) => rule.key)
    expect(independent).not.toContain('luftBis50Mfeuv')
    expect(independent).toContain('aussenwandMfeuv')

    const luft = heatingRoom.rules.find((rule) => rule.key === 'luftBis50Mfeuv')!
    expect(hasOpenCondition(heatingRoom, luft, 'mfeuv', 'gas', {})).toBe(true)
    // Die Frage nach dem offenen Kamin zählt bei Gas nicht mit
    expect(hasOpenCondition(heatingRoom, luft, 'mfeuv', 'gas', { raumluftabhaengig: true })).toBe(false)
    expect(hasOpenCondition(heatingRoom, luft, 'mfeuv', 'fest', { raumluftabhaengig: true })).toBe(true)
  })

  it('zeigt die Fragen aufklappbar und die Bedingung nur, solange sie offen ist', () => {
    const open = renderToStaticMarkup(<ClassificationLookup tool={heatingRoom} initialFuel="gas" initialAmount="30" />)
    expect(open).toContain('Weitere Angaben (optional)')
    expect(open).toContain('0 von')
    expect(open).toContain('Gilt, wenn: Bei raumluftabhängigen Feuerstätten')

    const answered = renderToStaticMarkup(
      <ClassificationLookup tool={heatingRoom} initialFuel="gas" initialAmount="30" initialAnswers={{ raumluftabhaengig: false }} />,
    )
    expect(answered).toContain('1 von')
    expect(answered).not.toContain('Verbrennungsluft bis 50 kW')
    expect(answered).toMatch(/\d+ Vorschriften sind ausgeblendet/)
  })

  it('verlinkt Hochwasserkarten, den bayerischen Dienst nur bei Bayern', () => {
    const muster = renderToStaticMarkup(<ClassificationLookup tool={fuelStorage} initialFuel="heizoel" initialAmount="3000" />)
    expect(muster).toContain('https://geoportal.bafg.de/karten/HWRM/')
    expect(muster).not.toContain('iug.bayern.de')
    const bayern = renderToStaticMarkup(
      <ClassificationLookup tool={fuelStorage} initialRegulation="bayern" initialFuel="heizoel" initialAmount="3000" />,
    )
    expect(bayern).toContain('https://www.iug.bayern.de/')
  })

  it('zeigt ohne passende Fragen keinen Bereich für Angaben', () => {
    // Bayern kennt die Regel zur Kombination mit Feuerstätten nicht: keine Frage für die elektrische Wärmepumpe
    const html = renderToStaticMarkup(
      <ClassificationLookup tool={heatingRoom} initialRegulation="bayern" initialFuel="wpElektrisch" initialAmount="20" />,
    )
    expect(html).not.toContain('Weitere Angaben')
  })
})

describe('Einstufungs-Tools: Prüfung des Inhalts', () => {
  it('verlangt zu jeder Bedingung eine Frage', () => {
    const broken: ClassificationTool = {
      ...heatingRoom,
      rules: heatingRoom.rules.map((rule) =>
        rule.key === 'bodenbelagFest' ? { ...rule, ask: [] } : rule.key === 'verboteneOrte' ? { ...rule, ask: [{ question: 'gibtsNicht', is: true }] } : rule,
      ),
    }
    expect(checkClassificationTool(broken)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('condition ohne ask'),
        expect.stringContaining('ask ohne condition'),
        expect.stringContaining('unbekannte Frage "gibtsNicht"'),
        expect.stringContaining('keine Vorschrift fragt danach'),
      ]),
    )
  })

  it('findet Fehler im Inhalt', () => {
    const broken: ClassificationTool = {
      ...fuelStorage,
      rules: [
        ...fuelStorage.rules,
        {
          ...fuelStorage.rules[0]!,
          key: 'kaputt',
          topic: 'unbekannt',
          // Pellets zählen je Regelwerk in kg bzw. l: Mengengrenzen über beide Regelwerke sind nicht eindeutig
          applies: [{ regulations: [], fuels: ['pellets', 'holz'], above: 10 }],
        },
      ],
      examples: [{ ...fuelStorage.examples[0]!, overLimit: true, values: [{ rule: 'oelWohnung', value: 1 }] }],
    }
    expect(checkClassificationTool(broken)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unbekanntes Thema "unbekannt"'),
        expect.stringContaining('unbekannter Brennstoff "holz"'),
        expect.stringContaining('verschiedenen Einheiten'),
        expect.stringContaining('erwartet das Gegenteil'),
      ]),
    )
  })

  it('meldet falsch nachgerechnete Werte', () => {
    const broken: ClassificationTool = {
      ...heatingRoom,
      examples: [{ ...heatingRoom.examples[1]!, values: [{ rule: 'luftUeber50', value: 999 }] }],
    }
    expect(checkClassificationTool(broken)).toEqual([expect.stringContaining('ergibt 170 statt 999')])
  })
})
