import type { BaseEntry } from '../content/schema/base'
import { formatIsoDate } from '../lib/format'
import { splitLinks } from '../lib/links'

type SourceMeta = Pick<BaseEntry, 'status' | 'source' | 'verifiedBy' | 'verifiedAt'>

/** Quellenangabe; enthaltene Webadressen sind klickbar und öffnen sich in einem neuen Tab */
function Source({ source }: { source: string }) {
  if (source.trim() === '') return <>nicht angegeben</>
  return splitLinks(source).map((part, index) =>
    part.href ? (
      <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="text-accent underline">
        {part.text}
      </a>
    ) : (
      <span key={index}>{part.text}</span>
    ),
  )
}

/** Quelle und Prüfstatus – Pflicht am Ende jeder Inhaltsseite */
export function SourceInfo({ entry }: { entry: SourceMeta }) {
  const verified = entry.status === 'verified'
  return (
    <footer className="mt-8 border-t-2 border-line pt-4 text-base text-muted">
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
