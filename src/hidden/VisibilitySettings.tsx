import { secondaryButton } from '../components/buttons'
import { EntryRows } from '../components/EntryList'
import { Link } from 'react-router'
import { MODE_PAGE_PATH, ModeSummary } from '../modules/modes/ModePage'
import type { SearchDocument } from '../search/search'
import { getContentIndex } from '../search/sources'
import { HideButton } from './HideButton'
import { resetAllShown, showAllHidden } from './hiddenStore'
import { useVisibilityState, visibilityOf, type VisibilityState } from './visibility'

interface VisibilitySettingsProps {
  /** Für Tests überschreibbar */
  state?: VisibilityState
  index?: ReadonlyMap<string, SearchDocument>
}

function AdjustedEntries({ title, description, entries, buttonLabel, onReset, state }: {
  title: string
  description: string
  entries: SearchDocument[]
  buttonLabel: string
  onReset: () => void
  state: VisibilityState
}) {
  return (
    <div className="mt-3 rounded-2xl border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span>
          <span className="block font-semibold">
            {title} ({entries.length})
          </span>
          <span className="mt-1 block text-base text-muted">{description}</span>
        </span>
        <button type="button" className={secondaryButton} disabled={entries.length === 0} onClick={onReset}>
          {buttonLabel}
        </button>
      </div>
      {entries.length > 0 && (
        <details className="mt-2">
          <summary className="min-h-12 cursor-pointer py-3 font-semibold">Einträge anzeigen</summary>
          <EntryRows
            entries={entries}
            action={(entry) => (
              <HideButton id={entry.id} title={entry.title} tags={entry.tags} visibility={visibilityOf(entry, state)} />
            )}
          />
        </details>
      )}
    </div>
  )
}

/**
 * Einstellungen zu dem, was in den Listen steht: Modus für Tools und Formeln und die einzeln
 * per Auge aus- oder eingeblendeten Einträge. Das Auge geht dem Modus vor.
 */
export function VisibilitySettings({ state, index }: VisibilitySettingsProps) {
  const stored = useVisibilityState()
  const current = state ?? stored
  const all = index ?? getContentIndex()
  const hiddenEntries = [...all.values()].filter((entry) => current.hidden.has(entry.id))
  const shownEntries = [...all.values()].filter((entry) => current.shown.has(entry.id))

  return (
    <>
      <p className="mb-3 text-base text-muted">
        Der Modus zeigt bei Tools und Formeln nur, was zum Arbeitsbereich passt. Einzelne Einträge lassen sich
        zusätzlich über das Auge auf ihrer Seite oder unten in der Liste aus- oder einblenden.
      </p>
      <Link to={MODE_PAGE_PATH} className="flex min-h-16 w-full items-center justify-between gap-3 rounded-2xl border-2 border-accent bg-surface px-4 py-2 text-left">
        <span>
          <span className="block font-semibold">Modus wählen</span>
          <span className="block text-base text-muted">
            Aktiv: {current.modes.length === 0 ? 'Alles' : current.modes.map((mode) => mode.title).join(', ')}
          </span>
        </span>
        <span aria-hidden="true" className="text-2xl text-accent">
          ›
        </span>
      </Link>
      <ModeSummary state={current} index={all} />
      <AdjustedEntries
        title="Einzeln ausgeblendet"
        description="Tools, Formeln und Umrechner, die du über das Auge ausgeblendet hast."
        entries={hiddenEntries}
        buttonLabel="Alle einblenden"
        onReset={showAllHidden}
        state={current}
      />
      <AdjustedEntries
        title="Einzeln eingeblendet"
        description="Tools und Formeln, die du über das Auge eingeblendet hast, obwohl der Modus sie ausblenden würde."
        entries={shownEntries}
        buttonLabel="Dem Modus überlassen"
        onReset={resetAllShown}
        state={current}
      />
    </>
  )
}
