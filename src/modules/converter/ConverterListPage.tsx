import { Link } from 'react-router'
import { DraftBadge } from '../../components/DraftBadge'
import { formatUnit } from '../../lib/units'
import { usePageTitle } from '../../lib/usePageTitle'
import { converterEntries, converterPath } from './converter'
import type { ConverterEntry } from './schema'

export function ConverterListPage({ entries = converterEntries }: { entries?: ConverterEntry[] }) {
  usePageTitle('Umrechner')
  return (
    <>
      <h1 className="text-2xl font-bold">Umrechner</h1>
      {entries.length === 0 ? (
        <p className="mt-2 text-muted">Noch keine Größen vorhanden.</p>
      ) : (
        <ul className="mt-4 grid gap-3 sm:grid-cols-2">
          {entries.map((entry) => (
            <li key={entry.id}>
              <Link
                to={converterPath(entry.id)}
                className="flex min-h-20 flex-col justify-center gap-1 rounded-xl border-2 border-line bg-surface p-4 active:border-accent"
              >
                <span className="flex items-center justify-between gap-2">
                  <span className="text-xl font-bold">{entry.title}</span>
                  {entry.status === 'draft' && <DraftBadge variant="inline" />}
                </span>
                <span className="text-base text-muted">{entry.units.map(formatUnit).join(' · ')}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
