import type { EvalFunction, MathNode, Unit } from 'mathjs'
// Wird auch beim Build geladen (über schema.ts): Importe mit Dateiendung .ts.
import { asTargetUnit, math } from '../../lib/math.ts'
import type { FormulaEntry, FormulaExample } from './schema.ts'

/** Eingabewert mit Einheit ("" = ohne Einheit) */
export interface Quantity {
  value: number
  unit: string
}

export class FormulaError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FormulaError'
  }
}

/** Symbole, die ohne Definition in Formeln erlaubt sind */
const BUILTIN_SYMBOLS = new Set(['pi', 'e'])

const compiled = new Map<string, EvalFunction>()

function compile(expression: string): EvalFunction {
  let code = compiled.get(expression)
  if (!code) {
    code = math.compile(expression)
    compiled.set(expression, code)
  }
  return code
}

function toScopeValue({ value, unit }: Quantity): number | Unit {
  return unit === '' ? value : math.unit(value, unit)
}

/** Wandelt ein Rechenergebnis in eine Zahl in der gewünschten Einheit. */
function toNumberIn(result: unknown, unit: string): number {
  if (math.isUnit(result)) {
    if (unit === '') {
      if (result.dimensions.some((d) => d !== 0)) {
        throw new FormulaError(`Ergebnis hat die Einheit ${result.formatUnits()}, erwartet ohne Einheit`)
      }
      return result.toNumber()
    }
    try {
      return result.toNumber(asTargetUnit(unit))
    } catch {
      throw new FormulaError(`Ergebnis (${result.formatUnits()}) lässt sich nicht in ${unit} umrechnen`)
    }
  }
  if (typeof result === 'number') {
    if (unit !== '') throw new FormulaError(`Ergebnis hat keine Einheit, erwartet ${unit}`)
    return result
  }
  throw new FormulaError('Ergebnis ist keine Zahl')
}

/**
 * Berechnet eine Formel.
 * @param inputs je Variablen-Symbol Wert und Einheit
 * @param resultUnit gewünschte Ergebniseinheit (Standard: Haupteinheit des Ergebnisses)
 */
export function evaluateFormula(
  formula: FormulaEntry,
  inputs: Readonly<Record<string, Quantity>>,
  resultUnit = formula.result?.unit ?? '',
): number {
  if (formula.expression === '' || !formula.result) {
    throw new FormulaError('Die Formel ist noch nicht hinterlegt')
  }
  const scope = new Map<string, unknown>()
  for (const constant of formula.constants) {
    scope.set(constant.symbol, math.evaluate(constant.value))
  }
  for (const variable of formula.variables) {
    const input = inputs[variable.symbol]
    if (!input) throw new FormulaError(`Wert für ${variable.symbol} fehlt`)
    // Erst in die Haupteinheit der Variable umrechnen, dann rechnen. So gilt z. B. 20 °C als
    // absolute Temperatur 293,15 K, und die Formel rechnet stets wie mit den Haupteinheiten.
    const value =
      input.unit === variable.unit || variable.unit === ''
        ? input.value
        : math.unit(input.value, input.unit).toNumber(asTargetUnit(variable.unit))
    scope.set(variable.symbol, toScopeValue({ value, unit: variable.unit }))
  }
  // Erst in der Haupteinheit des Ergebnisses ausrechnen, dann als einfache Einheit umrechnen:
  // bei zusammengesetzten Einheiten (z. B. kg·K/kg) übergeht mathjs sonst den Nullpunkt von °C.
  const mainUnit = formula.result.unit
  const value = toNumberIn(compile(formula.expression).evaluate(scope), mainUnit)
  if (resultUnit === mainUnit) return value
  if (mainUnit === '') throw new FormulaError(`Ergebnis hat keine Einheit, erwartet ${resultUnit}`)
  try {
    return math.unit(value, mainUnit).toNumber(asTargetUnit(resultUnit))
  } catch {
    throw new FormulaError(`Ergebnis (${mainUnit}) lässt sich nicht in ${resultUnit} umrechnen`)
  }
}

/** Text wie "10 kW" oder Zahl (in fallbackUnit) in einen Wert in targetUnit umrechnen */
function quantityIn(raw: number | string, targetUnit: string): number {
  if (typeof raw === 'number') return raw
  const asNumber = Number(raw.trim())
  if (raw.trim() !== '' && Number.isFinite(asNumber)) return asNumber
  return toNumberIn(math.unit(raw), targetUnit)
}

export interface ExampleOutcome {
  expected: number
  actual: number
  ok: boolean
}

/** Rechnet ein Testbeispiel nach. Wirft bei unbrauchbaren Eingaben. */
export function evaluateExample(formula: FormulaEntry, example: FormulaExample): ExampleOutcome {
  const resultUnit = formula.result?.unit ?? ''
  const inputs = exampleInputs(formula, example)
  const expected = quantityIn(example.expected, resultUnit)
  const actual = evaluateFormula(formula, inputs)
  const allowed = example.tolerance * Math.max(Math.abs(expected), Number.EPSILON)
  return { expected, actual, ok: Math.abs(actual - expected) <= allowed }
}

