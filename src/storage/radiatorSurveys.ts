import { getDb, type RadiatorSurvey } from './db'

/** Alle gespeicherten Heizkörper-Aufmaße eines Tools */
export async function listRadiatorSurveys(toolId: string): Promise<RadiatorSurvey[]> {
  const db = await getDb()
  return (await db.getAll('radiatorSurveys')).filter((survey) => survey.toolId === toolId)
}

/** Legt ein Aufmaß an oder überschreibt es mit dem neuen Stand */
export async function saveRadiatorSurvey(survey: RadiatorSurvey): Promise<void> {
  const db = await getDb()
  await db.put('radiatorSurveys', survey)
}

export async function deleteRadiatorSurvey(id: string): Promise<void> {
  const db = await getDb()
  await db.delete('radiatorSurveys', id)
}
