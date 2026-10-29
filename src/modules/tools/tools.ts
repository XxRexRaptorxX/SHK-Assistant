import { modules } from '../../app/modules'
import { content } from '../../content'
import type { SearchDocument } from '../../search/search'
import { TOOL_ID_PREFIX } from './constants'
import type { FormulaEntry } from '../formulas/schema'
import { isChoiceTool, isFactorTool, isFormulaTool, isTableTool, isVariantTool, type ToolEntry } from './schema'
import { variantFormulas } from './variantTool'

/** Alle Tools der aktuellen Edition, alphabetisch */
export const toolEntries: ToolEntry[] = [...content.tools].sort((a, b) => a.title.localeCompare(b.title, 'de'))

/** Alle Formeln mit Rechner aus den Tools, auch die Varianten (Kennung „tool.x.variante“) */
export const formulaToolEntries: FormulaEntry[] = toolEntries.flatMap((entry) =>
  isFormulaTool(entry) ? [entry] : isVariantTool(entry) ? variantFormulas(entry) : [],
)

/** Was ein Tool liefert, z. B. „Ausgerollte Länge“ oder „Heizlast, Wärmebedarf“ */
export function toolResultNames(entry: ToolEntry): string | undefined {
  if (isTableTool(entry)) return entry.columns.map((column) => column.name).join(', ')
  if (isChoiceTool(entry)) return entry.sections.map((section) => section.title).join(', ')
  if (isFactorTool(entry)) return entry.results.map((result) => result.name).join(', ')
  if (isVariantTool(entry)) {
    return [...new Set(entry.variants.flatMap((variant) => (variant.result ? [variant.result.name] : [])))].join(', ')
  }
  return entry.result?.name
}

export const toolSlug = (id: string) => id.slice(TOOL_ID_PREFIX.length + 1)
export const toolPath = (id: string) => `${modules.tools.path}/${toolSlug(id)}`

export function findTool(entries: readonly ToolEntry[], slug: string | undefined): ToolEntry | undefined {
  return slug ? entries.find((entry) => entry.id === `${TOOL_ID_PREFIX}.${slug}`) : undefined
}

/** Suchbegriffe: Eingaben, Spalten und bei Auswahl-Tools die Optionen mit ihren Werten, z. B. Raumnamen */
function toolKeywords(entry: ToolEntry): string[] {
  if (isTableTool(entry)) {
    return [entry.input.name, ...entry.columns.map((column) => column.name), ...entry.rows.map((row) => row.note)]
  }
  if (isChoiceTool(entry)) {
    return [
      ...entry.bars.flatMap((bar) => bar.options.flatMap((option) => [option.label, option.note])),
      ...entry.sections.flatMap((section) => [
        section.title,
        section.inputName,
        ...section.columns.map((column) => column.name),
        ...section.options.flatMap((option) => [option.label, option.note, ...Object.values(option.values)]),
      ]),
    ]
  }
  if (isFactorTool(entry)) {
    return [
      ...entry.inputs.map((input) => input.name),
      ...entry.choices.flatMap((choice) => [choice.name, ...choice.options.map((option) => option.label)]),
      ...entry.results.map((result) => result.name),
    ]
  }
  if (isVariantTool(entry)) {
    return entry.variants.flatMap((variant) => [
      variant.label,
      variant.title,
      ...variant.variables.map((variable) => variable.name),
    ])
  }
  return entry.variables.map((variable) => variable.name)
}

export function toolSearchDocuments(entries: readonly ToolEntry[] = toolEntries): SearchDocument[] {
  return entries.map((entry) => ({
    id: entry.id,
    moduleTitle: modules.tools.title,
    title: entry.title,
    subtitle: toolResultNames(entry),
    keywords: toolKeywords(entry),
    text: entry.description,
    path: toolPath(entry.id),
    status: entry.status,
  }))
}
