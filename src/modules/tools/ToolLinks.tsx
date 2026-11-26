import { Link } from 'react-router'
import { DraftBadge } from '../../components/DraftBadge'
import { listCard } from '../../components/surfaces'
import type { ToolEntry } from './schema'
import { toolEntries, toolPath } from './tools'

interface ToolLinksProps {
  /** Tool-ids in der gewünschten Reihenfolge */
  ids: readonly string[]
  /** Für Tests überschreibbar */
  entries?: readonly ToolEntry[]
}

/** „Verwandte Tools“ am Seitenende; nur vorhandene Tools (im public-Build fehlen interne) */
export function ToolLinks({ ids, entries = toolEntries }: ToolLinksProps) {
  const tools = ids.flatMap((id) => entries.find((entry) => entry.id === id) ?? [])
  if (tools.length === 0) return null
  return (
    <section className="mt-8 print:hidden">
      <h2 className="text-xl font-bold">Verwandte Tools</h2>
      <ul className={`mt-2 ${listCard}`}>
        {tools.map((entry) => (
          <li key={entry.id}>
            <Link to={toolPath(entry.id)} className="flex min-h-14 items-center justify-between gap-3 px-4 py-2">
              <span>
                <span className="block font-semibold">{entry.title}</span>
                <span className="block text-base text-muted">{entry.summary}</span>
              </span>
              {entry.status === 'draft' && <DraftBadge variant="inline" />}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
