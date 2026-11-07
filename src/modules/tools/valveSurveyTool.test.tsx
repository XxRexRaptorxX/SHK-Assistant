import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDatabase, DB_NAME, type ValveSurvey as Survey } from '../../storage/db'
import { deleteValveSurvey, listValveSurveys, saveValveSurvey } from '../../storage/valveSurveys'
import { isValveSurveyTool, toolEntrySchema } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'
import { ValveSurvey } from './ValveSurvey'
import {
  addRoom,
  clampCount,
  createSurvey,
  isEmptySurvey,
  MAX_COUNT,
  removeRoom,
  ROOMS_TOO_LONG,
  roomLines,
  setCount,
  showRoomBreakdown,
  surveyBill,
  surveyCsv,
  surveyMailto,
  surveyText,
} from './valveSurveyCalc'
import { formatSurveyDate, MAILTO_MAX_LENGTH, parseRecipients, renameRoom, setNote, setProject, surveyFileName } from './surveyCommon'
import { checkValveSurveyTool, valveTypes, type ValveSurveyTool } from './valveSurveyTool'

const NOW = new Date(2026, 10, 7, 9, 30)
const LATER = new Date(2026, 10, 7, 10, 0)

const tool = toolEntries.find(isValveSurveyTool)!

/** Aufmaß mit Zählungen je Raum: [Raumname, { Typ-key: Anzahl }] */
function survey(rooms: [string, Record<string, number>][], project = 'Müller, Hauptstr. 5'): Survey {
  let result = setProject(createSurvey(tool.id, NOW), project, NOW)
  result = { ...result, rooms: [] }
  for (const [name, counts] of rooms) {
    const added = addRoom(result, name, NOW)
    result = added.survey
    for (const [key, count] of Object.entries(counts)) result = setCount(result, added.room.id, key, count, NOW)
  }
  return result
}

/** Eigenes kleines Tool für die Prüfungen */
function testTool(change: Partial<ValveSurveyTool> = {}): ValveSurveyTool {
  return {
    ...tool,
    groups: [
      {
        key: 'eck',
        name: 'Eck',
        types: [{ key: 'eck12', label: '1/2" Eck', article: 'A1', note: '', counts: ['ventile'] }],
      },
    ],
    totals: [{ key: 'ventile', name: 'Ventile' }],
    ...change,
  }
}

describe('Inhalt Aufmaß Thermostatventile', () => {
  it('ist ein gültiges Ventil-Aufmaß ohne Befunde', () => {
    expect(tool).toBeDefined()
    expect(checkValveSurveyTool(tool)).toEqual([])
  })

  it('übernimmt die Typen und Artikelnummern der Excel-Vorlage', () => {
    const articles = Object.fromEntries(valveTypes(tool).map((type) => [type.label, type.article]))
    expect(articles).toEqual({
      '3/8" Durchgang': '013G0032',
      '1/2" Durchgang': '013G0034',
      '3/4" Durchgang': '013G0036',
      '3/8" Eck': '013G0031',
      '1/2" Eck': '013G0033',
      '3/4" Eck': '013G0035',
      '3/8" Axial': '013G0151',
      '1/2" Axial': '013G0153',
      '3/4" Axial': '013G0155',
      '3/8" Winkeleck links': '013G0232',
      '1/2" Winkeleck links': '013G0234',
      '3/8" Winkeleck rechts': '013G0231',
      '1/2" Winkeleck rechts': '013G0233',
      Einbauventil: undefined,
      Fußbodenheizung: undefined,
    })
  })

  it('rechnet die Summen wie die Excel-Vorlage', () => {
    // Je Typ eine andere Anzahl, damit jede Zuordnung auffällt
    const counts = Object.fromEntries(valveTypes(tool).map((type, index) => [type.key, index + 1]))
    const bill = surveyBill(tool, survey([['', counts]]))
    const raN = valveTypes(tool)
      .slice(0, 13)
      .reduce((sum, type) => sum + counts[type.key]!, 0)
    expect(Object.fromEntries(bill.totals.map((total) => [total.name, total.count]))).toEqual({
      // D7 + D11 + D15 + D18 + D21
      Thermostatventile: raN,
      // Thermostatventile + Einbauventil (D24 + D22)
      Thermostatköpfe: raN + counts.einbauventil!,
      // Fußbodenheizung (D23)
      Stellantriebe: counts.fussbodenheizung!,
    })
  })

  it('ist über Artikelnummer und Begriffe auffindbar', () => {
    const document = toolSearchDocuments().find((entry) => entry.id === tool.id)!
    expect(document.keywords).toEqual(expect.arrayContaining(['013G0033', 'Danfoss RA-N', 'Thermostatköpfe', 'Ventiltausch']))
  })
})

