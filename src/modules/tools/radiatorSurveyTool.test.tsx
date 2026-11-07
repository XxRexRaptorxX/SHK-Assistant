import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDatabase, DB_NAME, type RadiatorSurvey as Survey } from '../../storage/db'
import { deleteRadiatorSurvey, listRadiatorSurveys, saveRadiatorSurvey } from '../../storage/radiatorSurveys'
import { listValveSurveys } from '../../storage/valveSurveys'
import { RadiatorSurvey } from './RadiatorSurvey'
import {
  addRadiator,
  addRoom,
  cleanValue,
  createSurvey,
  draftFromRadiator,
  draftIssues,
  EMPTY_DRAFT,
  isEmptySurvey,
  MAX_RADIATORS,
  radiatorFromDraft,
  radiatorLine,
  radiatorSummary,
  removeRadiator,
  replaceRadiator,
  ROOMS_TOO_LONG,
  surveyCsv,
  surveyMailto,
  surveyText,
  type RadiatorDraft,
} from './radiatorSurveyCalc'
import { checkRadiatorSurveyTool, dimensionFields, type RadiatorSurveyTool } from './radiatorSurveyTool'
import { isRadiatorSurveyTool } from './schema'
import { formatSurveyDate, MAILTO_MAX_LENGTH, renameRoom, setNote, setProject, surveyFileName } from './surveyCommon'
import { toolEntries, toolSearchDocuments } from './tools'

const NOW = new Date(2026, 10, 7, 9, 30)
const LATER = new Date(2026, 10, 7, 10, 0)

const tool = toolEntries.find(isRadiatorSurveyTool)!

/** Kleines eigenes Tool mit Auswahlwerten, unabhängig vom Inhalt */
const testTool: RadiatorSurveyTool = {
  ...tool,
  dimensions: [
    { key: 'bauart', label: 'Bauart', unit: '', numeric: false },
    { key: 'hoehe', label: 'Höhe', unit: 'mm', numeric: true },
    { key: 'laenge', label: 'Länge', unit: 'mm', numeric: true },
    { key: 'glieder', label: 'Gliederzahl', unit: '', numeric: true },
  ],
  defaultDimensions: [
    { key: 'hoehe', required: true, options: [], allowOther: true },
    { key: 'laenge', required: true, options: [], allowOther: true },
  ],
  models: [
    {
      key: 'kompakt',
      label: 'Kompaktheizkörper',
      dimensions: [
        { key: 'bauart', required: true, options: ['11', '22', '33'], allowOther: false },
        { key: 'hoehe', required: true, options: ['300', '600', '900'], allowOther: true },
        {
          key: 'laenge',
          required: true,
          options: ['400', '500', '600', '700', '800', '900', '1000', '1200', '1400'],
          allowOther: true,
        },
      ],
    },
    {
      key: 'glieder',
      label: 'Gliederheizkörper',
      dimensions: [
        { key: 'hoehe', required: true, options: [], allowOther: true },
        { key: 'glieder', required: true, options: [], allowOther: true },
      ],
    },
  ],
  thermostats: [
    { key: 'eck12', label: '1/2" Eck' },
    { key: 'durchgang12', label: '1/2" Durchgang' },
  ],
}

const kompakt = (change: Partial<Record<'bauart' | 'hoehe' | 'laenge', string>> = {}, rest: Partial<RadiatorDraft> = {}): RadiatorDraft => ({
  ...EMPTY_DRAFT,
  model: 'kompakt',
  values: { bauart: '22', hoehe: '600', laenge: '1000', ...change },
  ...rest,
})
const plain = (rest: Partial<RadiatorDraft> = {}): RadiatorDraft => ({ ...EMPTY_DRAFT, values: { hoehe: '600', laenge: '1000' }, ...rest })

/** Aufmaß mit Heizkörpern je Raum: [Raumname, Formularstände] */
function survey(rooms: [string, RadiatorDraft[]][], project = 'Müller, Hauptstr. 5', onTool = testTool): Survey {
  let result: Survey = { ...setProject(createSurvey(onTool.id, NOW), project, NOW), rooms: [] }
  for (const [name, drafts] of rooms) {
    const added = addRoom(result, name, NOW)
    result = added.survey
    for (const entry of drafts) result = addRadiator(onTool, result, added.room.id, entry, NOW)
  }
  return result
}

