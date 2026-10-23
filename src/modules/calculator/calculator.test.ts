import { describe, expect, it } from 'vitest'
import { closeParentheses, evaluate, formatResult, toggleSign, appendDigit, type Token } from './engine'
import { compileFunction, normalizeFunction, sampleFunction, tickStep, ticks, zoomView, DEFAULT_VIEW } from './graph'
import { INITIAL_STATE, keyForKeyboard, press, resultTokens, scientificKeys, screen, STANDARD_KEYS, type CalculatorState, type Key } from './keypad'

const keyById = (keys: Key[], id: string) => {
  const key = keys.find((k) => k.id === id)
  if (!key) throw new Error(`Taste ${id} fehlt`)
  return key
}

/** Tippt eine Folge von Tasten-ids, z. B. "d1 plus d2 equals" */
function type(sequence: string, keys: Key[] = STANDARD_KEYS, start: CalculatorState = INITIAL_STATE): CalculatorState {
  return sequence.split(' ').reduce((state, id) => press(state, keyById(keys, id)), start)
}

const tokens = (...values: string[]): Token[] => values.map((value) => ({ value, label: value }))

describe('Rechenkern', () => {
  it('rechnet Punkt vor Strich und ohne Gleitkomma-Reste', () => {
    expect(evaluate(tokens('2', '+', '3', '*', '4'))).toEqual({ ok: true, value: 14 })
    expect(evaluate(tokens('0', '.', '1', '+', '0', '.', '2'))).toEqual({ ok: true, value: 0.3 })
  })

  it('rechnet Prozent wie ein Taschenrechner', () => {
    expect(evaluate(tokens('200', '-', '15', '%'))).toEqual({ ok: true, value: 170 })
    expect(evaluate(tokens('50', '+', '10', '%'))).toEqual({ ok: true, value: 55 })
  })

  it('rechnet Winkel in Grad oder Bogenmaß ohne Rundungsreste', () => {
    expect(evaluate(tokens('sin(', '30', ')'))).toEqual({ ok: true, value: 0.5 })
    expect(evaluate(tokens('sin(', '180', ')'))).toEqual({ ok: true, value: 0 })
    expect(evaluate(tokens('cos(', 'pi', ')'), { angle: 'rad' })).toEqual({ ok: true, value: -1 })
    expect(evaluate(tokens('asin(', '1', ')'))).toEqual({ ok: true, value: 90 })
    expect(evaluate(tokens('tan(', '90', ')'))).toEqual({ ok: false, reason: 'undefined' })
  })

  it('schließt offene Klammern und meldet Unsinn', () => {
    expect(closeParentheses('sqrt(2*(3')).toBe('sqrt(2*(3))')
    expect(evaluate(tokens('sqrt(', '16'))).toEqual({ ok: true, value: 4 })
    expect(evaluate(tokens('1', '/', '0'))).toEqual({ ok: false, reason: 'undefined' })
    expect(evaluate(tokens('*', '*'))).toEqual({ ok: false, reason: 'invalid' })
    expect(evaluate([])).toEqual({ ok: false, reason: 'empty' })
  })

  it('zeigt Zahlen deutsch, große und kleine wissenschaftlich', () => {
    expect(formatResult(1234567.5)).toBe('1.234.567,5')
    expect(formatResult(0.3)).toBe('0,3')
    expect(formatResult(1.5e15)).toBe('1,5E15')
    expect(formatResult(2e-12)).toBe('2E-12')
  })

  it('wechselt das Vorzeichen der letzten Zahl in Klammern und hängt Ziffern hinein', () => {
    const five = appendDigit([], '5')
    const negative = toggleSign(five)
    expect(negative.map((t) => t.value).join('')).toBe('(-5)')
    expect(appendDigit(negative, '0').map((t) => t.value).join('')).toBe('(-50)')
    expect(toggleSign(negative).map((t) => t.value).join('')).toBe('5')
  })
})

