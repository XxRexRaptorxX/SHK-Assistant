import type { ConverterEntry } from './schema'
import { fieldBase } from '../../components/surfaces'

// Gemeinsame Bausteine der Umrechner-Ansichten

/** Name mit grauem Formelzeichen dahinter, z. B. „Fläche A“ */
export function ConverterTitle({ entry }: { entry: Pick<ConverterEntry, 'title' | 'symbol'> }) {
  return (
    <>
      {entry.title}
      {entry.symbol && <span className="ml-2 font-normal text-muted">{entry.symbol}</span>}
    </>
  )
}

export const fieldClass = fieldBase

export function Select<T extends string>({ id, label, options, value, onChange }: {
  id: string
  label: string
  options: readonly { value: T; label: string }[]
  value: T
  onChange: (value: T) => void
}) {
  return (
    <select
      id={id}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className={`${fieldClass} min-w-28 shrink-0`}
    >
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function ValueInput({ id, value, onChange, invalid, hint = 'Beispiel: 12,5', inputMode = 'decimal' }: {
  id: string
  value: string
  onChange: (value: string) => void
  invalid: boolean
  hint?: string
  inputMode?: 'decimal' | 'text'
}) {
  return (
    <>
      <input
        id={id}
        type="text"
        inputMode={inputMode}
        autoComplete="off"
        value={value}
        aria-invalid={invalid}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`${fieldClass} w-full min-w-0`}
      />
      {invalid && (
        <p id={`${id}-error`} className="mt-1 basis-full text-base font-semibold">
          Ungültige Eingabe ({hint})
        </p>
      )}
    </>
  )
}

export interface ResultRow {
  key: string
  value: string
  label: string
  /** Ausgeschriebener Name, grau hinter der Einheit */
  name?: string
  highlight?: boolean
}

/** Name nur, wenn eingeschaltet und nicht gleich der Kurzform (z. B. „Tag“) */
export function displayName(names: Record<string, string>, key: string, label: string, show: boolean): string | undefined {
  const name = names[key]
  return show && name && name.toLowerCase() !== label.toLowerCase() ? name : undefined
}

export function ResultsTable({ title, rows, wrapValues = false }: {
  title: string
  rows: ResultRow[]
  /** Lange Werte ohne Leerzeichen umbrechen (z. B. Hexadezimalzahlen); sonst bleiben Zahlen zusammen */
  wrapValues?: boolean
}) {
  if (rows.length === 0) return null
  return (
    <>
      <h2 className="mt-6 text-xl font-bold">{title}</h2>
      <div className="mt-2 overflow-hidden rounded-2xl border border-edge bg-surface">
        <table className="w-full text-lg" aria-live="polite">
          <tbody className="divide-y divide-edge">
            {rows.map((row) => (
              <tr key={row.key} className={row.highlight ? 'bg-raised font-bold' : ''}>
                <td className={`py-2 pr-3 pl-4 text-right tabular-nums ${wrapValues ? '[overflow-wrap:anywhere]' : ''}`}>
                  {row.value}
                </td>
                <td className="py-2 pr-4">
                  {row.label}
                  {row.name && <span className="ml-2 text-base font-normal text-muted hyphens-auto">{row.name}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
