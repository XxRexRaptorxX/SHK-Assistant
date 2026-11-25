import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { getSearchEngine } from '../../search/sources'
import { DEFAULT_SETTINGS, parseSettings } from '../../settings/settings'
import { FormulaListPage } from '../formulas/FormulaListPage'
import { ToolListPage } from '../tools/ToolListPage'
import { matchesMode, matchesModes, modeEntries, resolveModes, toggleModeId } from './modes'
import { ModePicker } from './ModePicker'
import { modeColor } from './ModeNotice'
import { MODE_PAGE_PATH, ModePage } from './ModePage'
import { SettingsPage } from '../../settings/SettingsPage'
import { modeCollection, type ModeEntry } from './schema'

// Testgerüst ohne Fachinhalt: zwei erfundene Modi über Tags
const meta = { visibility: 'public', status: 'draft', source: '', verifiedBy: '', verifiedAt: '' } as const
const strom: ModeEntry = { id: 'mode.a', ...meta, title: 'Modus A', order: 1, tags: ['strom'], include: ['tool.extra'], exclude: ['tool.weg'] }
const kaelte: ModeEntry = { id: 'mode.b', ...meta, title: 'Modus B', order: 2, tags: ['kaelte'], include: [], exclude: [] }

describe('Modi', () => {
  it('zeigt Einträge mit passendem Tag, zusätzlich include, ohne exclude', () => {
    expect(matchesMode({ id: 'tool.x', tags: ['strom', 'heizung'] }, strom)).toBe(true)
    expect(matchesMode({ id: 'tool.y', tags: ['heizung'] }, strom)).toBe(false)
    expect(matchesMode({ id: 'tool.extra', tags: ['heizung'] }, strom)).toBe(true)
    expect(matchesMode({ id: 'tool.weg', tags: ['strom'] }, strom)).toBe(false)
  })

  it('zeigt bei mehreren Modi alles, was zu einem davon passt; ohne Modus alles', () => {
    expect(matchesModes({ id: 'tool.y', tags: ['kaelte'] }, [strom, kaelte])).toBe(true)
    expect(matchesModes({ id: 'tool.weg', tags: ['strom'] }, [strom, kaelte])).toBe(false)
    expect(matchesModes({ id: 'tool.y', tags: ['heizung'] }, [])).toBe(true)
  })

  it('ignoriert gespeicherte ids unbekannter Modi und schaltet Modi um', () => {
    expect(resolveModes(['mode.b', 'mode.weg'], [strom, kaelte])).toEqual([kaelte])
    expect(toggleModeId(['mode.a'], 'mode.b')).toEqual(['mode.a', 'mode.b'])
    expect(toggleModeId(['mode.a', 'mode.b'], 'mode.a')).toEqual(['mode.b'])
  })

  it('speichert die Auswahl in den Einstellungen, Standard ist „Alles“', () => {
    expect(DEFAULT_SETTINGS.modes).toEqual([])
    expect(parseSettings('{"modes":["mode.a","mode.a",3]}').modes).toEqual(['mode.a'])
    expect(parseSettings('{"modes":"mode.a"}').modes).toEqual([])
  })

  it('bietet alle gewünschten Modi in fester Reihenfolge an', () => {
    expect(modeEntries.map((mode) => mode.title)).toEqual([
      'Anlagenmechaniker SHK',
      'Elektriker',
      'Lüftungsbauer',
      'Kältetechniker',
      'Azubi',
      'Kundendienst-Monteur',
      'Rohbau-Monteur',
      'Installateur',
      'Planer',
    ])
  })

  it('blendet im Azubi-Modus sehr komplexe Inhalte aus, auch ihre Umstellungen', () => {
    const azubi = modeEntries.find((mode) => mode.title === 'Azubi')!
    expect(matchesMode({ id: 'tool.heizlast', tags: ['heizung'] }, azubi)).toBe(false)
    expect(matchesMode({ id: 'formula.hydraulik.reynolds-zahl', tags: ['heizung'] }, azubi)).toBe(false)
    expect(matchesMode({ id: 'formula.hydraulik.reynolds-zahl.nach-d', tags: ['heizung'] }, azubi)).toBe(false)
    expect(matchesMode({ id: 'formula.geometrie.kreisflaeche', tags: ['allgemein'] }, azubi)).toBe(true)
  })

  it('lässt keinen Modus die Inhalte eines anderen aktiven Modus ausblenden', () => {
    const azubi = modeEntries.find((mode) => mode.title === 'Azubi')!
    const lueftung = modeEntries.find((mode) => mode.title === 'Lüftungsbauer')!
    const planer = modeEntries.find((mode) => mode.title === 'Planer')!
    // Azubi blendet die Lüfter-Strangdimension aus, der Lüftungsbauer zeigt sie
    const luefter = { id: 'tool.strangdimension-bad-luefter', tags: ['lueftung'] as const }
    expect(matchesModes(luefter, [azubi])).toBe(false)
    expect(matchesModes(luefter, [azubi, lueftung])).toBe(true)
    expect(matchesModes(luefter, [lueftung, azubi])).toBe(true)
    // Planer blendet den Stundenzettel aus, Azubi zeigt ihn
    expect(matchesModes({ id: 'tool.stundenzettel', tags: ['planung'] }, [planer, azubi])).toBe(true)
    // Allgemein: alles, was ein einzelner aktiver Modus zeigt, bleibt bei jeder Kombination sichtbar
    const items = [...content.tools, ...content.formulas]
    for (const a of modeEntries) {
      for (const b of modeEntries) {
        for (const item of items.filter((entry) => matchesMode(entry, a))) {
          expect(matchesModes(item, [a, b]), `${item.id}: ${a.title} + ${b.title}`).toBe(true)
        }
      }
    }
  })

  it('zeigt in jedem Modus mindestens ein Tool und eine Formel', () => {
    for (const mode of modeEntries) {
      expect(content.tools.some((entry) => matchesMode(entry, mode)), mode.title).toBe(true)
      expect(content.formulas.some((entry) => matchesMode(entry, mode)), mode.title).toBe(true)
    }
  })

  it('lehnt Verweise auf andere Inhalte und Widersprüche ab', () => {
    const bad = { ...strom, include: ['lexicon.x', 'tool.z'], exclude: ['tool.z'] }
    expect(modeCollection.check!(bad)).toEqual(['"lexicon.x" ist kein Tool und keine Formel', '"tool.z" steht in include und exclude'])
  })

  it('entfernt Verweise auf Einträge außerhalb der Edition', () => {
    const result = modeCollection.forEdition!({ ...strom, include: ['tool.intern', 'tool.extra'] }, (id) => id !== 'tool.intern')
    expect(result.include).toEqual(['tool.extra'])
  })
})

