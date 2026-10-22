import { EntryRows } from '../components/EntryList'
import type { SearchDocument } from '../search/search'
import { getContentIndex } from '../search/sources'
import { HideButton } from './HideButton'
import { useHiddenIds } from './hiddenStore'

interface ModuleHiddenProps {
  /** Modulname wie in der Navigation, z. B. "Formeln" */
  moduleTitle: string
  /** Für Tests überschreibbar */
  hiddenIds?: ReadonlySet<string>
  index?: ReadonlyMap<string, SearchDocument>
}

/** Aufklappbarer Bereich unten in der Liste: ausgeblendete Einträge, mit Auge zum Wiedereinblenden */
export function ModuleHidden({ moduleTitle, hiddenIds, index }: ModuleHiddenProps) {
  const stored = useHiddenIds()
  const ids = hiddenIds ?? stored
  if (ids.size === 0) return null
  const entries = [...(index ?? getContentIndex()).values()].filter(
    (entry) => entry.moduleTitle === moduleTitle && ids.has(entry.id),
  )
  if (entries.length === 0) return null

  return (
    <details className="mt-6 border-t-2 border-line pt-2">
      <summary className="min-h-12 cursor-pointer py-3 font-semibold text-muted">Ausgeblendet ({entries.length})</summary>
      <EntryRows
        entries={entries}
        action={(entry) => <HideButton id={entry.id} title={entry.title} hidden />}
      />
    </details>
  )
}
