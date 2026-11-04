import { modules } from '../../app/modules'
import { content } from '../../content'
import type { SearchDocument } from '../../search/search'
import { TOOL_ID_PREFIX } from './constants'
import { groupFormulasByCategory } from '../formulas/formulas'
import type { FormulaEntry } from '../formulas/schema'
import { cableKeywords } from './cableTool'
import { normFinderKeywords } from './normFinderTool'
import {
  isCableTool,
  isChoiceTool,
  isFactorTool,
  isFormulaTool,
  isNormFinderTool,
  isSequenceTool,
  isSymbolTool,
  isTableTool,
  isVariantTool,
  isWireColorTool,
  isWorkHoursTool,
  type ToolEntry,
} from './schema'
import { sequenceKeywords } from './sequenceTool'
import { symbolKeywords } from './symbolTool'
import { variantFormulas } from './variantTool'
import { wireColorKeywords } from './wireColorTool'

/** Alle Tools der aktuellen Edition, alphabetisch */
export const toolEntries: ToolEntry[] = [...content.tools].sort((a, b) => a.title.localeCompare(b.title, 'de'))

/** Alle Formeln mit Rechner aus den Tools, auch die Varianten (Kennung „tool.x.variante“) */
export const formulaToolEntries: FormulaEntry[] = toolEntries.flatMap((entry) =>
  isFormulaTool(entry) ? [entry] : isVariantTool(entry) ? variantFormulas(entry) : [],
)

/** Reihenfolge der Kategorien in der Tool-Liste; nicht genannte stehen danach, alphabetisch */
export const TOOL_CATEGORY_ORDER = ['Montage', 'Wartung', 'Demonstration', 'Aufmaß', 'Auslegung', 'Planung', 'Organisation']

/** Tools je Kategorie für die Liste; innerhalb einer Kategorie bleibt die Reihenfolge der Einträge */
export function groupToolsByCategory<T extends { category: string }>(entries: readonly T[]): { category: string; entries: T[] }[] {
  const rank = (category: string) => {
    const index = TOOL_CATEGORY_ORDER.indexOf(category)
    return index === -1 ? TOOL_CATEGORY_ORDER.length : index
  }
  return groupFormulasByCategory(entries).sort((a, b) => rank(a.category) - rank(b.category))
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
      ...entry.choices.flatMap((choice) => [
        choice.name,
        ...choice.options.flatMap((option) => (option.info ? [option.label, option.info] : [option.label])),
      ]),
      ...entry.results.map((result) => result.name),
    ]
  }
  if (isSymbolTool(entry)) return symbolKeywords(entry)
  if (isSequenceTool(entry)) return sequenceKeywords(entry)
  if (isCableTool(entry)) return cableKeywords(entry)
  if (isWireColorTool(entry)) return wireColorKeywords(entry)
  if (isNormFinderTool(entry)) return normFinderKeywords(entry)
  if (isWorkHoursTool(entry)) return entry.keywords
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
    subtitle: entry.summary,
    keywords: toolKeywords(entry),
    text: `${entry.summary} ${entry.description}`,
    path: toolPath(entry.id),
    status: entry.status,
  }))
}
