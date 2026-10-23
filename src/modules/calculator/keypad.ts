import {
  appendDigit,
  EVALUATION_MESSAGES,
  evaluate,
  formatResult,
  toggleSign,
  type AngleMode,
  type Token,
} from './engine'

// Tasten und Tastenlogik beider Rechner (ohne Oberfläche, damit testbar)

export type KeyStyle = 'digit' | 'operator' | 'function' | 'equals' | 'clear'

interface KeyBase {
  id: string
  label: string
  /** Für Screenreader, wenn das Zeichen allein nicht reicht (z. B. "√") */
  aria?: string
  style: KeyStyle
}

export type Key =
  | (KeyBase & { kind: 'digit'; digit: string })
  /** continues: rechnet nach "=" mit dem Ergebnis weiter (+, ², %) statt neu zu beginnen (sin, π) */
  | (KeyBase & { kind: 'token'; token: Token; continues: boolean })
  | (KeyBase & { kind: 'action'; action: 'clear' | 'back' | 'equals' | 'sign' | 'second' | 'angle' })

const digit = (d: string): Key => ({ id: `d${d}`, label: d, kind: 'digit', digit: d, style: 'digit' })
const op = (id: string, label: string, value: string, aria?: string): Key => ({
  id,
  label,
  aria,
  kind: 'token',
  token: { value, label },
  continues: true,
  style: 'operator',
})
const fn = (id: string, label: string, token: Token, aria: string, continues = false): Key => ({
  id,
  label,
  aria,
  kind: 'token',
  token,
  continues,
  style: 'function',
})
const action = (id: string, label: string, act: Extract<Key, { kind: 'action' }>['action'], style: KeyStyle, aria?: string): Key => ({
  id,
  label,
  aria,
  kind: 'action',
  action: act,
  style,
})

const DIVIDE = op('divide', '÷', '/', 'geteilt durch')
const MULTIPLY = op('multiply', '×', '*', 'mal')
const MINUS = op('minus', '−', '-', 'minus')
const PLUS = op('plus', '+', '+', 'plus')
const PERCENT = op('percent', '%', '%', 'Prozent')
const CLEAR = action('clear', 'AC', 'clear', 'clear', 'Alles löschen')
const BACK = action('back', '⌫', 'back', 'function', 'Letzte Eingabe löschen')
const SIGN = action('sign', '±', 'sign', 'digit', 'Vorzeichen wechseln')
const COMMA: Key = { ...digit(','), id: 'comma', aria: 'Komma' }
const EQUALS = action('equals', '=', 'equals', 'equals', 'Ergebnis')

/** Taschenrechner, 4 Spalten */
export const STANDARD_KEYS: Key[] = [
  CLEAR, BACK, PERCENT, DIVIDE,
  digit('7'), digit('8'), digit('9'), MULTIPLY,
  digit('4'), digit('5'), digit('6'), MINUS,
  digit('1'), digit('2'), digit('3'), PLUS,
  SIGN, digit('0'), COMMA, EQUALS,
]

const t = (value: string, label = value): Token => ({ value, label })

/** Wissenschaftlicher Rechner, 5 Spalten; second = Belegung mit gedrückter „2nd“-Taste */
export function scientificKeys(second: boolean, angle: AngleMode): Key[] {
  const functions = second
    ? [
        fn('asin', 'sin⁻¹', t('asin(', 'sin⁻¹('), 'Arkussinus'),
        fn('acos', 'cos⁻¹', t('acos(', 'cos⁻¹('), 'Arkuskosinus'),
        fn('atan', 'tan⁻¹', t('atan(', 'tan⁻¹('), 'Arkustangens'),
        fn('exp', 'eˣ', t('e^(', 'e^('), 'e hoch x'),
        fn('pow10', '10ˣ', t('10^(', '10^('), '10 hoch x'),
      ]
    : [
        fn('sin', 'sin', t('sin(', 'sin('), 'Sinus'),
        fn('cos', 'cos', t('cos(', 'cos('), 'Kosinus'),
        fn('tan', 'tan', t('tan(', 'tan('), 'Tangens'),
        fn('ln', 'ln', t('log(', 'ln('), 'natürlicher Logarithmus'),
        fn('log', 'log', t('log10(', 'log('), 'Zehnerlogarithmus'),
      ]
  const powers = second
    ? [
        fn('cube', 'x³', t('^3', '³'), 'hoch 3', true),
        fn('cbrt', '∛', t('cbrt(', '∛('), 'Kubikwurzel'),
        fn('inverse', '1/x', t('^(-1)', '⁻¹'), 'Kehrwert', true),
        fn('ten', 'EXP', t('*10^', '×10^'), 'mal 10 hoch', true),
        fn('e', 'e', t('e', 'e'), 'Eulersche Zahl'),
      ]
    : [
        fn('square', 'x²', t('^2', '²'), 'Quadrat', true),
        fn('power', 'xʸ', t('^', '^'), 'hoch', true),
        fn('sqrt', '√', t('sqrt(', '√('), 'Quadratwurzel'),
        fn('factorial', 'n!', t('!', '!'), 'Fakultät', true),
        fn('pi', 'π', t('pi', 'π'), 'Pi'),
      ]
  return [
    action('second', '2nd', 'second', 'function', 'Zweitbelegung'),
    action('angle', angle === 'deg' ? 'DEG' : 'RAD', 'angle', 'function', angle === 'deg' ? 'Winkel in Grad, umschalten auf Bogenmaß' : 'Winkel im Bogenmaß, umschalten auf Grad'),
    fn('open', '(', t('(', '('), 'Klammer auf'),
    fn('close', ')', t(')', ')'), 'Klammer zu', true),
    BACK,
    ...functions,
    ...powers,
    digit('7'), digit('8'), digit('9'), DIVIDE, CLEAR,
    digit('4'), digit('5'), digit('6'), MULTIPLY, PERCENT,
    digit('1'), digit('2'), digit('3'), MINUS, fn('ans', 'Ans', t('ans', 'Ans'), 'letztes Ergebnis'),
    SIGN, digit('0'), COMMA, PLUS, EQUALS,
  ]
}

