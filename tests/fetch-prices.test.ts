import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  excelDateText,
  findOilBulletinLink,
  htmlTables,
  isPlausible,
  parseCarmenWoodChips,
  parseDepiPellets,
  parseEurostat,
  parseGermanNumber,
  parseOilBulletin,
  parsePricesData,
} from '../src/modules/tools/heatingCostSources'
import { readXlsxRows } from '../tools/xlsx'

// Parser für tools/fetch-prices.ts. Die HTML-Beispiele sind nachgebaut (nur der Aufbau der Tabellen der Quellen),
// die xlsx-Datei ist das Weekly Oil Bulletin der EU-Kommission vom 02.11.2026 (Weiterverwendung erlaubt).

describe('Marktpreise: Parser', () => {
  it('liest das Weekly Oil Bulletin (Heizöl Deutschland, € je Liter)', () => {
    const rows = readXlsxRows(readFileSync(new URL('./fixtures/oil-bulletin-2026-11-02.xlsx', import.meta.url)))
    expect(rows[12]?.[0]).toBe('Germany')
    expect(parseOilBulletin(rows)).toEqual({ value: 1.7169, period: 'Woche ab 02.11.2026' })
    expect(parseOilBulletin(rows.map((row) => row.map((cell) => cell.replace('1000 l', 'kg'))))).toBeUndefined()
    expect(parseOilBulletin([])).toBeUndefined()
  })

  it('findet den Link zur aktuellen Datei auf der Seite des Bulletins', () => {
    const html =
      '<a href="/document/download/abc_en?filename=Weekly%20without%20taxes.xlsx" data-untranslated-label="Prices without taxes latest prices (xlsx)">' +
      '<a href="/document/download/def_en?filename=Weekly%20with%20Taxes.xlsx&amp;x=1" class="ecl-link" data-untranslated-label="Prices with taxes latest prices (xlsx)">'
    expect(findOilBulletinLink(html, 'https://energy.ec.europa.eu/data-and-analysis/weekly-oil-bulletin_en')).toBe(
      'https://energy.ec.europa.eu/document/download/def_en?filename=Weekly%20with%20Taxes.xlsx&x=1',
    )
    expect(findOilBulletinLink('<a href="/x">Prices</a>', 'https://example.org/')).toBeUndefined()
  })

  it('liest die Eurostat-API (jüngster Halbjahreswert mit Zahl)', () => {
    const json = {
      value: { '0': 0.3869, '1': 0.3618 },
      dimension: { time: { category: { index: { '2025-S2': 0, '2026-S1': 1 } } } },
    }
    expect(parseEurostat(json)).toEqual({ value: 0.3618, period: '1. Halbjahr 2026' })
    // Fehlt der jüngste Wert, gilt der davor
    expect(parseEurostat({ ...json, value: { '0': 0.3869 } })).toEqual({ value: 0.3869, period: '2. Halbjahr 2025' })
    expect(parseEurostat({ value: {} })).toBeUndefined()
    expect(parseEurostat('kaputt')).toBeUndefined()
  })

  it('liest den DEPI-Pelletpreis für 6 t mit Monat', () => {
    const html = `
      <h2>Aktueller Pelletpreis</h2>
      <table><thead><tr><th scope="col"><strong>Oktober 2026</strong></th><th>&nbsp;</th></tr></thead>
      <tbody>
        <tr><td>Pelletpreis 1 Kilogramm:</td><td>46,46&nbsp;Cent</td></tr>
        <tr><td>Pelletpreis 6 Tonnen (t):</td><td>464,61&nbsp;€/t</td></tr>
        <tr><td>Pelletpreis 26 Tonnen (t):</td><td>448,45&nbsp;€/t</td></tr>
      </tbody></table>
      <table><thead><tr><th></th><th>2025 (in €/t)</th></tr></thead><tbody><tr><td>Januar</td><td>306,35</td></tr></tbody></table>`
    expect(parseDepiPellets(html)).toEqual({ value: 464.61, period: 'Oktober 2026' })
    expect(parseDepiPellets('<table><tr><td>Pelletpreis 6 Tonnen (t):</td><td>k. A.</td></tr></table>')).toBeUndefined()
  })

  it('liest den C.A.R.M.E.N.-Hackschnitzelpreis (Mittelwert Gesamt, jüngstes Quartal, 20 %)', () => {
    const header = ['wdt_ID', 'Region', 'Statistik', 'Quartal_Zahl', 'Quartal', 'Jahr', 'Wassergehalt 35 %', 'Wassergehalt 20 %']
    const row = (cells: string[]) => `<tr>${cells.map((cell) => `<td>${cell}</td>`).join('')}</tr>`
    const html = `<table id="table_1"><thead><tr>${header.map((cell) => `<th class="wdtheader"> ${cell}</th>`).join('')}</tr></thead><tbody>
      ${row(['1', 'Gesamt', 'Mittelwert', '3', '3. Quartal', '2026', '102,82', '153,95'])}
      ${row(['2', 'Süden', 'Mittelwert', '3', '3. Quartal', '2026', '87,77', '138,42'])}
      ${row(['8', 'Gesamt', 'Maximum', '3', '3. Quartal', '2026', '210,79', '263,02'])}
      ${row(['10', 'Gesamt', 'Mittelwert', '2', '2. Quartal', '2026', '108,46', '158,94'])}
      </tbody></table>`
    expect(parseCarmenWoodChips(html)).toEqual({ value: 153.95, period: '3. Quartal 2026' })
    expect(parseCarmenWoodChips(html.replace('Wassergehalt 20 %', 'Wassergehalt 25 %'))).toBeUndefined()
  })

  it('liest Tabellen, Zahlen und Excel-Daten', () => {
    expect(htmlTables('<table><thead><tr><th>A</th></tr></thead><tr><td> 1 &amp; 2 </td></tr></table>')).toEqual([
      { headers: ['A'], rows: [['1 & 2']] },
    ])
    expect(parseGermanNumber('1.234,56 €')).toBe(1234.56)
    expect(parseGermanNumber('464,61 €/t')).toBe(464.61)
    expect(parseGermanNumber('k. A.')).toBeUndefined()
    expect(excelDateText(46328)).toBe('02.11.2026')
  })

  it('übernimmt aus prices.json nur bekannte und plausible Preise', () => {
    expect(
      parsePricesData({
        generatedAt: '2026-11-10T04:00:00Z',
        prices: {
          oilBulletin: { value: 1.7, period: 'Woche ab 02.11.2026' },
          depiPellets: { value: 46461, period: 'falsch gelesen' },
          unbekannt: { value: 1, period: '' },
          eurostatGas: { value: '0,11' },
        },
        failed: ['carmenWoodChips', 'unbekannt'],
      }),
    ).toEqual({
      generatedAt: '2026-11-10T04:00:00Z',
      prices: { oilBulletin: { value: 1.7, period: 'Woche ab 02.11.2026' } },
      failed: ['carmenWoodChips'],
    })
    expect(parsePricesData(null)).toBeUndefined()
    expect(isPlausible('eurostatElectricity', 0.36)).toBe(true)
    expect(isPlausible('eurostatElectricity', 36)).toBe(false)
  })
})
