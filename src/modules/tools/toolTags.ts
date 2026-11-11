import { z } from 'zod'

// Themen-Tags der Tools: Fachgebiet, zu dem ein Tool gehört. Ein Tool kann mehrere haben.
// Wird auch von vite.config.ts geladen (über die Tool-Schemas): keine Importe aus dem UI-Code.

/** Alle Tags in Anzeigereihenfolge; die Farben stehen in ToolTagList.tsx */
export const TOOL_TAGS = [
  { key: 'heizung', label: 'Heizung' },
  { key: 'sanitaer', label: 'Sanitär' },
  { key: 'lueftung', label: 'Lüftung' },
  { key: 'klima', label: 'Klima' },
  { key: 'kaelte', label: 'Kälte' },
  { key: 'solar', label: 'Solar' },
  { key: 'strom', label: 'Strom' },
  { key: 'kundendienst', label: 'Kundendienst' },
  { key: 'buero', label: 'Büro' },
] as const

export type ToolTag = (typeof TOOL_TAGS)[number]['key']

const TOOL_TAG_KEYS = TOOL_TAGS.map((tag) => tag.key) as [ToolTag, ...ToolTag[]]

/** Feld "tags" eines Tools: mindestens ein Tag, keiner doppelt */
export const toolTagsSchema = z
  .array(z.enum(TOOL_TAG_KEYS))
  .min(1, 'tags: mindestens ein Tag angeben')
  .refine((tags) => new Set(tags).size === tags.length, 'tags: Tag doppelt vergeben')

export const toolTagLabel = (tag: ToolTag): string => TOOL_TAGS.find((entry) => entry.key === tag)!.label

/** Tags in der festen Reihenfolge von TOOL_TAGS, unabhängig von der Reihenfolge im Inhalt */
export const sortToolTags = (tags: readonly ToolTag[]): ToolTag[] =>
  TOOL_TAG_KEYS.filter((key) => tags.includes(key))