describe('Inhalt Aufmaß Heizkörper', () => {
  it('ist gültig, mit den Modellen des Inhabers und Thermostaten aus der Ventil-Vorlage', () => {
    expect(tool).toBeDefined()
    expect(checkRadiatorSurveyTool(tool)).toEqual([])
    expect(tool.models.map((model) => model.label)).toEqual(
      expect.arrayContaining(['Kompaktheizkörper', 'Badheizkörper', 'Flachheizkörper', 'Rippenheizkörper']),
    )
    const valveTool = toolEntries.find((entry) => entry.id === 'tool.aufmass-thermostatventile')
    expect(valveTool?.kind).toBe('valveSurvey')
    if (valveTool?.kind !== 'valveSurvey') return
    const valveLabels = valveTool.groups.flatMap((group) => group.types.map((type) => type.label))
    for (const thermostat of tool.thermostats) expect(valveLabels).toContain(thermostat.label)
  })

  it('fragt je Modell eigene Maße ab, Höhe immer als Pflicht', () => {
    const keys = (model: string | undefined) => dimensionFields(tool, model).map((field) => `${field.key}${field.required ? '*' : ''}`)
    expect(keys(undefined)).toEqual(['hoehe*', 'laenge*', 'tiefe'])
    expect(keys('kompakt')).toEqual(['bauart', 'hoehe*', 'laenge*', 'tiefe'])
    expect(keys('bad')).toEqual(['hoehe*', 'breite*', 'tiefe', 'nabenabstand'])
    expect(keys('glieder')).toEqual(['hoehe*', 'tiefe', 'nabenabstand', 'glieder*'])
  })

  it('bietet für Kompakt-, Flach- und Gliederheizkörper die Werte aus den Herstellerdatenblättern an', () => {
    const options = (model: string) =>
      Object.fromEntries(dimensionFields(tool, model).map((field) => [field.key, field.options.join(' ')]))
    const panel = {
      bauart: '10 11 20 21 22 33',
      hoehe: '300 400 500 550 600 900 950',
      laenge: '400 500 600 700 800 900 1000 1100 1200 1400 1600 1800 2000 2300 2600 3000',
      tiefe: '',
    }
    expect(options('kompakt')).toEqual(panel)
    expect(options('flach')).toEqual(panel)
    expect(options('glieder')).toEqual({ hoehe: '300 450 600 1000', tiefe: '110 160 220 250', nabenabstand: '200 350 500 900', glieder: '' })
    // Anderes Maß bleibt überall erlaubt: im Bestand gibt es auch andere Größen
    expect(tool.models.every((model) => model.dimensions.every((field) => field.allowOther))).toBe(true)
    expect(tool.source).toContain('Purmo')
    expect(tool.source).toContain('HG-TEC')
  })

  it('ist ungeprüft und nennt die fehlenden Auswahlwerte', () => {
    expect(tool.status).toBe('draft')
    expect(tool.todo).toMatch(/^TODO: Inhalt fehlt/)
  })

  it('ist über Modelle und Maße auffindbar', () => {
    const document = toolSearchDocuments().find((entry) => entry.id === tool.id)!
    expect(document.keywords).toEqual(expect.arrayContaining(['Kompaktheizkörper', 'Nabenabstand', '1/2" Eck']))
  })
})

describe('Prüfung des Inhalts', () => {
  it('meldet unbekannte, doppelte und ungenutzte Maße, falsche Auswahlwerte und fehlende Pflichtmaße', () => {
    const broken: RadiatorSurveyTool = {
      ...testTool,
      status: 'verified',
      todo: 'TODO: Inhalt fehlt',
      dimensions: [...testTool.dimensions, { key: 'breite', label: 'Breite', unit: 'mm', numeric: true }],
      models: [
        {
          key: 'kompakt',
          label: 'Kompaktheizkörper',
          dimensions: [
            { key: 'hoehe', required: false, options: ['600', '600', '0', 'abc'], allowOther: true },
            { key: 'hoehe', required: false, options: [], allowOther: true },
            { key: 'bauart', required: false, options: [], allowOther: false },
            { key: 'unbekannt', required: false, options: [], allowOther: true },
          ],
        },
      ],
    }
    expect(checkRadiatorSurveyTool(broken)).toEqual([
      'models (kompakt): Maß doppelt genannt (hoehe)',
      'models (kompakt): kein Pflichtmaß',
      'models (kompakt) (hoehe): Auswahlwert doppelt (600)',
      'models (kompakt) (hoehe): keine ganze Zahl von 1 bis 10000 (0, abc)',
      'models (kompakt) (bauart): weder Auswahlwerte noch Eingabe erlaubt',
      'models (kompakt): unbekanntes Maß "unbekannt"',
      'dimensions (glieder): von keinem Modell abgefragt',
      'dimensions (breite): von keinem Modell abgefragt',
      'todo: bei verified nicht erlaubt',
    ])
  })
})

