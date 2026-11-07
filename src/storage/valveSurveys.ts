import { getDb, type ValveSurvey } from './db'

/** Alle gespeicherten Aufmaße eines Tools */
export async function listValveSurveys(toolId: string): Promise<ValveSurvey[]> {
  const db = await getDb()
  return (await db.getAll('valveSurveys')).filter((survey) => survey.toolId === toolId)
}

/** Legt ein Aufmaß an oder überschreibt es mit dem neuen Stand */
export async function saveValveSurvey(survey: ValveSurvey): Promise<void> {
  const db = await getDb()
  await db.put('valveSurveys', survey)
}

export async function deleteValveSurvey(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('valveSurveys', id)
}