describe('Prüfung des Inhalts', () => {
  it('meldet unbekannte und ungenutzte Summen sowie doppelte Schlüssel', () => {
    const broken = testTool({
      groups: [
        {
          key: 'eck',
          name: 'Eck',
          types: [
            { key: 'eck12', label: 'A', note: '', counts: ['ventile', 'ventile'] },
            { key: 'eck12', label: 'B', note: '', counts: ['koepfe'] },
          ],
        },
        { key: 'eck', name: 'Eck 2', types: [{ key: 'x', label: 'C', note: '', counts: ['ventile'] }] },
      ],
      totals: [
        { key: 'ventile', name: 'Ventile' },
        { key: 'antriebe', name: 'Antriebe' },
      ],
    })
    expect(checkValveSurveyTool(broken)).toEqual([
      'groups: key doppelt vergeben (eck)',
      'types: key doppelt vergeben (eck12)',
      'types (eck12): Summe doppelt genannt',
      'types (eck12): unbekannte Summe "koepfe"',
      'totals (antriebe): kein Ventiltyp zählt dazu',
    ])
  })

  it('verlangt mindestens eine Summe je Typ', () => {
    const result = toolEntrySchema.safeParse({
      ...tool,
      groups: [{ key: 'eck', name: 'Eck', types: [{ key: 'eck12', label: 'A', counts: [] }] }],
    })
    expect(result.success).toBe(false)
  })
})

