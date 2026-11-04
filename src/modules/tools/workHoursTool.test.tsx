import 'fake-indexeddb/auto'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, describe, expect, it } from 'vitest'
import { closeDatabase, DB_NAME, type WorkEntry } from '../../storage/db'
import { listFavorites } from '../../storage/favorites'
import { deleteWorkEntry, listWorkEntries, saveWorkEntry } from '../../storage/workEntries'
import { isWorkHoursTool } from './schema'
import { toolEntries, toolSearchDocuments } from './tools'
import { DayCard, ProjectInput, WeekOverview, WorkHours } from './WorkHours'
import {
  agreedTargets,
  appendAddress,
  balanceLabel,
  breakEntries,
  chainStart,
  clockFieldValue,
  createBreakEntry,
  createEntry,
  csvFileName,
  dayBalance,
  editedNote,
  editEntry,
  endMinuteFromDuration,
  entriesOfDay,
  entriesOfWeek,
  entryTimeRange,
  formatBalance,
  formatClock,
  formatDay,
  formatDayLong,
  formatHours,
  formatStamp,
  hasOverlaps,
  hoursByProject,
  hoursUntilNow,
  isoWeek,
  MAX_WEEK_MINUTES,
  minutesBetween,
  NO_TARGETS,
  overlapNote,
  overlapsOf,
  overlapWarning,
  parseClock,
  parseHours,
  parseWorkHoursSettings,
  projectSuggestions,
  roundMinutes,
  sumMinutes,
  totalMinutes,
  weekBalance,
  weekDays,
  weekLabel,
  weekStart,
  workHoursCsv,
  type AgreedTargets,
  type WorkHoursSettings,
} from './workHoursCalc'

// Mittwoch, 4. November 2026, Ortszeit
const at = (hours: number, minutes = 0) => new Date(2026, 10, 4, hours, minutes)
const TODAY = '2026-11-04'
const MONDAY = '2026-11-02'

const settings = (change: Partial<WorkHoursSettings> = {}): WorkHoursSettings => ({
  regularStart: '07:00',
  roundingStep: 0,
  breakMinutes: 30,
  agreedPeriod: 'day',
  dailyMinutes: 0,
  weeklyMinutes: 0,
  ...change,
})

let counter = 0
function entry(change: Partial<WorkEntry> = {}): WorkEntry {
  counter += 1
  return {
    id: `e${counter}`,
    project: 'Müller',
    date: TODAY,
    startMinute: 7 * 60,
    minutes: 60,
    recordedAt: at(12).toISOString(),
    ...change,
  }
}

describe('Stunden lesen und anzeigen', () => {
  it.each([
    ['2,5', 150],
    ['2.5', 150],
    ['2', 120],
    ['2:30', 150],
    [' 0,25 ', 15],
    ['24', 1440],
  ])('liest %s als %i Minuten', (text, minutes) => {
    expect(parseHours(text)).toBe(minutes)
  })

  it.each(['', 'abc', '0', '-1', '24,5', '2:75', '1,2,3'])('lehnt „%s“ ab', (text) => {
    expect(parseHours(text)).toBeUndefined()
  })

  it('zeigt Stunden mit Komma und ohne unnötige Stellen', () => {
    expect(formatHours(150)).toBe('2,5')
    expect(formatHours(60)).toBe('1')
    expect(formatHours(15)).toBe('0,25')
    expect(formatHours(80)).toBe('1,33')
  })

  it('verliert beim Weg über das Eingabefeld keine Minute', () => {
    for (let minutes = 1; minutes <= 1440; minutes++) expect(parseHours(formatHours(minutes))).toBe(minutes)
  })

  it('liest und zeigt Uhrzeiten', () => {
    expect(parseClock('07:30')).toBe(450)
    expect(parseClock('7:30')).toBe(450)
    expect(parseClock('24:00')).toBeUndefined()
    expect(parseClock('')).toBeUndefined()
    expect(formatClock(450)).toBe('07:30')
    expect(formatClock(25 * 60)).toBe('01:00 (+1)')
  })
})

describe('Runden', () => {
  it('rundet zum nächsten Wert', () => {
    expect(roundMinutes(307, 0)).toBe(307)
    expect(roundMinutes(307, 15)).toBe(300)
    expect(roundMinutes(308, 15)).toBe(315)
    expect(roundMinutes(314, 30)).toBe(300)
    expect(roundMinutes(315, 30)).toBe(330)
  })
})

describe('Knopf „Bis jetzt“', () => {
  it('rechnet ohne Eintrag ab dem regulären Arbeitsbeginn', () => {
    const result = hoursUntilNow([], at(12, 7), settings())
    expect(result).toMatchObject({ kind: 'ok', minutes: 307, rawMinutes: 307, start: { minute: 420, from: 'regular' } })
  })

  it('rechnet ab der letzten erfassten Zeit von heute', () => {
    const entries = [entry({ startMinute: 420, minutes: 300 }), entry({ startMinute: 720, minutes: 60 })]
    const result = hoursUntilNow(entries, at(15), settings())
    expect(result).toMatchObject({ kind: 'ok', minutes: 120, start: { minute: 780, from: 'last' } })
  })

  it('zählt Einträge anderer Tage nicht mit', () => {
    const result = hoursUntilNow([entry({ date: '2026-11-03', startMinute: 420, minutes: 480 })], at(8), settings())
    expect(result).toMatchObject({ kind: 'ok', minutes: 60, start: { from: 'regular' } })
  })

  it('rundet nur die Stunden aus dem Knopf', () => {
    expect(hoursUntilNow([], at(12, 7), settings({ roundingStep: 15 }))).toMatchObject({ minutes: 300, rawMinutes: 307 })
    expect(hoursUntilNow([], at(12, 7), settings({ roundingStep: 30 }))).toMatchObject({ minutes: 300 })
    expect(hoursUntilNow([], at(12, 20), settings({ roundingStep: 30 }))).toMatchObject({ minutes: 330 })
  })

  it('verliert beim Runden keine Zeit: Der Rest fällt in den nächsten Eintrag', () => {
    const quarter = settings({ roundingStep: 15 })
    const first = hoursUntilNow([], at(12, 7), quarter)
    if (first.kind !== 'ok') throw new Error('Ergebnis erwartet')
    const entries = [createEntry({ project: 'A', date: TODAY, minutes: first.minutes }, [], quarter.regularStart, at(12, 7))]
    expect(entryTimeRange(entries[0]!)).toBe('07:00–12:00')
    // Gerechnet wird ab 12:00, nicht ab 12:07: 233 Minuten bis 15:53, gerundet 240
    expect(hoursUntilNow(entries, at(15, 53), quarter)).toMatchObject({ minutes: 240, rawMinutes: 233 })
  })

  it('rechnet mit 07:00, wenn die gespeicherte Uhrzeit nicht lesbar ist', () => {
    expect(hoursUntilNow([], at(8), settings({ regularStart: 'kaputt' }))).toMatchObject({ kind: 'ok', minutes: 60 })
  })

  it('zieht eine Pause ab: Der nächste Eintrag beginnt erst danach', () => {
    const work = createEntry({ project: 'A', date: TODAY, minutes: 120 }, [], '07:00', at(9))
    const pause = createBreakEntry({ date: TODAY, minutes: 30 }, [work], '07:00', at(9))
    expect(entryTimeRange(pause)).toBe('09:00–09:30')
    expect(hoursUntilNow([work, pause], at(12), settings())).toMatchObject({ minutes: 150, start: { minute: 570 } })
    // Während der Pause gibt es noch nichts zu erfassen
    expect(hoursUntilNow([work, pause], at(9, 10), settings())).toMatchObject({ kind: 'notYet' })
  })

  it('kommt auch ohne Eintrag vor der Pause auf die richtige Summe', () => {
    const pause = createBreakEntry({ date: TODAY, minutes: 30 }, [], '07:00', at(9))
    expect(hoursUntilNow([pause], at(12), settings())).toMatchObject({ minutes: 270 })
  })

  it('erfindet keine Zeit, wenn der Beginn noch nicht erreicht ist', () => {
    expect(hoursUntilNow([], at(6, 30), settings())).toMatchObject({ kind: 'notYet' })
    expect(hoursUntilNow([], at(7), settings())).toMatchObject({ kind: 'notYet' })
    // Aufgerundet oder von Hand bis in die Zukunft erfasst
    expect(hoursUntilNow([entry({ startMinute: 420, minutes: 480 })], at(14), settings())).toMatchObject({ kind: 'notYet' })
  })

  it('meldet, wenn gerundet nichts übrig bleibt', () => {
    expect(hoursUntilNow([], at(7, 10), settings({ roundingStep: 30 }))).toEqual({
      kind: 'roundedToZero',
      rawMinutes: 10,
      start: { minute: 420, from: 'regular' },
    })
  })
})

