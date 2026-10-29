import type { BaseEntry } from '../content/schema/base'
import { formatIsoDate } from '../lib/format'
import { splitLinks } from '../lib/links'
import { splitSources } from '../lib/sources'

type SourceMeta = Pick<BaseEntry, 'status' | 'source' | 'verifiedBy' | 'verifiedAt'>

/** Text einer Quelle; enthaltene Webadressen sind klickbar und öffnen sich in einem neuen Tab */
function SourceText({ text }: { text: string }) {
  return splitLinks(text).map((part, index) =>
    part.href ? (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-accent underline">
        {part.text}
      </a>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  )
}

/**
 * Quellenangabe: eine Quelle als Text, mehrere als Aufzählung. Lange Angaben scrollen in einem
 * begrenzten Bereich, damit die Seite nicht unnötig lang wird; die Optik bleibt zurückhaltend.
 */
function Source({ source }: { source: string }) {
  const items = splitSources(source)
  if (items.length === 0) return <>nicht angegeben</>
  if (items.length === 1) return <SourceText text={items[0]!} />
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Quellenangaben"
      className="max-h-48 overflow-y-auto overscroll-contain pr-2 [scrollbar-width:thin]"
    >
      <ul className="list-disc space-y-1 pl-5 marker:text-faint">
        {items.map((item, index) => (
          <li key={index}>
            <SourceText text={item} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Quelle und Prüfstatus – Pflicht am Ende jeder Inhaltsseite */
export function SourceInfo({ entry }: { entry: SourceMeta }) {
  const verified = entry.status === 'verified'
  return (
    <footer className="mt-12 border-t-2 border-line pt-4 text-base text-muted">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="font-semibold">Quelle</dt>
        {/* lange URLs in Quellenangaben dürfen überall umbrechen */}
        <dd className="min-w-0 [overflow-wrap:anywhere]">
          <Source source={entry.source} />
        </dd>
        <dt className="font-semibold">Geprüft</dt>
        <dd>
          {verified ? `${formatIsoDate(entry.verifiedAt)} (${entry.verifiedBy})` : 'noch nicht geprüft'}
        </dd>
      </dl>
    </footer>
  )
}
