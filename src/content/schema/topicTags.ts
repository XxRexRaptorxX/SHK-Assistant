import { z } from 'zod'

// Themen-Tags: Fachgebiet, zu dem ein Tool oder Lexikon-Begriff gehört. Mehrere sind möglich.
// Wird auch von vite.config.ts geladen (über die Schemas): keine Importe aus dem UI-Code.

/** Alle Tags in Anzeigereihenfolge; die Farben stehen in src/components/TopicTags.tsx */
export const TOPIC_TAGS = [
  { key: 'heizung', label: 'Heizung' },
  { key: 'sanitaer', label: 'Sanitär' },
  { key: 'trinkwasser', label: 'Trinkwasser' },
  { key: 'abwasser', label: 'Abwasser' },
  { key: 'lueftung', label: 'Lüftung' },
  { key: 'klima', label: 'Klima' },
  { key: 'kaelte', label: 'Kälte' },
  { key: 'solar', label: 'Solar' },
  { key: 'strom', label: 'Strom' },
  { key: 'kundendienst', label: 'Kundendienst' },
  /** Planung, Normen, Aufmaß-Listen, Büroarbeit */
  { key: 'planung', label: 'Planung' },
  /** Nur wenn kein Fachgebiet passt, z. B. Einheiten, Physik, Werkzeuge */
  { key: 'allgemein', label: 'Allgemein' },
] as const

export type TopicTag = (typeof TOPIC_TAGS)[number]['key']

const TOPIC_TAG_KEYS = TOPIC_TAGS.map((tag) => tag.key) as [TopicTag, ...TopicTag[]]

/** Feld "tags" eines Tools oder Lexikon-Begriffs: mindestens ein Tag, keiner doppelt */
export const topicTagsSchema = z
  .array(z.enum(TOPIC_TAG_KEYS))
  .min(1, 'tags: mindestens ein Tag angeben')
  .refine((tags) => new Set(tags).size === tags.length, 'tags: Tag doppelt vergeben')

export const topicTagLabel = (tag: TopicTag): string => TOPIC_TAGS.find((entry) => entry.key === tag)!.label

/** Tags in der festen Reihenfolge von TOPIC_TAGS, unabhängig von der Reihenfolge im Inhalt */
export const sortTopicTags = (tags: readonly TopicTag[]): TopicTag[] =>
  TOPIC_TAG_KEYS.filter((key) => tags.includes(key))
