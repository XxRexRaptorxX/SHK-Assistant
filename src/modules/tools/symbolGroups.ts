import { createStoredState } from '../../lib/storedState'

// Eingeklappte Gruppen im Sinnbild-Tool, je Tool gemerkt. Reine Anzeige-Vorliebe, daher localStorage.

export const COLLAPSED_SYMBOL_GROUPS_KEY = 'shk-symbol-groups-collapsed'

type CollapsedGroups = Record<string, string[]>

/** Liest den gespeicherten Stand; Unbekanntes oder Kaputtes ergibt „nichts eingeklappt“. */
export function parseCollapsedGroups(raw: string | null): CollapsedGroups {
  try {
    const data: unknown = raw ? JSON.parse(raw) : {}
    if (typeof data !== 'object' || data === null || Array.isArray(data)) return {}
    return Object.fromEntries(
      Object.entries(data).flatMap(([toolId, titles]) =>
        Array.isArray(titles) ? [[toolId, titles.filter((title): title is string => typeof title === 'string')]] : [],
      ),
    )
  } catch {
    return {}
  }
}

const collapsedState = createStoredState<CollapsedGroups>({
  key: COLLAPSED_SYMBOL_GROUPS_KEY,
  read: () => {
    try {
      return parseCollapsedGroups(globalThis.localStorage?.getItem(COLLAPSED_SYMBOL_GROUPS_KEY) ?? null)
    } catch {
      return {}
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(COLLAPSED_SYMBOL_GROUPS_KEY, JSON.stringify(value))
    } catch {
      // ohne Speicher gilt der Stand bis zum Neuladen
    }
  },
  fallback: {},
})

/** Titel der eingeklappten Gruppen eines Tools */
export function useCollapsedGroups(toolId: string): string[] {
  return collapsedState.useValue()[toolId] ?? []
}

/** Gruppe ein- oder ausklappen und merken */
export function toggleCollapsedGroup(toolId: string, title: string): void {
  const all = collapsedState.get()
  const current = all[toolId] ?? []
  const next = current.includes(title) ? current.filter((entry) => entry !== title) : [...current, title]
  collapsedState.set({ ...all, [toolId]: next })
}
