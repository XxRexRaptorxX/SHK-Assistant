import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { homeTileModules, modules, visibleBottomNavModules } from './app/modules'
import { pageTitle } from './components/headings'

function renderAt(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App-Routen', () => {
  // Fachmann wird nachgeladen (entfällt im public-Build), siehe eigener Test
  const directModules = Object.values(modules).filter((module) => module !== modules.expert)

  it.each(directModules)('zeigt die Seite $title unter $path', (module) => {
    expect(renderAt(module.path)).toContain(`<h1 class="${pageTitle}">${module.title}</h1>`)
  })

  it('kennt in der internen Edition den Bereich Fachmann mit Kachel auf der Startseite', () => {
    const html = renderAt(modules.expert.path)
    expect(html).not.toContain('Seite nicht gefunden')
    expect(html).toContain('Wird geladen')
    expect(renderAt('/')).toContain(modules.expert.description)
  })

  it('zeigt auf der Startseite Kacheln zu den Modulen', () => {
    const html = renderAt('/')
    for (const module of homeTileModules) {
      expect(html).toContain(module.description)
    }
  })

  it('hat Favoriten ganz rechts in der unteren Leiste, Checklisten bleiben über die Startseite erreichbar', () => {
    expect(visibleBottomNavModules(true).at(-1)).toBe(modules.favorites)
    expect(visibleBottomNavModules(true)).not.toContain(modules.checklists)
    expect(homeTileModules).toContain(modules.checklists)
    expect(new Set(homeTileModules).size).toBe(homeTileModules.length)
  })

  it('zeigt für unbekannte Adressen "Seite nicht gefunden"', () => {
    expect(renderAt('/gibt-es-nicht')).toContain('Seite nicht gefunden')
  })

  it('enthält die untere Navigation mit Start und allen Hauptmodulen', () => {
    const html = renderAt('/')
    for (const path of ['/', ...visibleBottomNavModules(false).map((m) => m.path)]) {
      expect(html).toContain(`href="${path}"`)
    }
  })

  it('zeigt Favoriten in der unteren Leiste erst, wenn etwas gemerkt ist', () => {
    expect(visibleBottomNavModules(false)).not.toContain(modules.favorites)
    expect(visibleBottomNavModules(true)).toContain(modules.favorites)
    // Ohne geladene Favoriten: sechs Spalten und kein Knopf in der Leiste, der Stern oben bleibt
    const html = renderAt('/')
    const nav = html.slice(html.indexOf('aria-label="Module"'))
    expect(nav).toContain('grid-cols-6')
    expect(nav).not.toContain('>Favoriten</span>')
    expect(html).toContain('aria-label="Favoriten"')
  })

  it('markiert in der internen Edition die Kopfzeile', () => {
    expect(renderAt('/')).toContain('Intern')
  })
})
