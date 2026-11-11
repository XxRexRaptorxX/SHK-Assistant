import { csvFile, csvText } from '../../lib/csv'
import { normalizeForSearch } from '../../lib/text'
import type { MaterialItem, MaterialList, MaterialMemoryRecord } from '../../storage/db'
import type { MaterialListTool } from './materialListTool'
import { headerCsvLines, headerTextLines, mailtoUrl, newId, projectLabel, touch } from './surveyCommon'

// Logik der Materialliste ohne Oberfläche und Speicher. Änderungen liefern eine neue Liste zurück.

export const MAX_QUANTITY = 9999
/** Datum in Kopf, Ausdruck und Export */
export const LIST_DATE_LABEL = 'Liste vom'
/** Höchstens so viele Vorschläge unter einem Feld */
export const SUGGESTION_LIMIT = 6

/** Eingabe eines Artikels im Formular */
export interface ItemDraft {
  name: string
  quantity: number
  /** Leer = Stück */
  unit: string
}

export const EMPTY_ITEM_DRAFT: ItemDraft = { name: '', quantity: 1, unit: '' }

export function createList(toolId: string, now: Date): MaterialList {
  const stamp = now.toISOString()
  return { id: newId(now), toolId, project: '', items: [], createdAt: stamp, updatedAt: stamp }
}

/** Noch nichts eingetragen: wird erst gespeichert, wenn etwas drinsteht */
export const isEmptyList = (list: MaterialList) =>
  list.project.trim() === '' && (list.note ?? '').trim() === '' && list.items.length === 0

export const clampQuantity = (value: number) =>
  Number.isFinite(value) ? Math.min(MAX_QUANTITY, Math.max(1, Math.round(value))) : 1

/** Bereinigte Eingabe (Leerzeichen, Menge 1 bis MAX_QUANTITY); undefined ohne Artikel */
export function cleanDraft(draft: ItemDraft): ItemDraft | undefined {
  const name = draft.name.trim()
  if (name === '') return undefined
  return { name, quantity: clampQuantity(draft.quantity), unit: draft.unit.trim() }
}

export const draftFromItem = (item: MaterialItem): ItemDraft => ({
  name: item.name,
  quantity: item.quantity,
  unit: item.unit ?? '',
})

const sameArticleKey = (name: string, unit: string | undefined) =>
  `${normalizeForSearch(name)}|${normalizeForSearch(unit ?? '')}`

function itemFromDraft(id: string, draft: ItemDraft): MaterialItem {
  return { id, name: draft.name, quantity: draft.quantity, ...(draft.unit ? { unit: draft.unit } : {}) }
}

/**
 * Fügt einen bereinigten Artikel (cleanDraft) hinzu. Steht derselbe Artikel mit gleicher Einheit noch offen auf der
 * Liste, wird nur dessen Menge erhöht.
 */
export function addItem(
  list: MaterialList,
  draft: ItemDraft,
  now: Date,
): { list: MaterialList; item: MaterialItem; merged: boolean } {
  const key = sameArticleKey(draft.name, draft.unit)
  const existing = list.items.find((item) => !item.doneAt && sameArticleKey(item.name, item.unit) === key)
  if (existing) {
    const item = { ...existing, quantity: clampQuantity(existing.quantity + draft.quantity) }
    const items = list.items.map((other) => (other.id === existing.id ? item : other))
    return { list: touch(list, { items }, now), item, merged: true }
  }
  const item = itemFromDraft(newId(now), draft)
  return { list: touch(list, { items: [...list.items, item] }, now), item, merged: false }
}

/** Ersetzt Artikel, Menge und Einheit; abgehakt bleibt abgehakt */
export function replaceItem(list: MaterialList, itemId: string, draft: ItemDraft, now: Date): MaterialList {
  const items = list.items.map((item) =>
    item.id === itemId ? { ...itemFromDraft(item.id, draft), ...(item.doneAt ? { doneAt: item.doneAt } : {}) } : item,
  )
  return touch(list, { items }, now)
}

/** Abhaken (done) oder wieder als fehlend markieren */
export function setItemDone(list: MaterialList, itemId: string, done: boolean, now: Date): MaterialList {
  const items = list.items.map((item) => {
    if (item.id !== itemId) return item
    const { doneAt: _old, ...rest } = item
    return done ? { ...rest, doneAt: now.toISOString() } : rest
  })
  return touch(list, { items }, now)
}

export const removeItem = (list: MaterialList, itemId: string, now: Date) =>
  touch(list, { items: list.items.filter((item) => item.id !== itemId) }, now)

export const removeDoneItems = (list: MaterialList, now: Date) =>
  touch(list, { items: list.items.filter((item) => !item.doneAt) }, now)

/** Noch fehlendes Material in der eingegebenen Reihenfolge */
export const openItems = (list: MaterialList) => list.items.filter((item) => !item.doneAt)
export const doneItems = (list: MaterialList) => list.items.filter((item) => item.doneAt)

