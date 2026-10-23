import { Fragment, type ReactNode } from 'react'
import type { MathNode } from 'mathjs'
import { math } from '../../lib/math'
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

type Labels = ReadonlyMap<string, string>

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

export function renderNode(node: MathNode, labels: Labels): ReactNode {
  if (math.isSymbolNode(node)) {
    return labels.get(node.name) ?? BUILTIN_CONSTANTS[node.name]?.label ?? node.name
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
          {renderNode(base!, labels)}
          <sup className="text-[0.65em]">{renderNode(unwrap(exponent!), labels)}</sup>
        </>
      )
    }
    if (node.fn === 'unaryMinus') return <>−{renderNode(node.args[0]!, labels)}</>
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

/** Ausdruck der Formel in Bruchschreibweise */
export function FormulaMath({ formula }: { formula: FormulaEntry }) {
  const labels = new Map<string, string>()
  for (const item of [...formula.variables, ...formula.constants]) {
    if (item.label) labels.set(item.symbol, item.label)
  }
  return <>{renderNode(math.parse(formula.expression), labels)}</>
}
