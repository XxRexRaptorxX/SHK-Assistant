import { EntryRows } from '../components/EntryList'
import type { SearchDocument } from '../search/search'
import { getContentIndex } from '../search/sources'
import { HideButton } from './HideButton'
import { useVisibilityState, visibilityOf, type VisibilityState } from './visibility'

interface ModuleHiddenProps {
  /** Modulname wie in der Navigation, z. B. "Formeln" */
  moduleTitle: string
  /** Vom Modus ausgeblendete Einträge, die hier trotzdem nicht erscheinen sollen (z. B. umgestellte Formeln) */
  skip?: ReadonlySet<string>
  /** Für Tests überschreibbar */
  state?: VisibilityState
  index?: ReadonlyMap<string, SearchDocument>
}

/** Aufklappbarer Bereich unten in der Liste: per Auge oder vom Modus ausgeblendete Einträge, mit Auge zum Einblenden */
export function ModuleHidden({ moduleTitle, skip, state, index }: ModuleHiddenProps) {
  const stored = useVisibilityState()
  const current = state ?? stored
  const rows = [...(index ?? getContentIndex()).values()]
    .filter((entry) => entry.moduleTitle === moduleTitle)
    .map((entry) => ({ entry, visibility: visibilityOf(entry, current) }))
    .filter(({ entry, visibility }) => visibility === 'manual' || (visibility === 'mode' && !skip?.has(entry.id)))
  if (rows.length === 0) return null
  const byMode = rows.filter((row) => row.visibility === 'mode').length

  return (
    <details className="mt-6 border-t-2 border-line pt-2">
      <summary className="min-h-12 cursor-pointer py-3 font-semibold text-muted">
        Ausgeblendet ({rows.length}){byMode > 0 && `, davon ${byMode} vom Modus`}
      </summary>
      <EntryRows
        entries={rows.map((row) => row.entry)}
        action={(entry) => (
          <HideButton
            id={entry.id}
            title={entry.title}
            tags={entry.tags}
            visibility={rows.find((row) => row.entry === entry)?.visibility}
          />
        )}
      />
    </details>
  )
}
