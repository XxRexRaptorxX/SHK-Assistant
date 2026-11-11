import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { EntryList } from '../../components/EntryList'
import { createSearch } from '../../search/search'
import { ToolListPage } from './ToolListPage'
import { ToolTags } from './ToolTagList'
import { toolEntries, toolSearchDocuments } from './tools'
import { sortToolTags, TOOL_TAGS, toolTagsSchema } from './toolTags'

describe('Themen-Tags der Tools', () => {
  it('verlangt mindestens einen bekannten Tag ohne Doppelung', () => {
    expect(toolTagsSchema.safeParse(['heizung', 'strom']).success).toBe(true)
    expect(toolTagsSchema.safeParse([]).success).toBe(false)
    expect(toolTagsSchema.safeParse(['garten']).success).toBe(false)
    expect(toolTagsSchema.safeParse(['heizung', 'heizung']).success).toBe(false)
  })

  it('jedes Tool hat Tags', () => {
    for (const entry of toolEntries) expect(entry.tags.length, entry.id).toBeGreaterThan(0)
  })

  it('zeigt Tags in fester Reihenfolge, egal wie sie im Inhalt stehen', () => {
    expect(sortToolTags(['buero', 'heizung'])).toEqual(['heizung', 'buero'])
    const html = renderToStaticMarkup(<ToolTags tags={['kundendienst', 'heizung']} />)
    expect(html.indexOf('Heizung')).toBeLessThan(html.indexOf('Kundendienst'))
  })

  it('hat für jeden Tag eine eigene Farbe', () => {
    const html = renderToStaticMarkup(<ToolTags tags={TOOL_TAGS.map((tag) => tag.key)} />)
    const classes = [...html.matchAll(/class="rounded-full ([^"]+)"/g)].map((match) => match[1])
    expect(classes).toHaveLength(TOOL_TAGS.length)
    expect(new Set(classes).size).toBe(TOOL_TAGS.length)
  })

  it('zeigt die Tags in der Tool-Liste', () => {
    const tool = toolEntries.find((entry) => entry.tags.includes('kundendienst'))!
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToolListPage entries={[tool]} />
      </MemoryRouter>,
    )
    expect(html).toContain('Kundendienst')
    expect(html).toContain('Themen:')
  })

  it('zeigt „Ungeprüft“ in der Liste über den Tags', () => {
    const tool = { ...toolEntries.find((entry) => entry.tags.includes('heizung'))!, status: 'draft' as const }
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToolListPage entries={[tool]} />
      </MemoryRouter>,
    )
    expect(html.indexOf('Ungeprüft')).toBeGreaterThan(-1)
    expect(html.indexOf('Ungeprüft')).toBeLessThan(html.indexOf('Heizung'))
  })

  it('findet Tools über den Tag-Namen', () => {
    const tool = toolEntries.find((entry) => entry.tags.includes('lueftung'))!
    const document = toolSearchDocuments([tool])[0]!
    expect(document.keywords).toContain('Lüftung')
  })

  it('zeigt die Tags in den Suchtreffern rechts unter „Ungeprüft“', () => {
    const tool = { ...toolEntries.find((entry) => entry.tags.includes('kundendienst'))!, status: 'draft' as const }
    const groups = createSearch(toolSearchDocuments([tool])).search(tool.title)
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <EntryList groups={groups} />
      </MemoryRouter>,
    )
    expect(html).toContain('Kundendienst')
    expect(html.indexOf('Ungeprüft')).toBeGreaterThan(-1)
    expect(html.indexOf('Ungeprüft')).toBeLessThan(html.indexOf('Kundendienst'))
  })
})
