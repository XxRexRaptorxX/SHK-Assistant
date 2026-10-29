// Quellenangaben sind Freitext. Für die Anzeige als Aufzählung werden sie an „; “ und an Satzenden
// getrennt – aber nicht in Klammern oder Anführungszeichen und nicht nach Abkürzungen wie „S.“ oder „Abs.“.

const ABBREVIATIONS = new Set([
  'a', 'abb', 'abs', 'aufl', 'b', 'bd', 'bl', 'bzw', 'ca', 'dipl', 'dr', 'evtl', 'f', 'ff', 'ggf', 'hrsg',
  'inkl', 'ing', 'kap', 'lt', 'max', 'min', 'mind', 'nr', 's', 'st', 'str', 'tab', 'u', 'vgl', 'vol', 'z',
])

const OPENING = '(„['
const CLOSING = ')“]'

/** Wort direkt vor dem Punkt an Position index (ohne Satzzeichen) */
function wordBefore(text: string, index: number): string {
  let start = index
  while (start > 0 && !/\s/.test(text[start - 1]!)) start -= 1
  return text.slice(start, index).replace(/^[(„"'[]+/, '')
}

/** Satzende: Punkt, Leerzeichen, Großbuchstabe – nicht nach Abkürzung oder Aufzählungszahl („1. BImSchV“) */
function isSentenceEnd(text: string, index: number): boolean {
  if (text[index + 1] !== ' ' || !/[A-ZÄÖÜ]/.test(text[index + 2] ?? '')) return false
  const word = wordBefore(text, index)
  if (word === '' || ABBREVIATIONS.has(word.toLowerCase())) return false
  if (/^\d{1,2}$/.test(word)) return false
  return true
}

/** Zerlegt eine Quellenangabe in einzelne Einträge; kurze Angaben bleiben ein Eintrag */
export function splitSources(source: string): string[] {
  const items: string[] = []
  let depth = 0
  let start = 0
  const push = (end: number) => {
    const item = source.slice(start, end).trim()
    if (item) items.push(item)
  }
  for (let index = 0; index < source.length; index += 1) {
    const char = source[index]!
    if (OPENING.includes(char)) depth += 1
    else if (CLOSING.includes(char)) depth = Math.max(0, depth - 1)
    else if (depth === 0 && char === ';' && source[index + 1] === ' ') {
      push(index)
      start = index + 1
    } else if (depth === 0 && char === '.' && isSentenceEnd(source, index)) {
      push(index + 1)
      start = index + 1
    }
  }
  push(source.length)
  return items
}
