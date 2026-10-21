import { z } from 'zod'
// Wird auch von vite.config.ts geladen: Importe mit Dateiendung .ts.
import { defineCollection, defineEntrySchema } from '../../content/schema/base.ts'
import { FORMULA_ID_PREFIX } from './constants.ts'
import { checkFormula } from './engine.ts'

/** Bezeichner in der Formel: Buchstabe, dann Buchstaben/Ziffern/_ (z. B. "Q", "dT", "c_w") */
const symbol = z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/, 'Symbol: nur A-Z, a-z, 0-9 und _')

/** mathjs-Einheit, z. B. "kW", "m^3/h", "kJ/(kg K)"; leer = ohne Einheit */
const unit = z.string().trim()

const variableSchema = z.strictObject({
  symbol,
  /** Anzeige statt Symbol, z. B. "ΔT" für "dT" */
  label: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  unit,
  /** Weitere wählbare Eingabeeinheiten (müssen zur Haupteinheit passen) */
  units: z.array(unit).default([]),
  description: z.string().default(''),
})

const constantSchema = z.strictObject({
  symbol,
  label: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  /** Wert mit Einheit als mathjs-Ausdruck, z. B. "4.19 kJ/(kg K)" */
  value: z.string().trim().min(1),
})

const resultSchema = z.strictObject({
  symbol,
  label: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  unit,
  units: z.array(unit).default([]),
  /** Nachkommastellen in der Anzeige */
  decimals: z.number().int().min(0).max(6).default(2),
})

const exampleSchema = z.strictObject({
  /** Eingaben je Symbol: Zahl (in der Haupteinheit) oder Text mit Einheit, z. B. "10 kW" */
  inputs: z.record(z.string(), z.union([z.number(), z.string()])),
  /** Referenzwert: Zahl (in der Ergebniseinheit) oder Text mit Einheit */
  expected: z.union([z.number(), z.string()]),
  /** Erlaubte relative Abweichung, Standard 0,1 % */
  tolerance: z.number().positive().max(0.1).default(0.001),
  note: z.string().optional(),
})

export const formulaEntrySchema = defineEntrySchema({
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  /** Gruppierung in der Liste, z. B. "Hydraulik" */
  category: z.string().trim().default(''),
  variables: z.array(variableSchema).default([]),
  constants: z.array(constantSchema).default([]),
  result: resultSchema.optional(),
  /** mathjs-Ausdruck mit den Symbolen, z. B. "Q / (c * dT)"; bei draft darf er fehlen */
  expression: z.string().trim().default(''),
  examples: z.array(exampleSchema).default([]),
}).superRefine((entry, ctx) => {
  if (entry.status !== 'verified') return
  if (entry.expression === '') {
    ctx.addIssue({ code: 'custom', path: ['expression'], message: 'Pflicht bei status "verified"' })
  }
  if (!entry.result) {
    ctx.addIssue({ code: 'custom', path: ['result'], message: 'Pflicht bei status "verified"' })
  }
  if (entry.examples.length === 0) {
    ctx.addIssue({ code: 'custom', path: ['examples'], message: 'Mindestens ein Testbeispiel bei status "verified"' })
  }
})

export type FormulaEntry = z.output<typeof formulaEntrySchema>
export type FormulaVariable = z.output<typeof variableSchema>
export type FormulaExample = z.output<typeof exampleSchema>

export const formulaCollection = defineCollection({
  dir: 'formulas',
  idPrefix: FORMULA_ID_PREFIX,
  schema: formulaEntrySchema,
  check: checkFormula,
})
