import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createSearch } from '../../search/search'
import { checklistSearchDocuments } from './search'
import { ChecklistListPage } from './ChecklistListPage'
import { ChecklistNotes, ChecklistPage, ChecklistTitle, ChecklistView } from './ChecklistPage'
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

  it('macht Checklisten mit ihren Prüfpunkten durchsuchbar', () => {
    const engine = createSearch(checklistSearchDocuments([fixture]))
    expect(engine.search('Testwartung').flatMap((g) => g.results.map((r) => r.id))).toEqual([fixture.id])
    // auch über den Text eines Prüfpunkts
    expect(engine.search('Punkt C').flatMap((g) => g.results.map((r) => r.id))).toEqual([fixture.id])
  })

  it('lädt die echten Checklisten gültig (auch wenn noch keine vorhanden sind)', () => {
    expect(checklistEntries.every((entry) => checkChecklist(entry).length === 0)).toBe(true)
  })

  it('enthält alle 14 Checklisten mit allen 243 Punkten und Notizfeld', () => {
    expect(checklistEntries).toHaveLength(14)
    expect(checklistEntries.reduce((sum, entry) => sum + countDone(entry, new Set()).total, 0)).toBe(243)
    expect(checklistEntries.every((entry) => entry.notes?.label === 'Notizen')).toBe(true)
    const lpg = checklistEntries.find((entry) => entry.id === 'checklist.lpg-inspection')
    expect(lpg?.category).toBe('Prüfung')
    expect(lpg?.sections[0]?.items.map((item) => item.id)).toContain('leak-test-passed')
  })

  it('enthält die Brenner-Checklisten als ungeprüfte Entwürfe mit Quelle', () => {
    const burners = checklistEntries.filter((entry) => entry.id.startsWith('checklist.burner-'))
    expect(burners.map((entry) => entry.id).sort()).toEqual([
      'checklist.burner-gas-atmospheric',
      'checklist.burner-gas-forced-draught',
      'checklist.burner-gas-premix-condensing',
      'checklist.burner-oil-blue-flame',
      'checklist.burner-oil-yellow-flame',
    ])
    for (const entry of burners) {
      expect(entry.status).toBe('draft')
      expect(entry.source).toMatch(/https:\/\//)
      expect(entry.sections.map((section) => section.title)).toEqual(['Vor der Wartung', 'Wartung', 'Nach der Wartung'])
      // was vor der Wartung abgeschaltet wird, wird danach wieder eingeschaltet
      const texts = (title: string) =>
        entry.sections.find((section) => section.title === title)?.items.map((item) => item.text) ?? []
      expect(texts('Vor der Wartung')).toContain('Anlage spannungsfrei geschaltet und gegen Wiedereinschalten gesichert')
      expect(texts('Nach der Wartung')).toContain('Anlage eingeschaltet')
      const fuel = entry.id.includes('-oil-') ? 'Ölabsperrhahn' : 'Gasabsperrhahn'
      expect(texts('Vor der Wartung')).toContain(`${fuel} geschlossen`)
      expect(texts('Nach der Wartung')).toContain(`${fuel} geöffnet`)
      // jede Abgasmessung nennt im Untertitel, was gemessen wird
      const exhaust = entry.sections.flatMap((section) => section.items).filter((item) => item.text === 'Abgasmessung durchgeführt')
      expect(exhaust.length).toBeGreaterThan(0)
      expect(exhaust.every((item) => item.note.includes('CO'))).toBe(true)
      const all = entry.sections.flatMap((section) => section.items.map((item) => item.text))
      expect(all).not.toContain('Gasart geprüft')
      expect(all).not.toContain('Betreiber informiert')
      expect(all.some((text) => text.includes('Protokoll'))).toBe(false)
    }
  })
})

describe('Notizen', () => {
  it('zeigt ein beschriftetes Textfeld und für den Ausdruck einen Kasten mit dem Text', () => {
    const html = renderToStaticMarkup(
      <ChecklistNotes id="n" label="Notizen" value="MAG-Vordruck geprüft" onChange={() => {}} />,
    )
    expect(html).toContain('<label for="n"')
    expect(html).toContain('>Notizen</label>')
    expect(html).toContain('<textarea id="n"')
    expect(html).toMatch(/print:block">MAG-Vordruck geprüft<\/div>/)
  })

  it('zeigt oben ein Titelfeld, im Ausdruck als Text', () => {
    const html = renderToStaticMarkup(<ChecklistTitle id="t" value="Heizung Müller" onChange={() => {}} />)
    expect(html).toContain('<label for="t"')
    expect(html).toContain('>Titel</label>')
    expect(html).toContain('<input id="t" type="text"')
    expect(html).toMatch(/print:block">Heizung Müller<\/p>/)
  })

  it('zeigt Abschnitte ohne Überschrift ohne leere Überschrift', () => {
    const entry: ChecklistEntry = { ...fixture, sections: [{ title: '', items: [{ id: 'x', text: 'X', note: '' }] }] }
    const html = renderToStaticMarkup(<ChecklistView entry={entry} checked={new Set()} onToggle={() => {}} />)
    expect(html).not.toContain('<h2')
    expect(html).toContain('>X</span>')
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
    expect(html).toContain('>Titel</label>')
    expect(html).toContain('>Drucken</button>')
    expect(html).not.toContain('Leer drucken')
    expect(html).toContain('Zurücksetzen')
    expect(html).toContain('Unterschrift')
  })

  it('weist auf fehlende Prüfpunkte und unbekannte Checklisten hin', () => {
    expect(renderAt('/checklisten/leer')).toContain('TODO: Inhalt fehlt')
    expect(renderAt('/checklisten/gibt-es-nicht')).toContain('Checkliste nicht gefunden')
  })
})