describe('Zählen', () => {
  it('setzt Stückzahlen als ganze Zahl von 0 bis zum Höchstwert und vergisst Typen ohne Stück', () => {
    expect([clampCount(-3), clampCount(2.7), clampCount(Number.NaN), clampCount(5000)]).toEqual([0, 2, 0, MAX_COUNT])
    const start = survey([['Bad', { eck12: 2 }]])
    const roomId = start.rooms[0]!.id
    const changed = setCount(start, roomId, 'eck12', 0, LATER)
    expect(changed.rooms[0]!.counts).toEqual({})
    expect(changed.updatedAt).toBe(LATER.toISOString())
    // Das alte Aufmaß bleibt unverändert
    expect(start.rooms[0]!.counts).toEqual({ eck12: 2 })
  })

  it('zählt gleiche Typen aus mehreren Räumen zusammen, mit Zwischensumme je Gruppe', () => {
    const bill = surveyBill(tool, survey([['Bad', { eck12: 2, eck38: 1 }], ['Küche', { eck12: 1, einbauventil: 1 }]]))
    expect(bill.groups.map((group) => [group.name, group.lines.map((line) => [line.type.key, line.count]), group.subtotal])).toEqual([
      ['Eck', [['eck38', 1], ['eck12', 3]], 4],
      ['Sonstige', [['einbauventil', 1]], 1],
    ])
    expect(bill.totals.map((total) => total.count)).toEqual([4, 5, 0])
  })

  it('zählt Stück mit unbekanntem Typ nicht mit, meldet sie aber', () => {
    const bill = surveyBill(tool, survey([['', { eck12: 1, entfallen: 2 }]]))
    expect(bill.unknownPieces).toBe(2)
    expect(bill.totals[0]!.count).toBe(1)
  })

  it('behält beim Löschen des letzten Raums einen leeren Raum', () => {
    const start = survey([['Bad', { eck12: 2 }]])
    const removed = removeRoom(start, start.rooms[0]!.id, LATER)
    expect(removed.rooms).toHaveLength(1)
    expect(removed.rooms[0]).toMatchObject({ name: '', counts: {} })
  })

  it('erkennt leere Aufmaße, die nicht gespeichert werden', () => {
    const blank = createSurvey(tool.id, NOW)
    expect(isEmptySurvey(blank)).toBe(true)
    expect(isEmptySurvey(setProject(blank, 'Müller', NOW))).toBe(false)
    expect(isEmptySurvey(setNote(blank, 'Keller', NOW))).toBe(false)
    expect(isEmptySurvey(renameRoom(blank, blank.rooms[0]!.id, 'Bad', NOW))).toBe(false)
    expect(isEmptySurvey(setCount(blank, blank.rooms[0]!.id, 'eck12', 1, NOW))).toBe(false)
    expect(setNote(setNote(blank, 'x', NOW), '  ', NOW)).not.toHaveProperty('note')
  })

  it('zeigt die Aufteilung nach Räumen nur bei mehreren oder benannten Räumen', () => {
    expect(showRoomBreakdown(tool, survey([['', { eck12: 1 }]]))).toBe(false)
    expect(showRoomBreakdown(tool, survey([['Bad', { eck12: 1 }]]))).toBe(true)
    expect(showRoomBreakdown(tool, survey([['', { eck12: 1 }], ['Flur', {}]]))).toBe(false)
    expect(roomLines(tool, survey([['Bad', {}], ['', { eck12: 1 }]])).map(({ room }) => room.name)).toEqual([''])
  })
})

describe('Weitergeben', () => {
  const full = survey([['Bad "OG"', { eck12: 2 }], ['=Küche', { einbauventil: 1, fussbodenheizung: 3 }]])

  it('exportiert eine CSV für Excel mit Stückliste, Summen und Räumen', () => {
    const csv = surveyCsv(tool, setNote(full, 'Heizkörper; Keller fehlt', NOW))
    expect(csv.startsWith('﻿')).toBe(true)
    expect(csv.split('\r\n')).toEqual([
      '﻿Aufmaß Thermostatventile',
      'Bauvorhaben;Müller, Hauptstr. 5',
      `Aufmaß vom;${formatSurveyDate(NOW.toISOString())}`,
      'Bemerkung;"Heizkörper; Keller fehlt"',
      '',
      'Ventil;Art.-Nr. Danfoss RA-N;Stück',
      '"1/2"" Eck";013G0033;2',
      'Eck gesamt;;2',
      'Einbauventil;;1',
      'Fußbodenheizung;;3',
      'Sonstige gesamt;;4',
      '',
      'Thermostatventile;;2',
      'Thermostatköpfe;;3',
      'Stellantriebe;;3',
      '',
      'Raum;Ventil;Art.-Nr.;Stück',
      '"Bad ""OG""";"1/2"" Eck";013G0033;2',
      // Text, den Excel als Formel lesen würde, bekommt ein Hochkomma
      "'=Küche;Einbauventil;;1",
      "'=Küche;Fußbodenheizung;;3",
      '',
    ])
  })

  it('benennt die Datei nach Tool, Bauvorhaben und Datum', () => {
    expect(surveyFileName(tool.id, full)).toBe('aufmass-thermostatventile-mueller-hauptstr-5-2026-11-07.csv')
    expect(surveyFileName(tool.id, setProject(full, '  ', NOW))).toBe('aufmass-thermostatventile-2026-11-07.csv')
  })

  it('liest Empfänger und lehnt Ungültiges ab', () => {
    expect(parseRecipients('')).toEqual([])
    expect(parseRecipients(' buero@firma.de; chef@firma.de ')).toEqual(['buero@firma.de', 'chef@firma.de'])
    expect(parseRecipients('buero@firma')).toBeUndefined()
    expect(parseRecipients('a@b.de?cc=x@y.de')).toBeUndefined()
  })

  it('schreibt Stückliste und Räume in die E-Mail', () => {
    const mailto = surveyMailto(tool, full, ['buero@firma.de'])
    expect(mailto.startsWith('mailto:buero@firma.de?subject=')).toBe(true)
    const body = decodeURIComponent(mailto.split('&body=')[1]!)
    expect(decodeURIComponent(mailto.split('subject=')[1]!.split('&')[0]!)).toBe('Aufmaß Thermostatventile: Müller, Hauptstr. 5')
    expect(body).toContain('2 × 1/2" Eck – Art.-Nr. 013G0033')
    expect(body).toContain('Thermostatköpfe: 3')
    expect(body).toContain('=Küche: 1 × Einbauventil, 3 × Fußbodenheizung')
  })

  it('lässt bei zu langer E-Mail die Räume weg, die Stückliste bleibt', () => {
    const rooms = Array.from({ length: 60 }, (_, index): [string, Record<string, number>] => [
      `Raum mit langem Namen ${index}`,
      { eck12: 1, durchgang12: 1 },
    ])
    const long = survey(rooms)
    expect(surveyText(tool, long).length).toBeGreaterThan(MAILTO_MAX_LENGTH)
    const mailto = surveyMailto(tool, long, [])
    expect(mailto.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH)
    const body = decodeURIComponent(mailto.split('&body=')[1]!)
    expect(body).toContain('60 × 1/2" Eck')
    expect(body).toContain(ROOMS_TOO_LONG)
  })
})

