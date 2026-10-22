import { Fragment, type ReactNode } from 'react'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { splitLinks } from '../../lib/links'
import { splitParagraphs } from '../../lib/text'
import { usePageTitle } from '../../lib/usePageTitle'
import { findLegalEntry, legalEntries, type LegalPageInfo } from './legal'
import type { LegalEntry } from './schema'

const BACK = { to: '/einstellungen', label: 'Einstellungen' }

const EMAIL_PATTERN = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/g
const linkClass = 'text-accent underline [overflow-wrap:anywhere]'

/** **fett** und E-Mail-Adressen innerhalb eines Textstücks ohne Webadresse */
function renderPlain(text: string): ReactNode[] {
  return text.split(/\*\*(.+?)\*\*/g).flatMap((part, index): ReactNode[] => {
    if (index % 2 === 1) return [<strong key={`b${index}`}>{part}</strong>]
    const nodes: ReactNode[] = []
    let position = 0
    for (const match of part.matchAll(EMAIL_PATTERN)) {
      if (match.index > position) nodes.push(part.slice(position, match.index))
      nodes.push(
        <a key={`m${index}-${match.index}`} href={`mailto:${match[0]}`} className={linkClass}>
          {match[0]}
        </a>,
      )
      position = match.index + match[0].length
    }
    if (position < part.length) nodes.push(part.slice(position))
    return nodes
  })
}

/** Absätze mit Fettdruck und klickbaren Web- und E-Mail-Adressen; HTML wird nie ausgeführt */
export function LegalText({ text }: { text: string }) {
  return splitParagraphs(text).map((paragraph, index) => (
    <p key={index} className="mt-3 whitespace-pre-line first:mt-0">
      {splitLinks(paragraph).map((part, partIndex) =>
        part.href ? (
          <a key={partIndex} href={part.href} target="_blank" rel="noopener noreferrer" className={linkClass}>
            {part.text}
          </a>
        ) : (
          <Fragment key={partIndex}>{renderPlain(part.text)}</Fragment>
        ),
      )}
    </p>
  ))
}

export function LegalPage({ page, entries = legalEntries }: { page: LegalPageInfo; entries?: LegalEntry[] }) {
  const entry = findLegalEntry(entries, page.id)
  if (!entry) return <LegalMissing title={page.title} />
  return (
    <ContentPage entry={entry} title={entry.title} back={BACK}>
      {entry.sections.length === 0 ? (
        <p className="font-semibold">TODO: Inhalt fehlt</p>
      ) : (
        entry.sections.map((section, index) => (
          <section key={index} className="mt-6 first:mt-0">
            {section.heading && <h2 className="mb-2 text-xl font-bold">{section.heading}</h2>}
            <LegalText text={section.text} />
          </section>
        ))
      )}
    </ContentPage>
  )
}

function LegalMissing({ title }: { title: string }) {
  usePageTitle(title)
  return (
    <>
      <BackLink to={BACK.to} label={BACK.label} />
      <h1 className="text-2xl font-bold">{title}</h1>
      <p className="mt-2 font-semibold">TODO: Inhalt fehlt</p>
    </>
  )
}
