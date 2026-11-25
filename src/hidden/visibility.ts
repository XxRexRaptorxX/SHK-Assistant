import { useMemo } from 'react'
import { isModeFiltered, matchesModes, useActiveModes, type ModeFilterable } from '../modules/modes/modes'
import type { ModeEntry } from '../modules/modes/schema'
import { getContentIndex } from '../search/sources'
import { setHiddenIds, setShownIds, useHiddenIds, useShownIds } from './hiddenStore'

// Sichtbarkeit eines Eintrags in der Liste seines Moduls. Zwei Ebenen:
// 1. Modus (Einstellungen): filtert Tools und Formeln nach Arbeitsbereich.
// 2. Auge (einzeln): blendet einen Eintrag aus („hidden“) oder einen vom Modus
//    ausgeblendeten Eintrag doch ein („shown“). Das Auge geht immer vor.

/** visible = steht in der Liste; manual = per Auge ausgeblendet; mode = vom Modus ausgeblendet */
export type Visibility = 'visible' | 'manual' | 'mode'

export interface VisibilityState {
  hidden: ReadonlySet<string>
  shown: ReadonlySet<string>
  modes: readonly ModeEntry[]
}

export function visibilityOf(item: ModeFilterable, state: VisibilityState): Visibility {
  if (state.hidden.has(item.id)) return 'manual'
  if (!isModeFiltered(item.id) || state.shown.has(item.id) || matchesModes(item, state.modes)) return 'visible'
  return 'mode'
}

/** Neue Auswahl, nachdem ein Eintrag per Auge ein- oder ausgeblendet wurde */
export function withVisibility(
  item: ModeFilterable,
  visible: boolean,
  state: VisibilityState,
): { hidden: string[]; shown: string[] } {
  const hidden = [...state.hidden].filter((id) => id !== item.id)
  const shown = [...state.shown].filter((id) => id !== item.id)
  if (!visible) return { hidden: [...hidden, item.id], shown }
  // Nur merken, wenn der Modus den Eintrag sonst ausblenden würde
  const modeHides = isModeFiltered(item.id) && !matchesModes(item, state.modes)
  return { hidden, shown: modeHides ? [...shown, item.id] : shown }
}

/** Alles, was die Sichtbarkeit bestimmt: Modi und die Auswahl per Auge */
export function useVisibilityState(): VisibilityState {
  const hidden = useHiddenIds()
  const shown = useShownIds()
  const modes = useActiveModes()
  return useMemo(() => ({ hidden, shown, modes }), [hidden, shown, modes])
}

/** Wie useVisibilityState, einzelne Teile für Tests überschreibbar */
export function useListVisibility(overrides: { hiddenIds?: ReadonlySet<string>; modes?: readonly ModeEntry[] }): VisibilityState {
  const stored = useVisibilityState()
  const { hiddenIds, modes } = overrides
  return useMemo(
    () => ({ hidden: hiddenIds ?? stored.hidden, shown: stored.shown, modes: modes ?? stored.modes }),
    [hiddenIds, modes, stored],
  )
}

/** Tags eines Eintrags aus dem gemeinsamen Verzeichnis, für Seiten, die nur die id kennen */
export const indexedItem = (id: string): ModeFilterable => ({ id, tags: getContentIndex().get(id)?.tags })

export function setVisible(item: ModeFilterable, visible: boolean, state: VisibilityState): void {
  const next = withVisibility(item, visible, state)
  setHiddenIds(next.hidden)
  setShownIds(next.shown)
}
