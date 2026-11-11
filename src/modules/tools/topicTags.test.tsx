import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { EntryList } from '../../components/EntryList'
import { createSearch } from '../../search/search'
import { lexiconEntries } from '../lexicon/lexicon'
import { LexiconListPage } from '../lexicon/LexiconListPage'
import { lexiconSearchDocuments } from '../lexicon/search'
import { ToolListPage } from './ToolListPage'
import { TopicTags } from '../../components/TopicTags'
import { toolEntries, toolSearchDocuments } from './tools'
import { sortTopicTags, TOPIC_TAGS, topicTagsSchema } from '../../content/schema/topicTags'

describe('Themen-Tags der Tools', () => {
  it('verlangt mindestens einen bekannten Tag ohne Doppelung', () => {
    expect(topicTagsSchema.safeParse(['heizung', 'strom']).success).toBe(true)
    expect(topicTagsSchema.safeParse([]).success).toBe(false)
    expect(topicTagsSchema.safeParse(['garten']).success).toBe(false)
    expect(topicTagsSchema.safeParse(['heizung', 'heizung']).success).toBe(false)
  })

  it('jedes Tool und jeder Lexikon-Begriff hat Tags', () => {
    for (const entry of toolEntries) expect(entry.tags.length, entry.id).toBeGreaterThan(0)
    for (const entry of lexiconEntries) expect(entry.tags.length, entry.id).toBeGreaterThan(0)
  })

  it('„Allgemein“ steht nie neben einem Fachgebiet', () => {
    for (const entry of [...toolEntries, ...lexiconEntries]) {
      if (entry.tags.includes('allgemein')) expect(entry.tags, entry.id).toEqual(['allgemein'])
    }
  })

  it('zeigt die Tags in der Lexikon-Liste und hat dort einen Filter-Knopf', () => {
    const entry = lexiconEntries.find((candidate) => candidate.tags.includes('trinkwasser'))!
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <LexiconListPage entries={[entry]} initialQuery={entry.term} />
      </MemoryRouter>,
    )
    expect(html).toContain('Trinkwasser</span>')
    expect(html).toContain('aria-label="Filter"')
  })

  it('bietet im Themen-Filter der Suche auch Lexikon-Tags an und filtert danach', () => {
    const engine = createSearch(lexiconSearchDocuments())
    expect(engine.filterOptions.tags).toContain('abwasser')
    const results = engine.search('', { modules: [], tags: ['abwasser'] }).flatMap((group) => group.results)
    expect(results.length).toBeGreaterThan(0)
    for (const result of results) expect(result.tags).toContain('abwasser')
  })

  it('zeigt Tags in fester Reihenfolge, egal wie sie im Inhalt stehen', () => {
    expect(sortTopicTags(['planung', 'heizung'])).toEqual(['heizung', 'planung'])
    const html = renderToStaticMarkup(<TopicTags tags={['kundendienst', 'heizung']} />)
    expect(html.indexOf('Heizung')).toBeLessThan(html.indexOf('Kundendienst'))
  })

  it('hat für jeden Tag eine eigene Farbe', () => {
    const html = renderToStaticMarkup(<TopicTags tags={TOPIC_TAGS.map((tag) => tag.key)} />)
    const classes = [...html.matchAll(/class="rounded-full ([^"]+)"/g)].map((match) => match[1])
    expect(classes).toHaveLength(TOPIC_TAGS.length)
    expect(new Set(classes).size).toBe(TOPIC_TAGS.length)
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