/** Eingaben eines Testbeispiels, jeweils in der Haupteinheit der Variable */
export function exampleInputs(formula: FormulaEntry, example: FormulaExample): Record<string, Quantity> {
  const inputs: Record<string, Quantity> = {}
  for (const variable of formula.variables) {
    const raw = example.inputs[variable.symbol]
    if (raw === undefined) throw new FormulaError(`Eingabe für ${variable.symbol} fehlt`)
    inputs[variable.symbol] = { value: quantityIn(raw, variable.unit), unit: variable.unit }
  }
  for (const key of Object.keys(example.inputs)) {
    if (!formula.variables.some((v) => v.symbol === key)) throw new FormulaError(`Unbekannte Eingabe ${key}`)
  }
  return inputs
}

function isValidUnit(unit: string): boolean {
  if (unit === '') return true
  try {
    math.unit(1, unit)
    return true
  } catch {
    return false
  }
}

function isCompatible(unit: string, mainUnit: string): boolean {
  if (unit === '' || mainUnit === '') return unit === mainUnit
  return math.unit(1, unit).equalBase(math.unit(1, mainUnit))
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

/** Fachliche Prüfung einer Formel für den Build. Liefert Fehlermeldungen. */
export function checkFormula(formula: FormulaEntry): string[] {
  const issues: string[] = []
  const symbols = new Set<string>()

  for (const { symbol } of [...formula.variables, ...formula.constants]) {
    if (symbols.has(symbol)) issues.push(`Symbol "${symbol}" ist doppelt vergeben`)
    symbols.add(symbol)
  }

  const unitGroups = [
    ...formula.variables.map((v) => ({ owner: v.symbol, unit: v.unit, units: v.units })),
    ...(formula.result ? [{ owner: formula.result.symbol, unit: formula.result.unit, units: formula.result.units }] : []),
  ]
  for (const { owner, unit, units } of unitGroups) {
    for (const u of [unit, ...units]) {
      if (!isValidUnit(u)) issues.push(`${owner}: unbekannte Einheit "${u}"`)
    }
    if (!isValidUnit(unit)) continue
    for (const alternative of units) {
      if (isValidUnit(alternative) && !isCompatible(alternative, unit)) {
        issues.push(`${owner}: Einheit "${alternative}" passt nicht zu "${unit}"`)
      }
    }
  }

  for (const constant of formula.constants) {
    try {
      const value: unknown = math.evaluate(constant.value)
      if (typeof value !== 'number' && !math.isUnit(value)) throw new Error('kein Zahlenwert')
    } catch (error) {
      issues.push(`Konstante ${constant.symbol}: "${constant.value}" ist ungültig (${describeError(error)})`)
    }
  }

  // Entwurf ohne Formel: nichts weiter zu prüfen
  if (formula.expression === '') return issues
  if (!formula.result) issues.push('result fehlt, obwohl eine Formel hinterlegt ist')

  let tree: MathNode
  try {
    tree = math.parse(formula.expression)
  } catch (error) {
    issues.push(`Formel nicht lesbar: ${describeError(error)}`)
    return issues
  }

  const used = new Set<string>()
  tree.traverse((node, path) => {
    if (!math.isSymbolNode(node)) return
    if (path === 'fn') {
      if (typeof (math as unknown as Record<string, unknown>)[node.name] !== 'function') {
        issues.push(`Unbekannte Funktion "${node.name}"`)
      }
      return
    }
    used.add(node.name)
  })
  for (const name of used) {
    if (!symbols.has(name) && !BUILTIN_SYMBOLS.has(name)) {
      issues.push(`Symbol "${name}" ist weder Variable noch Konstante`)
    }
  }
  for (const variable of formula.variables) {
    if (!used.has(variable.symbol)) issues.push(`Variable "${variable.symbol}" kommt in der Formel nicht vor`)
  }

  if (issues.length > 0 || !formula.result) return issues

  formula.examples.forEach((example, index) => {
    const label = `Testbeispiel ${index + 1}`
    try {
      const { expected, actual, ok } = evaluateExample(formula, example)
      if (!ok) issues.push(`${label}: erwartet ${expected}, berechnet ${actual}`)
    } catch (error) {
      issues.push(`${label}: ${describeError(error)}`)
    }
  })
  return issues
}

/** Formel zur Anzeige, mit Anzeige-Bezeichnungen statt Symbolen (z. B. "ΔT" statt "dT") */
export function formatExpression(formula: FormulaEntry): string {
  if (formula.expression === '') return ''
  const labels = new Map<string, string>()
  for (const item of [...formula.variables, ...formula.constants]) {
    if (item.label) labels.set(item.symbol, item.label)
  }
  return math
    .parse(formula.expression)
    .toString({
      implicit: 'show',
      handler: (node: MathNode) =>
        math.isSymbolNode(node) && labels.has(node.name) ? labels.get(node.name) : undefined,
    })
    .replace(/ \* /g, ' · ')
}
