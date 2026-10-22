import { useEffect } from 'react'
import { createStoredState } from '../lib/storedState'
import {
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from './theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

/** Gemeinsamer Stand für alle Komponenten (Einstellungen, Seiten), auch über Tabs hinweg */
const themeState = createStoredState<ThemePreference>({
  key: THEME_STORAGE_KEY,
  read: () => loadThemePreference(),
  write: (value) => saveThemePreference(value),
  fallback: 'system',
})

export function useTheme() {
  return { preference: themeState.useValue(), setPreference: themeState.set }
}

/** Setzt das Theme auf <html> und folgt bei "System" dem Betriebssystem. Einmal im Layout verwenden. */
export function useApplyTheme() {
  const preference = themeState.useValue()
  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const apply = () => {
      const root = document.documentElement
      const theme = resolveTheme(preference, media.matches)
      root.classList.toggle('dark', theme === 'dark')
      // Statusleiste (installierte App) an die Kopfzeile angleichen (Seitenhintergrund)
      const page = getComputedStyle(root).getPropertyValue('--page').trim()
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', page)
    }
    apply()
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])
}