describe('Einträge', () => {
  it('hängt von Hand eingetragene Stunden an die Kette an', () => {
    const first = createEntry({ project: ' Müller ', date: TODAY, minutes: 120 }, [], '07:00', at(9))
    expect(first).toMatchObject({ project: 'Müller', startMinute: 420, minutes: 120, recordedAt: at(9).toISOString() })
    const second = createEntry({ project: 'Bad Schmidt', date: TODAY, minutes: 90 }, [first], '07:00', at(9))
    expect(entryTimeRange(second)).toBe('09:00–10:30')
    expect(chainStart([first, second], TODAY, '07:00')).toEqual({ minute: 630, from: 'last' })
  })

  it('zeigt frühe Einträge ohne Uhrzeit ohne Von–Bis', () => {
    const { startMinute: _, ...withoutStart } = entry()
    expect(entryTimeRange(withoutStart)).toBeUndefined()
  })

  it('hängt die GPS-Adresse an das Bauvorhaben an', () => {
    expect(appendAddress('', 'Hauptstraße 5, 80331 München')).toBe('Hauptstraße 5, 80331 München')
    expect(appendAddress(' Müller ', 'Hauptstraße 5, 80331 München')).toBe('Müller, Hauptstraße 5, 80331 München')
    expect(appendAddress('Müller, Hauptstraße 5, 80331 München', 'hauptstraße 5, 80331 münchen')).toBe(
      'Müller, Hauptstraße 5, 80331 München',
    )
  })

  it('kennzeichnet ein Ende nach Mitternacht', () => {
    expect(entryTimeRange(entry({ startMinute: 22 * 60, minutes: 180 }))).toBe('22:00–01:00 (+1)')
  })
})

describe('Notiz', () => {
  it('ist optional, wird gekürzt und fehlt, wenn sie leer ist', () => {
    const create = (note?: string) => createEntry({ project: 'A', date: TODAY, minutes: 60, ...(note === undefined ? {} : { note }) }, [], '07:00', at(9))
    expect(create(' Rohr getauscht ').note).toBe('Rohr getauscht')
    expect(create('   ')).not.toHaveProperty('note')
    expect(create()).not.toHaveProperty('note')
  })

  it('lässt sich bearbeiten und entfernen, beides wird vermerkt', () => {
    const original = entry({ project: 'Müller', startMinute: 420, minutes: 60, note: 'Alt' })
    const fields = { project: 'Müller', date: TODAY, startMinute: 420, minutes: 60 }
    expect(editEntry(original, { ...fields, note: ' Alt ' }, at(18))).toBe(original)
    expect(editEntry(original, { ...fields, note: 'Neu' }, at(18))).toMatchObject({ note: 'Neu', editedAt: at(18).toISOString() })
    const removed = editEntry(original, { ...fields, note: '  ' }, at(18))
    expect(removed).not.toHaveProperty('note')
    expect(removed.editedAt).toBe(at(18).toISOString())
  })

  it('steht im Export und ist dort entschärft', () => {
    const lines = workHoursCsv(
      [entry({ date: MONDAY, startMinute: 420, note: 'Rohr; getauscht', recordedAt: new Date(2026, 10, 2, 9).toISOString() })],
      MONDAY,
    ).split('\r\n')
    expect(lines).toContain('Müller;02.11.2026;07:00;08:00;1;"Rohr; getauscht";02.11.2026 09:00;')
    expect(workHoursCsv([entry({ date: MONDAY, note: '=1+1' })], MONDAY)).toContain(`;'=1+1;`)
  })
})

describe('Bearbeiten', () => {
  const original = entry({ project: 'Müller', startMinute: 420, minutes: 60 })
  const same = { project: 'Müller', date: TODAY, startMinute: 420, minutes: 60, note: '' }

  it('übernimmt Änderungen und vermerkt den Zeitpunkt', () => {
    const edited = editEntry(original, { ...same, project: ' Bad Schmidt ', minutes: 90 }, at(18))
    expect(edited).toMatchObject({ id: original.id, project: 'Bad Schmidt', minutes: 90, editedAt: at(18).toISOString() })
    expect(edited.recordedAt).toBe(original.recordedAt)
  })

  it('vermerkt nichts, wenn sich nichts geändert hat', () => {
    expect(editEntry(original, same, at(18))).toBe(original)
    expect(editEntry(original, { ...same, project: ' Müller ' }, at(18))).toBe(original)
  })

  it('zählt bearbeitete Einträge für die Fußzeile', () => {
    expect(editedNote([original])).toBeUndefined()
    const edited = editEntry(original, { ...same, minutes: 90 }, at(18))
    expect(editedNote([original, edited])).toBe('1 Eintrag wurde nachträglich bearbeitet.')
    expect(editedNote([edited, edited])).toBe('2 Einträge wurden nachträglich bearbeitet.')
  })
})

