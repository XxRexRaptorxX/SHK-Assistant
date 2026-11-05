import { Fragment, type ReactNode } from 'react'

// Indizes in Formelzeichen: „p_amb“ wird zu p mit tiefgestelltem „amb“. Der Index reicht bis zum
// nächsten Zeichen, das kein Buchstabe und keine Ziffer ist (z. B. „φ·p_s“, „ΔT_1 / ΔT_2“).
// Unicode-Indizes (ₐ, ₛ …) gibt es nicht für alle Buchstaben, daher einheitlich so.

const SUBSCRIPT = /_([\p{L}\p{N}]+)/gu

/** Text mit Formelzeichen, Indizes tiefgestellt */
export function renderSymbol(text: string): ReactNode {
  if (!text.includes('_')) return text
  const parts: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(SUBSCRIPT)) {
    parts.push(<Fragment key={`t${last}`}>{text.slice(last, match.index)}</Fragment>)
    parts.push(<sub key={`s${match.index}`}>{match[1]}</sub>)
    last = match.index + match[0].length
  }
  parts.push(<Fragment key={`t${last}`}>{text.slice(last)}</Fragment>)
  return <>{parts}</>
}
