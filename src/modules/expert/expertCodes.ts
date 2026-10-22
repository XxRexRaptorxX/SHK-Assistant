import { content } from '../../content'
import { normalizeForSearch } from '../../lib/text'
import type { ExpertCodeEntry } from './schema'

/** Alle Codes der aktuellen Edition, alphabetisch nach Name (in der public-Edition leer) */
export const expertCodeEntries: ExpertCodeEntry[] = sortExpertCodes(content.expertCodes)

export function sortExpertCodes(entries: readonly ExpertCodeEntry[]): ExpertCodeEntry[] {
  return [...entries].sort((a, b) => plainText(a.name).localeCompare(plainText(b.name), 'de'))
}

/** normal; dark = [eckige Klammern] dunkelgrau; light = (runde Klammern) hellgrau */
export type Shade = 'normal' | 'dark' | 'light'

export interface TextPart {
  text: string
  shade: Shade
}

/** "[Bsp.:] (1)[9]" → "Bsp.:" dunkelgrau, "1" hellgrau, "9" dunkelgrau; die Klammern selbst entfallen */
export function splitShades(text: string): TextPart[] {
  const parts: TextPart[] = []
  let last = 0
  for (const match of text.matchAll(/\[([^[\]()]*)\]|\(([^[\]()]*)\)/g)) {
    if (match.index > last) parts.push({ text: text.slice(last, match.index), shade: 'normal' })
    const dark = match[1] !== undefined
    const inner = dark ? match[1] : match[2]
    if (inner) parts.push({ text: inner, shade: dark ? 'dark' : 'light' })
    last = match.index + match[0].length
  }
  if (last < text.length) parts.push({ text: text.slice(last), shade: 'normal' })
  return parts
}

/** Text ohne Klammern, z. B. für Suche und Sortierung */
export function plainText(text: string): string {
  return splitShades(text)
    .map((part) => part.text)
    .join('')
}

/** Filtert nach dem Namen (Teilwort, Groß-/Kleinschreibung und Umlaute egal) */
export function filterExpertCodes(entries: readonly ExpertCodeEntry[], query: string): ExpertCodeEntry[] {
  const needle = normalizeForSearch(query)
  if (needle === '') return [...entries]
  return entries.filter((entry) => normalizeForSearch(plainText(entry.name)).includes(needle))
}