export interface CalculatorState {
  tokens: Token[]
  /** Zeile über der Anzeige nach "=", z. B. "12 + 3 =" */
  previous: string
  /** Letztes Ergebnis (Taste „Ans“) */
  ans: number
  /** Gerade "=" gedrückt: Ziffern beginnen eine neue Rechnung */
  evaluated: boolean
  /** Fehlermeldung nach "=" */
  message: string
  second: boolean
  angle: AngleMode
}

export const INITIAL_STATE: CalculatorState = {
  tokens: [],
  previous: '',
  ans: 0,
  evaluated: false,
  message: '',
  second: false,
  angle: 'deg',
}

const display = (tokens: readonly Token[]) => tokens.map((token) => token.label).join('')

/** Ergebnis als Ziffern-Bausteine, damit ⌫ und ± damit arbeiten; Exponentialzahlen als Ganzes */
export function resultTokens(value: number): Token[] {
  const text = String(Math.abs(value))
  if (/e/i.test(text)) return [{ value: `(${value})`, label: formatResult(value) }]
  const digits = appendDigits([], text)
  return value < 0 ? toggleSign(digits) : digits
}

function appendDigits(tokens: Token[], text: string): Token[] {
  return [...text].reduce((acc, char) => appendDigit(acc, char), tokens)
}

/** Letzten Baustein löschen; in "(−5)" die letzte Ziffer, eine leere Klammer ganz */
function removeLast(tokens: readonly Token[]): Token[] {
  const last = tokens.at(-1)
  if (!last?.signClose) return tokens.slice(0, -1)
  const inner = tokens.slice(0, -2)
  return inner.at(-1)?.value === '(-' ? inner.slice(0, -1) : [...inner, last]
}

export function press(state: CalculatorState, key: Key): CalculatorState {
  const fresh = { ...state, message: '' }
  if (key.kind === 'digit') {
    const base = state.evaluated ? [] : state.tokens
    return { ...fresh, tokens: appendDigit(base, key.digit), evaluated: false }
  }
  if (key.kind === 'token') {
    const base = state.evaluated && !key.continues ? [] : state.tokens
    return { ...fresh, tokens: [...base, key.token], evaluated: false, second: false }
  }
  switch (key.action) {
    case 'clear':
      return { ...INITIAL_STATE, ans: state.ans, angle: state.angle }
    case 'back':
      return state.evaluated ? { ...fresh, tokens: [], evaluated: false } : { ...fresh, tokens: removeLast(state.tokens) }
    case 'sign':
      return { ...fresh, tokens: toggleSign(state.tokens), evaluated: false }
    case 'second':
      return { ...fresh, second: !state.second }
    case 'angle':
      return { ...fresh, angle: state.angle === 'deg' ? 'rad' : 'deg' }
    case 'equals': {
      if (state.evaluated || state.tokens.length === 0) return fresh
      const result = evaluate(state.tokens, { angle: state.angle, ans: state.ans })
      if (!result.ok) {
        return result.reason === 'empty' ? fresh : { ...fresh, message: EVALUATION_MESSAGES[result.reason] }
      }
      return {
        ...fresh,
        previous: `${display(state.tokens)} =`,
        tokens: resultTokens(result.value),
        ans: result.value,
        evaluated: true,
      }
    }
  }
}

/** Was die Anzeige zeigt: Eingabezeile und (vor "=") ein Zwischenergebnis */
export function screen(state: CalculatorState): { input: string; preview: string } {
  // Ergebnis mit Tausenderpunkten wie im Zwischenergebnis; die Bausteine bleiben ungegliedert
  if (state.evaluated) return { input: formatResult(state.ans), preview: '' }
  const input = display(state.tokens)
  if (state.tokens.length === 0) return { input: '0', preview: '' }
  const result = evaluate(state.tokens, { angle: state.angle, ans: state.ans })
  return { input, preview: result.ok ? formatResult(result.value) : '' }
}

/** Tastatur am Computer: Taste → Rechnertaste (nur Tasten, die es auf dem Feld gibt) */
export function keyForKeyboard(event: { key: string }, keys: readonly Key[]): Key | undefined {
  const map: Record<string, string> = {
    '/': 'divide', '*': 'multiply', '-': 'minus', '+': 'plus', '%': 'percent',
    Enter: 'equals', '=': 'equals', Backspace: 'back', Escape: 'clear', Delete: 'clear',
    ',': 'comma', '.': 'comma', '(': 'open', ')': 'close', '^': 'power', '!': 'factorial',
  }
  const id = /^[0-9]$/.test(event.key) ? `d${event.key}` : map[event.key]
  return id ? keys.find((key) => key.id === id) : undefined
}
