import { modules } from '../../app/modules'
import { content } from '../../content'
import type { SearchDocument } from '../../search/search'
import { TOOL_ID_PREFIX } from './constants'
import { isTableTool, type FormulaTool, type ToolEntry } from './schema'

/** Alle Tools der aktuellen Edition, alphabetisch */
export const toolEntries: ToolEntry[] = [...content.tools].sort((a, b) => a.title.localeCompare(b.title, 'de'))

/** Nur die Tools mit Formel und Rechner */
export const formulaToolEntries: FormulaTool[] = toolEntries.filter((entry) => !isTableTool(entry))

/** Was ein Tool liefert, z. B. „Ausgerollte Länge“ oder „Heizlast, Wärmebedarf“ */
export function toolResultNames(entry: ToolEntry): string | undefined {
  return isTableTool(entry) ? entry.columns.map((column) => column.name).join(', ') : entry.result?.name
}

export const toolSlug = (id: string) => id.slice(TOOL_ID_PREFIX.length + 1)
export const toolPath = (id: string) => `${modules.tools.path}/${toolSlug(id)}`

export function findTool(entries: readonly ToolEntry[], slug: string | undefined): ToolEntry | undefined {
  return slug ? entries.find((entry) => entry.id === `${TOOL_ID_PREFIX}.${slug}`) : undefined
}

export function toolSearchDocuments(entries: readonly ToolEntry[] = toolEntries): SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    moduleTitle: modules.tools.title,
    title: entry.title,
    subtitle: toolResultNames(entry),
    keywords: isTableTool(entry)
      ? [entry.input.name, ...entry.columns.map((column) => column.name), ...entry.rows.map((row) => row.note)]
      : entry.variables.map((variable) => variable.name),
    text: entry.description,
    path: toolPath(entry.id),
    status: entry.status,
  }))
}
