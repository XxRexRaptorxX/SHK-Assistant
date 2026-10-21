import { useEffect, useState } from 'react'
import {
  loadThemePreference,
  resolveTheme,
  saveThemePreference,
  type ThemePreference,
} from './theme'

const DARK_QUERY = '(prefers-color-scheme: dark)'

export function useTheme() {
  const [preference, setPreference] = useState<ThemePreference>(() => loadThemePreference())

  useEffect(() => {
    const media = window.matchMedia(DARK_QUERY)
    const apply = () => {
      const root = document.documentElement
      const theme = resolveTheme(preference, media.matches)
      root.classList.toggle('dark', theme === 'dark')
      // Statusleiste (installierte App) an die Kopfzeile angleichen
      const surface = getComputedStyle(root).getPropertyValue('--surface').trim()
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', surface)
    }
    apply()
    // Bei "System" dem Wechsel des Betriebssystems folgen
    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [preference])

  const changePreference = (next: ThemePreference) => {
    saveThemePreference(next)
    setPreference(next)
  }

  return { preference, setPreference: changePreference }
}
