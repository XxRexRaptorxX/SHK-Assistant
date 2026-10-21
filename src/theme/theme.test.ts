import { describe, expect, it } from 'vitest'
import {
  loadThemePreference,
  nextThemePreference,
  resolveTheme,
  saveThemePreference,
  THEME_STORAGE_KEY,
} from './theme'

function fakeStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial))
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
    data,
  }
}

describe('Theme-Einstellung', () => {
  it('nutzt "system", wenn nichts oder Unsinn gespeichert ist', () => {
    expect(loadThemePreference(fakeStorage())).toBe('system')
    expect(loadThemePreference(fakeStorage({ [THEME_STORAGE_KEY]: 'lila' }))).toBe('system')
    expect(loadThemePreference(undefined)).toBe('system')
  })

  it('übersteht einen Speicher, der beim Zugriff Fehler wirft', () => {
    const broken = {
      getItem: () => {
        throw new Error('SecurityError')
      },
      setItem: () => {
        throw new Error('QuotaExceededError')
      },
    }
    expect(loadThemePreference(broken)).toBe('system')
    expect(() => saveThemePreference('dark', broken)).not.toThrow()
  })

  it('speichert und lädt die Einstellung', () => {
    const storage = fakeStorage()
    saveThemePreference('dark', storage)
    expect(loadThemePreference(storage)).toBe('dark')
  })

  it('löst "system" nach Systemeinstellung auf', () => {
    expect(resolveTheme('system', true)).toBe('dark')
    expect(resolveTheme('system', false)).toBe('light')
    expect(resolveTheme('light', true)).toBe('light')
    expect(resolveTheme('dark', false)).toBe('dark')
  })

  it('wechselt reihum System → Hell → Dunkel → System', () => {
    expect(nextThemePreference('system')).toBe('light')
    expect(nextThemePreference('light')).toBe('dark')
    expect(nextThemePreference('dark')).toBe('system')
  })
})