describe('Pausen', () => {
  const pause = (change: Partial<WorkEntry> = {}) => entry({ project: '', isBreak: true, minutes: 30, ...change })

  it('zählen nicht zur Arbeitszeit und nicht als Bauvorhaben', () => {
    const entries = [entry({ minutes: 120 }), pause()]
    expect(totalMinutes(entries)).toBe(120)
    expect(sumMinutes(breakEntries(entries))).toBe(30)
    expect(hoursByProject(entries).map((group) => group.project)).toEqual(['Müller'])
    expect(projectSuggestions(entries, '')).toEqual(['Müller'])
  })

  it('stehen im Export mit eigener Zeile und eigener Summe', () => {
    const lines = workHoursCsv(
      [
        entry({ startMinute: 420, minutes: 120, recordedAt: new Date(2026, 10, 4, 9).toISOString() }),
        pause({ startMinute: 540, recordedAt: new Date(2026, 10, 4, 9, 1).toISOString() }),
      ],
      MONDAY,
    ).split('\r\n')
    expect(lines).toContain('Gesamt;2')
    expect(lines).toContain('Pausen (nicht in Gesamt);0,5')
    expect(lines).toContain('Pause;04.11.2026;09:00;09:30;0,5;;04.11.2026 09:01;')
  })
})

describe('Start- und Endzeit', () => {
  it('rechnet die Dauer und lehnt Unbrauchbares ab', () => {
    expect(minutesBetween('07:00', '09:30')).toBe(150)
    expect(minutesBetween('09:00', '09:00')).toBeUndefined()
    expect(minutesBetween('22:00', '01:00')).toBeUndefined()
    expect(minutesBetween('', '09:00')).toBeUndefined()
    expect(minutesBetween('07:00', '')).toBeUndefined()
  })

  it('übernimmt die eingegebene Startzeit statt der Kette', () => {
    const earlier = createEntry({ project: 'A', date: TODAY, minutes: 60 }, [], '07:00', at(8))
    const entered = createEntry({ project: 'B', date: TODAY, minutes: 90, startMinute: 780 }, [earlier], '07:00', at(15))
    expect(entryTimeRange(entered)).toBe('13:00–14:30')
    // Danach geht die Kette am spätesten Ende weiter
    expect(chainStart([earlier, entered], TODAY, '07:00')).toEqual({ minute: 870, from: 'last' })
  })

  it('rechnet „Bis jetzt“ ab dem eingegebenen Start und rundet die Dauer', () => {
    const quarter = settings({ roundingStep: 15 })
    expect(hoursUntilNow([], at(12, 7), quarter, 8 * 60)).toMatchObject({ minutes: 240, rawMinutes: 247, start: { minute: 480, from: 'entered' } })
    expect(endMinuteFromDuration(480, 240)).toBe(720)
    expect(hoursUntilNow([], at(7), quarter, 8 * 60)).toMatchObject({ kind: 'notYet' })
    // Ein von Hand gesetzter Start verdrängt auch einen späteren Eintrag
    const later = entry({ startMinute: 600, minutes: 60 })
    expect(hoursUntilNow([later], at(12), settings(), 8 * 60)).toMatchObject({ minutes: 240 })
  })

  it('bleibt beim Aufrunden kurz vor Mitternacht am selben Tag', () => {
    expect(endMinuteFromDuration(22 * 60, 120)).toBe(24 * 60 - 1)
  })

  it('füllt Uhrzeit-Felder ohne Folgetag-Kennzeichen', () => {
    expect(clockFieldValue(450)).toBe('07:30')
    expect(clockFieldValue(25 * 60)).toBe('01:00')
  })
})

