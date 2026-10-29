import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { formulaCollection, formulaShape, type FormulaEntry } from '../formulas/schema.ts'

// Varianten-Tools ("kind": "variants"): mehrere Rechenwege zu einer Aufgabe (z. B. Länge einer
// Rohrrolle über die Wicklungen oder über den Ringquerschnitt). Oben eine Leiste zum Umschalten,
// darunter die gewählte Formel wie bei den Formel-Tools mit Skizze, Legende und Rechner.

const key = z.string().regex(/^[a-z][a-zA-Z0-9]*$/, 'key: Kleinbuchstabe, dann Buchstaben/Ziffern')

const variantSchema = z.strictObject({
  key,
  /** Kurzer Name in der Leiste, z. B. „Wicklungen“ */
  label: z.string().trim().min(1),
  /** Kleine zweite Zeile in der Leiste, z. B. „Näherung“ */
  note: z.string().trim().default(''),
  ...formulaShape,
})

export const variantToolSchema = defineEntrySchema({
  kind: z.literal('variants'),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Was umgeschaltet wird, z. B. „Berechnung“ */
  name: z.string().trim().min(1),
  variants: z.array(variantSchema).min(2),
}).superRefine((entry, ctx) => {
  // Pflichtangaben wie bei geprüften Formeln, je Variante
  if (entry.status !== 'verified') return
  entry.variants.forEach((variant, index) => {
    const path = (field: string) => ['variants', index, field]
    if (variant.expression === '') ctx.addIssue({ code: 'custom', path: path('expression'), message: 'Pflicht bei status "verified"' })
    if (!variant.result) ctx.addIssue({ code: 'custom', path: path('result'), message: 'Pflicht bei status "verified"' })
    if (variant.examples.length === 0) {
      ctx.addIssue({ code: 'custom', path: path('examples'), message: 'Mindestens ein Testbeispiel bei status "verified"' })
    }
  })
})

export type VariantTool = z.output<typeof variantToolSchema>
export type ToolVariant = VariantTool['variants'][number]

/** Eine Variante als eigenständige Formel (Kennung „tool.x.variante“), z. B. für Rechner und Prüfung */
export function variantFormula(tool: VariantTool, variant: ToolVariant): FormulaEntry {
  const { key: variantKey, label: _label, note: _note, ...formula } = variant
  return {
    id: `${tool.id}.${variantKey}`,
    visibility: tool.visibility,
    status: tool.status,
    source: tool.source,
    verifiedBy: tool.verifiedBy,
    verifiedAt: tool.verifiedAt,
    ...formula,
  }
}

export function variantFormulas(tool: VariantTool): FormulaEntry[] {
  return tool.variants.map((variant) => variantFormula(tool, variant))
}

export function checkVariantTool(tool: VariantTool): string[] {
  const issues: string[] = []
  const keys = tool.variants.map((variant) => variant.key)
  if (new Set(keys).size !== keys.length) issues.push('variants: key doppelt vergeben')
  tool.variants.forEach((variant, index) => {
    for (const issue of formulaCollection.check!(variantFormula(tool, variant))) {
      issues.push(`variants[${index}] (${variant.label}): ${issue}`)
    }
  })
  return issues
}

/** Skizzen der Varianten, damit der Build ihre Existenz prüft */
export function variantReferences(tool: VariantTool): string[] {
  return tool.variants.flatMap((variant) => (variant.figure ? [variant.figure] : []))
}
