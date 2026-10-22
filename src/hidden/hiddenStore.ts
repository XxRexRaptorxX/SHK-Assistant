import { useMemo } from 'react'
import { createStoredState } from '../lib/storedState'

// Ausgeblendete Einträge (Formeln, Umrechner): fehlen in der Liste ihres Moduls.
// Reine Anzeige-Vorliebe dieses Geräts, daher localStorage wie die Einstellungen.

export const HIDDEN_STORAGE_KEY = 'shk-hidden'

/** Liest die gespeicherten IDs; Kaputtes oder Fremdes wird ignoriert */
export function parseHiddenIds(raw: string | null): string[] {
  try {
    const data: unknown = raw ? JSON.parse(raw) : []
    return Array.isArray(data) ? [...new Set(data.filter((id): id is string => typeof id === 'string'))] : []
  } catch {
    return []
  }
}

const hiddenState = createStoredState<string[]>({
  key: HIDDEN_STORAGE_KEY,
  read: () => {
    try {
      return parseHiddenIds(globalThis.localStorage?.getItem(HIDDEN_STORAGE_KEY) ?? null)
    } catch {
      return []
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(HIDDEN_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // ohne Speicher gilt die Auswahl bis zum Neuladen
    }
  },
  fallback: [],
})

export function useHiddenIds(): ReadonlySet<string> {
  const ids = hiddenState.useValue()
  return useMemo(() => new Set(ids), [ids])
}

export function toggleHidden(id: string): void {
  const ids = hiddenState.get()
  hiddenState.set(ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id])
}

export function showAllHidden(): void {
  hiddenState.set([])
}
