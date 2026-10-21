import { content } from '../../content'
import { CONVERTER_ID_PREFIX } from './constants'
import type { ConverterEntry } from './schema'

/** Alle Größen der aktuellen Edition, alphabetisch */
export const converterEntries: ConverterEntry[] = [...content.converter].sort((a, b) =>
  a.title.localeCompare(b.title, 'de'),
)

export function converterSlug(id: string): string {
  return id.slice(CONVERTER_ID_PREFIX.length + 1)
}

export function converterPath(id: string): string {
  return `/umrechner/${converterSlug(id)}`
}

export function findConverter(entries: readonly ConverterEntry[], slug: string | undefined) {
  if (!slug) return undefined
  const id = `${CONVERTER_ID_PREFIX}.${slug}`
  return entries.find((entry) => entry.id === id)
}
