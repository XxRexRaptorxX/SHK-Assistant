import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router'
import { describe, expect, it } from 'vitest'
import { content } from '../../content'
import { checkFormula, evaluateExample } from './engine'
import FormulaDetailPage from './FormulaDetailPage'
import { FormulaListPage } from './FormulaListPage'
import { formulaEntries, formulaRearrangementGroups, formulaSlug, rearrangedIds } from './formulas'
import { rearrangedFormula, rearrangedId, rearrangementTargets } from './rearrangements'
import type { FormulaEntry } from './schema'

const byId = new Map(formulaEntries.map((entry) => [entry.id, entry]))
const bases = content.formulas.filter((entry) => (entry.rearrangements ?? []).length > 0)

const pageAt = (formula: FormulaEntry) =>
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/formeln/${formulaSlug(formula.id)}`]}>
      <Routes>
        <Route path="/formeln/:slug" element={<FormulaDetailPage />} />
      </Routes>
    </MemoryRouter>,
  )

describe('Umgestellte Formeln', () => {
  it('gibt es für viele Formeln', () => {
    expect(bases.length).toBeGreaterThan(30)
    expect(rearrangedIds.size).toBeGreaterThan(40)
  })

  it('rechnet jede Umstellung das Testbeispiel der Ausgangsformel rückwärts nach', () => {
    const failures: string[] = []
    for (const base of bases) {
      for (const item of base.rearrangements ?? []) {
        const target = item.formula ? byId.get(item.formula) : rearrangedFormula(base, item)
        if (!target) {
          failures.push(`${base.id} → ${item.symbol}: Formel fehlt`)
          continue
        }
        if (target.result?.symbol !== item.symbol) {
          failures.push(`${base.id} → ${item.symbol}: Ergebnis heißt "${target.result?.symbol}"`)
          continue
        }
        for (const example of base.examples) {
          const inputs = Object.fromEntries(
            target.variables.map((v) => [v.symbol, v.symbol === base.result!.symbol ? example.expected : example.inputs[v.symbol]]),
          )
          const missing = Object.entries(inputs).filter(([, value]) => value === undefined)
          if (missing.length > 0) {
            failures.push(`${base.id} → ${target.id}: Symbole passen nicht (${missing.map(([s]) => s).join(', ')})`)
            continue
          }
          const result = evaluateExample(target, {
            inputs: inputs as Record<string, number | string>,
            expected: example.inputs[item.symbol]!,
            tolerance: example.tolerance,
          })
          if (!result.ok) failures.push(`${base.id} → ${target.id}: erwartet ${result.expected}, berechnet ${result.actual}`)
        }
      }
    }
    expect(failures).toEqual([])
  })

  it('besteht als eigene Seite dieselben Prüfungen wie jede Formel', () => {
    const issues = formulaEntries
      .filter((entry) => rearrangedIds.has(entry.id))
      .flatMap((entry) => checkFormula(entry).map((issue) => `${entry.id}: ${issue}`))
    expect(issues).toEqual([])
  })

  it('übernimmt Quelle, Prüfstatus und Sichtbarkeit der Ausgangsformel', () => {
    for (const base of bases) {
      for (const item of (base.rearrangements ?? []).filter((r) => r.expression)) {
        const page = byId.get(rearrangedId(base, item.symbol))!
        expect(page).toMatchObject({
          source: base.source,
          status: base.status,
          visibility: base.visibility,
          verifiedBy: base.verifiedBy,
          verifiedAt: base.verifiedAt,
          category: base.category,
        })
      }
    }
  })

  it('verlinkt in beide Richtungen: Ausgangsformel → Umstellung und zurück', () => {
    const cop = byId.get('formula.heizungstechnik.leistungszahl-waermepumpe')!
    const pel = byId.get(rearrangedId(cop, 'Pel'))!
    const fromCop = rearrangementTargets(cop, formulaRearrangementGroups)
    expect(fromCop.get('Pel')?.id).toBe(pel.id)
    expect(fromCop.get('QdotH')?.id).toBe(rearrangedId(cop, 'QdotH'))
    const fromPel = rearrangementTargets(pel, formulaRearrangementGroups)
    expect(fromPel.get('eps')?.id).toBe(cop.id)
    expect(fromPel.get('QdotH')?.id).toBe(rearrangedId(cop, 'QdotH'))
  })

  it('verbindet vorhandene Formeln wie das ohmsche Gesetz untereinander', () => {
    const current = byId.get('formula.elektrotechnik.ohmsches-gesetz-stromstaerke')!
    const targets = rearrangementTargets(current, formulaRearrangementGroups)
    expect(targets.get('U')?.id).toBe('formula.elektrotechnik.ohmsches-gesetz-spannung')
    expect(targets.get('R')?.id).toBe('formula.elektrotechnik.ohmsches-gesetz-widerstand')
  })

  it('zeigt in der Legende einen Knopf „umstellen“ zur umgestellten Seite', () => {
    const cop = byId.get('formula.heizungstechnik.leistungszahl-waermepumpe')!
    const html = pageAt(cop)
    expect(html).toContain(`href="/formeln/${formulaSlug(rearrangedId(cop, 'Pel'))}"`)
    expect(html).toContain('aria-label="Formel nach Elektrische Leistungsaufnahme umstellen"')
    const page = pageAt(byId.get(rearrangedId(cop, 'Pel'))!)
    expect(page).toContain('Elektrische Leistungsaufnahme einer Wärmepumpe')
    expect(page).toContain(`href="/formeln/${formulaSlug(cop.id)}"`)
  })

  it('stehen nur beim Filtern in der Formelliste', () => {
    const list = (query: string) =>
      renderToStaticMarkup(
        <MemoryRouter>
          <FormulaListPage initialQuery={query} hiddenIds={new Set()} />
        </MemoryRouter>,
      )
    expect(list('')).not.toContain('Elektrische Leistungsaufnahme einer Wärmepumpe')
    expect(list('Leistungsaufnahme')).toContain('Elektrische Leistungsaufnahme einer Wärmepumpe')
  })
})
