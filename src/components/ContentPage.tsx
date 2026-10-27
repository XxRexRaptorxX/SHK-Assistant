import type { ReactNode } from 'react'
import { Link } from 'react-router'
import type { BaseEntry } from '../content/schema/base'
import { usePageTitle } from '../lib/usePageTitle'
import { DraftBadge } from './DraftBadge'
import { SourceInfo } from './SourceInfo'

interface ContentPageProps {
  entry: BaseEntry
  title: string
  /** Überschrift, falls sie mehr als den reinen Text braucht (z. B. graues Formelzeichen); sonst title */
  heading?: ReactNode
  /** Zurück zur Liste. Nötig, weil installierte Apps (v. a. iOS) keinen Zurück-Knopf haben. */
  back?: { to: string; label: string }
  /** z. B. Favoriten-Knopf neben der Überschrift */
  actions?: ReactNode
  /** Quelle + Prüfdatum unten; nur bei Seiten ohne Fachinhalt (Impressum, Datenschutz) aus */
  showSource?: boolean
  children: ReactNode
}

/**
 * Rahmen für jede Detailseite eines Inhaltseintrags.
 * Stellt sicher, dass Entwürfe markiert sind und Quelle + Prüfdatum erscheinen.
 */
export function ContentPage({ entry, title, heading, back, actions, showSource = true, children }: ContentPageProps) {
  usePageTitle(title)
  return (
    <article>
      {back && <BackLink to={back.to} label={back.label} />}
      <header className="mb-4 flex items-start justify-between gap-3">
        <h1 className="text-2xl font-bold break-words">{heading ?? title}</h1>
        {actions && <div className="flex print:hidden">{actions}</div>}
      </header>
      {entry.status === 'draft' && <DraftBadge />}
      <div className="mt-4">{children}</div>
      {showSource && <SourceInfo entry={entry} />}
    </article>
  )
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link
      to={to}
      className="-ml-2 mb-2 inline-flex min-h-12 items-center gap-1 rounded-xl px-2 font-semibold text-accent print:hidden"
    >
      <span aria-hidden="true">←</span> {label}
    </Link>
  )
}
