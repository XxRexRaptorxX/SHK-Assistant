import { getDb, type ChecklistProgressRecord } from './db'

export async function getChecklistProgress(checklistId: string): Promise<ChecklistProgressRecord | undefined> {
  const db = await getDb()
  return db.get('checklistProgress', checklistId)
}

export async function listChecklistProgress(): Promise<ChecklistProgressRecord[]> {
  const db = await getDb()
  return db.getAll('checklistProgress')
}

/** Hakt einen Punkt an oder ab und liefert den neuen Stand. */
export async function setChecklistItemChecked(
  checklistId: string,
  itemId: string,
  checked: boolean,
): Promise<ChecklistProgressRecord> {
  const db = await getDb()
  const tx = db.transaction('checklistProgress', 'readwrite')
  const existing = await tx.store.get(checklistId)
  const checkedItemIds = new Set(existing?.checkedItemIds ?? [])
  if (checked) checkedItemIds.add(itemId)
  else checkedItemIds.delete(itemId)

  const record: ChecklistProgressRecord = {
    checklistId,
    checkedItemIds: [...checkedItemIds],
    updatedAt: new Date().toISOString(),
  }
  await tx.store.put(record)
  await tx.done
  return record
}

export async function resetChecklistProgress(checklistId: string): Promise<void> {
  const db = await getDb()
  await db.delete('checklistProgress', checklistId)
}
