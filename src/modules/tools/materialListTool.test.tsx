import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { SuggestInput } from '../../components/SuggestInput'
import { closeDatabase, DB_NAME, type MaterialList as List, type MaterialMemoryRecord } from '../../storage/db'
import {
  deleteMaterialList,
  deleteMaterialMemory,
  listMaterialLists,
  listMaterialMemory,
  saveMaterialList,
  saveMaterialMemory,
} from '../../storage/materialLists'
import { MaterialList } from './MaterialList'
import {
  addItem,
  cleanDraft,
  clampQuantity,
  createList,
  doneItems,
  isEmptyList,
  itemLine,
  listCsv,
  listMailto,
  listStatus,
  listText,
  MAX_QUANTITY,
  memoryKey,
  memoryRecords,
  mergeMemory,
  openItems,
  rememberedUnit,
  removeDoneItems,
  removeItem,
  replaceItem,
  setItemDone,
  suggestionsFor,
  type ItemDraft,
} from './materialListCalc'
import { isMaterialListTool, toolEntrySchema } from './schema'
import { MAILTO_MAX_LENGTH, setProject, surveyFileName } from './surveyCommon'
import { toolEntries, toolSearchDocuments } from './tools'

const NOW = new Date(2026, 10, 10, 9, 30)
const LATER = new Date(2026, 10, 10, 10, 0)

const tool = toolEntries.find(isMaterialListTool)!

const draft = (name: string, quantity = 1, unit = ''): ItemDraft => ({ name, quantity, unit })

/** Liste mit Artikeln: [Name, Menge, Einheit, erledigt] */
function list(items: [string, number, string, boolean?][], project = 'Müller, Hauptstr. 5'): List {
  let result = setProject(createList(tool.id, NOW), project, NOW)
  for (const [name, quantity, unit, done] of items) {
    const added = addItem(result, draft(name, quantity, unit), NOW)
    result = done ? setItemDone(added.list, added.item.id, true, NOW) : added.list
  }
  return result
}

const record = (kind: MaterialMemoryRecord['kind'], text: string, usedAt: string, unit?: string): MaterialMemoryRecord => ({
  key: memoryKey(kind, text),
  kind,
  text,
  ...(unit ? { unit } : {}),
  usedAt,
})

describe('Inhalt', () => {
  it('steht als öffentliches Aufmaß-Tool in der Liste und in der Suche', () => {
    expect(tool).toBeDefined()
    expect(tool.category).toBe('Aufmaß')
    expect(tool.visibility).toBe('public')
    const doc = toolSearchDocuments().find((candidate) => candidate.id === tool.id)!
    expect(doc.keywords).toContain('Mitnehmen')
  })

  it('verlangt einen Hinweis am Ende', () => {
    const { closingNote: _note, ...rest } = tool
    expect(toolEntrySchema.safeParse(rest).success).toBe(false)
  })
})

describe('Artikel', () => {
  it('beginnt leer und gilt erst mit Eingaben als gespeichert', () => {
    const empty = createList(tool.id, NOW)
    expect(isEmptyList(empty)).toBe(true)
    expect(isEmptyList(setProject(empty, 'Müller', NOW))).toBe(false)
    expect(isEmptyList(addItem(empty, draft('Bogen'), NOW).list)).toBe(false)
  })

  it('bereinigt Eingaben und verlangt einen Artikel', () => {
    expect(cleanDraft(draft('  '))).toBeUndefined()
    expect(cleanDraft({ name: ' Bogen ', quantity: 0, unit: ' m ' })).toEqual({ name: 'Bogen', quantity: 1, unit: 'm' })
    expect(clampQuantity(MAX_QUANTITY + 5)).toBe(MAX_QUANTITY)
    expect(clampQuantity(Number.NaN)).toBe(1)
  })

  it('erhöht bei gleichem offenem Artikel mit gleicher Einheit nur die Menge', () => {
    const first = addItem(createList(tool.id, NOW), draft('Kupferrohr 15', 3, 'm'), NOW)
    const same = addItem(first.list, draft('kupferrohr 15', 2, 'M'), LATER)
    expect(same.merged).toBe(true)
    expect(same.list.items).toHaveLength(1)
    expect(itemLine(same.item)).toBe('5 m Kupferrohr 15')
    expect(same.list.updatedAt).toBe(LATER.toISOString())

    const otherUnit = addItem(same.list, draft('Kupferrohr 15', 1, 'Stange'), LATER)
    expect(otherUnit.merged).toBe(false)
    expect(otherUnit.list.items).toHaveLength(2)

    // Erledigt zählt nicht mit: neu auf die Liste
    const done = setItemDone(first.list, first.item.id, true, NOW)
    expect(addItem(done, draft('Kupferrohr 15', 1, 'm'), LATER).list.items).toHaveLength(2)
  })

  it('zeigt die Menge mit Einheit oder als Stück', () => {
    const result = list([
      ['Kugelhahn 1/2"', 2, ''],
      ['Kupferrohr 15', 6, 'm'],
    ])
    expect(result.items.map(itemLine)).toEqual(['2 × Kugelhahn 1/2"', '6 m Kupferrohr 15'])
    expect(result.items[0]!.unit).toBeUndefined()
  })

  it('hakt ab, macht rückgängig, ändert und entfernt', () => {
    const start = list([
      ['Bogen', 4, ''],
      ['Muffe', 2, ''],
      ['Hanf', 1, 'Rolle'],
    ])
    const [bogen, muffe, hanf] = start.items
    const checked = setItemDone(start, muffe!.id, true, LATER)
    expect(openItems(checked).map((item) => item.name)).toEqual(['Bogen', 'Hanf'])
    expect(doneItems(checked)[0]!.doneAt).toBe(LATER.toISOString())
    expect(listStatus(checked)).toBe('2 offen, 1 erledigt')
    expect(doneItems(setItemDone(checked, muffe!.id, false, LATER))).toEqual([])

    const changed = replaceItem(checked, muffe!.id, draft('Muffe 22', 3, ''), LATER)
    expect(doneItems(changed).map(itemLine)).toEqual(['3 × Muffe 22'])

    expect(removeItem(changed, bogen!.id, LATER).items.map((item) => item.id)).toEqual([muffe!.id, hanf!.id])
    expect(removeDoneItems(changed, LATER).items.map((item) => item.name)).toEqual(['Bogen', 'Hanf'])
  })

  it('beschreibt den Stand für die Übersicht', () => {
    expect(listStatus(list([]))).toBe('noch leer')
    expect(listStatus(list([['Bogen', 1, '']]))).toBe('1 offen')
    expect(listStatus(list([['Bogen', 1, '', true]]))).toBe('alles erledigt')
  })
})

