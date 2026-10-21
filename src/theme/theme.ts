// Theme-Einstellung. Reine UI-Vorliebe, daher localStorage statt IndexedDB.
// Schlüssel und Werte müssen zum Inline-Skript in index.html passen.

export const THEME_STORAGE_KEY = 'shk-theme'

export const THEME_PREFERENCES = ['system', 'light', 'dark'] as const

export type ThemePreference = (typeof THEME_PREFERENCES)[number]

export type ResolvedTheme = 'light' | 'dark'

export const THEME_LABELS: Record<ThemePreference, string> = {
  system: 'System',
  light: 'Hell',
  dark: 'Dunkel',
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

/** localStorage kann fehlen oder Zugriffe verbieten (privater Modus, Node in Tests). */
function browserStorage(): Storage | undefined {
  try {
    return globalThis.localStorage
  } catch {
    return undefined
  }
}

export function loadThemePreference(storage: ReadableStorage | undefined = browserStorage()): ThemePreference {
  try {
    const value = storage?.getItem(THEME_STORAGE_KEY)
    return THEME_PREFERENCES.find((p) => p === value) ?? 'system'
  } catch {
    return 'system'
  }
}

export function saveThemePreference(
  preference: ThemePreference,
  storage: WritableStorage | undefined = browserStorage(),
): void {
  try {
    storage?.setItem(THEME_STORAGE_KEY, preference)
  } catch {
    // Speichern ist nur Komfort; ohne Speicher gilt die Einstellung bis zum Neuladen.
  }
}

export function resolveTheme(preference: ThemePreference, systemPrefersDark: boolean): ResolvedTheme {
  if (preference === 'system') return systemPrefersDark ? 'dark' : 'light'
  return preference
}

/** Reihenfolge beim Antippen des Umschalters: System → Hell → Dunkel → System */
export function nextThemePreference(preference: ThemePreference): ThemePreference {
  const index = THEME_PREFERENCES.indexOf(preference)
  return THEME_PREFERENCES[(index + 1) % THEME_PREFERENCES.length] ?? 'system'
}