describe('Über- und Minusstunden', () => {
  const day = (minutes: number) => [entry({ minutes })]
  const perDay = (dailyMinutes: number): AgreedTargets => ({ dailyMinutes, weeklyMinutes: 0 })
  const perWeek = (weeklyMinutes: number): AgreedTargets => ({ dailyMinutes: 0, weeklyMinutes })
  const noop = () => {}
  const dayCard = (entries: WorkEntry[], dailyMinutes: number) =>
    renderToStaticMarkup(
      <DayCard entries={entries} allEntries={entries} dailyMinutes={dailyMinutes} today={TODAY} onEdit={noop} onDelete={noop} />,
    )
  const weekView = (entries: WorkEntry[], targets: AgreedTargets) =>
    renderToStaticMarkup(
      <WeekOverview week={MONDAY} entries={entries} targets={targets} selectedDay={TODAY} today={TODAY} onSelectDay={noop} />,
    )

  it('rechnet Arbeitszeit minus vereinbarte Stunden', () => {
    expect(dayBalance(day(510), 480)).toBe(30)
    expect(dayBalance(day(420), 480)).toBe(-60)
    expect(dayBalance(day(480), 480)).toBe(0)
  })

  it('zählt Pausen nicht als Arbeitszeit', () => {
    expect(dayBalance([entry({ minutes: 480 }), entry({ project: '', isBreak: true, minutes: 30 })], 480)).toBe(0)
  })

  it('rechnet nichts ohne vereinbarte Stunden und an Tagen ohne Arbeit', () => {
    expect(dayBalance(day(480), 0)).toBeUndefined()
    expect(dayBalance([], 480)).toBeUndefined()
    expect(dayBalance([entry({ project: '', isBreak: true })], 480)).toBeUndefined()
  })

  it('summiert die Woche und lässt freie Tage außen vor', () => {
    const entries = [entry({ date: MONDAY, minutes: 540 }), entry({ date: TODAY, minutes: 450 }), entry({ date: '2026-11-09', minutes: 600 })]
    expect(weekBalance(entries, MONDAY, perDay(480))).toBe(30)
    expect(weekBalance(entries, MONDAY, NO_TARGETS)).toBeUndefined()
    expect(weekBalance([], MONDAY, perDay(480))).toBeUndefined()
  })

  it('schreibt das Vorzeichen', () => {
    expect(formatBalance(30)).toBe('+0,5 h')
    expect(formatBalance(-60)).toBe('−1 h')
    expect(balanceLabel(30)).toBe('Überstunden')
    expect(balanceLabel(-60)).toBe('Minusstunden')
  })

  it('zeigt sie am Tag nur, wenn sie zutreffen', () => {
    expect(dayCard(day(510), 480)).toMatch(/Überstunden<\/span><span>\+0,5 h/)
    expect(dayCard(day(420), 480)).toMatch(/Minusstunden<\/span><span>−1 h/)
    expect(dayCard(day(480), 480)).not.toMatch(/Überstunden|Minusstunden/)
    expect(dayCard(day(510), 0)).not.toMatch(/Überstunden|Minusstunden/)
  })

  it('zeigt sie je Tag in der Woche und als Summe', () => {
    const html = weekView([entry({ date: MONDAY, minutes: 540 }), entry({ date: TODAY, minutes: 420 })], perDay(480))
    expect(html).toContain('+1 h')
    expect(html).toContain('−1 h')
    expect(html).not.toContain('der Woche')
    const over = weekView([entry({ date: MONDAY, minutes: 540 })], perDay(480))
    expect(over).toMatch(/Überstunden der Woche<\/span><span>\+1 h/)
    expect(weekView([entry({ date: MONDAY, minutes: 540 })], NO_TARGETS)).not.toMatch(/Überstunden|Minusstunden/)
  })

  it('rechnet bei Wochenstunden die ganze Woche gegen das Soll', () => {
    const entries = [entry({ date: MONDAY, minutes: 1200 }), entry({ date: TODAY, minutes: 1260 }), entry({ date: '2026-11-09', minutes: 600 })]
    expect(weekBalance(entries, MONDAY, perWeek(2400))).toBe(60)
    expect(weekBalance(entries, MONDAY, perWeek(2520))).toBe(-60)
    expect(weekBalance(entries, MONDAY, perWeek(2460))).toBe(0)
    expect(weekBalance([], MONDAY, perWeek(2400))).toBeUndefined()
    // Pausen zählen auch hier nicht als Arbeitszeit
    expect(weekBalance([entry({ project: '', isBreak: true, minutes: 30 })], MONDAY, perWeek(2400))).toBeUndefined()
  })

  it('zeigt bei Wochenstunden nur die Woche, nicht die einzelnen Tage', () => {
    const entries = [entry({ date: MONDAY, minutes: 1500 }), entry({ date: TODAY, minutes: 960 })]
    const html = weekView(entries, perWeek(2400))
    expect(html).toMatch(/Überstunden der Woche<\/span><span>\+1 h/)
    expect(html).not.toContain('sr-only">Überstunden')
    expect(dayCard(entries, perWeek(2400).dailyMinutes)).not.toMatch(/Überstunden|Minusstunden/)
    expect(workHoursCsv(entries, MONDAY, perWeek(2400)).split('\r\n')).toContain('Über-/Minusstunden;+1')
  })

  it('wählt die Sollzeit passend zur Einstellung und behält die andere', () => {
    const both = settings({ dailyMinutes: 480, weeklyMinutes: 2400 })
    expect(agreedTargets(both)).toEqual(perDay(480))
    expect(agreedTargets({ ...both, agreedPeriod: 'week' })).toEqual(perWeek(2400))
  })

  it('liest Wochenstunden über 24 Stunden, Tageswerte bleiben begrenzt', () => {
    expect(parseHours('40', MAX_WEEK_MINUTES)).toBe(2400)
    expect(parseHours('38,5', MAX_WEEK_MINUTES)).toBe(2310)
    expect(parseHours('169', MAX_WEEK_MINUTES)).toBeUndefined()
    expect(parseHours('40')).toBeUndefined()
    expect(formatHours(2310)).toBe('38,5')
  })

  it('steht im Export als Zahl, ohne Angabe gar nicht', () => {
    const entries = [entry({ date: MONDAY, minutes: 420 })]
    expect(workHoursCsv(entries, MONDAY, perDay(480)).split('\r\n')).toContain('Über-/Minusstunden;-1')
    expect(workHoursCsv(entries, MONDAY)).not.toContain('Minusstunden')
  })

  it('merkt sich die Einstellung und ignoriert Unsinn', () => {
    expect(parseWorkHoursSettings('{"dailyMinutes":480}').dailyMinutes).toBe(480)
    expect(parseWorkHoursSettings('{"dailyMinutes":-1}').dailyMinutes).toBe(0)
    expect(parseWorkHoursSettings('{"dailyMinutes":"8"}').dailyMinutes).toBe(0)
    expect(parseWorkHoursSettings(null).dailyMinutes).toBe(0)
    expect(parseWorkHoursSettings('{"agreedPeriod":"week","weeklyMinutes":2400}')).toMatchObject({ agreedPeriod: 'week', weeklyMinutes: 2400 })
    expect(parseWorkHoursSettings('{"agreedPeriod":"monat","weeklyMinutes":99999}')).toMatchObject({ agreedPeriod: 'day', weeklyMinutes: 0 })
  })
})

describe('Überschneidungen', () => {
  const at0900 = entry({ id: 'a', project: 'Müller', startMinute: 540, minutes: 60 })
  const check = (startMinute: number, minutes: number) => overlapsOf([at0900], { date: TODAY, startMinute, minutes }).map((other) => other.id)

  it('erkennt jede Art von Überschneidung', () => {
    expect(check(510, 60)).toEqual(['a']) // ragt von vorne hinein
    expect(check(570, 60)).toEqual(['a']) // ragt von hinten hinein
    expect(check(555, 10)).toEqual(['a']) // liegt innerhalb
    expect(check(480, 240)).toEqual(['a']) // umschließt
    expect(check(540, 60)).toEqual(['a']) // gleiche Zeit
  })

  it('lässt aneinander anschließende Einträge durchgehen', () => {
    expect(check(480, 60)).toEqual([])
    expect(check(600, 60)).toEqual([])
  })

  it('vergleicht nur innerhalb eines Tages und nicht mit sich selbst', () => {
    expect(overlapsOf([at0900], { date: '2026-11-03', startMinute: 540, minutes: 60 })).toEqual([])
    expect(overlapsOf([at0900], at0900)).toEqual([])
  })

  it('zählt Pausen mit und lässt Einträge ohne Uhrzeit außen vor', () => {
    const pause = entry({ id: 'p', project: '', isBreak: true, startMinute: 540, minutes: 30 })
    expect(overlapsOf([pause], { date: TODAY, startMinute: 420, minutes: 300 })).toEqual([pause])
    const { startMinute: _, ...withoutStart } = entry({ id: 'x' })
    expect(overlapsOf([withoutStart], { date: TODAY, startMinute: 420, minutes: 300 })).toEqual([])
    expect(overlapsOf([at0900], withoutStart)).toEqual([])
  })

  it('kann bei der normalen Eingabe nicht entstehen, weil die Kette am Ende weitergeht', () => {
    const first = createEntry({ project: 'A', date: TODAY, minutes: 120 }, [], '07:00', at(9))
    const pause = createBreakEntry({ date: TODAY, minutes: 30 }, [first], '07:00', at(9))
    const next = createEntry({ project: 'B', date: TODAY, minutes: 60 }, [first, pause], '07:00', at(10))
    expect(hasOverlaps([first, pause, next])).toBe(false)
  })

  it('nennt die betroffenen Einträge', () => {
    const pause = entry({ project: '', isBreak: true, startMinute: 540, minutes: 30 })
    expect(overlapWarning([at0900])).toBe('Überschneidet sich mit Müller (09:00–10:00).')
    expect(overlapWarning([at0900, pause])).toBe('Überschneidet sich mit Müller (09:00–10:00), Pause (09:00–09:30).')
  })

  it('vermerkt es im Export', () => {
    const other = entry({ project: 'B', date: TODAY, startMinute: 570, minutes: 60 })
    expect(overlapNote([at0900])).toBeUndefined()
    const lines = workHoursCsv([at0900, other], MONDAY).split('\r\n')
    expect(lines).toContain('Hinweis;2 Einträge überschneiden sich zeitlich, die Stunden zählen dann doppelt.')
  })
})

