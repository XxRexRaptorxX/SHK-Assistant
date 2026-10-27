import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from '../../App'
import { CALCULATORS, findCalculator, neighbors } from './calculators'
import { GraphCalculator } from './GraphCalculator'
import { KeypadCalculator } from './KeypadCalculator'
import { INITIAL_STATE, press, scientificKeys, STANDARD_KEYS } from './keypad'

const at = (path: string) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )

describe('Taschenrechner-Seiten', () => {
  it('hat eine Kachel auf der Startseite und listet die drei Rechner', () => {
    expect(at('/')).toContain('Standard, Wissenschaft, Grafik')
    const list = at('/rechner')
    for (const info of CALCULATORS) expect(list).toContain(`href="/rechner/${info.slug}"`)
  })

  it('wechselt mit Pfeilen im Kreis zwischen den Rechnern', () => {
    const neighbours = (slug: string) => findCalculator(slug) && neighbors(findCalculator(slug)!)
    expect(neighbours('standard')).toMatchObject({ previous: { slug: 'grafik' }, next: { slug: 'wissenschaftlich' } })
    expect(neighbours('grafik')?.next.slug).toBe('standard')
  })

  it('steht in der unteren Leiste als „Rechner“ vor den Checklisten', () => {
    const html = at('/')
    const nav = html.slice(html.indexOf('aria-label="Module"'))
    expect(nav).toContain('grid-cols-7')
    expect(nav.indexOf('>Rechner</span>')).toBeLessThan(nav.indexOf('>Checklisten</span>'))
  })

  it('zeigt den Standardrechner mit 20 großen Tasten und Ergebnis', () => {
    const state = ['d7', 'multiply', 'd6', 'equals'].reduce(
      (s, id) => press(s, STANDARD_KEYS.find((k) => k.id === id)!),
      INITIAL_STATE,
    )
    const html = renderToStaticMarkup(<KeypadCalculator mode="standard" initialState={state} />)
    expect(html.match(/<button/g)).toHaveLength(20)
    expect(html).toContain('grid-cols-4')
    expect(html).toContain('7×6 =')
    expect(html).toMatch(/aria-label="Eingabe"[^>]*>42<\/output>/)
  })

  it('zeigt den wissenschaftlichen Rechner mit Winkelmaß und Zweitbelegung', () => {
    const html = renderToStaticMarkup(<KeypadCalculator mode="scientific" />)
    expect(html.match(/<button/g)).toHaveLength(35)
    expect(html).toContain('grid-cols-5')
    expect(html).toContain('>DEG</span>')
    expect(html).toContain('aria-label="Sinus"')
    expect(html).toContain('aria-pressed="false"')
  })

  it('beschriftet „Alles löschen“ mit C, im wissenschaftlichen Rechner oben rechts, und färbt ⌫ rot', () => {
    expect(STANDARD_KEYS[0]).toMatchObject({ id: 'clear', label: 'C' })
    const ids = scientificKeys(false, 'deg').map((key) => key.id)
    expect(ids.indexOf('clear')).toBe(4)
    expect(ids.indexOf('back')).toBe(19)
    for (const mode of ['standard', 'scientific'] as const) {
      const html = renderToStaticMarkup(<KeypadCalculator mode={mode} />)
      expect(html).toContain('aria-label="Alles löschen"')
      expect(html).not.toContain('>AC<')
      expect(html).toContain('<span class="text-[var(--fig-hot)]">⌫</span>')
    }
  })

  it('zeichnet Achsen und eine Kurve und meldet Fehler in der Eingabe', () => {
    const html = renderToStaticMarkup(<GraphCalculator initialInputs={['x^2', 'x + y', '']} />)
    expect(html).toContain('aria-label="Funktionsgraph"')
    expect(html.match(/<polyline/g)?.length).toBeGreaterThan(0)
    expect(html).toContain('stroke="var(--graph-1)"')
    expect(html).toContain('Unbekannt: „y“ (nur x erlaubt)')
    // Bedienhinweis steht unter allen Knöpfen
    expect(html.indexOf('Dezimalkomma, Argumente')).toBeGreaterThan(html.indexOf('Ansicht zurücksetzen'))
  })
})
