import { useMemo } from 'react'
import { content } from '../../content'
import type { TopicTag } from '../../content/schema/topicTags'
import { useSettings } from '../../settings/settings'
import type { ModeEntry } from './schema'

// Modi filtern die Listen von Tools und Formeln (und die Zahlen auf der Startseite).
// Die Suche und die Favoriten zeigen immer alles.

/** Alle Modi in der Reihenfolge der Einstellungen */
export const modeEntries: ModeEntry[] = [...content.modes].sort(
  (a, b) => a.order - b.order || a.title.localeCompare(b.title, 'de'),
)

/** Was ein Modus zum Filtern braucht: id und Themen-Tags */
export interface ModeFilterable {
  id: string
  tags?: readonly TopicTag[]
}

/** Trifft die id selbst oder eine davon abgeleitete (umgestellte Formel „….nach-x“, Tool-Variante) */
const listsId = (ids: readonly string[], id: string) => ids.some((other) => id === other || id.startsWith(`${other}.`))

/** Einträge, die Modi überhaupt filtern; alle anderen (z. B. Umrechner) zeigt jeder Modus */
export const isModeFiltered = (id: string): boolean => id.startsWith('tool.') || id.startsWith('formula.')

export function matchesMode(item: ModeFilterable, mode: ModeEntry): boolean {
  if (listsId(mode.exclude, item.id)) return false
  if (listsId(mode.include, item.id)) return true
  return (item.tags ?? []).some((tag) => mode.tags.includes(tag))
}

/** Ohne gewählten Modus („Alles“) erscheint alles, sonst was zu mindestens einem Modus passt */
export function matchesModes(item: ModeFilterable, modes: readonly ModeEntry[]): boolean {
  return modes.length === 0 || modes.some((mode) => matchesMode(item, mode))
}

/** Gewählte Modi aus den gespeicherten ids; unbekannte ids (z. B. gelöschte Modi) fallen weg */
export function resolveModes(ids: readonly string[], entries: readonly ModeEntry[] = modeEntries): ModeEntry[] {
  return entries.filter((mode) => ids.includes(mode.id))
}

/** Gewählte Modi; leer bedeutet „Alles“ */
export function useActiveModes(): ModeEntry[] {
  const { modes } = useSettings()
  return useMemo(() => resolveModes(modes), [modes])
}

/** Schaltet einen Modus in der Auswahl an oder aus */
export function toggleModeId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((other) => other !== id) : [...ids, id]
}
