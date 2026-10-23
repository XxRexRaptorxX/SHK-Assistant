import { Link, useParams } from 'react-router'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { RichText } from '../../components/RichText'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { HideButton } from '../../hidden/HideButton'
import { FigureView } from '../figures/FigureView'
import { lexiconPathFor, unitNameFor } from '../lexicon/termLinks'
import { TermLink } from '../lexicon/TermLink'
import { math } from '../../lib/math'
import { formatUnit } from '../../lib/units'
import { listCard } from '../../components/surfaces'
import { DraftBadge } from '../../components/DraftBadge'
import { FractionIcon, LinearIcon } from '../../components/icons'
import { updateSettings, useSettings } from '../../settings/settings'
import { FormulaMath } from './FormulaMath'
import { usePageTitle } from '../../lib/usePageTitle'
import { ensureCustomUnits } from '../units/customUnits'
import { Calculator } from './Calculator'
import { BUILTIN_CONSTANTS, builtinConstantsUsed, formatExpression } from './engine'
import { findFormula, formulaEntries, formulaPath, relatedFormulas } from './formulas'
import { FormulaTitle } from './FormulaTitle'
import type { FormulaEntry } from './schema'

const BACK = { to: '/formeln', label: 'Formeln' }

ensureCustomUnits()

// Wird per React.lazy geladen, damit mathjs nicht im Start-Bundle landet.
export default function FormulaDetailPage({ entries = formulaEntries }: { entries?: FormulaEntry[] }) {
  const { slug } = useParams()
  const formula = findFormula(entries, slug)
  if (!formula) return <FormulaNotFound />

  return (
    <ContentPage
      entry={formula}
      title={formula.title}
      back={BACK}
      actions={
        <>
          <HideButton id={formula.id} title={formula.title} />
          <FavoriteButton id={formula.id} title={formula.title} />
        </>
      }
    >
      <RichText text={formula.description} />
      <FormulaBody formula={formula} />
      <RelatedFormulas formulas={relatedFormulas(formula, entries)} />
    </ContentPage>
  )
}

