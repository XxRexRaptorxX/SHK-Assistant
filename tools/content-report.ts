// Übersicht über den Stand der Inhalte: geprüft/ungeprüft, fehlende Angaben.
// Aufruf: npm run content:report

import { fileURLToPath } from 'node:url'
import { collections } from '../src/content/collections.ts'
import type { BaseEntry } from '../src/content/schema/base.ts'
import { loadContent } from './content-loader.ts'

const contentDir = fileURLToPath(new URL('../content', import.meta.url))
const { allEntries } = loadContent({ contentDir, edition: 'internal', collections })

/** Hinweise auf fehlende Angaben je Eintrag (nur strukturelle, keine fachliche Bewertung) */
function gaps(entry: BaseEntry): string[] {
  const e = entry as BaseEntry & Record<string, unknown>
  const found: string[] = []
  if (JSON.stringify(entry).includes('TODO')) found.push('enthält „TODO“')
  if (entry.source.trim() === '') found.push('Quelle fehlt')
  if (entry.id.startsWith('formula.')) {
    if (e.expression === '') found.push('Formel fehlt')
    else if (Array.isArray(e.examples) && e.examples.length === 0) found.push('Testbeispiel fehlt')
  }
  if (entry.id.startsWith('unit.') && e.definition === '') found.push('Definition fehlt')
  if (entry.id.startsWith('checklist.') && Array.isArray(e.sections) && e.sections.length === 0) {
    found.push('Prüfpunkte fehlen')
  }
  if (entry.id.startsWith('converter.') && e.kind === 'table' && Array.isArray(e.rows) && e.rows.length === 0) {
    found.push('Tabelle leer')
  }
  return found
}

const lines: string[] = ['# Inhaltsstand', '']
for (const [name, collection] of Object.entries(collections)) {
  const entries = allEntries.filter((entry) => entry.id.startsWith(`${collection.idPrefix}.`))
  const verified = entries.filter((entry) => entry.status === 'verified').length
  const internal = entries.filter((entry) => entry.visibility === 'internal').length
  lines.push(
    `## ${name}: ${entries.length} Einträge – ${verified} geprüft, ${entries.length - verified} ungeprüft` +
      ` (${internal} intern, ${entries.length - internal} öffentlich)`,
  )
  const withGaps = entries.map((entry) => ({ entry, found: gaps(entry) })).filter(({ found }) => found.length > 0)
  for (const { entry, found } of withGaps) lines.push(`- ${entry.id}: ${found.join(', ')}`)
  lines.push('')
}
console.log(lines.join('\n'))
