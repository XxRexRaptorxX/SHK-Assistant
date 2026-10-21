import { z } from 'zod'

// IDs: Kleinbuchstaben, Ziffern, Bindestriche; mind. zwei Teile durch Punkte getrennt.
// Der erste Teil ist das Modul-Präfix, z. B. "lexicon.beispiel-begriff".
// Beispiele hier nie mit echten IDs: die Meldung landet im Bundle (Public-Bundle-Test).
export const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\.[a-z0-9]+(?:-[a-z0-9]+)*)+$/

const baseShape = {
  id: z
    .string()
    .regex(
      ID_PATTERN,
      'Ungültige id: nur a-z, 0-9 und Bindestriche, Teile durch Punkte getrennt (z. B. "lexicon.beispiel-begriff")',
    ),
  visibility: z.enum(['internal', 'public']),
  status: z.enum(['draft', 'verified']),
  // Bei "draft" dürfen source, verifiedBy und verifiedAt leer sein, bei "verified" nicht.
  source: z.string(),
  verifiedBy: z.string(),
  verifiedAt: z.union([z.literal(''), z.iso.date()]),
}

export const baseEntrySchema = z.strictObject(baseShape)

export type BaseEntry = z.output<typeof baseEntrySchema>

function checkVerification(entry: BaseEntry, ctx: z.RefinementCtx) {
  if (entry.status !== 'verified') return
  const required = ['source', 'verifiedBy', 'verifiedAt'] as const
  for (const field of required) {
    if (entry[field].trim() === '') {
      ctx.addIssue({
        code: 'custom',
        path: [field],
        message: 'Pflichtfeld bei status "verified" darf nicht leer sein',
      })
    }
  }
}

/**
 * Erzeugt das Schema eines Inhaltstyps: Pflicht-Metadaten + modulspezifische Felder.
 * Unbekannte Felder sind verboten, damit Tippfehler (z. B. "verifedBy") auffallen.
 */
export function defineEntrySchema<T extends z.ZodRawShape>(shape: T) {
  return z
    .strictObject({ ...baseShape, ...shape })
    .superRefine((entry, ctx) => checkVerification(entry as BaseEntry, ctx))
}

export interface CollectionDefinition<T extends BaseEntry = BaseEntry> {
  /** Unterordner in content/ */
  dir: string
  /** Pflicht-Präfix der id, z. B. "lexicon" → "lexicon.…" */
  idPrefix: string
  schema: z.ZodType<T>
  /** ids, auf die ein Eintrag verweist. Der Build prüft, dass sie existieren. */
  references?(entry: T): string[]
  /** Fachliche Prüfungen über das Schema hinaus, z. B. Formeln gegen ihre Testbeispiele. */
  check?(entry: T): string[]
}

/** Hilft TypeScript, den Eintragstyp aus dem Schema abzuleiten. */
export function defineCollection<T extends BaseEntry>(definition: CollectionDefinition<T>) {
  return definition
}