/** Skizze, Formelzeile, Legende und Rechner einer Formel (auch für Tools) */
export function FormulaBody({ formula }: { formula: FormulaEntry }) {
  const result = formula.result
  // Ergebnis zuerst, dann Eingaben und Konstanten
  const legend = [
    ...(result ? [result] : []).map((r) => ({
      key: `result-${r.symbol}`,
      label: r.label ?? r.symbol,
      name: r.name,
      nameHref: lexiconPathFor([r.name, r.term]),
      unit: r.unit ? formatUnit(r.unit) : '',
      unitHref: r.unit ? lexiconPathFor([unitNameFor(r.unit), formatUnit(r.unit)]) : undefined,
      detail: '',
    })),
    ...formula.variables.map((v) => ({
      key: v.symbol,
      label: v.label ?? v.symbol,
      name: v.name,
      nameHref: lexiconPathFor([v.name, v.term]),
      unit: v.unit ? formatUnit(v.unit) : '',
      unitHref: v.unit ? lexiconPathFor([unitNameFor(v.unit), formatUnit(v.unit)]) : undefined,
      detail: '',
    })),
    ...formula.constants.map((c) => ({
      key: c.symbol,
      label: c.label ?? c.symbol,
      name: c.name,
      nameHref: lexiconPathFor([c.name, c.term]),
      unit: '',
      unitHref: undefined,
      detail: constantDetail(c.label ?? c.symbol, c.value),
    })),
    // Eingebaute Konstanten wie π, damit jedes Zeichen der Formel erklärt ist
    ...builtinConstantsUsed(formula).map((symbol) => {
      const builtin = BUILTIN_CONSTANTS[symbol]!
      return {
        key: `builtin-${symbol}`,
        label: builtin.label,
        name: builtin.name,
        nameHref: lexiconPathFor([builtin.name]),
        unit: '',
        unitHref: undefined,
        detail: `≈ ${approximate(builtin.value)}`,
      }
    }),
  ]

  return (
    <>
      {/* Skizze immer über der Formel */}
      <FigureView id={formula.figure} />

      {formula.expression === '' || !result ? (
        <p className="mt-4 font-semibold">Die Formel ist noch nicht hinterlegt.</p>
      ) : (
        <>
          <FormulaLine formula={formula} resultLabel={result.label ?? result.symbol} />
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
            {legend.map((item) => (
              <div key={item.key} className="contents">
                <dt className="font-mono font-semibold">{item.label}</dt>
                <dd>
                  <TermLink to={item.nameHref}>{item.name}</TermLink>
                  {item.unit && (
                    <span className="text-muted">
                      {' ['}
                      <TermLink to={item.unitHref}>{item.unit}</TermLink>]
                    </span>
                  )}
                  {item.detail && <span className="text-muted"> {item.detail}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <Calculator key={formula.id} formula={formula} />
        </>
      )}
    </>
  )
}

/** Formelzeile: Standard Bruchschreibweise, rechts ein Knopf zum Umschalten auf linear (Einstellung) */
export function FormulaLine({ formula, resultLabel, linear: linearOverride }: {
  formula: FormulaEntry
  resultLabel: string
  /** Für Tests */
  linear?: boolean
}) {
  const settings = useSettings()
  const linear = linearOverride ?? settings.linearFormulas
  const label = linear ? 'Als Bruch anzeigen' : 'Linear anzeigen'
  const Icon = linear ? FractionIcon : LinearIcon
  return (
    <div className="mt-4 flex items-center gap-2 rounded-2xl border border-edge bg-surface py-2 pr-2 pl-4">
      <p className={`min-w-0 flex-1 overflow-x-auto py-2 text-xl ${linear ? 'font-mono' : ''}`}>
        {resultLabel} = {linear ? formatExpression(formula) : <FormulaMath formula={formula} />}
      </p>
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => updateSettings({ linearFormulas: !linear })}
        className="flex size-11 shrink-0 items-center justify-center self-start rounded-full border border-edge bg-raised text-muted print:hidden"
      >
        <Icon className="size-6" />
      </button>
    </div>
  )
}

/** Liste unter dem Rechner: Formeln mit gleicher Skizze, für die Eingaben und mit dem Ergebnis als Eingabe */
function RelatedFormulas({ formulas }: { formulas: FormulaEntry[] }) {
  if (formulas.length === 0) return null
  return (
    <section className="mt-8 print:hidden">
      <h2 className="text-xl font-bold">Verwandte Formeln</h2>
      <ul className={`mt-2 ${listCard}`}>
        {formulas.map((related) => (
          <li key={related.id}>
            <Link to={formulaPath(related.id)} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <span className="font-semibold">
                <FormulaTitle entry={related} />
              </span>
              {related.status === 'draft' && <DraftBadge variant="inline" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}

const approximateFormat = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 6 })
const approximate = (value: number) => approximateFormat.format(value)

/** "4.19 kJ/(kg K)" → "4,19 kJ/(kg·K)"; berechnete Werte wie "sqrt(3)" → "≈ 1,73205" */
export function formatConstant(value: string): string {
  const match = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\s*([^()]*)$/i.exec(value)
  if (match) {
    const [, number = '', unit = ''] = match
    return `${number.replace('.', ',')} ${formatUnit(unit)}`.trim()
  }
  try {
    const result: unknown = math.evaluate(value)
    if (typeof result === 'number') return `≈ ${approximate(result)}`
  } catch {
    // unbekannter Ausdruck: unverändert zeigen
  }
  return value
}

/** Wert einer Konstanten in der Legende; leer, wenn das Formelzeichen ihn schon zeigt (z. B. „360°“) */
export function constantDetail(label: string, value: string): string {
  const formatted = formatConstant(value)
  const compact = (text: string) => text.replace(/\s/g, '')
  if (compact(formatted) === compact(label)) return ''
  return formatted.startsWith('≈') ? formatted : `= ${formatted}`
}

function FormulaNotFound() {
  usePageTitle('Formel nicht gefunden')
  return (
    <>
      <BackLink to={BACK.to} label={BACK.label} />
      <h1 className="text-2xl font-bold">Formel nicht gefunden</h1>
      <p className="mt-2 text-muted">Diese Formel gibt es nicht (mehr).</p>
    </>
  )
}
