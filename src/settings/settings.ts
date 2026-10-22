import { createStoredState } from '../lib/storedState'

// Persönliche Einstellungen. Reine Anzeige-Vorlieben, daher localStorage statt IndexedDB.

export const SETTINGS_STORAGE_KEY = 'shk-settings'

export interface Settings {
  /** Umrechner: unübliche Einheiten ausblenden (Standard: aus) */
  hideRareUnits: boolean
}

export const DEFAULT_SETTINGS: Settings = { hideRareUnits: false }

/** Liest gespeicherte Einstellungen; Unbekanntes oder Kaputtes fällt auf die Standardwerte zurück. */
export function parseSettings(raw: string | null): Settings {
  try {
    const data: unknown = raw ? JSON.parse(raw) : {}
    const record = typeof data === 'object' && data !== null ? (data as Record<string, unknown>) : {}
    return {
      hideRareUnits: typeof record.hideRareUnits === 'boolean' ? record.hideRareUnits : DEFAULT_SETTINGS.hideRareUnits,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const settingsState = createStoredState<Settings>({
  key: SETTINGS_STORAGE_KEY,
  read: () => {
    try {
      return parseSettings(globalThis.localStorage?.getItem(SETTINGS_STORAGE_KEY) ?? null)
    } catch {
      return DEFAULT_SETTINGS
    }
  },
  write: (value) => {
    try {
      globalThis.localStorage?.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(value))
    } catch {
      // ohne Speicher gilt die Einstellung bis zum Neuladen
    }
  },
  fallback: DEFAULT_SETTINGS,
})

export function useSettings(): Settings {
  return settingsState.useValue()
}

export function updateSettings(change: Partial<Settings>): void {
  settingsState.set({ ...settingsState.get(), ...change })
}
