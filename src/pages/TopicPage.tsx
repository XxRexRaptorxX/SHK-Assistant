import { useParams } from 'react-router'
import { BackLink } from '../components/ContentPage'
import { EntryList, groupByModule } from '../components/EntryList'
import { pageTitle } from '../components/headings'
import { TopicTags } from '../components/TopicTags'
import { TOPIC_TAGS, topicTagLabel, type TopicTag } from '../content/schema/topicTags'
import { FavoriteButton } from '../favorites/FavoriteButton'
import { usePageTitle } from '../lib/usePageTitle'
import type { SearchDocument } from '../search/search'
import { getContentIndex } from '../search/sources'
import { NotFoundPage } from './NotFoundPage'

const isTopicTag = (value: string | undefined): value is TopicTag => TOPIC_TAGS.some((tag) => tag.key === value)

/** Themen-Übersicht (#/thema/heizung): alle Einträge aller Module mit diesem Tag, nach Modul gruppiert */
export function TopicPage({ index }: { /** Für Tests überschreibbar */ index?: ReadonlyMap<string, SearchDocument> }) {
  const { tag } = useParams()
  const topic = isTopicTag(tag) ? tag : undefined
  usePageTitle(topic ? `Thema ${topicTagLabel(topic)}` : undefined)
  if (!topic) return <NotFoundPage />

  const documents = [...(index ?? getContentIndex()).values()]
  const entries = documents.filter((entry) => entry.tags?.includes(topic))
  // Leiste zum Wechseln: nur Themen, die überhaupt vorkommen
  const usedTags = new Set(documents.flatMap((entry) => entry.tags ?? []))
  const switchable = TOPIC_TAGS.map((entry) => entry.key).filter((key) => usedTags.has(key))

  return (
    <>
      <BackLink to="/" label="Startseite" />
      <h1 className={pageTitle}>Thema: {topicTagLabel(topic)}</h1>
      <p className="mt-2 text-base text-muted">
        {entries.length === 0
          ? 'Keine Einträge mit diesem Thema.'
          : `${entries.length} ${entries.length === 1 ? 'Eintrag' : 'Einträge'} mit dem Thema „${topicTagLabel(topic)}“`}
      </p>
      <nav aria-label="Andere Themen" className="mt-4">
        <TopicTags tags={switchable} linked current={topic} />
      </nav>
      <EntryList groups={groupByModule(entries)} action={(entry) => <FavoriteButton id={entry.id} title={entry.title} />} />
    </>
  )
}
