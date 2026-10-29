import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { HINT_AFTER_PAGES, HINT_AFTER_SECONDS, hintDue, InstallHint, InstallHintDialog } from './InstallHint'

describe('Installations-Hinweis', () => {
  it('erscheint erst nach einigen Seitenwechseln oder etwas Nutzungszeit', () => {
    expect(hintDue(0, 0)).toBe(false)
    expect(hintDue(HINT_AFTER_PAGES - 1, HINT_AFTER_SECONDS - 5)).toBe(false)
    expect(hintDue(HINT_AFTER_PAGES, 0)).toBe(true)
    expect(hintDue(0, HINT_AFTER_SECONDS)).toBe(true)
  })

  it('ist beim Start nicht sichtbar', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <InstallHint />
      </MemoryRouter>,
    )
    expect(html).toBe('')
  })

  it('zeigt die Anleitung für das erkannte Gerät', () => {
    const ios = renderToStaticMarkup(<InstallHintDialog platform="ios" canPrompt={false} onClose={() => {}} />)
    expect(ios).toContain('App installieren</h2>')
    expect(ios).toContain('So geht’s: iPhone und iPad (Safari)')
    expect(ios).toContain('„Zum Home-Bildschirm“ wählen')
    expect(ios).toContain('Verstanden</button>')
    const android = renderToStaticMarkup(<InstallHintDialog platform="android" canPrompt={false} onClose={() => {}} />)
    expect(android).toContain('Android (Chrome, Samsung Internet, Firefox)')
  })

  it('bietet den Installations-Dialog des Browsers an, wenn es ihn gibt', () => {
    const html = renderToStaticMarkup(<InstallHintDialog platform="android" canPrompt onClose={() => {}} />)
    expect(html).toContain('Jetzt installieren</button>')
    expect(html).toContain('Später</button>')
    expect(html).not.toContain('So geht’s')
  })
})
