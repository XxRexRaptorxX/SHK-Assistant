import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { App } from './App'
import { bottomNavModules, modules } from './app/modules'
import { pageTitle } from './components/headings'

function renderAt(path: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('App-Routen', () => {
  it.each(Object.values(modules))('zeigt die Seite $title unter $path', (module) => {
    expect(renderAt(module.path)).toContain(`<h1 class="${pageTitle}">${module.title}</h1>`)
  })

  it('zeigt auf der Startseite Kacheln zu den Modulen', () => {
    const html = renderAt('/')
    for (const module of bottomNavModules) {
      expect(html).toContain(module.description)
    }
  })

  it('zeigt für unbekannte Adressen "Seite nicht gefunden"', () => {
    expect(renderAt('/gibt-es-nicht')).toContain('Seite nicht gefunden')
  })

  it('enthält die untere Navigation mit Start und allen Hauptmodulen', () => {
    const html = renderAt('/')
    for (const path of ['/', ...bottomNavModules.map((m) => m.path)]) {
      expect(html).toContain(`href="${path}"`)
    }
  })

  it('markiert in der internen Edition die Kopfzeile', () => {
    expect(renderAt('/')).toContain('Intern')
  })
})
