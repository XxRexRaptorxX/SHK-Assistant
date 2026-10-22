import { useParams } from 'react-router'
import { BackLink, ContentPage } from '../../components/ContentPage'
import { RichText } from '../../components/RichText'
import { FavoriteButton } from '../../favorites/FavoriteButton'
import { HideButton } from '../../hidden/HideButton'
import { formatUnit } from '../../lib/units'
import { usePageTitle } from '../../lib/usePageTitle'
import { ensureCustomUnits } from '../units/customUnits'
import { Calculator } from './Calculator'
import { formatExpression } from './engine'
import { findFormula, formulaEntries } from './formulas'
import type { FormulaEntry } from './schema'

const BACK = { to: '/formeln', label: 'Formeln' }

ensureCustomUnits()

// Wird per React.lazy geladen, damit mathjs nicht im Start-Bundle landet.
export default function FormulaDetailPage({ entries = formulaEntries }: { entries?: FormulaEntry[] }) {
  const { slug } = useParams()
  const formula = findFormula(entries, slug)
  if (!formula) return <FormulaNotFound />

  const result = formula.result
  const legend = [
    ...formula.variables.map((v) => ({
      key: v.symbol,
      label: v.label ?? v.symbol,
      name: v.name,
      detail: v.unit ? `[${formatUnit(v.unit)}]` : '',
    })),
    ...formula.constants.map((c) => ({
      key: c.symbol,
      label: c.label ?? c.symbol,
      name: c.name,
      detail: `= ${formatConstant(c.value)}`,
    })),
  ]

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

      {formula.expression === '' || !result ? (
        <p className="mt-4 font-semibold">Die Formel ist noch nicht hinterlegt.</p>
      ) : (
        <>
          <p className="mt-4 overflow-x-auto rounded-2xl border border-edge bg-surface p-4 font-mono text-xl">
            {result.label ?? result.symbol} = {formatExpression(formula)}
          </p>
          <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-base">
            {legend.map((item) => (
              <div key={item.key} className="contents">
                <dt className="font-mono font-semibold">{item.label}</dt>
                <dd>
                  {item.name}
                  {item.detail && <span className="text-muted"> {item.detail}</span>}
                </dd>
              </div>
            ))}
          </dl>
          <Calculator key={formula.id} formula={formula} />
        </>
      )}
    </ContentPage>
  )
}

/** "4.19 kJ/(kg K)" → "4,19 kJ/(kg·K)" */
export function formatConstant(value: string): string {
  const match = /^([+-]?\d*\.?\d+(?:e[+-]?\d+)?)\s*(.*)$/i.exec(value)
  if (!match) return value
  const [, number = '', unit = ''] = match
  return `${number.replace('.', ',')} ${formatUnit(unit)}`.trim()
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
