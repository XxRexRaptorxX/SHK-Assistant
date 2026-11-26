import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { PressureSwitchSizing } from './PressureSwitchSizing'
import { checkCondensing, checkPressureSwitchTool, evaluatePressureSwitch, maxCondensingTemperature, type PressureSwitchTool } from './pressureSwitchTool'
import { tablePoints } from './refrigerantTool'
import { isPressureSwitchTool, isRefrigerantTool } from './schema'
import { filterTools, toolEntries } from './tools'

const entry = toolEntries.find((candidate) => candidate.id === 'tool.hochdruckschalter')
if (!entry || !isPressureSwitchTool(entry)) throw new Error('Hochdruckschalter-Tool erwartet')
const tool: PressureSwitchTool = entry
const tableEntry = toolEntries.find((candidate) => candidate.id === tool.pressureTable)
if (!tableEntry || !isRefrigerantTool(tableEntry)) throw new Error('Dampfdrucktabelle erwartet')
const table = tableEntry

const setup = (key: string) => tool.setups.find((candidate) => candidate.key === key)!
const points = (name: string) => tablePoints(table, table.refrigerants.find((refrigerant) => refrigerant.name === name)!)
const round1 = (value: number) => Math.round(value * 10) / 10

describe('Hochdruckschalter: Einstellwert', () => {
  it('ist fehlerfrei, öffentlich und als ungeprüft markiert', () => {
    expect(checkPressureSwitchTool(tool)).toEqual([])
    expect(tool.status).toBe('draft')
    expect(tool.visibility).toBe('public')
    expect(tool.category).toBe('Auslegung')
  })

  // Referenzwerte aus den Beispielen der Quelle (Copeland ATS-DE-1910)
  it('Beispiel 1: PS 45 bar, nur Schalter → Einstellung 45 bar, Abschaltung 41,4 … 45 bar, Werksprüfung über 49,5 bar', () => {
    const result = evaluatePressureSwitch(tool, setup('switchOnly'), 45)
    expect(round1(result.switchSetting)).toBe(45)
    expect(round1(result.tripLow)).toBe(41.4)
    expect(result.reliefValve).toBeNull()
    expect(round1(result.factoryTest)).toBe(49.5)
  })

  it('Beispiel 2: PS 45 bar mit Ventil → Schalter 40,5 bar, Abschaltung ab 37,3 bar, Ventil höchstens 45 bar', () => {
    const result = evaluatePressureSwitch(tool, setup('withValve'), 45)
    expect(round1(result.switchSetting)).toBe(40.5)
    expect(round1(result.tripLow)).toBe(37.3)
    expect(round1(result.reliefValve!)).toBe(45)
  })

  it('Beispiel 3: PS 50 bar mit Ventil → Schalter 45 bar, Abschaltung ab 41,4 bar, Ventil 50 bar, Werksprüfung über 55 bar', () => {
    const result = evaluatePressureSwitch(tool, setup('withValve'), 50)
    expect(round1(result.switchSetting)).toBe(45)
    expect(round1(result.tripLow)).toBe(41.4)
    expect(round1(result.reliefValve!)).toBe(50)
    expect(round1(result.factoryTest)).toBe(55)
  })

  it('prüft die Verflüssigungstemperatur mit der Dampfdrucktabelle', () => {
    // R32 bei 60 °C: 38,33 bar laut Tabelle; unter 41,4 bar → passt
    const ok = checkCondensing(points('R32'), 60, 41.4)
    expect(ok.kind).toBe('ok')
    if (ok.kind === 'ok') expect(ok.margin).toBeCloseTo(41.4 - 38.33, 6)
    // R32 bei 64 °C: 41,91 bar → zu hoch
    expect(checkCondensing(points('R32'), 64, 41.4).kind).toBe('tooHigh')
    expect(checkCondensing(points('R32'), 80, 41.4).kind).toBe('outOfRange')
  })

  it('nennt die höchste Verflüssigungstemperatur unter dem Abschaltfenster', () => {
    // 41,4 bar liegt bei R32 zwischen 62 °C (40,09 bar) und 64 °C (41,91 bar)
    const highest = maxCondensingTemperature(points('R32'), 41.4)
    expect(highest.kind).toBe('value')
    if (highest.kind === 'value') expect(highest.temperature).toBeCloseTo(62 + (2 * (41.4 - 40.09)) / (41.91 - 40.09), 6)
    // R290 erreicht bei 70 °C nur 24,9 bar
    expect(maxCondensingTemperature(points('R290'), 41.4).kind).toBe('aboveTable')
  })

  it('zeigt Einstellwerte, Ventil und Prüfung auf der Seite', () => {
    const html = renderToStaticMarkup(<PressureSwitchSizing tool={tool} entries={toolEntries} initialRefrigerant="R32" />)
    expect(html).toContain('Sicherheitsdruckschalter')
    expect(html).toContain('45,0 bar')
    expect(html).toContain('41,4')
    expect(html).toContain('Passt')
    expect(html).toContain('Quelle: Copeland ATS-DE-1910')
  })

  it('erklärt PS mit Quelle im Aufklapper unter der Eingabe', () => {
    expect(tool.inputs.ps.explanations.map((explanation) => explanation.title)).toContain('Was ist PS?')
    const html = renderToStaticMarkup(<PressureSwitchSizing tool={tool} entries={toolEntries} />)
    expect(html).toContain('Was ist PS?')
    expect(html).toContain('Quelle: Druckgeräteverordnung (14. ProdSV), § 2 Nr. 8')
    // Im ersten Aufklapper „Was bewirkt das?“ (details), nicht offen darunter
    const firstHelp = html.slice(html.indexOf('<details'), html.indexOf('</details>'))
    expect(firstHelp).toContain('Was ist PS?')
    expect(firstHelp).toContain('Bezug für die Sicherheitseinrichtungen')
  })

  it('ist über die Suche zu finden', () => {
    expect(filterTools(toolEntries, 'Hochdruckwächter').map((candidate) => candidate.id)).toContain('tool.hochdruckschalter')
  })
})
