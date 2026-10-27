// Ohne zod-Import, damit die App diese Konstante nutzen kann, ohne zod zu bündeln.
export const LEXICON_ID_PREFIX = 'lexicon'

/** Kategorien des Lexikons in Anzeigereihenfolge; ein Begriff kann in mehreren stehen */
export const LEXICON_CATEGORIES = [
  { key: 'heizung', label: 'Heizung' },
  { key: 'hydraulik', label: 'Hydraulik & Pumpen' },
  { key: 'trinkwasser', label: 'Trinkwasser & Sanitär' },
  { key: 'abwasser', label: 'Abwasser & Entwässerung' },
  { key: 'kaelte', label: 'Wärmepumpe & Kälte' },
  { key: 'lueftung', label: 'Lüftung & Klima' },
  { key: 'gas', label: 'Gas, Abgas & Verbrennung' },
  { key: 'solar', label: 'Solar & erneuerbare Energien' },
  { key: 'msr', label: 'Messen, Steuern, Regeln & Elektro' },
  { key: 'werkstoffe', label: 'Werkstoffe, Rohre & Verbindungen' },
  { key: 'werkzeuge', label: 'Werkzeuge & Maschinen' },
  { key: 'normen', label: 'Normen, Recht & Sicherheit' },
  { key: 'physik', label: 'Physik & Grundlagen' },
  { key: 'einheiten', label: 'Einheiten' },
  { key: 'kuerzel', label: 'Kürzel & Abkürzungen' },
] as const

export type LexiconCategory = (typeof LEXICON_CATEGORIES)[number]['key']

/** Schlüssel der Kategorie „Alles“ in der Adresse (?kategorie=alles) */
export const ALL_CATEGORIES = 'alles'
