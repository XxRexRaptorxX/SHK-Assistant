import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { getSearchEngine } from '../../search/sources'
import { ChecklistListPage } from './ChecklistListPage'
import { ChecklistPage, ChecklistView } from './ChecklistPage'
import { checklistEntries, countDone } from './checklists'
import { checkChecklist, type ChecklistEntry } from './schema'

const fixture: ChecklistEntry = {
  id: 'checklist.test-wartung',
  visibility: 'public',
  status: 'verified',
  source: 'Test',
  verifiedBy: 'TS',
  verifiedAt: '2026-01-01',
  title: 'Testwartung',
  description: '',
  category: 'Wartung',
  sections: [
    {
      title: 'Vorbereitung',
      items: [
        { id: 'punkt-a', text: 'Punkt A', note: 'Hinweis zu A' },
        { id: 'punkt-b', text: 'Punkt B', note: '' },
      ],
    },
    { title: 'Abschluss', items: [{ id: 'punkt-c', text: 'Punkt C', note: '' }] },
  ],
}

const draft: ChecklistEntry = { ...fixture, id: 'checklist.leer', title: 'Leer', status: 'draft', sections: [] }

describe('Checklisten-Daten', () => {
  it('meldet doppelte Punkt-ids', () => {
    expect(checkChecklist(fixture)).toEqual([])
    const duplicate = {
      ...fixture,
      sections: [...fixture.sections, { title: 'Nochmal', items: [{ id: 'punkt-a', text: 'X', note: '' }] }],
    }
    expect(checkChecklist(duplicate)).toEqual(['Punkt-id "punkt-a" ist doppelt vergeben'])
  })

  it('zählt nur Punkte, die es (noch) gibt', () => {
    expect(countDone(fixture, new Set(['punkt-a', 'punkt-c', 'geloeschter-punkt']))).toEqual({ done: 2, total: 3 })
  })

  it('lädt die echten Checklisten und macht sie durchsuchbar', () => {
    expect(checklistEntries.length).toBeGreaterThan(0)
    const first = checklistEntries[0]!
    const ids = getSearchEngine().search(first.title).flatMap((g) => g.results.map((r) => r.id))
    expect(ids).toContain(first.id)
  })
})

describe('Checklisten-Ansicht', () => {
  const html = renderToStaticMarkup(
    <ChecklistView entry={fixture} checked={new Set(['punkt-b'])} onToggle={() => {}} />,
  )

  it('zeigt Fortschritt, Abschnitte und Hinweise', () => {
    expect(html).toContain('1 von 3 erledigt')
    expect(html).toContain('aria-valuenow="1"')
    expect(html).toContain('Vorbereitung</h2>')
    expect(html).toContain('Hinweis zu A')
  })

  it('hakt erledigte Punkte an und streicht sie durch', () => {
    expect(html.match(/checked=""/g)).toHaveLength(1)
    expect(html).toContain('<span class="done-text">Punkt B</span>')
    expect(html).toContain('<span class="">Punkt A</span>')
  })
})

describe('Checklisten-Seiten', () => {
  const renderAt = (path: string, progress?: ReadonlyMap<string, ReadonlySet<string>>) =>
    renderToStaticMarkup(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/checklisten" element={<ChecklistListPage entries={[fixture, draft]} progress={progress} />} />
          <Route path="/checklisten/:slug" element={<ChecklistPage entries={[fixture, draft]} />} />
        </Routes>
      </MemoryRouter>,
    )

  it('listet Checklisten mit Fortschritt bzw. Anzahl der Punkte', () => {
    expect(renderAt('/checklisten', new Map([[fixture.id, new Set(['punkt-a', 'punkt-b'])]]))).toContain(
      '2 von 3 erledigt',
    )
    const fresh = renderAt('/checklisten', new Map())
    expect(fresh).toContain('3 Punkte')
    expect(fresh).toContain('Ungeprüft')
  })

  it('zeigt Druck- und Zurücksetzen-Knöpfe sowie die Felder für den Ausdruck', () => {
    const html = renderAt('/checklisten/test-wartung')
    expect(html).toContain('Testwartung</h1>')
    expect(html).toContain('Leer drucken')
    expect(html).toContain('Zurücksetzen')
    expect(html).toContain('Unterschrift')
  })

  it('weist auf fehlende Prüfpunkte und unbekannte Checklisten hin', () => {
    expect(renderAt('/checklisten/leer')).toContain('TODO: Inhalt fehlt')
    expect(renderAt('/checklisten/gibt-es-nicht')).toContain('Checkliste nicht gefunden')
  })
})