describe('Vorschläge', () => {
  const memory = [
    record('project', 'Müller, Hauptstr. 5', '2026-11-01T08:00:00.000Z'),
    record('project', 'Bad Schmidt', '2026-11-09T08:00:00.000Z'),
    record('article', 'Kugelhahn 1/2"', '2026-11-05T08:00:00.000Z'),
    record('article', 'Kupferrohr 15', '2026-11-08T08:00:00.000Z', 'm'),
  ]

  it('schlägt passende frühere Eingaben vor, die zuletzt genutzte zuerst', () => {
    expect(suggestionsFor(memory, 'project', '')).toEqual(['Bad Schmidt', 'Müller, Hauptstr. 5'])
    expect(suggestionsFor(memory, 'project', 'mueller')).toEqual(['Müller, Hauptstr. 5'])
    expect(suggestionsFor(memory, 'article', 'ku')).toEqual(['Kupferrohr 15', 'Kugelhahn 1/2"'])
    // Schon vollständig eingegeben: kein Vorschlag mehr
    expect(suggestionsFor(memory, 'article', 'kupferrohr 15')).toEqual([])
    expect(suggestionsFor(memory, 'article', 'xyz')).toEqual([])
    const many = Array.from({ length: 10 }, (_, index) => record('article', `Artikel ${index}`, NOW.toISOString()))
    expect(suggestionsFor(many, 'article', '')).toHaveLength(6)
  })

  it('merkt sich Bauvorhaben und Artikel mit Einheit, auch über Groß- und Kleinschreibung hinweg', () => {
    const records = memoryRecords(' Müller ', draft('kupferrohr 15', 2, 'Stange'), LATER)
    expect(records.map((entry) => entry.key)).toEqual(['project:mueller', 'article:kupferrohr 15'])
    expect(memoryRecords('', undefined, LATER)).toEqual([])

    const merged = mergeMemory(memory, records)
    expect(merged).toHaveLength(5)
    expect(rememberedUnit(merged, 'Kupferrohr 15')).toBe('Stange')
    expect(suggestionsFor(merged, 'article', '')[0]).toBe('kupferrohr 15')
    expect(rememberedUnit(merged, 'Kugelhahn 1/2"')).toBeUndefined()
  })

  it('zeigt im Vorschlagsfeld einen Knopf zum Vergessen nur, wenn das Tool ihn anbietet', () => {
    const field = (onForget?: (text: string) => void) =>
      renderToStaticMarkup(
        <SuggestInput id="a" value="" onChange={() => {}} suggestions={['Bogen']} listLabel="Frühere Artikel" initialOpen onForget={onForget} />,
      )
    expect(field()).toContain('aria-label="Frühere Artikel"')
    expect(field()).not.toContain('nicht mehr vorschlagen')
    expect(field(() => {})).toContain('aria-label="„Bogen“ nicht mehr vorschlagen"')
  })
})

