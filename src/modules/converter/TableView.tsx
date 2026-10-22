import { useState } from 'react'
import { SearchInput } from '../../components/SearchInput'
import { normalizeForSearch } from '../../lib/text'
import type { ConverterEntry } from './schema'

/** Nachschlagetabelle mit Filter über alle Zellen */
export function TableView({ entry, initialQuery = '' }: { entry: ConverterEntry; initialQuery?: string }) {
  const [query, setQuery] = useState(initialQuery)
  const needle = normalizeForSearch(query)
  const rows = needle === '' ? entry.rows : entry.rows.filter((row) => row.some((cell) => normalizeForSearch(cell).includes(needle)))

  if (entry.rows.length === 0) {
    return <p className="mt-2 font-semibold">TODO: Inhalt fehlt – die Tabelle ist noch nicht hinterlegt.</p>
  }

  return (
    <section className="mt-2" aria-label={entry.title}>
      <SearchInput id="table-filter" label="Tabelle filtern" value={query} onChange={setQuery} placeholder="Filtern …" />
      <div className="mt-3 overflow-x-auto rounded-2xl border border-edge bg-surface">
        <table className="w-full text-lg">
          <thead>
            <tr className="border-b-2 border-line bg-raised text-left">
              {entry.columns.map((column) => (
                <th key={column} scope="col" className="px-4 py-2 font-bold">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-edge">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-2 whitespace-nowrap tabular-nums">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 0 && <p className="mt-3">Keine passenden Zeilen.</p>}
    </section>
  )
}
