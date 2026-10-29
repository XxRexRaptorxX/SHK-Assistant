import { Fragment, type ReactNode } from 'react'
import type { MathNode } from 'mathjs'
import { math } from '../../lib/math'
import { formatSignificant } from '../../lib/number'
import { formatAnyUnit } from '../units/labels'
import { BUILTIN_CONSTANTS } from './engine'
import type { FormulaEntry } from './schema'

// Formel in Bruchschreibweise: Brüche übereinander, Hochzahlen hochgestellt, Wurzeln mit Strich.
// Aufeinanderfolgende Produkte und Quotienten werden zu einem Bruch zusammengefasst
// (a · b / c / d → a·b über c·d). Eingeklammerte Brüche wie (l / d) bleiben eigene Brüche,
// so lässt sich die gewohnte Schreibweise im Inhalt steuern.

const fractionClass = 'mx-0.5 inline-flex flex-col items-center align-middle leading-tight'

function Fraction({ numerator, denominator }: { numerator: ReactNode; denominator: ReactNode }) {
  return (
    <span className={fractionClass}>
      <span className="px-1 pb-0.5">{numerator}</span>
      <span className="w-full border-t-2 border-current px-1 pt-0.5 text-center">{denominator}</span>
    </span>
  )
}

function Radical({ index, children }: { index?: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-start">
      {index && <sup className="-mr-1 text-[0.55em]">{index}</sup>}
      <span>√</span>
      <span className="border-t-2 border-current pl-0.5">{children}</span>
    </span>
  )
}

const join = (parts: ReactNode[], separator: ReactNode) =>
  parts.map((part, index) => (
    <Fragment key={index}>
      {index > 0 && separator}
      {part}
    </Fragment>
  ))

const MULTIPLY = <span className="mx-1">·</span>

const OPERATOR_SIGNS: Record<string, string> = { add: '+', subtract: '−' }

/** Eingesetzter Wert statt eines Symbols (Rechenweg) */
export interface Substitution {
  node: ReactNode
  /** Zahl mit Einheit: als Basis einer Potenz in Klammern, (3 m)² statt 3 m² */
  compound: boolean
}

type Labels = ReadonlyMap<string, string | Substitution>

/** Ein Faktor des Produkts; inverted = steht im Nenner */
interface Factor {
  node: MathNode
}

/** Produkte und Quotienten in Zähler- und Nennerfaktoren zerlegen */
function collectFactors(node: MathNode, numerator: Factor[], denominator: Factor[], inverted = false) {
  if (math.isOperatorNode(node) && node.fn === 'multiply') {
    for (const arg of node.args) collectFactors(arg, numerator, denominator, inverted)
    return
  }
  if (math.isOperatorNode(node) && node.fn === 'divide') {
    collectFactors(node.args[0]!, numerator, denominator, inverted)
    collectFactors(node.args[1]!, numerator, denominator, !inverted)
    return
  }
  // Eingeklammerte Produkte gehören zum selben Bruch; eingeklammerte Brüche bleiben eigene Brüche
  if (math.isParenthesisNode(node) && math.isOperatorNode(node.content) && node.content.fn === 'multiply') {
    collectFactors(node.content, numerator, denominator, inverted)
    return
  }
  ;(inverted ? denominator : numerator).push({ node })
}

const isNumber = (node: MathNode) => math.isConstantNode(node)

/** Zahlen zuerst, wie im Lehrbuch (2 · d statt d · 2) */
const numbersFirst = (factors: Factor[]) => [
  ...factors.filter((factor) => isNumber(factor.node)),
  ...factors.filter((factor) => !isNumber(factor.node)),
]

/** Steht ein Faktor allein, braucht er keine Klammern (der Bruchstrich trennt) */
function renderProduct(factors: Factor[], labels: Labels): ReactNode {
  if (factors.length === 0) return '1'
  if (factors.length === 1) return renderNode(unwrap(factors[0]!.node), labels)
  return join(
    factors.map((factor) => renderNode(factor.node, labels)),
    MULTIPLY,
  )
}

const unwrap = (node: MathNode): MathNode => (math.isParenthesisNode(node) ? unwrap(node.content) : node)

function formatNumber(value: unknown): string {
  return String(value).replace('.', ',')
}

/** Potenzbasis oder Ziel eines Minus: eingesetzte Zahl mit Einheit eingeklammert */
function renderOperand(node: MathNode, labels: Labels): ReactNode {
  const label = math.isSymbolNode(node) ? labels.get(node.name) : undefined
  return typeof label === 'object' && label.compound ? <>({label.node})</> : renderNode(node, labels)
}