describe('Tag', () => {
  it('sortiert Einträge und Pausen eines Tages nach der Uhrzeit, ohne andere Tage', () => {
    const late = entry({ startMinute: 600 })
    const pause = entry({ project: '', isBreak: true, startMinute: 570 })
    const early = entry({ startMinute: 420 })
    const other = entry({ date: '2026-11-03' })
    expect(entriesOfDay([late, pause, other, early], TODAY)).toEqual([early, pause, late])
  })

  it('zählt die Pause nicht zur Tagessumme', () => {
    const day = [entry({ minutes: 120 }), entry({ project: '', isBreak: true, minutes: 30 })]
    expect(totalMinutes(day)).toBe(120)
  })

  it('nennt im Zeitstempel das Datum nur, wenn er von einem anderen Tag stammt', () => {
    expect(formatStamp(at(11, 3).toISOString(), TODAY)).toBe('um 11:03')
    expect(formatStamp(at(11, 3).toISOString(), '2026-11-03')).toBe('am 04.11.2026 11:03')
  })

  it('schreibt den Tag mit Jahr', () => {
    expect(formatDayLong(TODAY)).toBe('Mi 04.11.2026')
  })
})

describe('Woche', () => {
  it('hat sieben Tage von Montag bis Sonntag, auch über den Monatswechsel', () => {
    expect(weekDays(MONDAY)).toEqual(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'])
    expect(weekDays('2026-10-26').at(-1)).toBe('2026-11-01')
  })

  it('beginnt am Montag', () => {
    expect(weekStart('2026-11-02')).toBe(MONDAY)
    expect(weekStart('2026-11-04')).toBe(MONDAY)
    expect(weekStart('2026-11-08')).toBe(MONDAY)
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
  })

  it('zählt Kalenderwochen nach ISO 8601', () => {
    expect(isoWeek(MONDAY)).toEqual({ year: 2026, week: 45 })
    // 29.12.2025 gehört schon zu KW 1 von 2026, 28.12.2026 noch zu KW 53
    expect(isoWeek(weekStart('2025-12-29'))).toEqual({ year: 2026, week: 1 })
    expect(isoWeek(weekStart('2026-12-31'))).toEqual({ year: 2026, week: 53 })
    expect(isoWeek(weekStart('2027-01-03'))).toEqual({ year: 2026, week: 53 })
    expect(isoWeek(weekStart('2027-01-04'))).toEqual({ year: 2027, week: 1 })
  })

  it('beschriftet die Woche und die Tage', () => {
    expect(weekLabel(MONDAY)).toBe('KW 45 · 02.11. – 08.11.2026')
    expect(formatDay(MONDAY)).toBe('Mo 02.11.')
    expect(formatDay('2026-11-08')).toBe('So 08.11.')
  })

  it('nimmt nur Einträge von Montag bis Sonntag', () => {
    const inside = [entry({ date: MONDAY }), entry({ date: '2026-11-08' })]
    const outside = [entry({ date: '2026-11-01' }), entry({ date: '2026-11-09' })]
    expect(entriesOfWeek([...inside, ...outside], MONDAY)).toEqual(inside)
  })
})

describe('Stunden je Bauvorhaben', () => {
  it('fasst je Bauvorhaben zusammen, auch bei anderer Schreibweise, und sortiert nach Zeit', () => {
    const later = entry({ project: 'müller', date: '2026-11-03', startMinute: 420, minutes: 60 })
    const first = entry({ project: 'Müller', date: MONDAY, startMinute: 600, minutes: 90 })
    const earlier = entry({ project: 'Müller', date: MONDAY, startMinute: 420, minutes: 30 })
    const other = entry({ project: 'Bad Schmidt', date: MONDAY, startMinute: 450, minutes: 150 })
    const groups = hoursByProject([later, first, other, earlier])
    expect(groups.map((group) => [group.project, group.minutes])).toEqual([
      ['müller', 180],
      ['Bad Schmidt', 150],
    ])
    expect(groups[0]!.entries).toEqual([earlier, first, later])
    expect(totalMinutes([later, first, other, earlier])).toBe(330)
  })

  it('schlägt frühere Bauvorhaben vor, das zuletzt genutzte zuerst', () => {
    const entries = [
      entry({ project: 'Müller', recordedAt: '2026-11-01T08:00:00.000Z' }),
      entry({ project: 'Bad Schmidt', recordedAt: '2026-11-02T08:00:00.000Z' }),
      entry({ project: 'müller', recordedAt: '2026-11-03T08:00:00.000Z' }),
    ]
    expect(projectSuggestions(entries, '')).toEqual(['müller', 'Bad Schmidt'])
    expect(projectSuggestions(entries, 'SCHMI')).toEqual(['Bad Schmidt'])
    expect(projectSuggestions(entries, 'Müller')).toEqual([])
    expect(projectSuggestions(entries, 'xyz')).toEqual([])
    const many = Array.from({ length: 9 }, (_, index) => entry({ project: `Bau ${index}` }))
    expect(projectSuggestions(many, '')).toHaveLength(6)
  })
})

describe('Export', () => {
  const entries = [
    entry({ project: 'Müller', date: MONDAY, startMinute: 420, minutes: 300, recordedAt: new Date(2026, 10, 2, 12, 7).toISOString() }),
    entry({ project: 'Bad; "Schmidt"', date: MONDAY, startMinute: 720, minutes: 75, recordedAt: new Date(2026, 10, 2, 13, 15).toISOString() }),
    entry({ project: 'Ohne Zeit', date: '2026-11-03', minutes: 30, recordedAt: new Date(2026, 10, 3, 9, 0).toISOString() }),
    entry({ project: 'Andere Woche', date: '2026-11-09' }),
  ]
  delete entries[2]!.startMinute

  it('schreibt Summen und Einträge für Excel', () => {
    const lines = workHoursCsv(entries, MONDAY).replace('\uFEFF', '').split('\r\n')
    expect(lines).toEqual([
      'Stundenzettel;KW 45 · 02.11. – 08.11.2026',
      '',
      'Bauvorhaben;Stunden',
      'Müller;5',
      '"Bad; ""Schmidt""";1,25',
      'Ohne Zeit;0,5',
      'Gesamt;6,75',
      '',
      'Bauvorhaben;Datum;Von;Bis;Stunden;Notiz;Erfasst am;Bearbeitet am',
      'Müller;02.11.2026;07:00;12:00;5;;02.11.2026 12:07;',
      '"Bad; ""Schmidt""";02.11.2026;12:00;13:15;1,25;;02.11.2026 13:15;',
      'Ohne Zeit;03.11.2026;;;0,5;;03.11.2026 09:00;',
      '',
    ])
  })

  it('vermerkt Bearbeitungen je Zeile und am Ende', () => {
    const edited = entry({
      date: MONDAY,
      recordedAt: new Date(2026, 10, 2, 12, 7).toISOString(),
      editedAt: new Date(2026, 10, 3, 8, 30).toISOString(),
    })
    const lines = workHoursCsv([edited], MONDAY).split('\r\n')
    expect(lines).toContain('Müller;02.11.2026;07:00;08:00;1;;02.11.2026 12:07;03.11.2026 08:30')
    expect(lines.slice(-3)).toEqual(['', 'Hinweis;1 Eintrag wurde nachträglich bearbeitet.', ''])
  })

  it('beginnt mit BOM, damit Excel die Umlaute richtig liest', () => {
    expect(workHoursCsv(entries, MONDAY).startsWith('\uFEFF')).toBe(true)
  })

  it('entschärft Texte, die eine Tabelle als Formel ausführen würde', () => {
    const csv = workHoursCsv([entry({ project: '=HYPERLINK("x")', date: MONDAY })], MONDAY)
    expect(csv).toContain(`"'=HYPERLINK(""x"")";1`)
    expect(workHoursCsv([entry({ project: '-1+1', date: MONDAY })], MONDAY)).toContain(`'-1+1;1`)
  })

  it('benennt die Datei nach der Kalenderwoche', () => {
    expect(csvFileName(MONDAY)).toBe('stundenzettel-2026-KW45.csv')
    expect(csvFileName(weekStart('2027-01-04'))).toBe('stundenzettel-2027-KW01.csv')
  })
})

describe('Einstellungen', () => {
  it('liest Gespeichertes und fällt bei Kaputtem auf die Standardwerte zurück', () => {
    const standard = { regularStart: '07:00', roundingStep: 30, breakMinutes: 30, agreedPeriod: 'day', dailyMinutes: 0, weeklyMinutes: 0 }
    expect(parseWorkHoursSettings(null)).toEqual(standard)
    expect(parseWorkHoursSettings('{kaputt')).toEqual(standard)
    expect(parseWorkHoursSettings('{"regularStart":"99:00","roundingStep":7,"breakMinutes":-5}')).toEqual(standard)
    // Stand vor dieser Einstellung: leerer Arbeitsbeginn und keine Pausendauer
    expect(parseWorkHoursSettings('{"regularStart":"","roundingStep":15}')).toEqual({ ...standard, roundingStep: 15 })
    expect(parseWorkHoursSettings('{"regularStart":"06:45","roundingStep":15,"breakMinutes":45}')).toEqual({
      regularStart: '06:45',
      roundingStep: 15,
      breakMinutes: 45,
      agreedPeriod: 'day',
      dailyMinutes: 0,
      weeklyMinutes: 0,
    })
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

  it('behält Einträge über das Schließen hinaus und löscht einzeln', async () => {
    const [a, b] = [entry({ id: 'a' }), entry({ id: 'b' })]
    await saveWorkEntry(a)
    await saveWorkEntry(b)
    await closeDatabase()
    expect(await listWorkEntries()).toEqual([a, b])
    await deleteWorkEntry('a')
    expect(await listWorkEntries()).toEqual([b])
  })

  it('überschreibt beim Bearbeiten den alten Stand', async () => {
    const original = entry({ id: 'a' })
    await saveWorkEntry(original)
    const edited = editEntry(original, { project: 'Neu', date: TODAY, startMinute: 480, minutes: 30, note: '' }, at(18))
    await saveWorkEntry(edited)
    expect(await listWorkEntries()).toEqual([edited])
  })

  it('übernimmt eine Datenbank der Vorversion, ohne Favoriten zu verlieren', async () => {
    await new Promise<void>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1)
      request.onupgradeneeded = () => {
        request.result.createObjectStore('favorites', { keyPath: 'id' })
        request.result.createObjectStore('checklistProgress', { keyPath: 'checklistId' })
        request.transaction!.objectStore('favorites').put({ id: 'lexicon.a', addedAt: '2026-10-01T08:00:00.000Z' })
      }
      request.onsuccess = () => {
        request.result.close()
        resolve()
      }
      request.onerror = () => reject(request.error)
    })
    expect((await listFavorites()).map((favorite) => favorite.id)).toEqual(['lexicon.a'])
    expect(await listWorkEntries()).toEqual([])
  })
})

