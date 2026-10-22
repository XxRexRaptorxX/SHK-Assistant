import { Link } from 'react-router'
import { modules } from '../../app/modules'
import { DraftBadge } from '../../components/DraftBadge'
import { categoryHeading } from '../../components/headings'
import { ModuleFavorites } from '../../favorites/ModuleFavorites'
import { useHiddenIds } from '../../hidden/hiddenStore'
import { ModuleHidden } from '../../hidden/ModuleHidden'
import { usePageTitle } from '../../lib/usePageTitle'
import { converterEntries, converterPath, converterSummary, groupConvertersByCategory } from './converter'
import { ConverterTitle } from './converterUi'
import type { ConverterEntry } from './schema'

export function ConverterListPage({ entries = converterEntries, hiddenIds }: {
  entries?: ConverterEntry[]
  /** Für Tests überschreibbar */
  hiddenIds?: ReadonlySet<string>
}) {
  usePageTitle('Umrechner')
  const storedHidden = useHiddenIds()
  const hidden = hiddenIds ?? storedHidden
  const listed = entries.filter((entry) => !hidden.has(entry.id))
  return (
    <>
      <h1 className="text-2xl font-bold">Umrechner</h1>
      <ModuleFavorites moduleTitle={modules.converter.title} />
      {entries.length === 0 && <p className="mt-2 text-muted">Noch keine Größen vorhanden.</p>}
      {groupConvertersByCategory(listed).map((group) => (
        <section key={group.category} className="mt-5">
          <h2 className={categoryHeading}>{group.category}</h2>
          <ul className="mt-2 grid gap-3 sm:grid-cols-2">
            {group.entries.map((entry) => (
              <li key={entry.id}>
                <Link
                  to={converterPath(entry.id)}
                  className="flex min-h-20 flex-col justify-center gap-1 rounded-xl border-2 border-line bg-surface p-4 active:border-accent"
                >
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xl font-bold">
                      <ConverterTitle entry={entry} />
                    </span>
                    {entry.status === 'draft' && <DraftBadge variant="inline" />}
                  </span>
                  <span className="text-base text-muted">{converterSummary(entry)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
      <ModuleHidden moduleTitle={modules.converter.title} hiddenIds={hidden} />
    </>
  )
}
