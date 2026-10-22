import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { EXPERT_CODE_ID_PREFIX } from './constants.ts'

export const expertCodeSchema = defineEntrySchema({
  /** Hersteller bzw. Regelung; [eckige Klammern] dunkelgrau, (runde Klammern) hellgrau */
  name: z.string().trim().min(1),
  /** Code oder Rechenweg; [eckige Klammern] dunkelgrau, (runde Klammern) hellgrau */
  code: z.string().trim().min(1),
})

export type ExpertCodeEntry = z.output<typeof expertCodeSchema>

const CLOSING: Record<string, string> = { '(': ')', '[': ']' }

/** Klammern müssen paarweise und ungeschachtelt sein, sonst stimmt die Grau-Markierung nicht */
function checkBrackets(field: string, text: string): string[] {
  let open: string | undefined
  for (const char of text) {
    if (char === '(' || char === '[') {
      if (open) return [`${field}: verschachtelte Klammer`]
      open = char
    } else if (char === ')' || char === ']') {
      if (!open) return [`${field}: schließende Klammer ohne öffnende`]
      if (CLOSING[open] !== char) return [`${field}: Klammer ${open} mit ${char} geschlossen`]
      open = undefined
    }
  }
  return open ? [`${field}: Klammer nicht geschlossen`] : []
}

export function checkExpertCode(entry: ExpertCodeEntry): string[] {
  return [
    // Fachmann-Codes gehören nie in die öffentliche Version
    ...(entry.visibility === 'internal' ? [] : ['Fachmann-Codes müssen visibility "internal" haben']),
    ...checkBrackets('name', entry.name),
    ...checkBrackets('code', entry.code),
  ]
}

export const expertCodeCollection = defineCollection({
  dir: 'expert-codes',
  idPrefix: EXPERT_CODE_ID_PREFIX,
  schema: expertCodeSchema,
  check: checkExpertCode,
})