export function renderNode(node: MathNode, labels: Labels): ReactNode {
  if (math.isSymbolNode(node)) {
    const label = labels.get(node.name)
    if (typeof label === 'object') return label.node
    return label ?? BUILTIN_CONSTANTS[node.name]?.label ?? node.name
  }
  if (math.isConstantNode(node)) return formatNumber(node.value)
  if (math.isParenthesisNode(node)) {
    const content = unwrap(node.content)
    // Ein Bruch ist durch den Strich schon abgegrenzt
    if (math.isOperatorNode(content) && content.fn === 'divide') return renderNode(content, labels)
    return <>({renderNode(content, labels)})</>
  }
  if (math.isOperatorNode(node)) {
    if (node.fn === 'multiply' || node.fn === 'divide') {
      const numerator: Factor[] = []
      const denominator: Factor[] = []
      collectFactors(node, numerator, denominator)
      if (denominator.length === 0) return renderProduct(numerator, labels)
      return (
        <Fraction
          numerator={renderProduct(numbersFirst(numerator), labels)}
          denominator={renderProduct(numbersFirst(denominator), labels)}
        />
      )
    }
    if (node.fn === 'pow') {
      const [base, exponent] = node.args
      return (
        <>
          {renderOperand(base!, labels)}
          <sup className="text-[0.65em]">{renderNode(unwrap(exponent!), labels)}</sup>
        </>
      )
    }
    if (node.fn === 'unaryMinus') return <>−{renderOperand(node.args[0]!, labels)}</>
    if (node.fn === 'unaryPlus') return renderNode(node.args[0]!, labels)
    const sign = OPERATOR_SIGNS[node.fn] ?? node.op
    return join(
      node.args.map((arg) => renderNode(arg, labels)),
      <span className="mx-1">{sign}</span>,
    )
  }
  if (math.isFunctionNode(node)) {
    const name = node.fn.name
    const args = node.args.map((arg) => renderNode(unwrap(arg), labels))
    if (name === 'sqrt') return <Radical>{args[0]}</Radical>
    if (name === 'cbrt') return <Radical index="3">{args[0]}</Radical>
    // mathjs: log = natürlicher Logarithmus
    const shown = name === 'log' && args.length === 1 ? 'ln' : name === 'log10' ? 'log₁₀' : name
    return (
      <>
        {shown}({join(args, '; ')})
      </>
    )
  }
  return node.toString()
}

/**
 * Ausdruck der Formel in Bruchschreibweise. Mit substitutions stehen statt der Symbole
 * die eingesetzten Werte da (Rechenweg); Symbole ohne Wert bleiben stehen.
 */
export function FormulaMath({
  formula,
  substitutions,
}: {
  formula: FormulaEntry
  substitutions?: ReadonlyMap<string, Substitution>
}) {
  const labels = new Map<string, string | Substitution>()
  for (const item of [...formula.variables, ...formula.constants]) {
    if (item.label) labels.set(item.symbol, item.label)
  }
  for (const [symbol, substitution] of substitutions ?? []) labels.set(symbol, substitution)
  return <>{renderNode(math.parse(formula.expression), labels)}</>
}

/** Zahl mit Einheit als eingesetzter Wert; negative Zahlen eingeklammert, damit 2 · (−3) lesbar bleibt */
export function quantitySubstitution(value: number, unit: string): Substitution {
  const shown = value < 0 ? `(−${formatSignificant(-value)})` : formatSignificant(value)
  if (unit === '') return { node: shown, compound: false }
  const label = formatAnyUnit(unit)
  return {
    node: (
      <span className="whitespace-nowrap">
        {shown}
        {/* Winkelgrad ohne Abstand (90°), sonst mit (25 mm, 20 °C) */}
        <span className="text-[0.8em] text-muted">{label === '°' ? label : ` ${label}`}</span>
      </span>
    ),
    compound: true,
  }
}

/** Konstante wie "9.80665 m/s^2" als eingesetzter Wert; Ausdrücke wie sqrt(3) bleiben als Zeichen (√3) stehen */
export function constantSubstitution(value: string): Substitution | undefined {
  const match = /^\s*([-+]?\d+(?:\.\d+)?(?:e[-+]?\d+)?)\s*(.*?)\s*$/i.exec(value)
  if (!match) return undefined
  return quantitySubstitution(Number(match[1]), match[2]!)
}