describe('Eingabe', () => {
  it('bereinigt Zahlen und lässt Text-Maße als Text', () => {
    const numeric = { numeric: true }
    expect([cleanValue(numeric, ' 1.200 '), cleanValue(numeric, '1 000'), cleanValue(numeric, ''), cleanValue(numeric, '0')]).toEqual([
      '1200',
      '1000',
      '',
      undefined,
    ])
    expect([cleanValue(numeric, '60,5'), cleanValue(numeric, '10001'), cleanValue({ numeric: false }, ' 22 ')]).toEqual([
      undefined,
      undefined,
      '22',
    ])
  })

  it('verlangt die Pflichtmaße des Modells, gültige Zahlen und bei fester Auswahl einen Wert daraus', () => {
    expect(draftIssues(testTool, kompakt())).toEqual([])
    expect(draftIssues(testTool, kompakt({ hoehe: '', bauart: '' }))).toEqual(['Bauart fehlt.', 'Höhe fehlt.'])
    expect(draftIssues(testTool, kompakt({ laenge: 'x' }))).toEqual(['Länge: bitte eine ganze Zahl von 1 bis 10.000 eintragen.'])
    expect(draftIssues(testTool, kompakt({ bauart: '44' }))).toEqual(['Bauart: bitte einen Wert aus der Auswahl nehmen.'])
    // Anderes Maß ist bei Höhe erlaubt
    expect(draftIssues(testTool, kompakt({ hoehe: '550' }))).toEqual([])
    // Gliederheizkörper fragt keine Länge, aber die Gliederzahl
    expect(draftIssues(testTool, { ...EMPTY_DRAFT, model: 'glieder', values: { hoehe: '600', laenge: '1000' } })).toEqual(['Gliederzahl fehlt.'])
  })

  it('speichert nur die Maße des gewählten Modells und begrenzt die Anzahl', () => {
    const switched: RadiatorDraft = { ...EMPTY_DRAFT, model: 'glieder', values: { bauart: '22', hoehe: '600', laenge: '1000', glieder: '12' } }
    expect(radiatorFromDraft(testTool, { ...switched, count: 500, note: '  ' }, 'r1')).toEqual({
      id: 'r1',
      model: 'glieder',
      values: { hoehe: '600', glieder: '12' },
      count: MAX_RADIATORS,
    })
    const full = radiatorFromDraft(testTool, kompakt({ hoehe: '1.200' }, { thermostat: 'eck12', count: 0, note: ' Fenster ' }), 'r2')
    expect(full).toEqual({
      id: 'r2',
      model: 'kompakt',
      values: { bauart: '22', hoehe: '1200', laenge: '1000' },
      thermostat: 'eck12',
      count: 1,
      note: 'Fenster',
    })
    expect(radiatorFromDraft(testTool, draftFromRadiator(full), 'r2')).toEqual(full)
  })

  it('beschreibt einen Heizkörper in einer Zeile', () => {
    const radiator = radiatorFromDraft(testTool, kompakt({}, { thermostat: 'eck12', count: 2, note: 'Fenster' }), 'r')
    expect(radiatorLine(testTool, radiator)).toBe(
      '2 × Kompaktheizkörper, Bauart 22, Höhe 600 mm, Länge 1000 mm, Thermostat 1/2" Eck (Fenster)',
    )
    expect(radiatorLine(testTool, radiatorFromDraft(testTool, plain(), 'r'))).toBe('1 × Höhe 600 mm, Länge 1000 mm')
    expect(radiatorLine(testTool, { id: 'r', model: 'weg', values: { alt: '5' }, count: 1 })).toBe('1 × Unbekanntes Modell (weg), alt 5')
  })
})

