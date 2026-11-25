import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { topicTagLabel, type TopicTag } from '../../content/schema/topicTags'
import { EMPTY_LIST_FILTER, listFilterOptions, matchesListFilter } from '../../search/listFilter'
import { FormulaListPage } from '../formulas/FormulaListPage'
import { formulaEntries } from '../formulas/formulas'
import { ToolListPage } from './ToolListPage'
import { filterTools, groupToolsByCategory, toolEntries } from './tools'

const ids = (entries: readonly { id: string }[]) => entries.map((entry) => entry.id)

describe('Filter der Tool-Liste', () => {
  it('lässt bei leerer Eingabe alle Tools stehen', () => {
    expect(ids(filterTools(toolEntries, '  '))).toEqual(ids(toolEntries))
  })

  it('findet Tools über den Titel, ohne auf Groß-/Kleinschreibung zu achten', () => {
    const tool = toolEntries[0]!
    expect(ids(filterTools(toolEntries, tool.title.toUpperCase()))).toContain(tool.id)
  })

  it('findet Tools über die Kategorie', () => {
    const tool = toolEntries.find((entry) => entry.category !== '')!
    const result = ids(filterTools(toolEntries, tool.category))
    for (const entry of toolEntries.filter((candidate) => candidate.category === tool.category)) {
      expect(result).toContain(entry.id)
    }
  })

  it('findet Tools über den angezeigten Tag-Namen', () => {
    const tool = toolEntries.find((entry) => entry.tags.includes('lueftung'))!
    const result = filterTools(toolEntries, topicTagLabel('lueftung'))
    expect(ids(result)).toContain(tool.id)
    for (const entry of toolEntries.filter((candidate) => candidate.tags.includes('lueftung'))) {
      expect(ids(result)).toContain(entry.id)
    }
  })

  it('zeigt Suchleiste, Trefferzahl und „Keine Tools gefunden“', () => {
    const render = (query: string) =>
      renderToStaticMarkup(
        <MemoryRouter>
          <ToolListPage entries={toolEntries} modes={[]} hiddenIds={new Set()} initialQuery={query} />
        </MemoryRouter>,
      )
    const all = render('')
    expect(all).toContain('id="tool-filter"')
    expect(all).toContain(`${toolEntries.length} von ${toolEntries.length} Tools`)

    const none = render('xyz-gibt-es-nicht')
    expect(none).toContain(`0 von ${toolEntries.length} Tools`)
    expect(none).toContain('Keine Tools gefunden.')
  })
})

describe('Kategorie- und Themen-Filter wie im Lexikon', () => {
  const entry = (category: string, tags: TopicTag[]) => ({ category, tags })

  it('lässt ohne Auswahl alles durch; je Gruppe genügt ein Treffer, beide Gruppen müssen passen', () => {
    expect(matchesListFilter(entry('Wartung', ['heizung']), EMPTY_LIST_FILTER)).toBe(true)
    const filter = { categories: ['Wartung', 'Montage'], tags: ['heizung', 'strom'] as TopicTag[] }
    expect(matchesListFilter(entry('Montage', ['strom']), filter)).toBe(true)
    expect(matchesListFilter(entry('Planung', ['strom']), filter)).toBe(false)
    expect(matchesListFilter(entry('Wartung', ['lueftung']), filter)).toBe(false)
  })

  it('führt Einträge ohne Kategorie unter „Allgemein“', () => {
    expect(matchesListFilter(entry('', ['heizung']), { categories: ['Allgemein'], tags: [] })).toBe(true)
  })

  it('bietet nur vorhandene Kategorien in Listenreihenfolge und vorhandene Themen an', () => {
    const options = listFilterOptions(toolEntries, groupToolsByCategory)
    expect(options.categories).toEqual(groupToolsByCategory(toolEntries).map((group) => group.category))
    for (const tag of options.tags) expect(toolEntries.some((tool) => tool.tags.includes(tag)), tag).toBe(true)
  })

  it('Tool-Liste: Filter-Knopf in der Suchleiste, Auswahl filtert und blendet Favoriten aus', () => {
    const category = groupToolsByCategory(toolEntries)[0]!.category
    const expected = toolEntries.filter((tool) => (tool.category || 'Allgemein') === category)
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToolListPage
          entries={toolEntries}
          modes={[]}
          hiddenIds={new Set()}
          initialFilter={{ categories: [category], tags: [] }}
          initialFiltersOpen
        />
      </MemoryRouter>,
    )
    expect(html).toContain('aria-label="Filter (1 aktiv)"')
    expect(html).toContain('Kategorien')
    expect(html).toContain('Themen')
    expect(html).toContain(`${expected.length} von ${toolEntries.length} Tools`)
  })

  it('Formel-Liste: gleicher Aufbau mit Filter-Knopf und Auswahl', () => {
    const tag = formulaEntries.flatMap((formula) => formula.tags)[0]!
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FormulaListPage
          modes={[]}
          hiddenIds={new Set()}
          initialFilter={{ categories: [], tags: [tag] }}
          initialFiltersOpen
        />
      </MemoryRouter>,
    )
    expect(html).toContain('id="formula-filter"')
    expect(html).toContain('aria-label="Filter (1 aktiv)"')
    expect(html).toContain('Kategorien')
    expect(html).not.toContain('Keine Formeln gefunden.')
  })
})
