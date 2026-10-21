import { Link, useParams } from 'react-router'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { splitParagraphs } from '../../lib/text'
import { usePageTitle } from '../../lib/usePageTitle'
import { findLexiconEntry, lexiconEntries, lexiconPath } from './lexicon'
import type { LexiconEntry } from './schema'

const BACK = { to: '/lexikon', label: 'Lexikon' }

export function LexiconDetailPage({ entries = lexiconEntries }: { entries?: LexiconEntry[] }) {
  const { slug } = useParams()
  const entry = findLexiconEntry(entries, slug)
  if (!entry) return <LexiconEntryNotFound />

  // Verweise auf Einträge, die es in dieser Edition nicht gibt, still weglassen
  const related = entry.related
    .map((id) => entries.find((candidate) => candidate.id === id))
    .filter((candidate) => candidate !== undefined)

  return (
    <ContentPage
      entry={entry}
      title={entry.term}
      back={BACK}
      actions={<FavoriteButton id={entry.id} title={entry.term} />}
    >
      {entry.synonyms.length > 0 && (
        <p className="text-muted">
          <span className="font-semibold">Auch:</span> {entry.synonyms.join(', ')}
        </p>
      )}
      {splitParagraphs(entry.definition).map((paragraph, index) => (
        <p key={index} className="mt-3 whitespace-pre-line first:mt-0">
          {paragraph}
        </p>
      ))}
      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-bold">Siehe auch</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  to={lexiconPath(item.id)}
                  className="inline-flex min-h-12 items-center rounded-lg border-2 border-line px-3 font-semibold"
                >
                  {item.term}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </ContentPage>
  )
}

function LexiconEntryNotFound() {
  usePageTitle('Begriff nicht gefunden')
  return (
    <>
      <BackLink to={BACK.to} label={BACK.label} />
      <h1 className="text-2xl font-bold">Begriff nicht gefunden</h1>
      <p className="mt-2 text-muted">Diesen Eintrag gibt es im Lexikon nicht (mehr).</p>
    </>
  )
}
