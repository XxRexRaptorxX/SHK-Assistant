import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { converterEntries } from '../modules/converter/converter'
import { ConverterListPage } from '../modules/converter/ConverterListPage'
import { formulaEntries } from '../modules/formulas/formulas'
import { FormulaListPage } from '../modules/formulas/FormulaListPage'
import { SettingsPage } from '../settings/SettingsPage'
import { HideButton } from './HideButton'
import { parseHiddenIds } from './hiddenStore'

const inRouter = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe('Ausblenden', () => {
  it('liest gespeicherte IDs robust', () => {
    expect(parseHiddenIds(null)).toEqual([])
    expect(parseHiddenIds('{kaputt')).toEqual([])
    expect(parseHiddenIds('{"a":1}')).toEqual([])
    expect(parseHiddenIds('["formula.a", 3, "formula.a", "converter.b"]')).toEqual(['formula.a', 'converter.b'])
  })

  it('beschriftet das Auge je nach Zustand', () => {
    const shown = renderToStaticMarkup(<HideButton id="formula.a" title="Alpha" hidden={false} />)
    expect(shown).toContain('aria-pressed="false"')
    expect(shown).toContain('aria-label="„Alpha“ in der Liste ausblenden"')
    const hidden = renderToStaticMarkup(<HideButton id="formula.a" title="Alpha" hidden />)
    expect(hidden).toContain('aria-label="„Alpha“ in der Liste wieder einblenden"')
  })

  it('nimmt ausgeblendete Formeln aus der Liste und zeigt sie unten unter „Ausgeblendet“', () => {
    const formula = formulaEntries[0]!
    const html = inRouter(<FormulaListPage hiddenIds={new Set([formula.id])} />)
    const total = formulaEntries.length
    expect(html).toContain(`${total - 1} von ${total - 1} Formeln`)
    expect(html).toContain('Ausgeblendet (1)')
    expect(html.indexOf(`>${formula.title}<`)).toBeGreaterThan(html.indexOf('Ausgeblendet (1)'))
  })

  it('nimmt ausgeblendete Umrechner aus der Liste', () => {
    const entry = converterEntries.find((e) => e.id === 'converter.zeit')!
    const shown = inRouter(<ConverterListPage hiddenIds={new Set()} />)
    const hidden = inRouter(<ConverterListPage hiddenIds={new Set([entry.id])} />)
    expect(shown).not.toContain('Ausgeblendet (')
    expect(shown).toContain('href="/umrechner/zeit"')
    expect(hidden).toContain('Ausgeblendet (1)')
    expect(hidden.match(/href="\/umrechner\/zeit"/g)).toHaveLength(1) // nur noch im Bereich „Ausgeblendet“
  })

  it('bietet in den Einstellungen an, alles wieder einzublenden', () => {
    const html = renderToStaticMarkup(<SettingsPage />)
    expect(html).toContain('Ausgeblendete Einträge')
    expect(html).toContain('Alle einblenden')
  })
})
