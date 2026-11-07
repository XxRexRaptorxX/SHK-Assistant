/**
 * Ein Feld für CSV mit Semikolon (Excel in deutscher Einstellung). Text, den Excel als Formel lesen würde,
 * bekommt ein Hochkomma davor; Semikolon, Anführungszeichen und Zeilenumbruch werden in Anführungszeichen gesetzt.
 */
export function csvText(text: string): string {
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text
  return /[;"\r\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

/** Zeilen zu einer CSV-Datei mit BOM (damit Excel die Umlaute erkennt) und CRLF */
export function csvFile(lines: readonly string[]): string {
  return `﻿${lines.join('\r\n')}\r\n`
}