describe('Tool-Seite', () => {
  const render = (entries: WorkEntry[]) =>
    renderToStaticMarkup(<WorkHours closingNote="Schlusshinweis" initialEntries={entries} now={at(12)} />)
  /** Ohne den Teil, der nur auf Papier erscheint */
  const visible = (html: string) => html.replace(/<div class="hidden print:block">.*?(?=<h2 class="mt-6 text-xl font-bold">Wochenübersicht)/, '')

  it('zeigt den Hinweis zur Speicherung am Ende, nicht oben', () => {
    const tool = toolEntries.find((candidate) => candidate.id === 'tool.stundenzettel')
    if (!tool || !isWorkHoursTool(tool)) throw new Error('Stundenzettel erwartet')
    expect(tool.closingNote).toContain('nur auf diesem Gerät gespeichert')
    expect(tool.description).not.toContain('nur auf diesem Gerät gespeichert')
    for (const html of [render([]), render([entry()])]) expect(html).toMatch(/Schlusshinweis<\/p><\/section>$/)
  })

  it('steht in der Tool-Liste und ist über die Suche zu finden', () => {
    const tool = toolEntries.find((candidate) => candidate.id === 'tool.stundenzettel')
    expect(tool && isWorkHoursTool(tool)).toBe(true)
    expect(tool?.status).toBe('verified')
    expect(tool?.verifiedBy).toBe('AI')
    const document = toolSearchDocuments().find((candidate) => candidate.id === 'tool.stundenzettel')
    expect(document?.keywords).toContain('Arbeitszeit')
  })

  it('zeigt Eingabe, Knopf, Einstellungen und Leerzustand', () => {
    const html = render([])
    expect(html).toContain('Bauvorhaben')
    expect(html).toContain('aria-label="Adresse per GPS anfügen"')
    expect(html).toContain('Arbeitsstunden')
    expect(html).toContain('Bis jetzt')
    expect(html).toContain('Pause 0,5 h')
    expect(html).toContain('Regulärer Arbeitsbeginn')
    expect(html).toContain('Standard-Pausendauer')
    expect(html).toContain('Viertelstunde')
    expect(html).toContain('Halbe Stunde')
    expect(html).toContain('An diesem Tag ist noch nichts eingetragen.')
    expect(html).not.toContain('exportieren')
  })

  it('zeigt frühere Bauvorhaben erst, wenn das Feld benutzt wird, und dann über dem Formular', () => {
    expect(render([entry({ project: 'Müller' })])).not.toContain('Frühere Bauvorhaben')
    const field = (initialOpen: boolean, suggestions: string[]) =>
      renderToStaticMarkup(
        <ProjectInput id="p" value="" onChange={() => {}} suggestions={suggestions} initialOpen={initialOpen} />,
      )
    expect(field(false, ['Müller'])).not.toContain('Müller')
    expect(field(true, [])).not.toContain('Frühere Bauvorhaben')
    const open = field(true, ['Müller', 'Bad Schmidt'])
    expect(open).toMatch(/aria-label="Frühere Bauvorhaben" class="absolute[^"]*max-h-52/)
    expect(open.indexOf('Müller')).toBeLessThan(open.indexOf('Bad Schmidt'))
  })

  it('zeigt das Notizfeld und gespeicherte Notizen', () => {
    expect(render([])).toMatch(/Notiz <span[^>]*>\(optional\)<\/span><\/label><textarea/)
    expect(render([entry({ note: 'Rohr getauscht' })])).toContain('>Rohr getauscht</p>')
  })

  it('fordert für Stunden die Zahlen-Tastatur mit Komma an', () => {
    const html = render([])
    expect(html).toMatch(/<input(?=[^>]*placeholder="z\. B\. 2,5")(?=[^>]*inputMode="decimal")/)
    expect(html).toMatch(/<input(?=[^>]*value="0,5")(?=[^>]*inputMode="decimal")/)
  })

  it('füllt Datum und Standardwerte vor', () => {
    const html = render([])
    expect(html).toContain('>Datum</label>')
    expect(html).not.toContain('>Tag</label>')
    expect(html).toMatch(/<input(?=[^>]*type="date")(?=[^>]*value="2026-11-04")/)
    expect(html).toMatch(/<input(?=[^>]*type="time")(?=[^>]*value="07:00")/)
    expect(html).toMatch(/value="0,5"/)
    expect(html).toContain('zählt heute ab 07:00 (regulärer Arbeitsbeginn)')
    expect(html).not.toMatch(/<details[^>]* open=""/)
  })

  it('zeigt Pausen zwischen den Einträgen und zieht sie von der Summe ab', () => {
    const html = visible(
      render([
        entry({ project: 'Müller', startMinute: 420, minutes: 120 }),
        entry({ project: '', isBreak: true, startMinute: 540, minutes: 30 }),
        entry({ project: 'Bad Schmidt', startMinute: 570, minutes: 60 }),
      ]),
    )
    expect(html.indexOf('07:00–09:00')).toBeLessThan(html.indexOf('09:00–09:30'))
    expect(html.indexOf('09:00–09:30')).toBeLessThan(html.indexOf('09:30–10:30'))
    expect(html).toMatch(/Summe ohne Pausen<\/span><span>3 h/)
    expect(html).toMatch(/Gesamt ohne Pausen<\/span><span>3 h/)
    expect(html).toMatch(/Pausen, nicht in Gesamt<\/span><span[^>]*>0,5 h/)
  })

  it('vermerkt bearbeitete Einträge am Eintrag und in der Fußzeile', () => {
    const plain = render([entry()])
    expect(plain).toContain('title="Bearbeiten"')
    expect(plain).not.toContain('Bearbeitet ')
    expect(plain).not.toContain('nachträglich bearbeitet')
    const edited = render([entry({ editedAt: at(18, 30).toISOString() })])
    expect(edited).toContain('Bearbeitet um 18:30')
    expect(edited).toContain('1 Eintrag wurde nachträglich bearbeitet.')
  })

  it('zeigt Bearbeiten und Löschen als Zeichen mit Beschriftung für Screenreader', () => {
    const html = visible(render([entry({ project: 'Müller' })]))
    expect(html).not.toContain('>Bearbeiten<')
    expect(html).not.toContain('>Löschen<')
    expect(html).toMatch(/<button[^>]*aria-label="Müller, [^"]*bearbeiten"[^>]*title="Bearbeiten"[^>]*><svg/)
    expect(html).toMatch(/<button[^>]*aria-label="Müller, [^"]*löschen"[^>]*title="Löschen"[^>]*><svg[^>]*class="[^"]*text-red-600/)
    expect(html).toMatch(/<button[^>]*title="Bearbeiten"[^>]*><svg(?![^>]*text-red)/)
  })

  it('rundet ab Werk auf halbe Stunden', () => {
    expect(render([])).toContain('auf halbe Stunden gerundet')
    expect(render([])).toMatch(/role="radio" aria-checked="true"[^>]*>Halbe Stunde/)
  })

  it('bietet neben „Bis jetzt“ den Wechsel zu Start- und Endzeit an', () => {
    const hoursMode = render([])
    expect(hoursMode).toMatch(/Bis jetzt<\/button><button[^>]*aria-pressed="false"[^>]*aria-label="Start- und Endzeit statt Stunden eingeben"/)
    expect(hoursMode).toContain('>Arbeitsstunden</label>')
    expect(hoursMode).not.toContain('>Ende</label>')

    const timesMode = renderToStaticMarkup(
      <WorkHours closingNote="Hinweis" initialEntries={[entry({ startMinute: 420, minutes: 120 })]} now={at(12)} initialByTimes />,
    )
    expect(timesMode).not.toContain('>Arbeitsstunden</label>')
    expect(timesMode).toContain('>Start</label>')
    expect(timesMode).toContain('>Ende</label>')
    expect(timesMode).toContain('Bis jetzt')
    expect(timesMode).toContain('als Ende ein')
    expect(timesMode).toMatch(/aria-pressed="true"/)
    // Start ist mit dem Ende des letzten Eintrags vorbelegt
    expect(timesMode).toMatch(/<input(?=[^>]*type="time")(?=[^>]*value="09:00")/)
  })

  it('warnt am Eintrag, in der Woche und in der Fußzeile vor Überschneidungen, ohne zu blockieren', () => {
    const clean = visible(render([entry({ startMinute: 420, minutes: 60 }), entry({ startMinute: 480, minutes: 60 })]))
    expect(clean).not.toContain('Überschneidet sich')
    expect(clean).not.toContain('Zeiten überschneiden sich')
    const html = visible(
      render([
        entry({ project: 'Müller', startMinute: 420, minutes: 180 }),
        entry({ project: 'Bad Schmidt', startMinute: 540, minutes: 120 }),
      ]),
    )
    expect(html).toContain('Überschneidet sich mit Bad Schmidt (09:00–11:00).')
    expect(html).toContain('Überschneidet sich mit Müller (07:00–10:00).')
    expect(html).toContain('Zeiten überschneiden sich')
    expect(html).toContain('2 Einträge überschneiden sich zeitlich')
  })

  it('bietet ein Feld für eine eigene Pausendauer, leer gilt der Standard', () => {
    const html = render([])
    expect(html).toContain('>Pausendauer</label>')
    expect(html).not.toContain('(leer:')
    expect(html).toMatch(/<input(?=[^>]*placeholder="0,5")(?=[^>]*inputMode="decimal")/)
    expect(html).toContain('Pause 0,5 h')
  })

  it('trägt eine Pause mit eigener Dauer in die Kette ein', () => {
    const work = createEntry({ project: 'A', date: TODAY, minutes: 120 }, [], '07:00', at(9))
    const pause = createBreakEntry({ date: TODAY, minutes: parseHours('0:45')! }, [work], '07:00', at(9))
    expect(entryTimeRange(pause)).toBe('09:00–09:45')
    expect(chainStart([work, pause], TODAY, '07:00')).toEqual({ minute: 585, from: 'last' })
  })

  it('warnt schon beim Eingeben von Start und Ende', () => {
    const times = (entries: WorkEntry[]) =>
      renderToStaticMarkup(<WorkHours closingNote="Hinweis" initialEntries={entries} now={at(12)} initialByTimes />)
    // Ohne Ende gibt es noch nichts zu vergleichen
    expect(times([entry()]).split('</form>')[0]).not.toContain('Überschneidet sich')
  })

  it('heißt „Stundeneinträge“ und zeigt das Datum nur oben, nicht am Eintrag', () => {
    const html = visible(render([entry({ project: 'Müller', startMinute: 420, minutes: 240, recordedAt: at(11, 3).toISOString() })]))
    expect(html).toContain('>Stundeneinträge</h2>')
    expect(html).not.toContain('Stunden je Bauvorhaben')
    expect(html).toContain('Mi 04.11.2026')
    expect(html).toContain('>Heute<')
    expect(html).toContain('07:00–11:00')
    expect(html).toContain('Erfasst um 11:03')
    expect(html).not.toContain('Mi 04.11. ·')
    expect(html).not.toContain('Erfasst am')
  })

  it('zeigt nur die Einträge des gewählten Tages', () => {
    const html = visible(render([entry({ project: 'Heute hier' }), entry({ project: 'Gestern dort', date: '2026-11-03' })]))
    const dayPart = html.slice(0, html.indexOf('Wochenübersicht'))
    expect(dayPart).toContain('Heute hier')
    expect(dayPart).not.toContain('Gestern dort')
    // Heute ist das Ende, weiter vor geht es nicht
    expect(dayPart).toMatch(/<button[^>]*aria-label="Tag danach"[^>]*disabled=""/)
    expect(visible(render([]))).toContain('An diesem Tag ist noch nichts eingetragen.')
  })

  it('zeigt die Woche von Montag bis Sonntag mit Stunden je Tag und je Bauvorhaben', () => {
    const html = visible(
      render([
        entry({ project: 'Müller', date: '2026-11-02', minutes: 150 }),
        entry({ project: 'Bad Schmidt', date: TODAY, minutes: 240 }),
        entry({ project: 'Müller', date: TODAY, startMinute: 660, minutes: 60 }),
        entry({ project: 'Letzte Woche', date: '2026-10-30' }),
      ]),
    )
    const week = html.slice(html.indexOf('Wochenübersicht'))
    expect(week).toContain('KW 45 · 02.11. – 08.11.2026')
    const days = ['Mo 02.11.', 'Di 03.11.', 'Mi 04.11.', 'Do 05.11.', 'Fr 06.11.', 'Sa 07.11.', 'So 08.11.']
    const positions = days.map((day) => week.indexOf(`<span>${day}</span>`))
    expect(positions.every((position) => position > -1)).toBe(true)
    expect(positions).toEqual([...positions].sort((a, b) => a - b))
    const dayRow = (day: string) => week.slice(week.indexOf(`<span>${day}</span>`)).split('</button>')[0]
    expect(dayRow('Mo 02.11.')).toContain('<span class="font-semibold">2,5 h</span>')
    expect(dayRow('Di 03.11.')).toContain('<span class="text-muted">–</span>')
    expect(dayRow('Mi 04.11.')).toContain('<span class="font-semibold">5 h</span>')
    expect(week).toMatch(/Gesamt<\/span><span>7,5 h/)
    expect(week).toContain('Je Bauvorhaben')
    expect(week).toMatch(/Müller<\/span><span[^>]*>3,5 h/)
    expect(week).toMatch(/Bad Schmidt<\/span><span[^>]*>4 h/)
    expect(week).not.toContain('Letzte Woche')
    expect(week).toContain('Für Excel exportieren (CSV)')
    expect(week).toMatch(/<button[^>]*aria-label="Woche danach"[^>]*disabled=""/)
    // Der gewählte Tag ist markiert, Tage in der Zukunft lassen sich nicht wählen
    expect(week).toMatch(/aria-current="date"[^>]*>(?:(?!<\/button>).)*Mi 04\.11\./)
    expect(week).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>).)*Do 05\.11\./)
  })

  it('zeigt die Woche auch ohne Einträge, aber ohne Export', () => {
    const html = visible(render([]))
    expect(html).toContain('Wochenübersicht')
    expect(html).toContain('Mo 02.11.')
    expect(html).not.toContain('Je Bauvorhaben')
    expect(html).not.toContain('exportieren')
  })

  it('druckt alle Tage der Woche mit Datum über den Einträgen', () => {
    const html = render([entry({ project: 'Montag', date: '2026-11-02' }), entry({ project: 'Heute' })])
    const printed = html.slice(html.indexOf('hidden print:block'), html.indexOf('>Wochenübersicht<'))
    expect(printed).toContain('Mo 02.11.2026')
    expect(printed).toContain('Montag')
    expect(printed).toContain('Mi 04.11.2026')
    expect(printed).toContain('Heute')
    expect(printed).not.toContain('Di 03.11.2026')
  })

  it('blendet beim Drucken alles außer der Liste aus', () => {
    const html = render([entry()])
    expect(html).toMatch(/<form[^>]*print:hidden/)
    expect(html).toMatch(/<details[^>]*print:hidden/)
    expect(html).toMatch(/print:hidden"><button[^>]*aria-label="[^"]*bearbeiten"/)
  })
})
