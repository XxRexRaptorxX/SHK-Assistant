export interface TextPart {
  text: string
  /** Gesetzt, wenn der Teil eine Webadresse ist */
  href?: string
}

const URL_PATTERN = /https?:\/\/[^\s<>"„“]+/g

/** Satzzeichen am Ende gehören nicht zur Adresse; ")" nur, wenn die Klammer nicht in der Adresse geöffnet wurde. */
function trimUrl(url: string): string {
  let end = url.length
  for (;;) {
    const last = url[end - 1]
    if (last && '.,;:!?'.includes(last)) {
      end -= 1
      continue
    }
    if (last === ')') {
      const candidate = url.slice(0, end)
      const opened = candidate.split('(').length - 1
      const closed = candidate.split(')').length - 1
      if (closed > opened) {
        end -= 1
        continue
      }
    }
    return url.slice(0, end)
  }
}

/**
 * Zerlegt einen Text in normale Teile und Webadressen, z. B. für klickbare Quellenangaben.
 * "Wikipedia „Ventil“, https://de.wikipedia.org/wiki/Ventil_(Technik); S. 3"
 * → Text, Adresse (inkl. Klammer), "; S. 3"
 */
export function splitLinks(text: string): TextPart[] {
  const parts: TextPart[] = []
  let position = 0
  for (const match of text.matchAll(URL_PATTERN)) {
    const url = trimUrl(match[0])
    if (match.index > position) parts.push({ text: text.slice(position, match.index) })
    parts.push({ text: url, href: url })
    position = match.index + url.length
  }
  if (position < text.length) parts.push({ text: text.slice(position) })
  return parts
}
