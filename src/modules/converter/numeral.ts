import { NUMERAL_SYSTEMS } from './constants'

// Zahlensysteme – ganze Zahlen beliebiger Länge über BigInt, damit nichts gerundet wird.

export { NUMERAL_SYSTEMS }
export type NumeralSystem = (typeof NUMERAL_SYSTEMS)[number]

export const NUMERAL_BASES: Record<NumeralSystem, number> = {
  bin: 2,
  ter: 3,
  oct: 8,
  dec: 10,
  duo: 12,
  hex: 16,
}

export const NUMERAL_LABELS: Record<NumeralSystem, string> = {
  bin: 'Dual (Basis 2)',
  ter: 'Ternär (Basis 3)',
  oct: 'Oktal (Basis 8)',
  dec: 'Dezimal (Basis 10)',
  duo: 'Duodezimal (Basis 12)',
  hex: 'Hexadezimal (Basis 16)',
}

/** Längere Eingaben werden abgelehnt, damit die Ergebnistabelle lesbar bleibt */
export const MAX_DIGITS = 64

const DIGITS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Liest eine ganze Zahl im gewählten System, z. B. "FF" (hex), "1010 0101" (dual), "-12".
 * Leerzeichen und "_" trennen nur; im Dezimalsystem auch Tausenderpunkte. Groß-/Kleinschreibung egal.
 */
export function parseNumeral(raw: string, system: NumeralSystem): bigint | undefined {
  const separators = system === 'dec' ? /[\s_.]/g : /[\s_]/g
  const text = raw.replace(separators, '').toUpperCase()
  const negative = text.startsWith('-')
  const digits = negative ? text.slice(1) : text
  if (digits === '' || digits.length > MAX_DIGITS) return undefined
  const base = BigInt(NUMERAL_BASES[system])
  let value = 0n
  for (const char of digits) {
    const digit = DIGITS.indexOf(char)
    if (digit === -1 || digit >= NUMERAL_BASES[system]) return undefined
    value = value * base + BigInt(digit)
  }
  return negative ? -value : value
}

/** Schreibt die Zahl im System; dual in Vierergruppen, dezimal mit Tausenderpunkten */
export function formatNumeral(value: bigint, system: NumeralSystem): string {
  const sign = value < 0n ? '-' : ''
  const digits = (value < 0n ? -value : value).toString(NUMERAL_BASES[system]).toUpperCase()
  const group = system === 'bin' ? 4 : system === 'dec' ? 3 : 0
  if (group === 0) return sign + digits
  const separator = system === 'bin' ? ' ' : '.'
  const head = digits.length % group || group
  const groups = [digits.slice(0, head)]
  for (let i = head; i < digits.length; i += group) groups.push(digits.slice(i, i + group))
  return sign + groups.join(separator)
}