describe('Weitergeben', () => {
  const sample = list([
    ['Kupferrohr 15', 6, 'm'],
    ['Pressbogen; 90°', 4, ''],
    ['Hanf', 1, 'Rolle', true],
  ])

  it('schreibt offene und erledigte Artikel in den Text', () => {
    expect(listText(tool, sample).split('\r\n')).toEqual([
      'Materialliste',
      'Bauvorhaben: Müller, Hauptstr. 5',
      'Liste vom: 10.11.2026',
      '',
      'Mitnehmen:',
      '- 6 m Kupferrohr 15',
      '- 4 × Pressbogen; 90°',
      '',
      'Erledigt:',
      '- 1 Rolle Hanf',
    ])
    expect(listText(tool, list([['Hanf', 1, '', true]]))).toContain('- nichts mehr offen')
  })

  it('exportiert eine CSV mit Status, offene zuerst', () => {
    const csv = listCsv(tool, sample)
    expect(csv.startsWith('﻿Materialliste\r\n')).toBe(true)
    expect(csv).toContain('Liste vom;10.11.2026')
    expect(csv).toContain(
      'Artikel;Menge;Einheit;Status\r\nKupferrohr 15;6;m;offen\r\n"Pressbogen; 90°";4;;offen\r\nHanf;1;Rolle;erledigt\r\n',
    )
    expect(surveyFileName(tool.id, sample)).toBe('materialliste-mueller-hauptstr-5-2026-11-10.csv')
  })

  it('lässt in zu langen E-Mails die erledigten Artikel weg', () => {
    const items = Array.from({ length: 80 }, (_, index): [string, number, string, boolean] => [
      `Erledigter Artikel mit langem Namen ${index}`,
      1,
      '',
      true,
    ])
    const long = list([['Kupferrohr 15', 6, 'm'], ...items])
    const mailto = listMailto(tool, long, ['buero@example.com'])
    expect(mailto.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH)
    const body = decodeURIComponent(mailto.split('&body=')[1]!)
    expect(body).toContain('- 6 m Kupferrohr 15')
    expect(body).toContain('80 Artikel, hier nicht aufgeführt.')
  })
})

describe('Oberfläche', () => {
  it('beginnt ohne gespeicherte Listen mit einer leeren', () => {
    const html = renderToStaticMarkup(<MaterialList tool={tool} initialLists={[]} initialMemory={[]} now={NOW} />)
    expect(html).toContain('Noch keine. Eine Liste wird gespeichert, sobald etwas eingetragen ist.')
    expect(html).toContain('Artikel hinzufügen')
    expect(html).toContain('Noch keine Artikel auf der Liste.')
    expect(html).not.toContain('href="mailto:')
  })

  it('zeigt gespeicherte Listen mit Datum, offene und erledigte Artikel zum Abhaken', () => {
    const other = { ...list([['Bogen', 1, '', true]], 'Bad Schmidt'), id: 'b' }
    const html = renderToStaticMarkup(
      <MaterialList
        tool={tool}
        initialLists={[
          list([
            ['Kupferrohr 15', 6, 'm'],
            ['Hanf', 1, 'Rolle', true],
          ]),
          other,
        ]}
        initialMemory={[]}
        now={NOW}
      />,
    )
    expect(html).toContain('Gespeicherte Listen')
    expect(html).toContain('vom 10.11.2026 · 1 offen, 1 erledigt')
    expect(html).toContain('vom 10.11.2026 · alles erledigt')
    expect(html).toMatch(/aria-label="Fehlendes Material"[\s\S]*type="checkbox"[\s\S]*6 m<\/span> Kupferrohr 15/)
    expect(html).toMatch(/aria-label="Erledigtes Material"[\s\S]*checked=""[\s\S]*done-text[\s\S]*Hanf/)
    expect(html).toContain('Erledigte entfernen')
    expect(html).toContain('aria-label="Liste Bad Schmidt löschen"')
    expect(html).toContain('href="mailto:')
    expect(html).toContain('Für Excel exportieren (CSV)')
  })
})

describe('Speicher', () => {
  afterEach(async () => {
    await closeDatabase()
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.deleteDatabase(DB_NAME)
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  })

  it('speichert, überschreibt und löscht Listen je Tool', async () => {
    const first = list([['Bogen', 1, '']])
    await saveMaterialList(first)
    await saveMaterialList({ ...list([], 'Anderes Tool'), id: 'x', toolId: 'tool.anderes' })
    await saveMaterialList(setProject(first, 'Neu', LATER))
    expect((await listMaterialLists(tool.id)).map((stored) => stored.project)).toEqual(['Neu'])
    await deleteMaterialList(first.id)
    expect(await listMaterialLists(tool.id)).toEqual([])
  })

  it('merkt sich Eingaben unabhängig von den Listen und vergisst sie auf Wunsch', async () => {
    const records = memoryRecords('Müller', draft('Bogen', 1, 'Stück'), NOW)
    await saveMaterialMemory(records)
    await saveMaterialMemory(memoryRecords('müller', undefined, LATER))
    const stored = await listMaterialMemory()
    expect(stored).toHaveLength(2)
    expect(stored.find((entry) => entry.kind === 'project')).toMatchObject({ text: 'müller', usedAt: LATER.toISOString() })
    await deleteMaterialMemory(memoryKey('article', 'Bogen'))
    expect((await listMaterialMemory()).map((entry) => entry.kind)).toEqual(['project'])
  })
})
