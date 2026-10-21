/**
 * Vereinheitlicht Text für die Suche: Kleinschreibung, Umlaute und ß ausgeschrieben,
 * übrige Akzente entfernt. "Ausdehnungsgefäß" und "ausdehnungsgefaess" werden gleich.
 */
export function normalizeForSearch(text: string): string {
  return text
    .toLocaleLowerCase('de')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .trim()
}

/** Teilt Fließtext an Leerzeilen in Absätze. */
export function splitParagraphs(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
}
