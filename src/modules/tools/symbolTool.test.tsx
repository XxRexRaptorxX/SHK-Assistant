import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { isSymbolTool } from './schema'
import { SymbolLookup } from './SymbolLookup'
import { checkSymbolTool, filterSymbolGroups, symbolToolSchema, type SymbolTool } from './symbolTool'
import { toolEntries, toolSearchDocuments } from './tools'

const tool = toolEntries.find((entry) => entry.id === 'tool.sinnbilder')
if (!tool || !isSymbolTool(tool)) throw new Error('Sinnbild-Tool erwartet')
const symbols: SymbolTool = tool

// Lange Namen enthalten weiche Trennstellen (\u00AD) für schmale Bildschirme
const plain = (text: string) => text.replace(/\u00ad/g, '')
const names = (query: string) =>
  filterSymbolGroups(symbols, query).flatMap((group) => group.symbols.map((symbol) => plain(symbol.name)))

describe('Sinnbilder', () => {
  it('ist fehlerfrei und deckt alle Bereiche der Vorlage ab', () => {
    expect(checkSymbolTool(symbols)).toEqual([])
    const norms = new Set(symbols.groups.map((group) => group.norm))
    expect(norms).toEqual(
      new Set([
        'DIN EN 806-1:2001-12',
        'DIN 28000-4:2014-07',
        'DVGW-TRGI 2018',
        'DIN 1986-100:2016-12',
        'DIN 19227-2:1991-02',
        'DIN EN 60617-3, -4, -6, -7, -9, -11:1997-08',
        'DIN EN 806-1, Planungspraxis',
        'DIN 2403:2014-06',
      ]),
    )
    expect(symbols.status).toBe('draft')
  })

  it('findet Sinnbilder über Name, Suchbegriff und Gruppe, auch ohne Umlaute', () => {
    expect(names('Kugelhahn')).toEqual(['Kugelhahn'])
    expect(names('rv')).toContain('Rückflussverhinderer')
    expect(names('ruckfluss')).toEqual([])
    expect(names('rueckfluss')).toContain('Rückflussverhinderer')
    expect(names('Heizungsanlagen pumpe')).toEqual(['Umwälzpumpe'])
    expect(names('')).toHaveLength(symbols.groups.reduce((sum, group) => sum + group.symbols.length, 0))
    expect(names('gibt es nicht')).toEqual([])
    // Gleicher Name in zwei Gruppen ist erlaubt (Gas und MSR)
    expect(names('Druckmessgerät')).toEqual(['Druckmessgerät', 'Druckmessgerät'])
    expect(names('Schuko')).toEqual(['Schutzkontaktsteckdose, vierfach'])
    expect(names('Kappenventil')).toEqual(['Kappenventil'])
    expect(names('pwc')).toEqual(['Trinkwasser kalt'])
    expect(names('KW')).toContain('Trinkwasser kalt')
  })

  it('zeigt Suchfeld, Anzahl und Sinnbilder als Strichgrafik', () => {
    const all = renderToStaticMarkup(<SymbolLookup tool={symbols} />)
    expect(all).toContain('placeholder="z. B. Kugelhahn"')
    expect(all).toMatch(/\d+ Sinnbilder/)
    expect(all).toContain('<button type="button" disabled="" aria-label="Alle Eingaben löschen"')
    const one = renderToStaticMarkup(<SymbolLookup tool={symbols} initialQuery="Kugelhahn" />)
    expect(one).toContain('1 Sinnbild<')
    expect(one).toContain('<svg viewBox="0 0 48 32"')
    expect(one).toContain('Absperr- und Drosselarmaturen')
    expect(one).not.toContain('Heizungsanlagen')
    expect(renderToStaticMarkup(<SymbolLookup tool={symbols} initialQuery="xyz" />)).toContain('Kein Sinnbild gefunden.')
    // Hinweis zur Gruppe unter der Überschrift
    expect(renderToStaticMarkup(<SymbolLookup tool={symbols} initialQuery="Badewanne" />)).toContain('Links Grundriss, rechts Aufriss')
  })

  it('zeigt Leitungsfarben auf weißem Grund, damit Schwarz und Gelb in beiden Designs lesbar sind', () => {
    const cold = renderToStaticMarkup(<SymbolLookup tool={symbols} initialQuery="Trinkwasser kalt" />)
    expect(cold).toContain('<rect width="48" height="32" rx="3" fill="#ffffff" stroke="none"></rect>')
    expect(cold).toContain('stroke="#3f8f2e"')
    expect(cold).toContain('>PWC</text>')
    // Sinnbilder ohne Farbe bleiben in Textfarbe ohne weißen Grund
    expect(renderToStaticMarkup(<SymbolLookup tool={symbols} initialQuery="Kugelhahn" />)).not.toContain('fill="#ffffff"')
    // Dicht stehende Details werden dünner gezeichnet
    expect(renderToStaticMarkup(<SymbolLookup tool={symbols} initialQuery="Gassicherheitsverteiler" />)).toContain('stroke-width="0.9"')
    // Gruppenziffer in Schriftfarbe auf dem Band in Gruppenfarbe
    const water = renderToStaticMarkup(<SymbolLookup tool={symbols} initialQuery="Gruppe 1" />)
    expect(water).toMatch(/fill="#ffffff"[^>]*>1<\/text>/)
  })

  it('macht die Sinnbilder über die globale Suche auffindbar', () => {
    const doc = toolSearchDocuments().find((entry) => entry.id === 'tool.sinnbilder')!
    expect(doc.keywords.map(plain)).toContain('Rückflussverhinderer')
    expect(doc.keywords).toContain('RV')
  })

  it('lehnt Markup in Zeichnungen ab und meldet doppelte Namen', () => {
    const base = { ...symbols, groups: symbols.groups.slice(0, 1) }
    const withMarkup = {
      ...base,
      groups: [{ ...base.groups[0]!, symbols: [{ name: 'X', draw: [{ d: '<script>' }] }] }],
    }
    expect(symbolToolSchema.safeParse(withMarkup).success).toBe(false)
    const first = base.groups[0]!.symbols[0]!
    const doubled = { ...base, groups: [{ ...base.groups[0]!, symbols: [first, first] }] }
    expect(checkSymbolTool(doubled).join(' ')).toContain('name doppelt vergeben')
  })
})
