import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { converterEntries } from '../modules/converter/converter'
import { ConverterListPage } from '../modules/converter/ConverterListPage'
import { formulaEntries, rearrangedIds } from '../modules/formulas/formulas'
import { FormulaListPage } from '../modules/formulas/FormulaListPage'
import { SettingsPage } from '../settings/SettingsPage'
import { HideButton } from './HideButton'
import { parseHiddenIds } from './hiddenStore'
import { visibilityOf, withVisibility } from './visibility'
import { matchesModes, modeEntries } from '../modules/modes/modes'
import type { ModeEntry } from '../modules/modes/schema'
import { toolEntries } from '../modules/tools/tools'
import { ToolListPage } from '../modules/tools/ToolListPage'

const kaelte: ModeEntry = {
  id: 'mode.b', visibility: 'public', status: 'draft', source: '', verifiedBy: '', verifiedAt: '',
  title: 'Modus B', order: 1, tags: ['kaelte'], include: [], exclude: [],
}

const inRouter = (node: React.ReactNode) => renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>)

describe('Ausblenden', () => {
  it('liest gespeicherte IDs robust', () => {
    expect(parseHiddenIds(null)).toEqual([])
    expect(parseHiddenIds('{kaputt')).toEqual([])
    expect(parseHiddenIds('{"a":1}')).toEqual([])
    expect(parseHiddenIds('["formula.a", 3, "formula.a", "converter.b"]')).toEqual(['formula.a', 'converter.b'])
  })

  it('beschriftet das Auge je nach Zustand', () => {
    const shown = renderToStaticMarkup(<HideButton id="formula.a" title="Alpha" tags={['strom']} visibility="visible" />)
    expect(shown).toContain('aria-pressed="false"')
    expect(shown).toContain('aria-label="„Alpha“ in der Liste ausblenden"')
    const hidden = renderToStaticMarkup(<HideButton id="formula.a" title="Alpha" tags={['strom']} visibility="manual" />)
    expect(hidden).toContain('aria-label="„Alpha“ in der Liste wieder einblenden"')
    const byMode = renderToStaticMarkup(<HideButton id="formula.a" title="Alpha" tags={['strom']} visibility="mode" />)
    expect(byMode).toContain('aria-pressed="true"')
    expect(byMode).toContain('vom Modus ausgeblendet')
  })

  it('verbindet Modus und Auge: das Auge geht vor', () => {
    const tool = { id: 'tool.x', tags: ['strom'] as const }
    const none = { hidden: new Set<string>(), shown: new Set<string>(), modes: [kaelte] }
    expect(visibilityOf(tool, none)).toBe('mode')
    expect(visibilityOf(tool, { ...none, shown: new Set(['tool.x']) })).toBe('visible')
    expect(visibilityOf(tool, { ...none, modes: [] })).toBe('visible')
    expect(visibilityOf(tool, { ...none, modes: [], hidden: new Set(['tool.x']) })).toBe('manual')
    // Umrechner filtert kein Modus
    expect(visibilityOf({ id: 'converter.zeit' }, none)).toBe('visible')
  })

  it('merkt sich Einblenden gegen den Modus nur, wenn der Modus ausblendet', () => {
    const none = { hidden: new Set(['tool.x']), shown: new Set<string>(), modes: [kaelte] }
    expect(withVisibility({ id: 'tool.x', tags: ['strom'] }, true, none)).toEqual({ hidden: [], shown: ['tool.x'] })
    expect(withVisibility({ id: 'tool.x', tags: ['kaelte'] }, true, none)).toEqual({ hidden: [], shown: [] })
    expect(withVisibility({ id: 'tool.x', tags: ['strom'] }, false, { ...none, hidden: new Set(), shown: new Set(['tool.x']) })).toEqual({
      hidden: ['tool.x'],
      shown: [],
    })
  })

  it('zeigt vom Modus ausgeblendete Tools unten unter „Ausgeblendet“', () => {
    const elektriker = modeEntries.find((mode) => mode.title === 'Elektriker')!
    const outside = toolEntries.filter((entry) => !matchesModes(entry, [elektriker]))
    const html = inRouter(<ToolListPage modes={[elektriker]} hiddenIds={new Set()} />)
    expect(html).toContain(`Ausgeblendet (${outside.length}), davon ${outside.length} vom Modus`)
    expect(html).toContain('vom Modus ausgeblendet')
  })

  it('nimmt per Auge ausgeblendete Tools aus der Liste', () => {
    const tool = toolEntries[0]!
    const html = inRouter(<ToolListPage modes={[]} hiddenIds={new Set([tool.id])} />)
    expect(html).toContain('Ausgeblendet (1)')
    expect(html.indexOf(`>${tool.title}<`)).toBeGreaterThan(html.indexOf('Ausgeblendet (1)'))
  })

  it('nimmt ausgeblendete Formeln aus der Liste und zeigt sie unten unter „Ausgeblendet“', () => {
    // Umgestellte Formeln stehen nicht in der ungefilterten Liste
    const listed = formulaEntries.filter((entry) => !rearrangedIds.has(entry.id))
    const formula = listed[0]!
    const html = inRouter(<FormulaListPage hiddenIds={new Set([formula.id])} />)
    const total = listed.length
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
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    expect(html).toContain('Modus und Ausblenden')
    expect(html).toContain('Einzeln ausgeblendet')
    expect(html).toContain('Einzeln eingeblendet')
    expect(html).toContain('Alle einblenden')
    expect(html).toMatch(/In den Listen: \d+ von \d+ Tools, \d+ von \d+ Formeln/)
  })
})
