const DECIMAL_PATTERN = /^[+-]?(\d+([.,]\d*)?|[.,]\d+)([eE][+-]?\d+)?$/

/**
 * Liest eine Zahl aus einem Eingabefeld. Komma und Punkt gelten als Dezimaltrennzeichen;
 * Tausendertrennzeichen sind nicht erlaubt (mehrdeutig). Liefert undefined bei ungültiger Eingabe.
 */
export function parseDecimal(input: string): number | undefined {
  const text = input.trim().replace(/\s/g, '')
  if (!DECIMAL_PATTERN.test(text)) return undefined
  const value = Number(text.replace(',', '.'))
  return Number.isFinite(value) ? value : undefined
}

/** Deutsche Zahlendarstellung mit fester Anzahl Nachkommastellen, z. B. 1.234,50 */
export function formatNumber(value: number, decimals: number): string {
  return new Intl.NumberFormat('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}
