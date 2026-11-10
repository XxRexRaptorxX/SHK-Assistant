import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { converterEntries, converterSummaryParts } from './converter'
import { ConverterListPage, summaryText } from './ConverterListPage'

// Einheiten in der Umrechner-Liste: höchstens drei Zeilen, hintere Einheiten fallen weg (gemessen im Browser).

describe('Einheiten in der Umrechner-Liste', () => {
  it('kürzt hinten und endet dann mit „…“', () => {
    const parts = ['kWh', 'l Heizöl', 'm³ Erdgas', 'kWh Strom']
    expect(summaryText(parts, 4)).toBe('kWh · l Heizöl · m³ Erdgas · kWh Strom')
    expect(summaryText(parts, 2)).toBe('kWh · l Heizöl · …')
    // mindestens eine Einheit bleibt
    expect(summaryText(parts, 0)).toBe('kWh · …')
  })

  it('zeigt ohne Messung (Server, Tests) alle Einheiten', () => {
    const entry = converterEntries.find((candidate) => candidate.kind === 'factors')!
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <ConverterListPage entries={[entry]} hiddenIds={new Set()} />
      </MemoryRouter>,
    )
    expect(html).toContain(converterSummaryParts(entry).join(' · '))
    expect(converterSummaryParts(entry)).toHaveLength(entry.factors.length)
  })
})