describe('Heizkörper im Aufmaß', () => {
  it('fügt hinzu, ändert und löscht, ohne das alte Aufmaß zu verändern', () => {
    const start = survey([['Bad', [plain()]]])
    const roomId = start.rooms[0]!.id
    const radiatorId = start.rooms[0]!.radiators[0]!.id
    const changed = replaceRadiator(testTool, start, roomId, radiatorId, kompakt({ hoehe: '900' }), LATER)
    expect(changed.rooms[0]!.radiators[0]).toMatchObject({ id: radiatorId, model: 'kompakt', values: { hoehe: '900' } })
    expect(changed.updatedAt).toBe(LATER.toISOString())
    expect(start.rooms[0]!.radiators[0]!.values.hoehe).toBe('600')
    expect(removeRadiator(changed, roomId, radiatorId, LATER).rooms[0]!.radiators).toEqual([])
  })

  it('erkennt leere Aufmaße, die nicht gespeichert werden', () => {
    const blank = createSurvey(testTool.id, NOW)
    expect(isEmptySurvey(blank)).toBe(true)
    expect(isEmptySurvey(setProject(blank, 'Müller', NOW))).toBe(false)
    expect(isEmptySurvey(setNote(blank, 'x', NOW))).toBe(false)
    expect(isEmptySurvey(renameRoom(blank, blank.rooms[0]!.id, 'Bad', NOW))).toBe(false)
    expect(isEmptySurvey(addRadiator(testTool, blank, blank.rooms[0]!.id, plain(), NOW))).toBe(false)
  })

  it('fasst gleiche Heizkörper über alle Räume zusammen und zählt Thermostate', () => {
    const summary = radiatorSummary(
      testTool,
      survey([
        ['Bad', [{ ...EMPTY_DRAFT, model: 'glieder', values: { hoehe: '900', glieder: '10' }, thermostat: 'eck12' }]],
        ['Wohnen', [kompakt({}, { count: 2, thermostat: 'eck12' }), plain()]],
        ['Küche', [kompakt({}, { thermostat: 'durchgang12' }), kompakt({ bauart: '11' })]],
      ]),
    )
    expect(summary.sizes.map((size) => [size.model, size.values, size.count])).toEqual([
      ['kompakt', { bauart: '11', hoehe: '600', laenge: '1000' }, 1],
      ['kompakt', { bauart: '22', hoehe: '600', laenge: '1000' }, 3],
      ['glieder', { hoehe: '900', glieder: '10' }, 1],
      [undefined, { hoehe: '600', laenge: '1000' }, 1],
    ])
    expect(summary.thermostats.map((thermostat) => [thermostat.label, thermostat.count])).toEqual([
      ['1/2" Eck', 3],
      ['1/2" Durchgang', 1],
    ])
    expect(summary.withoutThermostat).toBe(2)
    expect(summary.total).toBe(6)
  })
})

describe('Weitergeben', () => {
  const full = survey([
    ['Bad "OG"', [{ ...EMPTY_DRAFT, model: 'glieder', values: { hoehe: '900', glieder: '10' }, thermostat: 'eck12', note: 'Handtuch; links' }]],
    ['=Küche', [kompakt({}, { count: 2 })]],
    ['Flur', []],
  ])

  it('exportiert eine CSV mit einer Spalte je Maß, einer Zeile je Heizkörper und der Zusammenfassung', () => {
    expect(surveyCsv(testTool, full).split('\r\n')).toEqual([
      '﻿Aufmaß Heizkörper',
      'Bauvorhaben;Müller, Hauptstr. 5',
      `Aufmaß vom;${formatSurveyDate(NOW.toISOString())}`,
      '',
      'Raum;Modell;Bauart;Höhe (mm);Länge (mm);Gliederzahl;Thermostat;Anzahl;Notiz',
      '"Bad ""OG""";Gliederheizkörper;;900;;10;"1/2"" Eck";1;"Handtuch; links"',
      "'=Küche;Kompaktheizkörper;22;600;1000;;;2;",
      '',
      'Zusammenfassung',
      'Modell;Bauart;Höhe (mm);Länge (mm);Gliederzahl;Anzahl',
      'Kompaktheizkörper;22;600;1000;;2',
      'Gliederheizkörper;;900;;10;1',
      'Gesamt;;;;;3',
      '',
      'Thermostat;Anzahl',
      '"1/2"" Eck";1',
      'ohne Angabe;2',
      '',
    ])
  })

  it('benennt die Datei nach Tool, Bauvorhaben und Datum', () => {
    expect(surveyFileName(tool.id, full)).toBe('aufmass-heizkoerper-mueller-hauptstr-5-2026-11-07.csv')
  })

  it('schreibt die Heizkörper je Raum in die E-Mail', () => {
    const mailto = surveyMailto(testTool, full, ['buero@firma.de'])
    expect(mailto.startsWith('mailto:buero@firma.de?subject=')).toBe(true)
    const body = decodeURIComponent(mailto.split('&body=')[1]!)
    expect(body).toContain('Bad "OG":\r\n  1 × Gliederheizkörper, Höhe 900 mm, Gliederzahl 10, Thermostat 1/2" Eck (Handtuch; links)')
    expect(body).toContain('2 × Kompaktheizkörper, Bauart 22, Höhe 600 mm, Länge 1000 mm')
    expect(body).toContain('Heizkörper gesamt: 3')
    expect(body).not.toContain('Flur')
  })

  it('lässt bei zu langer E-Mail die Liste je Raum weg, die Zusammenfassung bleibt', () => {
    const rooms = Array.from({ length: 40 }, (_, index): [string, RadiatorDraft[]] => [
      `Raum mit langem Namen ${index}`,
      [kompakt({}, { note: 'Anschluss rechts unten' })],
    ])
    const long = survey(rooms)
    expect(surveyText(testTool, long).length).toBeGreaterThan(MAILTO_MAX_LENGTH)
    const mailto = surveyMailto(testTool, long, [])
    expect(mailto.length).toBeLessThanOrEqual(MAILTO_MAX_LENGTH)
    const body = decodeURIComponent(mailto.split('&body=')[1]!)
    expect(body).toContain(ROOMS_TOO_LONG)
    expect(body).toContain('40 × Kompaktheizkörper, Bauart 22, Höhe 600 mm, Länge 1000 mm')
  })
})