/** Menge mit Einheit, z. B. „3 m“; ohne Einheit „2 ד */
export const quantityText = (item: MaterialItem) => (item.unit ? `${item.quantity} ${item.unit}` : `${item.quantity} ×`)
export const itemLine = (item: MaterialItem) => `${quantityText(item)} ${item.name}`

/** Stand für die Übersicht der gespeicherten Listen */
export function listStatus(list: MaterialList): string {
  const open = openItems(list).length
  const done = list.items.length - open
  if (list.items.length === 0) return 'noch leer'
  if (open === 0) return 'alles erledigt'
  return done > 0 ? `${open} offen, ${done} erledigt` : `${open} offen`
}

// Gedächtnis für die Vervollständigung: Bauvorhaben und Artikel, unabhängig von den Listen

export const memoryKey = (kind: MaterialMemoryRecord['kind'], text: string) => `${kind}:${normalizeForSearch(text)}`

/** Was nach dem Hinzufügen eines Artikels gemerkt wird: Bauvorhaben (wenn eingetragen) und der Artikel mit Einheit */
export function memoryRecords(project: string, draft: ItemDraft | undefined, now: Date): MaterialMemoryRecord[] {
  const usedAt = now.toISOString()
  const records: MaterialMemoryRecord[] = []
  const name = project.trim()
  if (name) records.push({ key: memoryKey('project', name), kind: 'project', text: name, usedAt })
  if (draft) {
    records.push({
      key: memoryKey('article', draft.name),
      kind: 'article',
      text: draft.name,
      ...(draft.unit ? { unit: draft.unit } : {}),
      usedAt,
    })
  }
  return records
}

/** Neue Einträge ersetzen gemerkte mit gleichem Schlüssel */
export function mergeMemory(
  current: readonly MaterialMemoryRecord[],
  next: readonly MaterialMemoryRecord[],
): MaterialMemoryRecord[] {
  const keys = new Set(next.map((record) => record.key))
  return [...current.filter((record) => !keys.has(record.key)), ...next]
}

/** Gemerkte Texte passend zur Eingabe, der zuletzt genutzte zuerst; ohne den schon vollständig eingegebenen */
export function suggestionsFor(
  memory: readonly MaterialMemoryRecord[],
  kind: MaterialMemoryRecord['kind'],
  query: string,
  limit = SUGGESTION_LIMIT,
): string[] {
  const typed = normalizeForSearch(query)
  return memory
    .filter((record) => record.kind === kind)
    .sort((a, b) => b.usedAt.localeCompare(a.usedAt))
    .filter((record) => {
      const key = normalizeForSearch(record.text)
      return key !== typed && key.includes(typed)
    })
    .slice(0, limit)
    .map((record) => record.text)
}

/** Zuletzt genutzte Einheit eines gemerkten Artikels */
export const rememberedUnit = (memory: readonly MaterialMemoryRecord[], name: string) =>
  memory.find((record) => record.key === memoryKey('article', name))?.unit

// Weitergeben

/** Die Liste als Text für die E-Mail; erledigte nur gezählt, wenn withDone false ist */
export function listText(tool: MaterialListTool, list: MaterialList, withDone = true): string {
  const open = openItems(list)
  const done = doneItems(list)
  const lines = [
    ...headerTextLines(tool.title, list, LIST_DATE_LABEL),
    '',
    'Mitnehmen:',
    ...(open.length > 0 ? open.map((item) => `- ${itemLine(item)}`) : ['- nichts mehr offen']),
  ]
  if (done.length > 0) {
    lines.push('', 'Erledigt:')
    if (withDone) lines.push(...done.map((item) => `- ${itemLine(item)}`))
    else lines.push(`${done.length} Artikel, hier nicht aufgeführt.`)
  }
  return lines.join('\r\n')
}

/** mailto-Adresse mit der Liste im Text; ist sie zu lang, fehlen die erledigten Artikel */
export function listMailto(tool: MaterialListTool, list: MaterialList, recipients: readonly string[]): string {
  return mailtoUrl(recipients, `${tool.title}: ${projectLabel(list)}`, [listText(tool, list), listText(tool, list, false)])
}

/** CSV für Excel in deutscher Einstellung: Kopf mit Bauvorhaben, dann je Artikel eine Zeile, offene zuerst */
export function listCsv(tool: MaterialListTool, list: MaterialList): string {
  const row = (item: MaterialItem, status: string) =>
    `${csvText(item.name)};${item.quantity};${csvText(item.unit ?? '')};${status}`
  return csvFile([
    ...headerCsvLines(tool.title, list, LIST_DATE_LABEL),
    '',
    'Artikel;Menge;Einheit;Status',
    ...openItems(list).map((item) => row(item, 'offen')),
    ...doneItems(list).map((item) => row(item, 'erledigt')),
  ])
}
