import { useMemo } from 'react'
import { createStoredState } from '../lib/storedState'

// Per Auge angepasste Einträge (Tools, Formeln, Umrechner). Reine Anzeige-Vorliebe dieses Geräts,
// daher localStorage wie die Einstellungen. Wie beides mit dem Modus zusammenspielt: visibility.ts.

/** Per Auge ausgeblendet: fehlen in der Liste ihres Moduls */
export const HIDDEN_STORAGE_KEY = 'shk-hidden'
/** Per Auge eingeblendet, obwohl der gewählte Modus sie ausblenden würde */
export const SHOWN_STORAGE_KEY = 'shk-shown'

/** Liest die gespeicherten IDs; Kaputtes oder Fremdes wird ignoriert */
export function parseHiddenIds(raw: string | null): string[] {
  try {
    const data: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? [...new Set(data.filter((id): id is string => typeof id === 'string'))] : []
  } catch {
    return []
  }
}

function createIdListState(key: string) {
  return createStoredState<string[]>({
    key,
    read: () => {
      try {
        return parseHiddenIds(globalThis.localStorage?.getItem(key) ?? null)
      } catch {
        return []
      }
    },
    write: (value) => {
      try {
        globalThis.localStorage?.setItem(key, JSON.stringify(value))
      } catch {
        // ohne Speicher gilt die Auswahl bis zum Neuladen
      }
    },
    fallback: [],
  })
}

const hiddenState = createIdListState(HIDDEN_STORAGE_KEY)
const shownState = createIdListState(SHOWN_STORAGE_KEY)

function useIdSet(state: ReturnType<typeof createIdListState>): ReadonlySet<string> {
  const ids = state.useValue()
  return useMemo(() => new Set(ids), [ids])
}

export const useHiddenIds = (): ReadonlySet<string> => useIdSet(hiddenState)
export const useShownIds = (): ReadonlySet<string> => useIdSet(shownState)

export const setHiddenIds = (ids: string[]): void => hiddenState.set(ids)
export const setShownIds = (ids: string[]): void => shownState.set(ids)

/** Per Auge ausgeblendete Einträge wieder einblenden */
export function showAllHidden(): void {
  hiddenState.set([])
}

/** Per Auge eingeblendete Einträge wieder dem Modus überlassen */
export function resetAllShown(): void {
  shownState.set([])
}
