import type { ReactNode } from 'react'
import { Link, useParams } from 'react-router'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { DraftBadge } from '../../components/DraftBadge'
import { listCard } from '../../components/surfaces'
import type { BaseEntry } from '../../content/schema/base'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { RichText } from '../../components/RichText'
import { usePageTitle } from '../../lib/usePageTitle'
import { formulaEntries, formulaPath } from '../formulas/formulas'
import { FormulaTitle } from '../formulas/FormulaTitle'
import type { FormulaEntry } from '../formulas/schema'
import type { ToolEntry } from '../tools/schema'
import { toolEntries, toolPath } from '../tools/tools'
import { findLexiconEntry, lexiconEntries, lexiconPath } from './lexicon'
import type { LexiconEntry } from './schema'

const BACK = { to: '/lexikon', label: 'Lexikon' }

export function LexiconDetailPage({
  entries = lexiconEntries,
  formulas = formulaEntries,
  tools = toolEntries,
}: {
  entries?: LexiconEntry[]
  formulas?: FormulaEntry[]
  tools?: ToolEntry[]
}) {
  const { slug } = useParams()
  const entry = findLexiconEntry(entries, slug)
  if (!entry) return <LexiconEntryNotFound />

  // Verweise auf Einträge, die es in dieser Edition nicht gibt, still weglassen
  const related = entry.related
    .map((id) => entries.find((candidate) => candidate.id === id))
    .filter((candidate) => candidate !== undefined)
  const linkedFormulas = formulas.filter((formula) => entry.formulas.includes(formula.id))
  const linkedTools = tools.filter((tool) => entry.tools.includes(tool.id))

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
      <RichText text={entry.definition} />
      {related.length > 0 && (
        <section className="mt-6">
          <h2 className="text-xl font-bold">Siehe auch</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {related.map((item) => (
              <li key={item.id}>
                <Link
                  to={lexiconPath(item.id)}
                  className="inline-flex min-h-12 items-center rounded-full border border-edge bg-surface px-4 font-semibold"
                >
                  {item.term}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <LinkedEntries
        title="Formeln"
        items={linkedFormulas.map((formula) => ({
          id: formula.id,
          path: formulaPath(formula.id),
          status: formula.status,
          label: <FormulaTitle entry={formula} />,
        }))}
      />
      <LinkedEntries
        title="Tools"
        items={linkedTools.map((tool) => ({
          id: tool.id,
          path: toolPath(tool.id),
          status: tool.status,
          label: tool.title,
        }))}
      />
    </ContentPage>
  )
}

/** Liste unter der Erklärung: Formeln bzw. Tools zum Begriff */
function LinkedEntries({ title, items }: {
  title: string
  items: { id: string; path: string; status: BaseEntry['status']; label: ReactNode }[]
}) {
  if (items.length === 0) return null
  return (
    <section className="mt-6 print:hidden">
      <h2 className="text-xl font-bold">{title}</h2>
      <ul className={`mt-2 ${listCard}`}>
        {items.map((item) => (
          <li key={item.id}>
            <Link to={item.path} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <span className="font-semibold">{item.label}</span>
              {item.status === 'draft' && <DraftBadge variant="inline" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
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
