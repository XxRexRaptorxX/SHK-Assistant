/**
 * Vereinheitlicht Text für die Suche: Kleinschreibung, Umlaute und ß ausgeschrieben,
 * übrige Akzente entfernt. "Ausdehnungsgefäß" und "ausdehnungsgefaess" werden gleich.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLocaleLowerCase('de')
    // Bruchzeichen ausschreiben, damit "1 1/4" auch "1 ¼" findet
    .replace(/¼/g, '1/4')
    .replace(/½/g, '1/2')
    .replace(/¾/g, '3/4')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Entfernt die Fettdruck-Markierung **…** (für Suche und Listen). */
export function stripEmphasis(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, '$1')
}

/** Teilt Fließtext an Leerzeilen in Absätze. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}
