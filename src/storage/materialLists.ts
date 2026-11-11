import { getDb, type MaterialList, type MaterialMemoryRecord } from './db'

/** Alle gespeicherten Materiallisten eines Tools */
export async function listMaterialLists(toolId: string): Promise<MaterialList[]> {
  const db = await getDb()
  return (await db.getAll('materialLists')).filter((list) => list.toolId === toolId)
}

/** Legt eine Liste an oder überschreibt sie mit dem neuen Stand */
export async function saveMaterialList(list: MaterialList): Promise<void> {
  const db = await getDb()
  await db.put('materialLists', list)
}

export async function deleteMaterialList(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('materialLists', id)
}

/** Gemerkte Bauvorhaben und Artikel für die Vervollständigung */
export async function listMaterialMemory(): Promise<MaterialMemoryRecord[]> {
  const db = await getDb()
  return db.getAll('materialMemory')
}

/** Merkt sich Einträge; gleiche Schlüssel werden überschrieben */
export async function saveMaterialMemory(records: readonly MaterialMemoryRecord[]): Promise<void> {
  const db = await getDb()
  const tx = db.transaction('materialMemory', 'readwrite')
  await Promise.all([...records.map((record) => tx.store.put(record)), tx.done])
}

export async function deleteMaterialMemory(key: string): Promise<void> {
  const db = await getDb()
  await db.delete('materialMemory', key)
}
