import type { BaseEntry } from '../content/schema/base'
import { formatIsoDate } from '../lib/format'

type SourceMeta = Pick<BaseEntry, 'status' | 'source' | 'verifiedBy' | 'verifiedAt'>

const URL_PATTERN = /^https?:\/\/\S+$/

function Source({ source }: { source: string }) {
  if (source.trim() === '') return <>nicht angegeben</>
  if (URL_PATTERN.test(source)) {
    return (
      <a href={source} target="_blank" rel="noopener noreferrer" className="break-all text-accent underline">
        {source}
      </a>
    )
  }
  return <>{source}</>
}

/** Quelle und Prüfstatus – Pflicht am Ende jeder Inhaltsseite */
export function SourceInfo({ entry }: { entry: SourceMeta }) {
  const verified = entry.status === 'verified'
  return (
    <footer className="mt-8 border-t-2 border-line pt-4 text-base text-muted">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="font-semibold">Quelle</dt>
        <dd className="break-words">
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
