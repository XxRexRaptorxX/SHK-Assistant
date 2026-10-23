import { modules } from '../../app/modules'
import { content } from '../../content'
import type { SearchDocument } from '../../search/search'
import { TOOL_ID_PREFIX } from './constants'
import type { ToolEntry } from './schema'

/** Alle Tools der aktuellen Edition, alphabetisch */
export const toolEntries: ToolEntry[] = [...content.tools].sort((a, b) => a.title.localeCompare(b.title, 'de'))

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
    subtitle: entry.result?.name,
    keywords: entry.variables.map((variable) => variable.name),
    text: entry.description,
    path: toolPath(entry.id),
    status: entry.status,
  }))
}
