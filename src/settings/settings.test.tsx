import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createStoredState } from '../lib/storedState'
import { detectPlatform } from './install'
import { parseSettings, DEFAULT_SETTINGS } from './settings'
import { SettingsPage, Switch } from './SettingsPage'

describe('Einstellungen', () => {
  it('nutzt Standardwerte bei fehlenden oder kaputten Daten', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{kaputt')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{"hideRareUnits":"ja"}')).toEqual(DEFAULT_SETTINGS)
    expect(parseSettings('{"hideRareUnits":true}')).toEqual({ ...DEFAULT_SETTINGS, hideRareUnits: true })
    expect(parseSettings('{"showUnitNames":false}')).toEqual({ ...DEFAULT_SETTINGS, showUnitNames: false })
    expect(parseSettings('{"shakeToReport":false}')).toEqual({ ...DEFAULT_SETTINGS, shakeToReport: false })
  })

  it('blendet unübliche Einheiten standardmäßig nicht aus und zeigt Einheitennamen', () => {
    expect(DEFAULT_SETTINGS.hideRareUnits).toBe(false)
    expect(DEFAULT_SETTINGS.showUnitNames).toBe(true)
    expect(DEFAULT_SETTINGS.shakeToReport).toBe(true)
  })

  it('teilt einen gespeicherten Wert zwischen allen Lesern', () => {
    let stored = 'a'
    const state = createStoredState({ key: 'test', read: () => stored, write: (v) => (stored = v), fallback: 'x' })
    expect(state.get()).toBe('a')
    state.set('b')
    expect(state.get()).toBe('b')
    expect(stored).toBe('b')
  })
})

describe('Installation', () => {
  it('erkennt die Plattform für die passende Anleitung', () => {
    expect(detectPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)')).toBe('ios')
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5)).toBe('ios') // iPadOS
    expect(detectPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0)).toBe('desktop')
    expect(detectPlatform('Mozilla/5.0 (Linux; Android 14; Pixel 8)')).toBe('android')
    expect(detectPlatform('Mozilla/5.0 (Windows NT 10.0; Win64; x64)')).toBe('desktop')
  })
})

describe('Einstellungen-Seite', () => {
  const html = renderToStaticMarkup(
    <MemoryRouter>
      <SettingsPage />
    </MemoryRouter>,
  )

  it('zeigt Grundeinstellungen, Design, Installation und Infos', () => {
    for (const heading of ['Grundeinstellungen', 'Design', 'App auf den Startbildschirm', 'Fehler melden', 'Über die App', 'Rechtliches']) {
      expect(html).toContain(`>${heading}</h2>`)
    }
  })

  it('hat die Schalter für unübliche Einheiten (aus) und ausgeschriebene Einheiten (an)', () => {
    expect(html).toContain('role="switch" aria-checked="false" aria-label="Unübliche Einheiten ausblenden"')
    expect(html).toContain('role="switch" aria-checked="true" aria-label="Einheiten ausgeschrieben anzeigen"')
  })

  it('bietet System, Hell und Dunkel zur Auswahl', () => {
    expect(html.match(/role="radio"/g)).toHaveLength(3)
    expect(html).toMatch(/role="radio" aria-checked="true"[^>]*>(?:(?!<\/button>).)*System<\/button>/) // System ist vorgewählt
  })

  it('erklärt die Installation und nennt die Version', () => {
    expect(html).toContain('Anleitung für andere Geräte')
    expect(html).toContain('Zum Home-Bildschirm')
    expect(html).toContain(__APP_VERSION__)
  })

  it('verlinkt „Fehler melden“ auf ein neues GitHub-Issue und bietet Schütteln (an)', () => {
    expect(html).toMatch(/href="https:\/\/github\.com\/XxRexRaptorxX\/SHK-Assistant\/issues\/new\?[^"]*" target="_blank"/)
    expect(html).toContain('role="switch" aria-checked="true" aria-label="Schütteln zum Melden"')
  })

  it('verlinkt die Ko-fi-Seite zum Unterstützen', () => {
    expect(html).toContain('href="https://ko-fi.com/xxrexraptorxx" target="_blank" rel="noopener noreferrer"')
    expect(html).toContain('aria-label="Entwicklung unterstützen auf Ko-fi"')
    expect(html).not.toContain('(Ko-fi)')
  })

  it('verlinkt Impressum und Datenschutzerklärung', () => {
    expect(html).toMatch(/href="\/impressum"[^>]*>Impressum</)
    expect(html).toMatch(/href="\/datenschutz"[^>]*>Datenschutzerklärung</)
  })

  it('zeigt den Schalter eingeschaltet an', () => {
    expect(renderToStaticMarkup(<Switch label="X" checked onChange={() => {}} />)).toContain('aria-checked="true"')
  })
})
