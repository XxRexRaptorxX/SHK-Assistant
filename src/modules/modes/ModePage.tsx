import { useLocation } from 'react-router'
import { modules } from '../../app/modules'
import { BackLink } from '../../components/ContentPage'
import { pageTitle } from '../../components/headings'
import { useVisibilityState, visibilityOf, type VisibilityState } from '../../hidden/visibility'
import { usePageTitle } from '../../lib/usePageTitle'
import type { SearchDocument } from '../../search/search'
import { getContentIndex } from '../../search/sources'
import { updateSettings, useSettings } from '../../settings/settings'
import { ModePicker } from './ModePicker'

export const MODE_PAGE_PATH = `${modules.settings.path}/modus`

/** Woher die Seite geöffnet wurde (z. B. aus der Tool-Liste), für den Zurück-Link */
export interface ModePageOrigin {
  from: string
  label: string
}

const isOrigin = (state: unknown): state is ModePageOrigin =>
  typeof state === 'object' && state !== null && 'from' in state && 'label' in state

/** „x von y Tools“ für die Module, die der Modus filtert */
export function ModeSummary({ state, index }: { state: VisibilityState; index: ReadonlyMap<string, SearchDocument> }) {
  const parts = [modules.tools.title, modules.formulas.title].map((title) => {
    // Umgestellte Formeln stehen nicht in der Liste, daher nur Einträge mit eigener Zeile
    const entries = [...index.values()].filter((entry) => entry.moduleTitle === title && !entry.id.includes('.nach-'))
    const visible = entries.filter((entry) => visibilityOf(entry, state) === 'visible').length
    return `${visible} von ${entries.length} ${title}`
  })
  return <p className="mt-3 text-base text-muted">In den Listen: {parts.join(', ')}.</p>
}

/** Eigene Seite für die Auswahl der Modi, erreichbar aus den Einstellungen und den Listen */
export function ModePage({ index }: { index?: ReadonlyMap<string, SearchDocument> }) {
  usePageTitle('Modus wählen')
  const settings = useSettings()
  const state = useVisibilityState()
  const { state: navState } = useLocation()
  const back = isOrigin(navState) ? { to: navState.from, label: navState.label } : { to: modules.settings.path, label: modules.settings.title }

  return (
    <>
      <BackLink to={back.to} label={back.label} />
      <h1 className={pageTitle}>Modus wählen</h1>
      <p className="mt-3 mb-4 text-base text-muted">
        Zeigt bei Tools und Formeln nur, was zum Arbeitsbereich passt. Mehrere sind möglich. Einzelne Einträge
        lassen sich zusätzlich über das Auge aus- oder einblenden. Die Suche findet weiterhin alles.
      </p>
      <ModePicker value={settings.modes} onChange={(modes) => updateSettings({ modes })} />
      <ModeSummary state={state} index={index ?? getContentIndex()} />
    </>
  )
}