describe('Taschenrechner-Tasten', () => {
  it('rechnet und zeigt die Rechnung über dem Ergebnis', () => {
    const state = type('d1 d2 plus d3 equals')
    expect(screen(state).input).toBe('15')
    expect(state.previous).toBe('12+3 =')
    expect(state.ans).toBe(15)
  })

  it('zeigt vor "=" ein Zwischenergebnis', () => {
    expect(screen(type('d7 multiply d6'))).toEqual({ input: '7×6', preview: '42' })
  })

  it('beginnt nach "=" mit einer Ziffer neu und rechnet mit einem Operator weiter', () => {
    expect(screen(type('d2 plus d2 equals d5')).input).toBe('5')
    expect(screen(type('d2 plus d2 equals multiply d3 equals')).input).toBe('12')
  })

  it('rechnet mit Komma, ±, Prozent und löscht mit ⌫ und AC', () => {
    expect(screen(type('d1 comma d5 multiply d4 equals')).input).toBe('6')
    expect(screen(type('d5 sign')).input).toBe('(−5)')
    expect(screen(type('d5 sign multiply d2 equals')).input).toBe('-10')
    expect(screen(type('d1 d0 d0 d0 multiply d3 equals')).input).toBe('3.000')
    expect(type('d2 d0 d0 minus d1 d5 percent equals').ans).toBe(170)
    expect(screen(type('d1 d2 d3 back')).input).toBe('12')
    expect(type('d1 d2 clear').tokens).toEqual([])
  })

  it('meldet Fehler, statt falsch zu rechnen', () => {
    expect(type('d1 divide d0 equals').message).toBe('Nicht definiert')
    expect(type('multiply equals').message).toBe('Ungültige Eingabe')
  })

  it('zerlegt Ergebnisse in Ziffern, damit ⌫ und ± damit arbeiten', () => {
    expect(resultTokens(-2.5).map((t) => t.label).join('')).toBe('(−2,5)')
    expect(resultTokens(1e21)).toEqual([{ value: '(1e+21)', label: '1E21' }])
  })

  it('nimmt Tasten der Computertastatur an', () => {
    expect(keyForKeyboard({ key: '7' }, STANDARD_KEYS)?.id).toBe('d7')
    expect(keyForKeyboard({ key: 'Enter' }, STANDARD_KEYS)?.id).toBe('equals')
    expect(keyForKeyboard({ key: '(' }, STANDARD_KEYS)).toBeUndefined()
  })
})

describe('Wissenschaftlicher Rechner', () => {
  const keys = (state: CalculatorState) => scientificKeys(state.second, state.angle)
  const run = (sequence: string) =>
    sequence.split(' ').reduce((state, id) => press(state, keyById(keys(state), id)), INITIAL_STATE)

  it('rechnet Funktionen, Potenzen und Konstanten', () => {
    expect(run('sin d3 d0 close equals').ans).toBe(0.5)
    expect(run('d2 power d1 d0 equals').ans).toBe(1024)
    expect(run('d5 factorial equals').ans).toBe(120)
    expect(run('sqrt d2 equals').ans).toBe(1.41421356237)
    expect(run('d2 pi equals').ans).toBe(6.28318530718)
    expect(run('log d1 d0 d0 d0 equals').ans).toBe(3)
  })

  it('schaltet Zweitbelegung und Winkelmaß um', () => {
    expect(run('second asin d1 equals').ans).toBe(90)
    expect(run('angle second asin d1 equals').ans).toBe(1.57079632679)
    // Zweitbelegung gilt nur für eine Taste
    expect(run('second cube').second).toBe(false)
  })

  it('rechnet mit dem letzten Ergebnis (Ans)', () => {
    expect(run('d4 equals ans multiply d2 equals').ans).toBe(8)
  })
})

describe('Grafikrechner', () => {
  it('liest Eingaben mit Dezimalkomma, Semikolon und f(x) =', () => {
    expect(normalizeFunction('0,5x^2 − 2·x')).toBe('0.5x^2 - 2*x')
    expect(normalizeFunction('nthRoot(x; 3) + ln(x)')).toBe('nthRoot(x, 3) + log(x)')
    const compiled = compileFunction('f(x) = 0,5x^2')
    expect(compiled.ok && compiled.fn(4)).toBe(8)
  })

  it('meldet unbekannte Zeichen und leere Eingaben', () => {
    expect(compileFunction('x + y')).toEqual({ ok: false, error: 'Unbekannt: „y“ (nur x erlaubt)' })
    expect(compileFunction('  ')).toEqual({ ok: false, error: '' })
    expect(compileFunction('x +')).toEqual({ ok: false, error: 'Eingabe nicht lesbar' })
  })

  it('teilt Achsen in gut lesbare Schritte', () => {
    expect(tickStep(20)).toBe(2)
    expect(tickStep(1)).toBe(0.1)
    expect(tickStep(150)).toBe(20)
    expect(ticks(-1, 1, 0.5)).toEqual([-1, -0.5, 0, 0.5, 1])
  })

  it('unterbricht Kurven an Polstellen und undefinierten Stellen', () => {
    const hyperbola = sampleFunction((x) => 1 / x, DEFAULT_VIEW, 100)
    expect(hyperbola).toHaveLength(2)
    const root = sampleFunction((x) => Math.sqrt(x), DEFAULT_VIEW, 100)
    expect(root).toHaveLength(1)
    expect(root[0]![0]![0]).toBeGreaterThanOrEqual(0)
  })

  it('zoomt um einen Punkt', () => {
    expect(zoomView(DEFAULT_VIEW, 0.5, { x: 0, y: 0 })).toEqual({ xMin: -5, xMax: 5, yMin: -3.75, yMax: 3.75 })
  })
})
