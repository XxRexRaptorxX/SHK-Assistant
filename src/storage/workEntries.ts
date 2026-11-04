import { getDb, type WorkEntry } from './db'

export async function listWorkEntries(): Promise<WorkEntry[]> {
  const db = await getDb()
  return db.getAll('workEntries')
}

/** Legt einen Eintrag an oder überschreibt ihn beim Bearbeiten */
export async function saveWorkEntry(entry: WorkEntry): Promise<void> {
  const db = await getDb()
  await db.put('workEntries', entry)
}

export async function deleteWorkEntry(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('workEntries', id)
}
