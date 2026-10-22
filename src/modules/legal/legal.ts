import { content } from '../../content'
import { LEGAL_ID_PREFIX } from './constants'
import type { LegalEntry } from './schema'

/** Rechtliche Seiten: Adresse in der App und id des Inhalts in content/legal */
export const LEGAL_PAGES = [
  { path: '/impressum', id: `${LEGAL_ID_PREFIX}.impressum`, title: 'Impressum' },
  { path: '/datenschutz', id: `${LEGAL_ID_PREFIX}.datenschutz`, title: 'Datenschutzerklärung' },
] as const

export type LegalPageInfo = (typeof LEGAL_PAGES)[number]

export function findLegalEntry(entries: readonly LegalEntry[], id: string): LegalEntry | undefined {
  return entries.find((entry) => entry.id === id)
}

export const legalEntries: LegalEntry[] = content.legal