describe('Modus-Seite', () => {
  it('hat eine eigene Seite mit der Auswahl, Zurück führt in die Einstellungen', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[MODE_PAGE_PATH]}>
        <ModePage />
      </MemoryRouter>,
    )
    expect(html).toContain('Modus wählen')
    expect(html).toContain('Anlagenmechaniker SHK')
    expect(html).toContain('href="/einstellungen"')
  })

  it('führt zurück in die Liste, aus der sie geöffnet wurde', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={[{ pathname: MODE_PAGE_PATH, state: { from: '/tools', label: 'Tools' } }]}>
        <ModePage />
      </MemoryRouter>,
    )
    expect(html).toContain('href="/tools"')
  })

  it('verlinkt aus den Einstellungen und den gefilterten Listen auf die Modus-Seite', () => {
    const settings = renderToStaticMarkup(
      <MemoryRouter>
        <SettingsPage />
      </MemoryRouter>,
    )
    expect(settings).toContain(`href="${MODE_PAGE_PATH}"`)
    const list = renderToStaticMarkup(
      <MemoryRouter>
        <ToolListPage modes={[modeEntries[0]!]} />
      </MemoryRouter>,
    )
    expect(list).toContain(`href="${MODE_PAGE_PATH}"`)
  })

  it('zeigt bei „Alles“ keine Modus-Zeile', () => {
    const list = renderToStaticMarkup(
      <MemoryRouter>
        <ToolListPage modes={[]} />
      </MemoryRouter>,
    )
    expect(list).not.toContain('Modus:')
    expect(list).not.toContain(`href="${MODE_PAGE_PATH}"`)
  })

  it('zeigt mehrere Modi als farbige Kästchen nebeneinander', () => {
    const [a, b] = modeEntries
    const list = renderToStaticMarkup(
      <MemoryRouter>
        <ToolListPage modes={[a!, b!]} />
      </MemoryRouter>,
    )
    expect(list).toContain(`${modeColor(a!)}">${a!.title}<`)
    expect(list).toContain(`${modeColor(b!)}">${b!.title}<`)
    expect(modeColor(a!)).not.toBe(modeColor(b!))
  })

  it('hat für jeden Modus eine eigene Farbe', () => {
    expect(new Set(modeEntries.map(modeColor)).size).toBe(modeEntries.length)
  })
})

describe('Modus-Auswahl', () => {
  it('markiert „Alles“, solange kein Modus gewählt ist', () => {
    const html = renderToStaticMarkup(<ModePicker value={[]} onChange={() => {}} entries={[strom, kaelte]} />)
    expect(html).toMatch(/aria-checked="true"[^>]*>.*?Alles/)
    expect(html).toContain('Modus A')
  })

  it('markiert mehrere gewählte Modi', () => {
    const html = renderToStaticMarkup(<ModePicker value={['mode.a', 'mode.b']} onChange={() => {}} entries={[strom, kaelte]} />)
    expect(html.match(/aria-checked="true"/g)).toHaveLength(2)
  })
})

describe('Gefilterte Listen', () => {
  const mode = modeEntries.find((entry) => entry.title === 'Elektriker')!

  it('zeigt in der Tool-Liste nur passende Tools und nennt den Modus', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToolListPage modes={[mode]} />
      </MemoryRouter>,
    )
    const hidden = content.tools.find((entry) => !matchesMode(entry, mode))!
    const shown = content.tools.find((entry) => matchesMode(entry, mode))!
    expect(html).toContain('>Elektriker</span>')
    expect(html).toContain('ausgeblendet')
    expect(html).toContain(shown.title)
    // nur noch unten im Bereich „Ausgeblendet“
    expect(html.indexOf(`>${hidden.title}<`)).toBeGreaterThan(html.indexOf('Ausgeblendet ('))
  })

  it('zeigt in der Formel-Liste nur passende Formeln', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <FormulaListPage modes={[mode]} hiddenIds={new Set()} />
      </MemoryRouter>,
    )
    expect(html).toContain('>Elektriker</span>')
    expect(html).toContain('Ohmsches Gesetz')
    expect(html.indexOf('kv-Wert')).toBeGreaterThan(html.indexOf('Ausgeblendet ('))
  })

  it('hält die Modus-Zeile kompakt', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ToolListPage modes={[mode]} />
      </MemoryRouter>,
    )
    expect(html).not.toContain('die Suche findet sie trotzdem')
    expect(html).not.toContain('Unten unter')
  })

  it('lässt die Suche unberührt: sie findet auch Einträge außerhalb des Modus', () => {
    const outside = content.tools.find((entry) => !matchesMode(entry, mode))!
    const hits = getSearchEngine().search(outside.title).flatMap((group) => group.results)
    expect(hits.some((hit) => hit.id === outside.id)).toBe(true)
  })
})
