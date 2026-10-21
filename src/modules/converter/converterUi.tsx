// Gemeinsame Bausteine der Umrechner-Ansichten

export const fieldClass = 'min-h-12 rounded-lg border-2 border-line bg-page px-3 text-lg'

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
  highlight?: boolean
}

export function ResultsTable({ title, rows }: { title: string; rows: ResultRow[] }) {
  if (rows.length === 0) return null
  return (
    <>
      <h2 className="mt-6 text-xl font-bold">{title}</h2>
      <table className="mt-2 w-full border-y-2 border-line text-lg" aria-live="polite">
        <tbody className="divide-y-2 divide-line">
          {rows.map((row) => (
            <tr key={row.key} className={row.highlight ? 'font-bold' : ''}>
              <td className="py-2 pr-3 text-right tabular-nums">{row.value}</td>
              <td className="py-2">{row.label}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
