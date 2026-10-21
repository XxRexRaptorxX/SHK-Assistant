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
      const theme = resolveTheme(preference, media.matches)
      document.documentElement.classList.toggle('dark', theme === 'dark')
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
