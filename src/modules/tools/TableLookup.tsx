import { useId, useState } from 'react'
import { HeadingWithClear } from '../../components/ClearInputsButton'
import { fieldBase } from '../../components/surfaces'
import { parseDecimal } from '../../lib/number'
import type { TableRow, TableTool } from './schema'

/** Zeilen, in deren Bereich der Wert liegt (Grenzen einschließlich); auch mehrere, z. B. aus verschiedenen Quellen */
export function matchingRows(tool: TableTool, value: number): TableRow[] {
  return tool.rows.filter((row) => (row.from === undefined || value >= row.from) && (row.to === undefined || value <= row.to))
}

type LookupState =
  | { kind: 'empty' }
  | { kind: 'invalid'; message: string }
  | { kind: 'rows'; rows: TableRow[] }

function lookup(tool: TableTool, raw: string): LookupState {
  if (raw.trim() === '') return { kind: 'empty' }
  const value = parseDecimal(raw)
  if (value === undefined) return { kind: 'invalid', message: 'Keine gültige Zahl (Beispiel: 1985)' }
  const { min, max } = tool.input
  if (min !== undefined && value < min) return { kind: 'invalid', message: `Der Wert muss mindestens ${min} sein.` }
  if (max !== undefined && value > max) return { kind: 'invalid', message: `Der Wert darf höchstens ${max} sein.` }
  return { kind: 'rows', rows: matchingRows(tool, value) }
}

/** Wert mit Einheit; „–“ (kein Wert) und Platzhalter bleiben ohne Einheit */
export const withUnit = (value: string, unit: string) =>
  unit && value !== '–' && !value.startsWith('TODO') ? `${value} ${unit}` : value
const withLabel = (name: string, label: string | undefined) => (label ? `${name} (${label})` : name)

/** Tabellen-Tool: eine Eingabe, dazu die passende(n) Zeile(n) und die ganze Tabelle zum Nachlesen */
export function TableLookup({ tool, initialValue = '' }: { tool: TableTool; initialValue?: string }) {
  const idPrefix = useId()
  const inputId = `${idPrefix}-input`
  const [raw, setRaw] = useState(initialValue)
  const state = lookup(tool, raw)
  const matched = state.kind === 'rows' ? state.rows : []

  return (
    <>
      <section className="mt-6" aria-labelledby={`${idPrefix}-heading`}>
        <HeadingWithClear id={`${idPrefix}-heading`} onClear={() => setRaw('')} disabled={raw === ''}>
          Nachschlagen
        </HeadingWithClear>
        <label htmlFor={inputId} className="mt-3 block font-semibold">
          {withUnit(tool.input.name, tool.input.unit ? `(${tool.input.unit})` : '')}
        </label>
        <input
          id={inputId}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          value={raw}
          aria-invalid={state.kind === 'invalid'}
          onChange={(event) => setRaw(event.target.value)}
          className={`${fieldBase} mt-1 w-full max-w-xs ${state.kind === 'invalid' ? 'border-warn-ink outline-2 outline-warn' : ''}`}
        />

        <div className="mt-5 space-y-3" aria-live="polite">
          {state.kind === 'empty' && (
            <p className="rounded-2xl border-2 border-accent bg-surface p-4 text-base text-muted">
              {tool.input.name} eingeben.
            </p>
          )}
          {state.kind === 'invalid' && (
            <p className="rounded-2xl border-2 border-accent bg-surface p-4 font-semibold">{state.message}</p>
          )}
          {state.kind === 'rows' && matched.length === 0 && (
            <p className="rounded-2xl border-2 border-accent bg-surface p-4 font-semibold">
              Für diesen Wert enthält die Tabelle keine Angabe.
            </p>
          )}
          {matched.map((row) => (
            <div key={row.label + row.note} className="rounded-2xl border-2 border-accent bg-surface p-4">
              <p className="font-semibold">
                {row.label}
                {row.note && <span className="font-normal text-muted"> {row.note}</span>}
              </p>
              <dl className="mt-2 space-y-1">
                {tool.columns.map((column) => (
                  <div key={column.key} className="flex flex-wrap items-baseline justify-between gap-x-3">
                    <dt className="text-base text-muted">{column.name}</dt>
                    <dd className="text-2xl font-bold">
                      {column.label && `${column.label} = `}
                      {withUnit(row.values[column.key] ?? '–', column.unit)}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6" aria-labelledby={`${idPrefix}-table`}>
        <h2 id={`${idPrefix}-table`} className="text-xl font-bold">
          Alle Werte
        </h2>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-edge bg-surface">
          <table className="w-full text-left text-sm min-[400px]:text-base">
            <thead>
              <tr className="border-b border-edge">
                <th scope="col" className="px-1.5 py-2 min-[400px]:px-2">
                  {tool.input.name}
                </th>
                {tool.columns.map((column) => (
                  <th key={column.key} scope="col" className="px-1.5 py-2 min-[400px]:px-2">
                    {withLabel(column.name, column.label)}
                    {column.unit && <span className="block text-sm font-normal text-muted">{column.unit}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-edge">
              {tool.rows.map((row) => (
                <tr
                  key={row.label + row.note}
                  className={matched.includes(row) ? 'bg-raised font-semibold' : undefined}
                  aria-current={matched.includes(row) ? 'true' : undefined}
                >
                  <th scope="row" className="px-1.5 py-2 align-top whitespace-nowrap min-[400px]:px-2">
                    {row.label}
                    {row.note && <span className="text-xs font-normal text-muted min-[400px]:text-sm"> {row.note}</span>}
                  </th>
                  {tool.columns.map((column) => (
                    <td key={column.key} className="px-1.5 py-2 align-top min-[400px]:px-2">
                      {row.values[column.key] ?? '–'}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}
