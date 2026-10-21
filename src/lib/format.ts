/** "2026-01-15" → "15.01.2026" (ohne Date-Objekt, damit keine Zeitzonen-Verschiebung entsteht) */
export function formatIsoDate(isoDate: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(isoDate)
  if (!match) return isoDate
  const [, year, month, day] = match
  return `${day}.${month}.${year}`
}
