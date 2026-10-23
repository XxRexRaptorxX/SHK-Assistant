import { math } from '../../lib/math'

// Rechenkern für Taschenrechner und wissenschaftlichen Rechner.
// Die Eingabe ist eine Folge von Bausteinen: value ist mathjs-Schreibweise, label die Anzeige
// (z. B. value "sqrt(" / label "√("). So bleibt die Anzeige deutsch (Komma, ×, ÷) und mathjs
// rechnet ohne eval() mit eindeutiger Schreibweise.

export interface Token {
  value: string
  label: string
  /** Schließt die Klammer eines Vorzeichenwechsels "(−5)"; weitere Ziffern kommen davor */
  signClose?: boolean
}

export type AngleMode = 'deg' | 'rad'

/** Ganz kleine Reste von Winkelfunktionen (sin 180° = 1,2·10⁻¹⁶) auf 0 setzen */
const snap = (value: number) => (Math.abs(value) < 1e-12 ? 0 : value)

const DEG = Math.PI / 180

function angleScope(mode: AngleMode): Record<string, (x: number) => number> {
  const toRad = (x: number) => (mode === 'deg' ? x * DEG : x)
  const fromRad = (x: number) => (mode === 'deg' ? x / DEG : x)
  return {
    sin: (x) => snap(Math.sin(toRad(x))),
    cos: (x) => snap(Math.cos(toRad(x))),
    // tan(90°) ist nicht definiert, Math.tan liefert sonst 1,6·10¹⁶
    tan: (x) => (mode === 'deg' && Math.abs(x % 180) === 90 ? NaN : snap(Math.tan(toRad(x)))),
    asin: (x) => fromRad(Math.asin(x)),
    acos: (x) => fromRad(Math.acos(x)),
    atan: (x) => fromRad(Math.atan(x)),
  }
}

/** Fehlende schließende Klammern ergänzen, wie es Taschenrechner tun */
export function closeParentheses(expression: string): string {
  let open = 0
  for (const char of expression) {
    if (char === '(') open += 1
    else if (char === ')') open = Math.max(0, open - 1)
  }
  return expression + ')'.repeat(open)
}

export type Evaluation =
  | { ok: true; value: number }
  | { ok: false; reason: 'empty' | 'invalid' | 'undefined' }

/** Berechnet die Eingabe; nur reelle Zahlen gelten als Ergebnis */
export function evaluate(tokens: readonly Token[], options: { angle?: AngleMode; ans?: number } = {}): Evaluation {
  const expression = tokens.map((token) => token.value).join('')
  if (expression.trim() === '') return { ok: false, reason: 'empty' }
  try {
    const result: unknown = math.evaluate(closeParentheses(expression), {
      ...angleScope(options.angle ?? 'deg'),
      ans: options.ans ?? 0,
    })
    if (typeof result !== 'number') return { ok: false, reason: 'invalid' }
    if (!Number.isFinite(result)) return { ok: false, reason: 'undefined' }
    // Gleitkomma-Reste wie 0,1 + 0,2 = 0,30000000000000004 abschneiden
    return { ok: true, value: Number(result.toPrecision(12)) }
  } catch {
    return { ok: false, reason: 'invalid' }
  }
}

const plainFormat = new Intl.NumberFormat('de-DE', { maximumSignificantDigits: 12 })
const scientificFormat = new Intl.NumberFormat('de-DE', { notation: 'scientific', maximumSignificantDigits: 10 })

/** Deutsche Anzeige; sehr große und kleine Zahlen wissenschaftlich (1,5E15) */
export function formatResult(value: number): string {
  const size = Math.abs(value)
  return size !== 0 && (size >= 1e12 || size < 1e-9) ? scientificFormat.format(value) : plainFormat.format(value)
}

export const EVALUATION_MESSAGES = {
  invalid: 'Ungültige Eingabe',
  undefined: 'Nicht definiert',
} as const

/** Ergebnis als Baustein, um damit weiterzurechnen */
export function resultToken(value: number): Token {
  return { value: value < 0 ? `(${value})` : String(value), label: formatResult(value) }
}

/** Eine Zahl oder Komma als Baustein (Ziffern einzeln, damit ⌫ ziffernweise löscht) */
export function digitToken(digit: string): Token {
  return digit === ',' || digit === '.' ? { value: '.', label: ',' } : { value: digit, label: digit }
}

const isNumberPart = (token: Token) => /^[0-9.]$/.test(token.value)

const SIGN_OPEN: Token = { value: '(-', label: '(−' }
const SIGN_CLOSE: Token = { value: ')', label: ')', signClose: true }

/** Ziffer oder Komma anhängen; nach "(−5)" landet sie in der Klammer */
export function appendDigit(tokens: readonly Token[], digit: string): Token[] {
  const last = tokens.at(-1)
  if (last?.signClose) return [...tokens.slice(0, -1), digitToken(digit), last]
  return [...tokens, digitToken(digit)]
}

/** Vorzeichen der letzten Zahl umkehren: 5 → (−5) → 5 */
export function toggleSign(tokens: readonly Token[]): Token[] {
  const wrapped = tokens.at(-1)?.signClose === true
  const end = wrapped ? tokens.length - 1 : tokens.length
  let start = end
  while (start > 0 && isNumberPart(tokens[start - 1]!)) start -= 1
  if (start === end) return [...tokens]
  const digits = tokens.slice(start, end)
  if (wrapped && tokens[start - 1]?.value === SIGN_OPEN.value) return [...tokens.slice(0, start - 1), ...digits]
  return [...tokens.slice(0, start), SIGN_OPEN, ...digits, SIGN_CLOSE]
}