describe('Oberfläche', () => {
  it('zeigt Zähler, Stückliste und Weitergabe', () => {
    const html = renderToStaticMarkup(<ValveSurvey tool={tool} initialSurveys={[survey([['Bad', { eck12: 2 }]])]} now={NOW} />)
    expect(html).toContain('Ventile zählen')
    expect(html).toContain('aria-label="1/2&quot; Eck: eins mehr"')
    expect(html).toContain('013G0033')
    expect(html).toContain('Aufteilung nach Räumen')
    expect(html).toContain('href="mailto:')
    expect(html).toContain('Für Excel exportieren (CSV)')
  })

  it('beginnt ohne gespeicherte Aufmaße mit einem leeren', () => {
    const html = renderToStaticMarkup(<ValveSurvey tool={tool} initialSurveys={[]} now={NOW} />)
    expect(html).toContain('Noch nichts gezählt.')
    expect(html).toContain('Ohne Raumangabe')
    expect(html).not.toContain('Gespeicherte Aufmaße')
    expect(html).not.toContain('href="mailto:')
  })

  it('bietet bei mehreren Aufmaßen die Auswahl an', () => {
    const html = renderToStaticMarkup(
      <ValveSurvey tool={tool} initialSurveys={[survey([], 'Müller'), survey([], 'Schmidt')]} now={NOW} />,
    )
    expect(html).toContain('Gespeicherte Aufmaße')
    expect(html).toContain('Schmidt (07.11.2026)')
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

  it('speichert, überschreibt und löscht Aufmaße je Tool', async () => {
    const first = survey([['Bad', { eck12: 1 }]])
    await saveValveSurvey(first)
    await saveValveSurvey({ ...survey([], 'Anderes Tool'), toolId: 'tool.anderes' })
    await saveValveSurvey(setProject(first, 'Neu', LATER))
    expect((await listValveSurveys(tool.id)).map((stored) => stored.project)).toEqual(['Neu'])
    await deleteValveSurvey(first.id)
    expect(await listValveSurveys(tool.id)).toEqual([])
  })
})
