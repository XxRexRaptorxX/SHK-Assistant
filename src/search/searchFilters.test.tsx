import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { topicTagColor } from '../components/TopicTags'
import { categoryColor, SearchFilters } from './SearchFilters'

const render = (modules: string[], selected: { modules: string[]; tags: ('heizung' | 'klima')[] }) =>
  renderToStaticMarkup(
    <SearchFilters options={{ modules, tags: ['heizung', 'klima'] }} filter={selected} onChange={() => {}} />,
  )

describe('Filter-Knöpfe der Suchleiste', () => {
  it('zeigt Themen auch ungewählt in ihrer Tag-Farbe', () => {
    const html = render([], { modules: [], tags: [] })
    expect(html).toContain(topicTagColor('heizung'))
    expect(html).toContain(topicTagColor('klima'))
  })

  it('färbt Kategorien gedämpft, gleichnamige im Farbton ihres Tags', () => {
    expect(categoryColor('Heizung')).toContain('bg-red-50')
    expect(categoryColor('Lüftung')).toContain('bg-green-50')
    expect(categoryColor('Planung')).toContain('bg-fuchsia-50')
    // nie die kräftige Tag-Farbe
    expect(categoryColor('Planung')).not.toBe(topicTagColor('planung'))
    const html = render(['Heizung', 'Geometrie'], { modules: [], tags: [] })
    expect(html).toContain(`${categoryColor('Heizung')} ">Heizung</button>`)
    expect(html).toContain(`${categoryColor('Geometrie')} ">Geometrie</button>`)
  })

  it('gibt Kategorien ohne Tag eine feste, gedämpfte Farbe', () => {
    expect(categoryColor('Hydraulik')).toBe(categoryColor('Hydraulik'))
    expect(categoryColor('Hydraulik')).toMatch(/bg-\w+-50 /)
  })

  it('markiert gewählte Knöpfe mit Haken und Ring', () => {
    const html = render(['Heizung', 'Geometrie'], { modules: ['Heizung', 'Geometrie'], tags: ['klima'] })
    expect(html.match(/aria-pressed="true" class="[^"]*ring-4 ring-ink/g)).toHaveLength(3)
    expect(html.match(/✓/g)).toHaveLength(3)
  })
})
