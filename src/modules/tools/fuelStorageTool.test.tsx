import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { FuelStorage } from './FuelStorage'
import {
  checkFuelStorageTool,
  classifyStorage,
  rulesForStorage,
  type FuelStorageTool,
} from './fuelStorageTool'
import { isFuelStorageTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.brennstofflagerung')
if (!entry || !isFuelStorageTool(entry)) throw new Error('Brennstofflagerungs-Tool erwartet')
const tool: FuelStorageTool = entry

const ruleKeys = (regulation: string, fuel: string, quantity: number) =>
  rulesForStorage(tool, regulation, fuel, quantity).map((rule) => rule.key)

describe('Brennstofflagerung', () => {
  it('ist fehlerfrei und bleibt ungeprüft, bis der Inhaber freigibt', () => {
    expect(checkFuelStorageTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.verifiedBy).toBe('')
  })

  it('stuft die Beispiele aus den Quellen richtig ein', () => {
    for (const example of tool.examples) {
      const classification = classifyStorage(tool, example.regulation, example.fuel, example.quantity)
      expect(classification?.storageRoom, example.label).toBe(example.storageRoom)
      const shown = ruleKeys(example.regulation, example.fuel, example.quantity)
      expect(shown, example.label).toEqual(expect.arrayContaining(example.rules))
      for (const ruleKey of example.notRules) expect(shown, `${example.label}: ${ruleKey}`).not.toContain(ruleKey)
    }
  })

  it('verlangt den Brennstofflagerraum erst über der Grenze', () => {
    expect(classifyStorage(tool, 'mfeuv', 'heizoel', 5000)?.storageRoom).toBe(false)
    expect(classifyStorage(tool, 'mfeuv', 'heizoel', 5000.5)?.storageRoom).toBe(true)
    expect(classifyStorage(tool, 'mfeuv', 'festeBrennstoffe', 15000)?.storageRoom).toBe(false)
    expect(classifyStorage(tool, 'mfeuv', 'festeBrennstoffe', 15001)?.storageRoom).toBe(true)
    expect(classifyStorage(tool, 'bayern', 'pellets', 10001)?.storageRoom).toBe(true)
  })

  it('meldet mehr als das zulässige Fassungsvermögen je Lagerraum', () => {
    expect(classifyStorage(tool, 'mfeuv', 'heizoel', 100000)?.overMax).toBe(false)
    expect(classifyStorage(tool, 'mfeuv', 'heizoel', 100001)?.overMax).toBe(true)
    expect(classifyStorage(tool, 'mfeuv', 'pellets', 1e9)?.overMax).toBe(false)
  })

  it('sortiert nach Thema und innerhalb eines Themas Vorschriften vor Empfehlungen', () => {
    const rules = rulesForStorage(tool, 'mfeuv', 'pellets', 8000)
    const topicIndex = rules.map((rule) => tool.topics.findIndex((topic) => topic.key === rule.topic))
    expect(topicIndex).toEqual([...topicIndex].sort((a, b) => a - b))
    const brandschutz = rules.filter((rule) => rule.topic === 'brandschutz').map((rule) => rule.binding)
    expect(brandschutz.at(-1)).toBe('empfehlung')
    expect(brandschutz[0]).toBe('pflicht')
  })

  it('zeigt die Heizöl-Stufen der Feuerungsverordnung je Menge', () => {
    expect(ruleKeys('mfeuv', 'heizoel', 100)).toContain('oelWohnung')
    expect(ruleKeys('mfeuv', 'heizoel', 101)).toContain('oelBis1000')
    expect(ruleKeys('mfeuv', 'heizoel', 1001)).toEqual(expect.arrayContaining(['oelBis5000', 'awsvFachbetrieb']))
    expect(ruleKeys('bayern', 'heizoel', 1001)).toContain('oelBis5000Bayern')
    expect(ruleKeys('bayern', 'heizoel', 1001)).not.toContain('notschalter')
  })

  it('findet Fehler im Inhalt', () => {
    const broken: FuelStorageTool = {
      ...tool,
      rules: [
        ...tool.rules,
        {
          ...tool.rules[0]!,
          key: 'kaputt',
          topic: 'unbekannt',
          // Pellets zählen je Regelwerk in kg bzw. l: Mengengrenzen über beide Regelwerke sind nicht eindeutig
          applies: [{ regulations: [], fuels: ['pellets', 'holz'], above: 10 }],
        },
      ],
      examples: [{ ...tool.examples[0]!, storageRoom: true }],
    }
    const issues = checkFuelStorageTool(broken)
    expect(issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining('unbekanntes Thema "unbekannt"'),
        expect.stringContaining('unbekannter Brennstoff "holz"'),
        expect.stringContaining('verschiedenen Einheiten'),
        expect.stringContaining('examples[0]'),
      ]),
    )
  })

  it('zeigt Einstufung, Themen und Quellen an', () => {
    const html = renderToStaticMarkup(<FuelStorage tool={tool} initialFuel="pellets" initialAmount="8000" />)
    expect(html).toContain('Brennstofflagerraum erforderlich')
    expect(html).toContain('8.000 kg')
    expect(html).toContain('Belüftung')
    expect(html).toContain('Beschilderung')
    expect(html).toContain('Vorschrift')
    expect(html).toContain('Empfehlung')
    expect(html).toContain('MFeuV § 11 Abs. 1 Satz 1 Nr. 1')
  })

  it('fragt erst nach Brennstoff und Menge', () => {
    expect(renderToStaticMarkup(<FuelStorage tool={tool} />)).toContain('Brennstoff wählen.')
    const html = renderToStaticMarkup(<FuelStorage tool={tool} initialFuel="heizoel" />)
    expect(html).toContain('Lagermenge eingeben.')
    expect(html).not.toContain('Einstufung nach')
  })

  it('zählt Pellets in Bayern in Litern', () => {
    const html = renderToStaticMarkup(<FuelStorage tool={tool} initialRegulation="bayern" initialFuel="pellets" initialAmount="9000" />)
    expect(html).toContain('Noch kein Brennstofflagerraum nötig')
    expect(html).toContain('9.000 l')
  })

  it('ist über Brennstoffe und Begriffe auffindbar', () => {
    const document = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    expect(document.keywords).toEqual(expect.arrayContaining(['Holzpellets', 'Heizöl', 'Beschilderung', 'Bayern (FeuV)']))
  })
})
