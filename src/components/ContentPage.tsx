import type { ReactNode } from 'react'
import type { BaseEntry } from '../content/schema/base'
import { usePageTitle } from '../lib/usePageTitle'
import { DraftBadge } from './DraftBadge'
import { SourceInfo } from './SourceInfo'

interface ContentPageProps {
  entry: BaseEntry
  title: string
  /** z. B. Favoriten-Knopf neben der Überschrift */
  actions?: ReactNode
  children: ReactNode
}

/**
 * Rahmen für jede Detailseite eines Inhaltseintrags.
 * Stellt sicher, dass Entwürfe markiert sind und Quelle + Prüfdatum immer erscheinen.
 */
export function ContentPage({ entry, title, actions, children }: ContentPageProps) {
  usePageTitle(title)
  return (
    <article>
      <header className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold break-words">{title}</h1>
        {actions}
      </header>
      {entry.status === 'draft' && <DraftBadge />}
      <div className="mt-4">{children}</div>
      <SourceInfo entry={entry} />
    </article>
  )
}
