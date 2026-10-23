import type { FormulaEntry } from './schema'

/** Name der Formel, dahinter grau das Formelzeichen des Ergebnisses (z. B. „Kreisfläche  A“) */
export function FormulaTitle({ entry }: { entry: Pick<FormulaEntry, 'title' | 'result'> }) {
  const symbol = entry.result && (entry.result.label ?? entry.result.symbol)
  return (
    <>
      {entry.title}
      {symbol && <span className="ml-2 font-normal text-muted">{symbol}</span>}
    </>
  )
}