describe('Oberfläche', () => {
  it('zeigt die Maße ohne Modell als Eingabefelder, dazu Übersicht und Weitergabe', () => {
    const html = renderToStaticMarkup(
      <RadiatorSurvey tool={tool} initialSurveys={[survey([['Bad', [plain({ thermostat: 'eck12' })]]], undefined, tool)]} now={NOW} />,
    )
    expect(html).toContain('Heizkörper hinzufügen')
    expect(html).toContain('<option value="kompakt">Kompaktheizkörper</option>')
    expect(html).toContain('<option value="eck12">1/2&quot; Eck</option>')
    expect(html).toMatch(/Höhe<span[^>]*> in mm<\/span><\/label><input/)
    expect(html).toContain('Gleiche Heizkörper zusammengefasst')
    expect(html).toContain('1 × Höhe 600 mm, Länge 1000 mm, Thermostat 1/2&quot; Eck')
    expect(html).toContain('href="mailto:')
  })

  it('beginnt ohne gespeicherte Aufmaße mit einem leeren', () => {
    const html = renderToStaticMarkup(<RadiatorSurvey tool={tool} initialSurveys={[]} now={NOW} />)
    expect(html).toContain('Noch keine Heizkörper eingetragen.')
    expect(html).toContain('In diesem Raum ist noch kein Heizkörper eingetragen.')
    expect(html).not.toContain('href="mailto:')
  })

  it('zeigt wenige Auswahlwerte als Knöpfe und viele als Auswahlliste', () => {
    const html = renderToStaticMarkup(
      <RadiatorSurvey tool={testTool} initialSurveys={[]} now={NOW} initialDraft={kompakt({ hoehe: '550' })} />,
    )
    // Bauart: drei Knöpfe, „22“ gewählt, kein „Anderes Maß“ (feste Auswahl)
    expect(html).toMatch(/aria-pressed="true" class="[^"]*">22<\/button>/)
    expect(html.match(/Anderes Maß<\/button>/g)).toHaveLength(1)
    // Höhe: Knöpfe; 550 steht nicht in der Auswahl, also ist „Anderes Maß“ aktiv mit Eingabefeld
    expect(html).toMatch(/aria-pressed="true" class="[^"]*">Anderes Maß<\/button>/)
    expect(html).toContain('value="550"')
    // Länge: neun Werte, also Auswahlliste mit „Anderes Maß …“
    expect(html).toContain('<option value="1000" selected="">1000 mm</option>')
    expect(html).toContain('Anderes Maß …')
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

  it('speichert, überschreibt und löscht Heizkörper-Aufmaße getrennt von den Ventil-Aufmaßen', async () => {
    const first = survey([['Bad', [plain()]]], undefined, tool)
    await saveRadiatorSurvey(first)
    await saveRadiatorSurvey(setProject(first, 'Neu', LATER))
    expect((await listRadiatorSurveys(tool.id)).map((stored) => stored.project)).toEqual(['Neu'])
    expect(await listValveSurveys(tool.id)).toEqual([])
    await deleteRadiatorSurvey(first.id)
    expect(await listRadiatorSurveys(tool.id)).toEqual([])
  })
})
