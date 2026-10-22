import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { Layout } from '../app/Layout'
import { bugReportUrl } from './bugReport'
import { BugReportDialog } from './ShakeToReport'
import { createShakeDetector, DEFAULT_SHAKE_OPTIONS, motionMagnitude } from './shake'

describe('Fehlermeldung', () => {
  it('füllt ein neues GitHub-Issue mit Seite, Version und Ausgabe vor', () => {
    const url = new URL(bugReportUrl({ page: '/formeln/kreisflaeche', version: '1.2.3', edition: 'intern' }))
    expect(url.origin + url.pathname).toBe('https://github.com/XxRexRaptorxX/SHK-Assistant/issues/new')
    expect(url.searchParams.get('title')).toBe('Fehler: ')
    const body = url.searchParams.get('body') ?? ''
    expect(body).toContain('**Seite:** /formeln/kreisflaeche')
    expect(body).toContain('**Version:** 1.2.3 (intern)')
    expect(body).toContain('**Was ist passiert?**')
  })

  it('lässt die Seite weg, wenn keine angegeben ist', () => {
    const body = new URL(bugReportUrl({ version: '1', edition: 'intern' })).searchParams.get('body')
    expect(body).not.toContain('Seite')
  })

  it('zeigt nach dem Schütteln eine Rückfrage mit Link und Abbrechen', () => {
    const html = renderToStaticMarkup(<BugReportDialog page="/lexikon" onClose={() => {}} />)
    expect(html).toContain('Fehler melden?')
    expect(html).toContain('target="_blank"')
    expect(html).toContain('%2Flexikon')
    expect(html).toContain('>Abbrechen</button>')
  })
})

describe('Schüttel-Erkennung', () => {
  const shake = (detect: ReturnType<typeof createShakeDetector>, start: number, count: number, gap = 200) =>
    Array.from({ length: count }, (_, i) => detect(20, start + i * gap))

  it('erkennt mehrere kräftige Ausschläge kurz hintereinander', () => {
    const detect = createShakeDetector()
    expect(shake(detect, 0, DEFAULT_SHAKE_OPTIONS.peaks)).toEqual([false, false, false, true])
  })

  it('ignoriert schwache Bewegungen, einzelne Stöße und zu langsame Folgen', () => {
    const detect = createShakeDetector()
    expect(Array.from({ length: 10 }, (_, i) => detect(10, i * 100)).some(Boolean)).toBe(false)
    expect(detect(30, 5000)).toBe(false)
    // Ausschläge weiter auseinander als das Zeitfenster
    expect(shake(detect, 10_000, 4, 800).some(Boolean)).toBe(false)
  })

  it('zählt viele Messwerte einer einzigen Bewegung nur einmal', () => {
    const detect = createShakeDetector()
    expect(Array.from({ length: 20 }, (_, i) => detect(25, i * 16)).some(Boolean)).toBe(false)
  })

  it('meldet nach einem Schütteln eine Weile nichts', () => {
    const detect = createShakeDetector()
    expect(shake(detect, 0, 4).at(-1)).toBe(true)
    expect(shake(detect, 1000, 4).some(Boolean)).toBe(false)
    expect(shake(detect, 5000, 4).at(-1)).toBe(true)
  })

  it('berechnet die Beschleunigung ohne Erdanziehung, notfalls aus dem Wert mit Erdanziehung', () => {
    expect(motionMagnitude({ acceleration: { x: 3, y: 4, z: 0 }, accelerationIncludingGravity: null })).toBe(5)
    expect(
      motionMagnitude({ acceleration: null, accelerationIncludingGravity: { x: 0, y: 0, z: 9.81 } }),
    ).toBeCloseTo(0)
    expect(motionMagnitude({ acceleration: null, accelerationIncludingGravity: null })).toBe(0)
  })
})

describe('Firmenlogo', () => {
  it('führt in der Kopfzeile zur Webseite von Biebl Haustechnik', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <Layout />
      </MemoryRouter>,
    )
    expect(html).toMatch(/<a href="https:\/\/www\.biebl-haustechnik\.de" target="_blank" rel="noopener noreferrer"/)
  })
})
