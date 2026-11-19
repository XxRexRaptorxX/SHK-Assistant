import { useId, useLayoutEffect, useRef, useState } from 'react'
import { fieldBase } from '../../components/surfaces'
import { formatSignificant } from '../../lib/number'
import { ResultsTable, type ResultRow } from './converterUi'
import { listStatistics, parseNumberList, type ListStatistics } from './statistics'

const format = (value: number) => formatSignificant(value, 6)

function percent(fraction: number): string {
  // geschütztes Leerzeichen: „%“ bleibt beim Umbruch an der Zahl
  return `${formatSignificant(fraction * 100, 3)} %`
}

function removedText(removed: number): string {
  if (removed === 0) return 'nichts weggelassen'
  return removed === 1 ?'je 1 Wert weggelassen' : `je ${removed} Werte weggelassen`
}

function statisticRows(stats: ListStatistics): ResultRow[] {
  return [
    { key: 'mean', value: format(stats.mean), label: 'Durchschnitt', name: 'arithmetisches Mittel', highlight: true },
    { key: 'median', value: format(stats.median), label: 'Median', name: 'Zentralwert', highlight: true },
    ...stats.trimmed.map((trim) => ({
      key: `trim-${trim.fraction}`,
      value: format(trim.value),
      // geschütztes Leerzeichen: „Getrimmt 10 %“ bleibt in einer Zeile
      label: `Getrimmt ${percent(trim.fraction)}`,
      name: removedText(trim.removed),
    })),
  ]
}

function overviewRows(stats: ListStatistics): ResultRow[] {
  return [
    { key: 'count', value: String(stats.count), label: 'Anzahl' },
    { key: 'min', value: format(stats.min), label: 'Minimum' },
    { key: 'max', value: format(stats.max), label: 'Maximum' },
  ]
}

export function StatisticsConverter({ initialValue = '' }: { initialValue?: string }) {
  const id = useId()
  const [raw, setRaw] = useState(initialValue)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  // Feld startet zweizeilig und wächst mit dem Inhalt, damit nichts außerhalb des Sichtbereichs liegt
  useLayoutEffect(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    const border = textarea.offsetHeight - textarea.clientHeight
    textarea.style.height = `${textarea.scrollHeight + border}px`
  }, [raw])
  const { values, invalid } = parseNumberList(raw)
  const stats = invalid.length === 0 ? listStatistics(values) : undefined

  return (
    <section className="mt-2" aria-label="Zahlenliste auswerten">
      <label htmlFor={`${id}-list`} className="block font-semibold">
        Zahlenliste
      </label>
      <textarea
        id={`${id}-list`}
        ref={textareaRef}
        rows={2}
        inputMode="decimal"
        autoComplete="off"
        spellCheck={false}
        value={raw}
        aria-invalid={invalid.length > 0}
        aria-describedby={`${id}-hint`}
        onChange={(event) => setRaw(event.target.value)}
        className={`${fieldBase} mt-1 w-full min-w-0 resize-none overflow-hidden py-2`}
      />
      <p id={`${id}-hint`} className={`mt-1 text-base ${invalid.length > 0 ? 'font-semibold' : 'text-muted'}`}>
        {invalid.length > 0
          ? `Keine Zahl: ${invalid.join(', ')} (Werte mit Leerzeichen, Semikolon oder Zeilenumbruch trennen)`
          : 'Werte mit Leerzeichen, Semikolon oder Zeilenumbruch trennen, z. B. 62,5 64 61,8'}
      </p>
      <ResultsTable title="Ergebnis" rows={stats ? statisticRows(stats) : []} />
      <ResultsTable title="Werte" rows={stats ? overviewRows(stats) : []} />
    </section>
  )
}
