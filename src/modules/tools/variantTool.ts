import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineEntrySchema } from '../../content/schema/base.ts'
import { topicTagsSchema } from '../../content/schema/topicTags.ts'
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
  /** Nur mit "modes": Modus, in dem die Variante erscheint (key einer Option von modes) */
  mode: key.optional(),
  ...formulaShape,
})

/**
 * Optionale Leiste über den Varianten, z. B. „Angabe auf der Düse: kg/h | USgal/h“.
 * Sie filtert die Varianten über deren "mode"; gleich beschriftete Varianten bleiben beim Umschalten gewählt.
 */
const modesSchema = z.strictObject({
  /** Was umgeschaltet wird, z. B. „Angabe auf der Düse“ */
  name: z.string().trim().min(1),
  options: z
    .array(
      z.strictObject({
        key,
        label: z.string().trim().min(1),
        note: z.string().trim().default(''),
      }),
    )
    .min(2),
})

export const variantToolSchema = defineEntrySchema({
  kind: z.literal('variants'),
  title: z.string().trim().min(1),
  summary: z.string().trim().min(1),
  tags: topicTagsSchema,
  description: z.string().trim().min(1),
  category: z.string().trim().default(''),
  /** Was umgeschaltet wird, z. B. „Berechnung“ */
  name: z.string().trim().min(1),
  modes: modesSchema.optional(),
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
  const { key: variantKey, label: _label, note: _note, mode: _mode, ...formula } = variant
  return {
    id: `${tool.id}.${variantKey}`,
    visibility: tool.visibility,
    status: tool.status,
    source: tool.source,
    verifiedBy: tool.verifiedBy,
    verifiedAt: tool.verifiedAt,
    tags: tool.tags,
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
  issues.push(...checkModes(tool))
  tool.variants.forEach((variant, index) => {
    for (const issue of formulaCollection.check!(variantFormula(tool, variant))) {
      issues.push(`variants[${index}] (${variant.label}): ${issue}`)
    }
  })
  return issues
}

/** Modus-Leiste: jede Variante in genau einem vorhandenen Modus, jeder Modus mit mindestens einer Variante */
function checkModes(tool: VariantTool): string[] {
  if (!tool.modes) {
    return tool.variants.some((variant) => variant.mode !== undefined) ? ['variants: mode nur zusammen mit modes'] : []
  }
  const issues: string[] = []
  const modeKeys = tool.modes.options.map((option) => option.key)
  if (new Set(modeKeys).size !== modeKeys.length) issues.push('modes: key doppelt vergeben')
  tool.variants.forEach((variant, index) => {
    if (variant.mode === undefined || !modeKeys.includes(variant.mode)) {
      issues.push(`variants[${index}] (${variant.label}): mode muss einer von ${modeKeys.join(', ')} sein`)
    }
  })
  for (const mode of modeKeys) {
    const labels = tool.variants.filter((variant) => variant.mode === mode).map((variant) => variant.label)
    if (labels.length === 0) issues.push(`modes: keine Variante für "${mode}"`)
    if (new Set(labels).size !== labels.length) issues.push(`modes: Beschriftung doppelt in "${mode}"`)
  }
  return issues
}

/** Varianten eines Modus; ohne Modus-Leiste alle */
export function variantsInMode(tool: VariantTool, mode: string | undefined): VariantTool['variants'] {
  return tool.modes ? tool.variants.filter((variant) => variant.mode === mode) : tool.variants
}

/**
 * Variante nach dem Umschalten des Modus: die gleich beschriftete, sonst die erste des neuen Modus
 * (z. B. „Durchsatz“ bleibt „Durchsatz“, wenn man von kg/h auf USgal/h wechselt)
 */
export function variantAfterModeChange(tool: VariantTool, currentKey: string, nextMode: string): string {
  const current = tool.variants.find((variant) => variant.key === currentKey)
  const candidates = variantsInMode(tool, nextMode)
  return (candidates.find((variant) => variant.label === current?.label) ?? candidates[0]!).key
}

/** Skizzen der Varianten, damit der Build ihre Existenz prüft */
export function variantReferences(tool: VariantTool): string[] {
  return tool.variants.flatMap((variant) => (variant.figure ? [variant.figure] : []))
}
